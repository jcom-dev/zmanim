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
 *             HTTP Proxy → EC2:8080
 *
 * Route Configuration:
 * | Route                | Authorizer    | Purpose              |
 * |----------------------|---------------|----------------------|
 * | GET /api/zmanim/*    | None (public) | Zmanim calculations  |
 * | GET /api/cities/*    | None (public) | City search          |
 * | GET /api/publishers  | None (public) | Publisher listing    |
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
    // NOTE: We need TWO integrations:
    // 1. Proxy integration for routes with {proxy+} path parameter
    // 2. Direct integration for routes without path parameters (e.g., /api/health)

    // Integration for routes WITH {proxy+} path parameter
    const ec2ProxyIntegration = new integrations.HttpUrlIntegration('EC2ProxyIntegration', `http://${elasticIp}:8080/{proxy}`, {
      method: apigatewayv2.HttpMethod.ANY,
      timeout: cdk.Duration.seconds(29), // AC2.4: 29 seconds (max allowed by API Gateway)
    });

    // Integration for routes WITHOUT path parameters (direct path mapping)
    // Uses parameterMapping to forward the exact path
    const ec2DirectIntegration = new integrations.HttpUrlIntegration('EC2DirectIntegration', `http://${elasticIp}:8080/api/health`, {
      method: apigatewayv2.HttpMethod.GET,
      timeout: cdk.Duration.seconds(29),
    });

    const ec2PublishersIntegration = new integrations.HttpUrlIntegration('EC2PublishersIntegration', `http://${elasticIp}:8080/api/publishers`, {
      method: apigatewayv2.HttpMethod.GET,
      timeout: cdk.Duration.seconds(29),
    });

    const ec2CountriesIntegration = new integrations.HttpUrlIntegration('EC2CountriesIntegration', `http://${elasticIp}:8080/api/countries`, {
      method: apigatewayv2.HttpMethod.GET,
      timeout: cdk.Duration.seconds(29),
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
    // Routes WITH {proxy+} use ec2ProxyIntegration
    this.httpApi.addRoutes({
      path: '/api/zmanim/{proxy+}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2ProxyIntegration,
      // No authorizer - public endpoint
    });

    this.httpApi.addRoutes({
      path: '/api/cities/{proxy+}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2ProxyIntegration,
      // No authorizer - public endpoint
    });

    this.httpApi.addRoutes({
      path: '/api/publishers/{proxy+}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2ProxyIntegration,
      // No authorizer - public endpoint (read-only)
    });

    // Routes WITHOUT path params use direct integrations
    this.httpApi.addRoutes({
      path: '/api/publishers',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2PublishersIntegration,
      // No authorizer - public endpoint
    });

    this.httpApi.addRoutes({
      path: '/api/countries/{proxy+}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2ProxyIntegration,
      // No authorizer - public endpoint
    });

    this.httpApi.addRoutes({
      path: '/api/countries',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2CountriesIntegration,
      // No authorizer - public endpoint
    });

    this.httpApi.addRoutes({
      path: '/api/health',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ec2DirectIntegration,
      // No authorizer - health check endpoint
    });

    // Protected routes - with JWT authorizer (AC3.4)
    this.httpApi.addRoutes({
      path: '/api/publisher/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: ec2ProxyIntegration,
      authorizer: clerkAuthorizer, // JWT required
    });

    this.httpApi.addRoutes({
      path: '/api/admin/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: ec2ProxyIntegration,
      authorizer: clerkAuthorizer, // JWT required
    });

    // Catch-all for other authenticated API routes
    // This ensures any new protected endpoints are authenticated by default
    this.httpApi.addRoutes({
      path: '/api/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: ec2ProxyIntegration,
      authorizer: clerkAuthorizer, // Default to authenticated
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
