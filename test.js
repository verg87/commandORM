const { Client, Pool } = require('pg');

// Configuration for your database connection
const dbConfig = {
    user: 'postgres',
    host: process.env['HOST'], 
    database: 'practiceSQL',
    password: process.env['PASSWORD'],
    port: process.env['PORT'], 
};

async function queryDatabase() {
  const pool = new Pool(dbConfig);
  const client = await pool.connect();

  try {
    // Execute your SQL query
    const res = await client.query("SELECT * FROM some_table");

    const fieldNames = Object.keys(res.fields).map((field) => res.fields[field].name);
    console.log(res);
    console.log('Rows:', res.rows); // The results are in res.rows

    return res

  } catch (err) {
    console.error('Error executing query', err.stack);
    process.exit(-1);
  } finally { 
    console.log(1);
    client.release(); // Close the connection
    process.exit(0);
  }
}

queryDatabase();

async function getTableSchemaAndData(tableName) {
    const client = new Client(dbConfig);
    try {
        await client.connect();
        // 1. Get column metadata, including defaults
        const schemaQuery = `
            SELECT
                column_name,
                column_default,
                is_nullable,
                data_type
            FROM
                information_schema.columns
            WHERE
                table_schema = 'public'
                AND table_name = \$1;
        `;
        const schemaRes = await client.query(schemaQuery, [tableName]);
        console.log(
          schemaRes
        );
        const columnsInfo = schemaRes.rows;
        console.log(`Schema for table '${tableName}':`);
        columnsInfo.forEach(col => {
            console.log(`  Column: ${col.column_name}, Type: ${col.data_type}, Default: ${col.column_default}, Nullable: ${col.is_nullable}`);
        });
        // 2. Get actual data from the table
        const dataQuery = `SELECT * FROM ${tableName};`;
        const dataRes = await client.query(dataQuery);
        const tableData = dataRes.rows;
        console.log(`\nData from table '${tableName}':`);
        console.log(tableData);
    } catch (err) {
        console.error('Error:', err.stack);
    } finally {
        await client.end();
    }
}
// getTableSchemaAndData('some_table'); // Replace with your actual table name