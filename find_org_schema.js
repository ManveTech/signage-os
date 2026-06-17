import fs from 'fs';
const schema = JSON.parse(fs.readFileSync('pb_schema.json', 'utf8'));
const orgSchema = schema.find(c => c.name === 'organizations');
if (orgSchema) {
  console.log('Collection:', orgSchema.name);
  console.log('Fields:', JSON.stringify(orgSchema.fields || orgSchema.schema, null, 2));
} else {
  console.log('organizations collection not found. Collections are:', schema.map(c => c.name));
}
