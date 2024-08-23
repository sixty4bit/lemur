const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const ddbClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(ddbClient);

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  try {
    const { info, arguments: args } = event;
    const field = info ? info.fieldName : event.field;


    switch (field) {
      case 'listEmails':
        return await listEmails();
      case 'addEmail':
        return await addEmail(args.address);
      default:
        throw new Error(`Unknown field: ${field}`);
    }
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};

async function listEmails() {
  console.log('Listing emails');
  const command = new ScanCommand({
    TableName: process.env.TABLE_NAME,
  });

  const result = await docClient.send(command);
  console.log('Scan result:', JSON.stringify(result, null, 2));
  return result.Items;
}

async function addEmail(address) {
  console.log('Adding email:', address);
  const item = {
    id: uuidv4(),
    address: address,
  };

  const command = new PutCommand({
    TableName: process.env.TABLE_NAME,
    Item: item,
  });

  await docClient.send(command);
  console.log('Added item:', JSON.stringify(item, null, 2));
  return item;
}
