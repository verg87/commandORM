import { Pool } from 'pg';

const dbConfig = {
    user: 'postgres',
    host: process.env['HOST'], 
    database: 'practiceSQL',
    password: process.env['PASSWORD'],
    port: process.env['PORT'], 
    allowExitOnIdle: true, // Change it in the future
};

class Database {
    constructor(config) {
        this.pool = new Pool(config);
    }

    decorator(fn) {
        return async (...args) => {
            const client = await this.pool.connect();

            try {
                return await fn(...args, client);
            } catch (err) {
                console.log("Error executing query: " + err);
                process.exit(-1);
            } finally {
                client.release();
            }
        }
    }

    async get_schema_data(table_name) {
        const func = this.decorator(async (table_name, client) => {
            const query = `
                SELECT column_name, column_default, is_nullable, data_type
                FROM information_schema.columns
                WHERE table_schema='public'
                AND table_name=\$1;
            `;

            const { rows } = await client.query(query, [table_name]);

            return rows;
        });

        return await func(table_name);
    }

    async add(table_name, values) {
        const func = this.decorator(async (table_name, values, client) => {
            const schemaData = await this.get_schema_data(table_name);
            const columnNames = schemaData.map((columnData) => columnData['column_name']);

            const mandatoryColumns = schemaData
                .filter(col => col.is_nullable === 'NO')
                .map(col => col.column_name);

            const finalInsertColumns = Object.keys(values);
            const columnsToInsertString = '(' + finalInsertColumns.join(', ') + ')';

            for (const col of mandatoryColumns) {
                if (!Object.prototype.hasOwnProperty.call(values, col)) {
                    throw new Error(`Missing mandatory column value: ${col}`);
                }
            }
            
            if (Object.keys(values).length > columnNames.length) {
                throw new Error(`Some of the values's keys aren't valid columns in ${table_name} table`);
            }

            const paramPlaceholders = finalInsertColumns.map((_, idx) => `$${idx + 1}`).join(', ');
            const valuesArray = finalInsertColumns.map(col => values[col]);

            const sql = `
                INSERT INTO ${table_name}
                ${columnsToInsertString}
                VALUES (${paramPlaceholders});
            `;

            await client.query(sql, valuesArray);
        });

        func(table_name, values);
    }

    async get(table_name, specification) {
        const func = this.decorator(async (table_name, specification, client) => {
            const sql = `SELECT * FROM ${table_name}`;
            const { rows } = await client.query(sql);

            if (specification) {
                return rows.filter(specification);
            }
            
            return rows;
        });

        return await func(table_name, specification);
    }

    async delete(table_name, column, condition) {
        const func = this.decorator(async (table_name, column, condition, client) => {
            const selectedByCondition = await this.get(table_name, condition);
            const valuesToDelete = selectedByCondition.map((obj) => obj[column]);

            let operation;

            if (valuesToDelete.every((value) => !value)) {
                operation = `IS NULL`;
            } else if (valuesToDelete.every((value) => [undefined, null, false].includes(typeof value))) {
                operation = `IN (${valuesToDelete.map((value) => {
                    if (value) 
                        return "'" + value + "'";

                    return 'NULL';
                }).join(', ')})`;
            } else {
                operation = `IS NULL OR ${column} IN (${valuesToDelete.map((value) => {
                    if (value)
                        return "'" + value + "'";

                    return 'NULL';
                }).join(', ')})`;
            }  

            const sql = `
                DELETE FROM ${table_name}
                WHERE ${column} ${operation}
            `;

            client.query(sql);
        });

        func(table_name, column, condition);
    }
}

const db = new Database(dbConfig);
// await db.delete('some_table', 'job', (obj) => obj['job'] === 'programmer');
const res = await db.get('some_table');
console.log(res);