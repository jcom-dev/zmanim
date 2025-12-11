import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ApiGatewayStack } from '../lib/api-gateway-stack';
import { getConfig } from '../lib/config';

/**
 * Story 7.7: API Gateway Configuration Tests
 *
 * These tests verify:
 * - AC1: HTTP API (not REST) created
 * - AC2: Integration proxies to EC2 Elastic IP
 * - AC3: Clerk JWT authorizer configured
 * - AC4: Throttling limits (500 rps, 1000 burst)
 * - AC5: CORS configured for frontend domain
 * - AC6: Access logs sent to CloudWatch
 */
describe('ApiGatewayStack', () => {
  const app = new cdk.App();
  const config = getConfig('prod');

  const stack = new ApiGatewayStack(app, 'TestApiGatewayStack', {
    config,
  });

  const template = Template.fromStack(stack);

  describe('AC1: HTTP API Creation', () => {
    test('creates HTTP API with correct protocol type', () => {
      template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
        ProtocolType: 'HTTP',
        Name: 'zmanim-api-prod',
      });
    });

    test('creates exactly one HTTP API', () => {
      template.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
    });
  });

  describe('AC2: EC2 Integration', () => {
    test('creates HTTP proxy integration', () => {
      template.hasResourceProperties('AWS::ApiGatewayV2::Integration', {
        IntegrationType: 'HTTP_PROXY',
        IntegrationMethod: 'ANY',
        TimeoutInMillis: 29000, // 29 seconds max
      });
    });

    test('creates Elastic IP for EC2 integration', () => {
      // ApiGatewayStack now creates the Elastic IP
      template.hasResourceProperties('AWS::EC2::EIP', {
        Domain: 'vpc',
      });
    });
  });

  describe('AC3: Clerk JWT Authorizer', () => {
    test('creates JWT authorizer', () => {
      template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
        AuthorizerType: 'JWT',
        Name: 'zmanim-clerk-authorizer-prod',
      });
    });

    test('protected routes use JWT authorization', () => {
      // Check that /api/publisher/* route has JWT authorization
      template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
        RouteKey: 'ANY /api/publisher/{proxy+}',
        AuthorizationType: 'JWT',
      });

      // Check that /api/admin/* route has JWT authorization
      template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
        RouteKey: 'ANY /api/admin/{proxy+}',
        AuthorizationType: 'JWT',
      });
    });

    test('public routes do not require authorization', () => {
      // Check that public routes have no authorizer
      template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
        RouteKey: 'GET /api/zmanim/{proxy+}',
        AuthorizationType: 'NONE',
      });

      template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
        RouteKey: 'GET /api/cities/{proxy+}',
        AuthorizationType: 'NONE',
      });

      template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
        RouteKey: 'GET /api/health',
        AuthorizationType: 'NONE',
      });
    });
  });

  describe('AC4: Throttling', () => {
    test('stage has throttling configuration', () => {
      template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
        DefaultRouteSettings: {
          ThrottlingRateLimit: 500,
          ThrottlingBurstLimit: 1000,
        },
      });
    });
  });

  describe('AC5: CORS Configuration', () => {
    test('API has CORS configuration for frontend domain', () => {
      template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
        CorsConfiguration: {
          AllowOrigins: ['https://zmanim.shtetl.io'],
          AllowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          AllowHeaders: ['Authorization', 'Content-Type', 'X-Publisher-Id'],
          AllowCredentials: true,
        },
      });
    });

    test('CORS exposes headers for error responses', () => {
      template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
        CorsConfiguration: {
          ExposeHeaders: ['X-Request-Id', 'X-Amzn-RequestId'],
        },
      });
    });
  });

  describe('AC6: CloudWatch Access Logging', () => {
    test('creates CloudWatch log group with 30-day retention', () => {
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/aws/apigateway/zmanim-api-prod',
        RetentionInDays: 30,
      });
    });

    test('stage has access log settings', () => {
      template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
        AccessLogSettings: {
          DestinationArn: {
            'Fn::GetAtt': [
              'ApiAccessLogsE9DF007D',
              'Arn',
            ],
          },
        },
      });
    });
  });

  describe('Route Configuration', () => {
    test('creates routes for all required endpoints', () => {
      // Public routes
      const publicRoutes = [
        'GET /api/zmanim/{proxy+}',
        'GET /api/cities/{proxy+}',
        'GET /api/publishers/{proxy+}',
        'GET /api/publishers',
        'GET /api/countries/{proxy+}',
        'GET /api/countries',
        'GET /api/health',
      ];

      publicRoutes.forEach(route => {
        template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
          RouteKey: route,
        });
      });

      // Protected routes
      const protectedRoutes = [
        'ANY /api/publisher/{proxy+}',
        'ANY /api/admin/{proxy+}',
        'ANY /api/{proxy+}',
      ];

      protectedRoutes.forEach(route => {
        template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
          RouteKey: route,
        });
      });
    });
  });

  describe('Stack Outputs', () => {
    test('exports API Gateway endpoint', () => {
      template.hasOutput('ApiGatewayEndpoint', {
        Export: {
          Name: 'ZmanimProd-ApiGatewayEndpoint',
        },
      });
    });

    test('exports API Gateway ID', () => {
      template.hasOutput('ApiGatewayId', {
        Export: {
          Name: 'ZmanimProd-ApiGatewayId',
        },
      });
    });

    test('exports log group name', () => {
      template.hasOutput('LogGroupName', {
        Export: {
          Name: 'ZmanimProd-ApiLogGroup',
        },
      });
    });
  });
});
