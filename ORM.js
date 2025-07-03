const { Pool } = require('pg');

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
     * Wrapper method to remove the constant try and catch blocks
     * @param {function} fn The asynchronous model method to be decorated.                                                                                                                     │
     * It will receive a `client` object as its last argument.                                                                                                                                 │
     * @returns {function} An asynchronous function that, when called, will                                                                                                                    │
     * execute the decorated method with a connected database client.    
     */
    decorator(fn) {
        return async (...args) => {
            const client = await this.pool.connect();

            try {
                return await fn(...args, client);
            } catch (err) {
                console.log(err);
                process.exit(-1);
            } finally {
                await client.release();
            }
        }
        
    }

    /**
     * Retrieves the schema information for a given table.
     * @param {string} table_name The name of the table.
     * @returns {Promise<Array<object>>} A promise that resolves to an array of objects,
     * each representing a column in the table. Each object contains `column_name`,
     * `column_default`, `is_nullable`, and `data_type`.
     */
    async get_schema_data(table_name) {
        return await this.decorator(async (table_name, client) => {
            const query = `
                SELECT column_name, column_default, is_nullable, data_type
                FROM information_schema.columns
                WHERE table_schema='public'
                AND table_name=$1;
            `;

            const { rows } = await client.query(query, [table_name]);

            return rows;
        })(table_name);
    }

    /**
     * Checks whether the table already exists or not.
     * @param {string} table_name The name of the table
     * @returns {Boolean} true or false
     */
    async exists(table_name) {
        return await this.decorator(async (table_name, client) => {
            const sql = `
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    AND table_name = $1
                );
            `;

            const { rows } = await client.query(sql, [table_name]);
            return rows[0].exists;
        })(table_name);
    }

    /**
     * Inserts a new row into the specified table.
     * @param {string} table_name The name of the table.
     * @param {object} values An object where keys are column names and values are the values to insert.
     * @throws {Error} If a mandatory column is missing a value.
     * @throws {Error} If `values` contains keys that are not valid column names.
     */
    async add(table_name, values) {
        await this.decorator(async (table_name, values, client) => {
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

    /**
     * Creates a new column in a specified table.
     *
     * @param {string} table_name - The name of the table to add the column to.
     * @param {object} columnData - An object containing the configuration for the new column.
     * @param {string} columnData.name - The name of the new column. Must be a valid SQL identifier.
     * @param {string} columnData.type - The data type of the column. Supported types: 'string', 'int', 'float', 'date', 'timestamp', 'time'.
     * @param {number} [columnData.length] - The maximum length for 'string' type columns. Required if type is 'string'.
     * @param {number} [columnData.precision] - The total number of digits for 'float' type columns. Required if type is 'float'.
     * @param {number} [columnData.scale] - The number of digits to the right of the decimal point for 'float' type columns. Required if type is 'float'.
     * @param {*} [columnData.defaultValue] - The default value for the column. If a string or date, it will be wrapped in single quotes.
     * @param {boolean} [columnData.nullable=true] - Whether the column can accept NULL values. Set to `false` for NOT NULL.
     * @throws {Error} If the column name is a duplicate or invalid.
     * @throws {Error} If required parameters for a data type are missing (e.g., length for string).
     * @throws {Error} If an unsupported data type is specified.
     */
    async createColumn(table_name, columnData) {
        await this.decorator(async (table_name, columnData, client) => {
            const schemaData = await this.get_schema_data(table_name);
            const { name, type, length, precision, scale, defaultValue, nullable } = columnData;
            const columnNames = schemaData.map((columnData) => columnData['column_name']);

            let defaultClause = ``;
            let sqlType = ``;

            if (columnNames.includes(name)) {
                throw new Error(`Duplicate column name: ${name}`);
            } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
                throw new Error(`Invalid column name: ${name}`);
            }

            sqlType = (() => {
                if (type === 'string') {
                    if (!length) throw new Error('string type requires max length');

                    return `VARCHAR(${length})`;
                } else if (type === 'int') {
                    return `INT`;
                } else if (type === 'float') {
                    if (!precision || !scale) throw new Error('float type requires max and min');

                    return `DECIMAL(${precision}, ${scale})`;
                } else if (['date', 'timestamp', 'time'].includes(type)) {
                    return type.toUpperCase();
                } else {
                    throw new Error(`Unsupported data type: ${type['name']}`);
                }
            })();
            
            if (defaultValue !== undefined && defaultValue !== null) {
                if (['string', 'date', 'timestamp'].includes(type)) {
                    defaultClause = `DEFAULT '${String(defaultValue)}'`;
                } else {
                    defaultClause = `DEFAULT ${defaultValue}`;
                }

            } else if (defaultValue !== false) {
                defaultClause = `DEFAULT NULL`;
            }

            const nullClause = nullable === false ? "NOT NULL" : "";

            const sql = `
                ALTER TABLE ${table_name}
                ADD COLUMN ${name} ${sqlType} ${nullClause} ${defaultClause};
            `;

            await client.query(sql);
        })(table_name, columnData);
    }

    /**
     * Creates a new table in the database.
     * @param {string} table_name The name of the table to create.
     * @throws {Error} If the table already exists.
     */
    async createTable(table_name) {
        await this.decorator(async (table_name, client) => {
            const schemaData = await this.get_schema_data(table_name);
            
            if (schemaData.length) {
                throw new Error(`table "${table_name}" already exists`);
            }

            // I could implement adding columns to table when creating it but maybe later...
            const sql = `CREATE TABLE ${table_name} ();`;

            await client.query(sql);
        })(table_name);
    }

    /**
     * Retrieves records from a table.
     * @param {string} table_name The name of the table.
     * @param {function(object): boolean} [specification] A function to filter the results.
     * It receives a row object and should return `true` to include the row in the result.
     * @returns {Promise<Array<object>>} A promise that resolves to an array of row objects.
     */
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

    /**
     * Deletes rows from a table based on a condition.
     * @param {string} table_name The name of the table.
     * @param {string} column The column to use for the WHERE clause.
     * @param {function(object): boolean} condition A function that filters which rows to delete.
     */
    async delete(table_name, column, condition) {
        await this.decorator(async (table_name, column, condition, client) => {
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

    /**
     * Deletes a column from a table.
     * @param {string} table_name The name of the table.
     * @param {string} column The name of the column to delete.
     */
    async deleteColumn(table_name, column) {
        await this.decorator(async (table_name, column, client) => {
            const sql = `
                ALTER TABLE ${table_name}
                DROP COLUMN ${column};
            `;

            await client.query(sql);
        })(table_name, column);
    }

    /**
     * Deletes a table from the database.
     * @param {string} table_name The name of the table to delete.
     */
    async deleteTable(table_name) {
        await this.decorator(async (table_name, client) => {
            const sql = `DROP TABLE ${table_name}`;

            await client.query(sql);
        })(table_name);
    }

    /**
     * Updates certain record corresponding to the column name and the old value.
     * @param {string} table_name The name of the table
     * @param {string} columnName column name
     * @param {string} oldValue the old value
     * @param {string} newValue new value
     */
    async update(table_name, columnName, oldValue, newValue) {
        await this.decorator(async (table_name, columnName, oldValue, newValue, client) => {

        })(table_name, columnName, oldValue, newValue);
    }
}

// const db = new Model(dbConfig);
// const res = await db.exists('some_table');
// console.log(res);

module.exports = {Model, dbConfig}