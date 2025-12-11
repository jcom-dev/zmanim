import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

export interface ApiGatewayStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  elasticIp: string; // EC2 Elastic IP from ComputeStack
}

/**
 * ApiGatewayStack - HTTP API Gateway with JWT authorizer, throttling, CORS, logging
 *
 * Story 7.7: API Gateway Configuration
 *
 * Architecture:
 * - HTTP API (NOT REST API) for lower latency (~10ms vs ~30ms) and cost ($1 vs $3.50/million)
 * - JWT Authorizer validates Clerk tokens for protected routes
 * - HTTP URL Integration proxies requests to EC2:8080
 * - Throttling: 500 rps rate limit, 1000 burst
 * - CORS: Configured for frontend domain
 * - CloudWatch access logging with 30-day retention
 *
 * Request Flow:
 * CloudFront → API Gateway HTTP API
 *                  ↓
 *             JWT Authorizer (for /api/publisher/*, /api/admin/*)
 *                  ↓
 *             HTTP Proxy → EC2:8080 (with X-Origin-Verify header)
 *
 * Origin Verification:
 * - API Gateway injects X-Origin-Verify header from SSM parameter
 * - Go API middleware validates this header, rejecting direct access
 * - This ensures EC2 can only be accessed through API Gateway
 *
 * Route Configuration:
 * | Route                | Authorizer    | Purpose              |
 * |----------------------|---------------|----------------------|
 * | GET /api/zmanim/*    | None (public) | Zmanim calculations  |
 * | GET /api/cities/*    | None (public) | City search          |
 * | GET /api/publishers  | None (public) | Publisher listing    |
 * | GET /api/countries/* | None (public) | Country data         |
 * | GET /api/continents  | None (public) | Continent listing    |
 * | GET /api/regions/*   | None (public) | Region data          |
 * | GET /api/coverage/*  | None (public) | Coverage search      |
 * | GET /api/geo/*       | None (public) | Map boundaries       |
 * | ANY /api/publisher/* | Clerk JWT     | Publisher management |
 * | ANY /api/admin/*     | Clerk JWT     | Admin operations     |
 */
export class ApiGatewayStack extends cdk.Stack {
  public readonly httpApi: apigatewayv2.HttpApi;
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    const { config, elasticIp } = props;

    // =========================================================================
    // Task 6: CloudWatch Log Group for Access Logging (AC6)
    // =========================================================================
    // - 30-day retention (AC6.4)
    // - JSON format for structured logging
    this.logGroup = new logs.LogGroup(this, 'ApiAccessLogs', {
      logGroupName: `/aws/apigateway/zmanim-api-${config.environment}`,
      retention: logs.RetentionDays.ONE_MONTH, // AC6.4: 30 days
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Allow cleanup on stack deletion
    });

    // =========================================================================
    // Task 1: HTTP API (AC1)
    // =========================================================================
    // - HTTP API (not REST) for lower latency (~10ms vs ~30ms)
    // - Built-in JWT authorizer support
    // - Lower cost ($1/million vs $3.50/million)

    // Task 5: CORS Configuration (AC5)
    // - Allowed origins: https://zmanim.shtetl.io
    // - Allowed methods: GET, POST, PUT, DELETE, OPTIONS
    // - Allowed headers: Authorization, Content-Type, X-Publisher-Id
    const corsPreflight: apigatewayv2.CorsPreflightOptions = {
      allowOrigins: ['https://zmanim.shtetl.io'], // AC5.2
      allowMethods: [
        apigatewayv2.CorsHttpMethod.GET,
        apigatewayv2.CorsHttpMethod.POST,
        apigatewayv2.CorsHttpMethod.PUT,
        apigatewayv2.CorsHttpMethod.DELETE,
        apigatewayv2.CorsHttpMethod.OPTIONS,
      ], // AC5.3
      allowHeaders: ['Authorization', 'Content-Type', 'X-Publisher-Id'], // AC5.4
      exposeHeaders: ['X-Request-Id', 'X-Amzn-RequestId'], // AC5.5: Expose headers for error responses
      maxAge: cdk.Duration.hours(1), // Cache preflight for 1 hour
      allowCredentials: true,
    };

