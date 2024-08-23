# Stop execution if an error occurs
$ErrorActionPreference = "Stop"

# Deploy backend and infrastructure
Write-Host "Deploying backend and infrastructure..."
Set-Location back
npm install
npm run build
npx cdk deploy --outputs-file ./cdk-outputs.json

# Capture CDK outputs
$CDK_OUTPUT = Get-Content ./cdk-outputs.json | ConvertFrom-Json
$API_URL = $CDK_OUTPUT.'LemurStack'.GraphQLAPIURL
$API_KEY = $CDK_OUTPUT.'LemurStack'.GraphQLAPIKey
$BUCKET_NAME = $CDK_OUTPUT.'LemurStack'.WebsiteBucketName
$CLOUDFRONT_URL = $CDK_OUTPUT.'LemurStack'.CloudFrontURL

# Check if all required outputs are present
if (-not $API_URL -or -not $API_KEY -or -not $BUCKET_NAME -or -not $CLOUDFRONT_URL) {
    Write-Error "Error: Missing required CDK outputs"
    exit 1
}

# Ensure shared directory exists
New-Item -ItemType Directory -Force -Path ../shared

# Save configuration to shared directory
Write-Host "Saving configuration..."
$config = @{
    apiUrl = $API_URL
    apiKey = $API_KEY
    cloudfrontUrl = "https://$CLOUDFRONT_URL"
} | ConvertTo-Json

Set-Content -Path ../shared/config.json -Value $config

# Deploy frontend
Write-Host "Deploying frontend..."
Set-Location ../front
Copy-Item ../shared/config.json src/config.json
npm install
npm run build

# Upload to S3
Write-Host "Uploading to S3..."
aws s3 sync build/ "s3://$BUCKET_NAME" --delete

Write-Host "Deployment completed!"
Write-Host "Your website is available at: https://$CLOUDFRONT_URL"
