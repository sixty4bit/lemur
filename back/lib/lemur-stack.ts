import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { execSync } from 'child_process';


export class LemurStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB table
    const emailTable = new dynamodb.Table(this, 'EmailTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Create Lambda function
    const emailLambda = new lambda.Function(this, 'EmailLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda'), {
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          command: [
            'bash', '-c', [
              'npm install',
              'cp -r /asset-input/* /asset-output/',
              'cp -r /asset-input/node_modules /asset-output/'
            ].join(' && ')
          ],
          local: {
            tryBundle(outputDir: string) {
              try {
                execSync('npm --version', { stdio: 'ignore' });
              } catch {
                return false; // npm is not installed, can't do local bundling
              }
              execSync(`cp -R ${path.join(__dirname, '..', 'lambda')}/* ${outputDir}`);
              execSync('npm install', { cwd: outputDir });
              return true;
            }
          }
        },
      }),
      environment: {
        TABLE_NAME: emailTable.tableName,
      }
    });

    // Grant Lambda function read/write permissions to DynamoDB table
    emailTable.grantReadWriteData(emailLambda);

    // Create AppSync API
    const api = new appsync.GraphqlApi(this, 'EmailApi', {
      name: 'email-api',
      schema: appsync.SchemaFile.fromAsset('graphql/schema.graphql'),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
        },
      },
    });

    // Create AppSync Lambda data source
    const lambdaDataSource = api.addLambdaDataSource('LambdaDataSource', emailLambda);

    // Create AppSync resolvers
    lambdaDataSource.createResolver('QueryListEmails', {
      typeName: 'Query',
      fieldName: 'listEmails',
    });

    lambdaDataSource.createResolver('MutationAddEmail', {
      typeName: 'Mutation',
      fieldName: 'addEmail',
    });

    // Create S3 bucket for frontend
    const websiteBucket = new s3.Bucket(this, 'LemurFrontendBucket', {
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Use with caution, removes bucket on stack deletion
      autoDeleteObjects: true, // Use with caution, deletes objects on stack deletion
    });

    // Grant public read access to bucket objects
    websiteBucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [websiteBucket.arnForObjects('*')],
      principals: [new iam.AnyPrincipal()],
    }));

    // Create CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'LemurDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // Output the necessary information
    new cdk.CfnOutput(this, 'GraphQLAPIURL', {
      value: api.graphqlUrl,
    });

    new cdk.CfnOutput(this, 'GraphQLAPIKey', {
      value: api.apiKey || '',
    });

    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: websiteBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: distribution.distributionDomainName,
    });

    new cdk.CfnOutput(this, 'EmailLambdaName', {
      value: emailLambda.functionName
    })
  }
}

