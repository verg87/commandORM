# The ORM built for postgreSQL, and ORM for csv files
Both ORM's very lightweight, fast and easy to use
## Usage
``` javascript
// The postgresSQL ORM
import { Model } from './commandORM/ORM.js';
// The CSV ORM
import { CSVDatabase } from './commandORM/CSVDatabase.js';

const config = {
    user: 'user-name',
    host: 'your-host', 
    database: 'your-db-name',
    password: 'your-password',
    port: 'your-port',
    allowExitOnIdle: true, // this way you don't have to wait for program to finish after the query
    _schemaName: 'your-schema-name',
};

const model = new Model(config);
const sqlTableContents = await model.table('your-table-name').select().get();

const db = new CSVDatabase('./commandORM/DB') // csv orm comes with a csv
const csvContents = await db.table('index.csv').select().get();
```
## Installation
git clone https://github.com/verg87/commandORM.git
npm install
npm test
