# CommandORM: An ORM/QueryBuilder For PostgreSQL And CSV

CommandORM is a lightweight module that allows you to execute direct PostgreSQL commands within a JavaScript environment. It also features a Query Builder for efficiently retrieving, writing, updating, and deleting data from CSV files.

## Code Example

Below is an exmple of how to use the CommandORM.

``` javascript
// The postgresSQL ORM/QueryBuilder
import { Model } from 'commandORM/ORM.js';
// The CSV QueryBuilder
import { CSVDatabase } from 'commandORM/CSVDatabase.js';

const config = {
    user: 'user-name',
    host: 'your-host', 
    database: 'your-db-name',
    password: 'your-password',
    port: 'your-port',
    allowExitOnIdle: true, 
    // this way you don't have to wait for program to finish after the query
    _schemaName: 'your-schema-name',
};

const model = new Model(config);
const sqlTableContents = await model.table('your-table-name').select().get();

// CommandORM already has a folder with a CSV file inside
const db = new CSVDatabase('./commandORM/DB') 
const csvContents = await db.table('index.csv').select().get();
```

## Installation

Need to have [Node.js](https://nodejs.org/) installed.  

1. Clone the repo
    ```bash
    git clone https://github.com/verg87/commandORM.git 
    ```
2. Install dependencies
    ```bash
    npm install  
    ```

## Testing  

This project uses jest for testing. To run tests use:
```bash
npm test
```

### Coverage

CommandORM has almost 100% test coverage  

![Coverage report](docs/img/coverage.png) 

To create a coverage report, use this command:
```bash
npm test --coverage
```
