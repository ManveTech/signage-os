import fs from 'fs';
const schema = JSON.parse(fs.readFileSync('pb_schema.json', 'utf8'));

for (const name of ['screens', 'users', 'licenses']) {
  const coll = schema.find(c => c.name === name);
  if (coll) {
    console.log(`\n--- ${name} ---`);
    console.log(JSON.stringify(coll.fields || coll.schema, null, 2));
  }
}