    // Create HTTP API with CORS
    this.httpApi = new apigatewayv2.HttpApi(this, 'ZmanimApi', {
      apiName: `zmanim-api-${config.environment}`,
      description: 'Zmanim Lab API Gateway - routes requests to EC2 backend',
      corsPreflight,
    });

    // =========================================================================
    // Task 4 & Task 6: Configure Stage with Throttling and Access Logging
    // =========================================================================
    // Access logging and throttling require stage configuration
    const defaultStage = this.httpApi.defaultStage?.node.defaultChild as apigatewayv2.CfnStage;
    if (defaultStage) {
      // Task 4: Throttling (AC4)
      // - Rate limit: 500 requests per second
      // - Burst limit: 1000 requests
      defaultStage.defaultRouteSettings = {
        throttlingRateLimit: 500, // AC4.2: 500 rps
        throttlingBurstLimit: 1000, // AC4.3: 1000 burst
      };

      // Task 6.2-6.3: Access Logging (AC6)
      // AC6.3: JSON format with request ID, method, path, status, latency
      defaultStage.accessLogSettings = {
        destinationArn: this.logGroup.logGroupArn,
        format: JSON.stringify({
          requestId: '$context.requestId',
          ip: '$context.identity.sourceIp',
          requestTime: '$context.requestTime',
          httpMethod: '$context.httpMethod',
          routeKey: '$context.routeKey',
          status: '$context.status',
          protocol: '$context.protocol',
          responseLength: '$context.responseLength',
          integrationLatency: '$context.integrationLatency',
          integrationStatus: '$context.integrationStatus',
          error: '$context.error.message',
          authError: '$context.authorizer.error',
        }),
      };
    }

    // =========================================================================
    // Task 2: EC2 Integration (AC2)
    // =========================================================================
    // - HTTP proxy integration to EC2 Elastic IP:8080
    // - Timeout: 29 seconds (max allowed by API Gateway, close to Go API 30s timeout)
    //
    // IMPORTANT: Go API route structure:
    // - /health (health check endpoint, NO /api prefix)
    // - /api/v1/* (all API endpoints with v1 version prefix)
    //
    // API Gateway maps:
    // - /api/health -> /health (direct)
    // - /api/* -> /api/v1/* (proxy with path rewrite)
    //
    // Origin Verification:
    // All integrations inject X-Origin-Verify header from SSM parameter.
    // Go API middleware validates this header to reject direct EC2 access.

    // Get origin verify key from SSM Parameter Store
    const originVerifyKey = ssm.StringParameter.valueForStringParameter(
      this,
      `/zmanim/${config.environment}/origin-verify-key`
    );

    // Common parameter mapping: inject X-Origin-Verify header
    const originVerifyMapping = new apigatewayv2.ParameterMapping()
      .appendHeader('X-Origin-Verify', apigatewayv2.MappingValue.custom(originVerifyKey));

    // Integration for /api/health -> /health (Go API health endpoint has no /api prefix)
    const ec2HealthIntegration = new integrations.HttpUrlIntegration('EC2HealthIntegration', `http://${elasticIp}:8080/health`, {
      method: apigatewayv2.HttpMethod.GET,
      timeout: cdk.Duration.seconds(29),
      parameterMapping: originVerifyMapping,
    });

    // Integration for routes WITH {proxy+} path parameter
    // Maps /api/X/{proxy+} -> /api/v1/X/{proxy}
    const ec2ApiV1ProxyIntegration = new integrations.HttpUrlIntegration('EC2ApiV1ProxyIntegration', `http://${elasticIp}:8080/api/v1/{proxy}`, {
      method: apigatewayv2.HttpMethod.ANY,
      timeout: cdk.Duration.seconds(29), // AC2.4: 29 seconds (max allowed by API Gateway)
      parameterMapping: originVerifyMapping,
    });

