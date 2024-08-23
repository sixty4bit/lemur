#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Deploy backend and infrastructure
echo "Deploying backend and infrastructure..."
cd back
npm run build
npx cdk deploy --outputs-file ./cdk-outputs.json

# Capture CDK outputs
CDK_OUTPUT=$(cat ./cdk-outputs.json)
API_URL=$(echo $CDK_OUTPUT | jq -r '.["LemurStack"].GraphQLAPIURL')
API_KEY=$(echo $CDK_OUTPUT | jq -r '.["LemurStack"].GraphQLAPIKey')
BUCKET_NAME=$(echo $CDK_OUTPUT | jq -r '.["LemurStack"].WebsiteBucketName')
CLOUDFRONT_URL=$(echo $CDK_OUTPUT | jq -r '.["LemurStack"].CloudFrontURL')

# Check if all required outputs are present
if [ -z "$API_URL" ] || [ -z "$API_KEY" ] || [ -z "$BUCKET_NAME" ] || [ -z "$CLOUDFRONT_URL" ]; then
    echo "Error: Missing required CDK outputs"
    exit 1
fi

# Ensure shared directory exists
mkdir -p ../shared

# Save configuration to shared directory
echo "Saving configuration..."
cat << EOF > ../shared/config.json
{
  "apiUrl": "$API_URL",
  "apiKey": "$API_KEY",
  "cloudfrontUrl": "https://$CLOUDFRONT_URL"
}
EOF

# Deploy frontend
echo "Deploying frontend..."
cd ../front
cp ../shared/config.json src/config.json
npm run build

# Upload to S3
echo "Uploading to S3..."
aws s3 sync build/ s3://$BUCKET_NAME --delete

echo "Deployment completed!"
echo "Your website is available at: https://$CLOUDFRONT_URL"
