import { Pool } from 'pg';

const dbConfig = {
    user: 'postgres',
    host: process.env['HOST'], 
    database: 'practiceSQL',
    password: process.env['POSTGRES_PASSWORD'],
    port: process.env['PORT'], 
    allowExitOnIdle: true, // Change it in the future
};

class Model {
    constructor(config) {
        this.pool = new Pool(config);
    }

    /** 
     * Wrapper method to remove the constant
     * try and catch blocks
     * @param {function} \the Model method
     * @returns {function} passes back the wrapped function but with client variable
    */
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
        return await this.decorator(async (table_name, client) => {
            const query = `
                SELECT column_name, column_default, is_nullable, data_type
                FROM information_schema.columns
                WHERE table_schema='public'
                AND table_name=\$1;
            `;

            const { rows } = await client.query(query, [table_name]);

            return rows;
        })(table_name);
    }

    add(table_name, values) {
        this.decorator(async (table_name, values, client) => {
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
        })(table_name, values);
    }

    createColumn(table_name, columnData) {
        this.decorator(async (table_name, columnData, client) => {
            const schemaData = await this.get_schema_data(table_name);
            const { name, defaultValue, type } = columnData;
            const columnNames = schemaData.map((columnData) => columnData['column_name']);

            let defaultValueSqlString = ``;
            let typeSqlString = ``;

            if (columnNames.includes(name)) {
                throw new Error(`Duplicate column name: ${name}`);
            } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
                throw new Error(`Invalid column name: ${name}`);
            }

            // Need to change this shitcode
            if (type['name'] === 'string') {
                if (!type.max) throw new Error('string type requires max length');

                defaultValueSqlString = `DEFAULT '${defaultValue}'`;
                typeSqlString = `VARCHAR(${type['max']})`;
            } else if (type['name'] === 'int') {

                defaultValueSqlString = `DEFAULT ${defaultValue}`;
                typeSqlString = `INT`;
            } else if (type['name'] === 'float') {
                if (!type.max || !type.min) throw new Error('float type requires max and min');

                defaultValueSqlString = `DEFAULT ${defaultValue}`;
                typeSqlString = `DECIMAL(${type['max'], type['min']})`;
            } else if (type['name'] === 'date' || type['name'] === 'timestamp') {

                // Maybe first check if the defaultValue is like datetime
                defaultValueSqlString = `DEFAULT '${defaultValue}'`;
                typeSqlString = type['name'].toUpperCase();
            } else {
                throw new Error(`Unsupported data type: ${type['name']}`);
            }

            if (defaultValue === undefined) {
                console.log(`${name} will be set to null`);
                defaultValueSqlString = `DEFAULT NULL`
            }

            const sql = `
                ALTER TABLE ${table_name}
                ADD COLUMN ${name} ${typeSqlString} ${defaultValueSqlString};
            `;

            await client.query(sql);
        })(table_name, columnData);
    }

    createTable(table_name) {
        this.decorator(async (table_name, client) => {
            const schemaData = await this.get_schema_data(table_name);
            
            if (schemaData.length) {
                throw new Error(`table "${table_name}" already exists`);
            }
        })(table_name);
    }

    async get(table_name, specification) {
        return await this.decorator(async (table_name, specification, client) => {
            const sql = `SELECT * FROM ${table_name}`;
            const { rows } = await client.query(sql);

            if (specification) {
                return rows.filter(specification);
            }
            
            return rows;
        })(table_name, specification);
    }

    delete(table_name, column, condition) {
        this.decorator(async (table_name, column, condition, client) => {
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
                WHERE ${column} ${operation};
            `;

            client.query(sql);
        })(table_name, column, condition);
    }

    deleteColumn(table_name, column) {
        this.decorator(async (table_name, column, client) => {
            const schemaData = await this.get_schema_data(table_name);
            const columnNames = schemaData.map(f => f.column_name);

            if (!schemaData.length) {
                throw new Error(`table "${table_name}" doesn't exist`)
            } else if (!columnNames.includes(column)) {
                throw new Error(`column "${column}" doesn't exist in ${table_name}`);
            }

            const sql = `
                ALTER TABLE ${table_name}
                DROP COLUMN ${column};
            `;

            await client.query(sql);
        })(table_name, column);
    }
}

const db = new Model(dbConfig);
// await db.delete('some_table', 'job', (obj) => obj['job'] === 'programmer');
// db.add('some_table', {name: "John", job: "Mustard"});
// const res = await db.get('some_table');
// console.log(res);