    // Integration for exact path routes (no proxy)
    // /api/publishers -> /api/v1/publishers
    const ec2PublishersIntegration = new integrations.HttpUrlIntegration('EC2PublishersIntegration', `http://${elasticIp}:8080/api/v1/publishers`, {
      method: apigatewayv2.HttpMethod.GET,
      timeout: cdk.Duration.seconds(29),
      parameterMapping: originVerifyMapping,
    });

    // /api/countries -> /api/v1/countries
    const ec2CountriesIntegration = new integrations.HttpUrlIntegration('EC2CountriesIntegration', `http://${elasticIp}:8080/api/v1/countries`, {
      method: apigatewayv2.HttpMethod.GET,
      timeout: cdk.Duration.seconds(29),
      parameterMapping: originVerifyMapping,
    });

    // =========================================================================
    // Task 3: Clerk JWT Authorizer (AC3)
    // =========================================================================
    // - Validates Clerk JWTs for protected routes
    // - Issuer and audience from SSM Parameter Store (security best practice)

    // Get Clerk configuration from SSM Parameter Store
    // These will be resolved at deploy time
    const clerkDomain = ssm.StringParameter.valueForStringParameter(
      this,
      `/zmanim/${config.environment}/clerk-domain`
    );
    const clerkAudience = ssm.StringParameter.valueForStringParameter(
      this,
      `/zmanim/${config.environment}/clerk-audience`
    );

    // Create JWT authorizer for Clerk
    // AC3.1-3.3: JWT authorizer with Clerk issuer and audience
    const clerkAuthorizer = new authorizers.HttpJwtAuthorizer('ClerkAuthorizer', `https://${clerkDomain}`, {
      jwtAudience: [clerkAudience], // AC3.3: Clerk frontend API audience
      identitySource: ['$request.header.Authorization'], // Standard Authorization header
      authorizerName: `zmanim-clerk-authorizer-${config.environment}`,
    });

    // =========================================================================
    // Task 2.3 & 3.4-3.5: Route Configuration
    // =========================================================================
    // Public routes (no authorizer):
    // - GET /api/zmanim/* - Zmanim calculations
    // - GET /api/cities/* - City search
    // - GET /api/publishers/* - Publisher listing (public read)
    // - GET /api/countries/* - Country listing
    // - GET /api/health - Health check
    //
    // Protected routes (JWT authorizer):
    // - ANY /api/publisher/* - Publisher management (singular, authenticated)
    // - ANY /api/admin/* - Admin operations

    // Public routes - no authorizer (AC3.5)
    // Health check: /api/health -> /health
    this.httpApi.addRoutes({
      path: '/api/health',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2HealthIntegration,
      // No authorizer - health check endpoint
    });

    // Zmanim calculations: /api/zmanim/{proxy+} -> /api/v1/zmanim/{proxy}
    this.httpApi.addRoutes({
      path: '/api/zmanim/{proxy+}',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
      integration: ec2ApiV1ProxyIntegration,
      // No authorizer - public endpoint
    });

    // Cities: /api/cities/{proxy+} -> /api/v1/cities/{proxy}
    this.httpApi.addRoutes({
      path: '/api/cities/{proxy+}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2ApiV1ProxyIntegration,
      // No authorizer - public endpoint
    });

    // Publishers list: /api/publishers -> /api/v1/publishers
    this.httpApi.addRoutes({
      path: '/api/publishers',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2PublishersIntegration,
      // No authorizer - public endpoint
    });

    // Publishers detail: /api/publishers/{proxy+} -> /api/v1/publishers/{proxy}
    this.httpApi.addRoutes({
      path: '/api/publishers/{proxy+}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2ApiV1ProxyIntegration,
      // No authorizer - public endpoint (read-only)
    });

    // Countries list: /api/countries -> /api/v1/countries
    this.httpApi.addRoutes({
      path: '/api/countries',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2CountriesIntegration,
      // No authorizer - public endpoint
    });

    // Countries detail: /api/countries/{proxy+} -> /api/v1/countries/{proxy}
    this.httpApi.addRoutes({
      path: '/api/countries/{proxy+}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2ApiV1ProxyIntegration,
      // No authorizer - public endpoint
    });

