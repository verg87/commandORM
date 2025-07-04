import { Pool } from 'pg';
import format from 'pg-format';

const dbConfig = {
    user: 'postgres',
    host: process.env['HOST'], 
    database: 'practiceSQL',
    password: process.env['POSTGRES_PASSWORD'],
    port: process.env['PORT'], 
    allowExitOnIdle: true, // Change it in the future
};

const escapeParam = (value) => {
    if (typeof value === 'number') {
        return String(value);
    } else if (typeof value === 'string') {
        return "'" + value + "'";
    } 

    return null;
}

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
                client.release();
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
     * @returns {Promise<boolean>} true or false
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
            const finalInsertColumns = Object.keys(values);

            if (finalInsertColumns.some((columnName) => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(columnName))) {
                throw new Error(`Column names can consist of only upper or lower cased letters, underscores and numbers`);
            }

            const schemaData = await this.get_schema_data(table_name);
            const columnNames = schemaData.map((columnData) => columnData['column_name']);

            const mandatoryColumns = schemaData
                .filter(col => col.is_nullable === 'NO')
                .map(col => col.column_name);

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
            const valuesArray = Object.values(values);

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
            
            const defaultClause = defaultValue !== undefined ? format(`DEFAULT %L`, defaultValue) : '';
            const nullClause = nullable === false ? "NOT NULL" : "";

            const sql = format(`ALTER TABLE %I ADD COLUMN %I %s %s %s;`, 
                table_name, name, sqlType, nullClause, defaultClause);

            await client.query(sql);
        })(table_name, columnData);
    }

    /**
     * Creates a new table in the database.
     * @param {string} table_name The name of the table to create.
     * @throws {Error} If the table already exists.
     * @throws {Error} If table name isn't valid.
     */
    async createTable(table_name) {
        await this.decorator(async (table_name, client) => {
            const exists = await this.exists(table_name);

            if (exists) 
                throw new Error(`table "${table_name}" already exists`);
            else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table_name)) 
                throw new Error(`Table names can consist of only upper or lower cased letters, underscores and numbers`);
            
            const sql = format(`CREATE TABLE %I ();`, table_name);

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
            const sql = format(`SELECT * FROM %I;`, table_name);
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
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) throw new Error(`Column names can consist of only upper or lower cased letters, underscores and numbers`);

            const selectedByCondition = await this.get(table_name, condition);
            const valuesToDelete = selectedByCondition.map((obj) => obj[column]);

            let operation;

            if (valuesToDelete.every((value) => value === null)) {
                operation = `IS NULL`;
            } else if (valuesToDelete.some((value) => value === null)) {
                operation = format(`IS NULL OR %I IN (%L)`, column, 
                    valuesToDelete.filter((value) => value !== null));
            } else {
                operation = format(`IN (%L)`, valuesToDelete);
            }  

            const sql = format(`DELETE FROM %I WHERE %I %s;`, table_name, column, operation);

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
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
                throw new Error(`Column names can consist of only upper or lower cased letters, underscores and numbers`);
            }

            const sql = format(`ALTER TABLE %I DROP COLUMN %I;`, table_name, column);

            await client.query(sql);
        })(table_name, column);
    }

    /**
     * Deletes a table from the database.
     * @param {string} table_name The name of the table to delete.
     */
    async deleteTable(table_name) {
        await this.decorator(async (table_name, client) => {
            const sql = format(`DROP TABLE %I`, table_name)

            await client.query(sql);
        })(table_name);
    }

    /**
     * Updates records in a table based on a condition object.
     * @param {string} table_name The name of the table.
     * @param {Object.<string, string|number>} setter An object representing the columns to update. Each key is a column name and the corresponding value is the new value.
     * @param {Object.<string, object|null>} condition An object that defines the WHERE clause. The properties are processed in order to build the clause. 
     * @example
     * To update rows where name is 'Gustavo' or 'Jack' OR job is 'janitor':
     * const condition = {
     *   name: { value: ['Gustavo', 'Jack'], op: '=' }, // -> name IN ('Gustavo', 'Jack')
     *   OR: null,                                     // -> OR
     *   job: { value: 'janitor', op: '=' }             // -> job = 'janitor'
     * };
     * await db.update('some_table', { status: 'inactive' }, condition);
     * Resulting WHERE clause: WHERE name IN ('Gustavo', 'Jack') OR job = 'janitor'
     */
    async update(table_name, setter, condition) {
        await this.decorator(async (table_name, setter, condition, client) => {
            // No support for -, +, *, / and % operators
            const operators = ['!=', '<>', '<=', '>=', '>', '<', '='];

            const setClauses = Object.entries(setter)
                .map(([key, value]) => format(`%I = %L`, key, value))
                .join(', ');

            const whereClauses = Object.entries(condition)
                .map(([key, data]) => {
                    const { value, op } = data || {};

                    if (['OR', 'AND'].includes(key) && data === null) {
                        return format(` %s `, key);
                    } else if (
                        (['string', 'number'].includes(typeof value) || Array.isArray(value)) && 
                        typeof data === 'object' && typeof key === 'string' && typeof op === 'string' &&
                        operators.includes(op)
                    ) {
                        if (Array.isArray(value)) {
                            return format(`%I IN (%L)`, key, value);
                        }
    
                        return format(`%I %s %L`, key, op, value);
                    } else {
                        throw new Error(`key: ${key} and value: ${value} are not valid condition items`)
                    }
                })
                .join("");

            const sql = format(`UPDATE %I SET %s WHERE %s;`, table_name, setClauses, whereClauses);

            await client.query(sql);
        })(table_name, setter, condition);
    }
}

// Do not run npm test with this not commented out
// const db = new Model(dbConfig);
// await db.createColumn('some_table', {name: 'gpa', type: 'string', length: 20, defaultValue: 'good'})
// await db.delete('some_table', 'age', (obj) => obj['age'] < 100);
// await db.update('some_table', {job: 'something'}, {name: {value: ['Gustavo', 'nameless'], op: '='}, OR: null, job: {value: 'janitor', op: '='}});
// const res = await db.get('some_table');
// console.log(res);

export {Model, dbConfig};