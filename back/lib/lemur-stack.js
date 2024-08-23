"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LemurStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const appsync = __importStar(require("aws-cdk-lib/aws-appsync"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
class LemurStack extends cdk.Stack {
    constructor(scope, id, props) {
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
                        tryBundle(outputDir) {
                            try {
                                (0, child_process_1.execSync)('npm --version', { stdio: 'ignore' });
                            }
                            catch (_a) {
                                return false; // npm is not installed, can't do local bundling
                            }
                            (0, child_process_1.execSync)(`cp -R ${path.join(__dirname, '..', 'lambda')}/* ${outputDir}`);
                            (0, child_process_1.execSync)('npm install', { cwd: outputDir });
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
            removalPolicy: cdk.RemovalPolicy.DESTROY,
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
        });
    }
}
exports.LemurStack = LemurStack;