    // Continents: /api/continents -> /api/v1/continents
    // Integration for exact path (no proxy)
    const ec2ContinentsIntegration = new integrations.HttpUrlIntegration('EC2ContinentsIntegration', `http://${elasticIp}:8080/api/v1/continents`, {
      method: apigatewayv2.HttpMethod.GET,
      timeout: cdk.Duration.seconds(29),
      parameterMapping: originVerifyMapping,
    });

    this.httpApi.addRoutes({
      path: '/api/continents',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2ContinentsIntegration,
      // No authorizer - public endpoint
    });

    // Regions: /api/regions -> /api/v1/regions
    const ec2RegionsIntegration = new integrations.HttpUrlIntegration('EC2RegionsIntegration', `http://${elasticIp}:8080/api/v1/regions`, {
      method: apigatewayv2.HttpMethod.GET,
      timeout: cdk.Duration.seconds(29),
      parameterMapping: originVerifyMapping,
    });

    this.httpApi.addRoutes({
      path: '/api/regions',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2RegionsIntegration,
      // No authorizer - public endpoint
    });

    // Regions detail: /api/regions/{proxy+} -> /api/v1/regions/{proxy}
    this.httpApi.addRoutes({
      path: '/api/regions/{proxy+}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2ApiV1ProxyIntegration,
      // No authorizer - public endpoint
    });

    // Coverage search: /api/coverage/{proxy+} -> /api/v1/coverage/{proxy}
    this.httpApi.addRoutes({
      path: '/api/coverage/{proxy+}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2ApiV1ProxyIntegration,
      // No authorizer - public endpoint (read-only coverage search)
    });

    // Geographic boundaries: /api/geo/{proxy+} -> /api/v1/geo/{proxy}
    this.httpApi.addRoutes({
      path: '/api/geo/{proxy+}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2ApiV1ProxyIntegration,
      // No authorizer - public endpoint (map boundaries)
    });

    // Protected routes - with JWT authorizer (AC3.4)
    // Publisher management: /api/publisher/{proxy+} -> /api/v1/publisher/{proxy}
    this.httpApi.addRoutes({
      path: '/api/publisher/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: ec2ApiV1ProxyIntegration,
      authorizer: clerkAuthorizer, // JWT required
    });

    // Admin operations: /api/admin/{proxy+} -> /api/v1/admin/{proxy}
    this.httpApi.addRoutes({
      path: '/api/admin/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: ec2ApiV1ProxyIntegration,
      authorizer: clerkAuthorizer, // JWT required
    });

    // Catch-all for other API routes (registry, dsl, ai, calendar, etc.)
    // /api/{proxy+} -> /api/v1/{proxy}
    // This ensures any new endpoints work without explicit route definitions
    this.httpApi.addRoutes({
      path: '/api/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: ec2ApiV1ProxyIntegration,
      authorizer: clerkAuthorizer, // Default to authenticated for safety
    });

    // =========================================================================
    // /backend/* routes - Alternative path for CloudFront routing
    // =========================================================================
    // cdk-nextjs-standalone claims the 'api/*' CloudFront behavior for Next.js.
    // We use '/backend/*' as an alternative path that CloudFront routes to API Gateway.
    // These mirror the /api/* routes above.

    // Integration for /backend/{proxy+} -> /api/v1/{proxy}
    const ec2BackendProxyIntegration = new integrations.HttpUrlIntegration('EC2BackendProxyIntegration', `http://${elasticIp}:8080/api/v1/{proxy}`, {
      method: apigatewayv2.HttpMethod.ANY,
      timeout: cdk.Duration.seconds(29),
      parameterMapping: originVerifyMapping,
    });

    // Health check: /backend/health -> /health
    this.httpApi.addRoutes({
      path: '/backend/health',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2HealthIntegration,
    });

    // Public routes via /backend/*
    this.httpApi.addRoutes({
      path: '/backend/zmanim/{proxy+}',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
      integration: ec2BackendProxyIntegration,
    });

    this.httpApi.addRoutes({
      path: '/backend/cities/{proxy+}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2BackendProxyIntegration,
    });

    this.httpApi.addRoutes({
      path: '/backend/publishers',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpUrlIntegration('EC2BackendPublishersIntegration', `http://${elasticIp}:8080/api/v1/publishers`, {
        method: apigatewayv2.HttpMethod.GET,
        timeout: cdk.Duration.seconds(29),
        parameterMapping: originVerifyMapping,
      }),
    });

    this.httpApi.addRoutes({
      path: '/backend/publishers/{proxy+}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2BackendProxyIntegration,
    });

    this.httpApi.addRoutes({
      path: '/backend/countries',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpUrlIntegration('EC2BackendCountriesIntegration', `http://${elasticIp}:8080/api/v1/countries`, {
        method: apigatewayv2.HttpMethod.GET,
        timeout: cdk.Duration.seconds(29),
        parameterMapping: originVerifyMapping,
      }),
    });

    this.httpApi.addRoutes({
      path: '/backend/countries/{proxy+}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2BackendProxyIntegration,
    });

    this.httpApi.addRoutes({
      path: '/backend/continents',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpUrlIntegration('EC2BackendContinentsIntegration', `http://${elasticIp}:8080/api/v1/continents`, {
        method: apigatewayv2.HttpMethod.GET,
        timeout: cdk.Duration.seconds(29),
        parameterMapping: originVerifyMapping,
      }),
    });

    this.httpApi.addRoutes({
      path: '/backend/regions',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpUrlIntegration('EC2BackendRegionsIntegration', `http://${elasticIp}:8080/api/v1/regions`, {
        method: apigatewayv2.HttpMethod.GET,
        timeout: cdk.Duration.seconds(29),
        parameterMapping: originVerifyMapping,
      }),
    });

    this.httpApi.addRoutes({
      path: '/backend/regions/{proxy+}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2BackendProxyIntegration,
    });

    this.httpApi.addRoutes({
      path: '/backend/coverage/{proxy+}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2BackendProxyIntegration,
    });

    this.httpApi.addRoutes({
      path: '/backend/geo/{proxy+}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2BackendProxyIntegration,
    });

    // Protected routes via /backend/*
    this.httpApi.addRoutes({
      path: '/backend/publisher/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: ec2BackendProxyIntegration,
      authorizer: clerkAuthorizer,
    });

    this.httpApi.addRoutes({
      path: '/backend/admin/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: ec2BackendProxyIntegration,
      authorizer: clerkAuthorizer,
    });

    // Catch-all for /backend/* routes
    this.httpApi.addRoutes({
      path: '/backend/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: ec2BackendProxyIntegration,
      authorizer: clerkAuthorizer, // Default to authenticated for safety
    });

    // =========================================================================
    // CloudFormation Outputs
    // =========================================================================
    new cdk.CfnOutput(this, 'ApiGatewayEndpoint', {
      value: this.httpApi.apiEndpoint,
      exportName: `${config.stackPrefix}-ApiGatewayEndpoint`,
      description: 'HTTP API invoke URL for CloudFront origin',
    });

    new cdk.CfnOutput(this, 'ApiGatewayId', {
      value: this.httpApi.apiId,
      exportName: `${config.stackPrefix}-ApiGatewayId`,
      description: 'API Gateway ID for monitoring',
    });

    new cdk.CfnOutput(this, 'LogGroupName', {
      value: this.logGroup.logGroupName,
      exportName: `${config.stackPrefix}-ApiLogGroup`,
      description: 'CloudWatch log group name for access logs',
    });

    new cdk.CfnOutput(this, 'LogGroupArn', {
      value: this.logGroup.logGroupArn,
      description: 'CloudWatch log group ARN',
    });

    // =========================================================================
    // Tags
    // =========================================================================
    cdk.Tags.of(this).add('Project', 'zmanim');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
    cdk.Tags.of(this).add('Story', '7.7');
  }
}
