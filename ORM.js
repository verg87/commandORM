import { Pool } from 'pg';
import format from 'pg-format';

const dbConfig = {
    user: 'postgres',
    host: process.env['HOST'], 
    database: 'practiceSQL',
    password: process.env['POSTGRES_PASSWORD'],
    port: process.env['PORT'], // Set it to your own port
    allowExitOnIdle: true, // Change it in the future
};

const validateSQLName = (...args) => {
    if (!args.every((arg) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(arg))) 
        throw new Error(`Column/Table names can consist of only upper or lower cased letters, underscores and numbers`);
}

/**
 * Represents a single database
 */
class Model {
    constructor(config, schemaName) {
        this.pool = new Pool(config);
        this.schema = schemaName;
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
            } finally {
                client.release();
            }
        }
    }

    /**
     * Retrieves primary keys for a given table.
     * @param {string} table_name the name of the table
     * @returns An array with objects inside. Each object represents one primary key and their type
     */
    async getPrimaryKeys(table_name) {
        return await this.decorator(async (table_name, client) => {
            const sql = `
                SELECT c.column_name, c.data_type
                FROM information_schema.table_constraints tc 
                JOIN information_schema.constraint_column_usage AS ccu USING (constraint_schema, constraint_name) 
                JOIN information_schema.columns AS c ON c.table_schema = tc.constraint_schema
                AND tc.table_name = c.table_name AND ccu.column_name = c.column_name
                WHERE constraint_type = 'PRIMARY KEY' and tc.table_name = $1;
            `;

            const { rows } = await client.query(sql, [table_name]);

            return rows;
        })(table_name);
    }

    /**
     * Retrieves the schema information for a given table.
     * @param {string} table_name The name of the table.
     * @returns {Promise<Array<object>>} A promise that resolves to an array of objects,
     * each representing a column in the table. Each object contains `column_name`,
     * `column_default`, `is_nullable`, and `data_type`.
     */
    async getSchemaData(table_name) {
        return await this.decorator(async (table_name, client) => {
            const query = `
                SELECT column_name, column_default, is_nullable, data_type
                FROM information_schema.columns
                WHERE table_schema=$1
                AND table_name=$2;
            `;

            const { rows } = await client.query(query, [this.schema, table_name]);

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
                    WHERE table_schema = $1
                    AND table_name = $2
                );
            `;

            const { rows } = await client.query(sql, [this.schema, table_name]);
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
            const keysArray = Object.keys(values);
            const valuesArray = Object.values(values);

            validateSQLName(table_name, ...keysArray);

            const schemaData = await this.getSchemaData(table_name);
            const columnNames = schemaData.map((columnData) => columnData['column_name']);

            const mandatoryColumns = schemaData
                .filter(col => col.is_nullable === 'NO')
                .map(col => col.column_name);

            const columnsToInsertString = '(' + keysArray.join(', ') + ')';

            for (const col of mandatoryColumns) {
                if (!Object.hasOwn(values, col)) {
                    throw new Error(`Missing mandatory column value: ${col}`);
                }
            }

            if (keysArray.length > columnNames.length) {
                throw new Error(`Some of the values's keys aren't valid columns in ${table_name} table`);
            }

            const sql = format(`INSERT INTO %I %s VALUES (%L)`, table_name, columnsToInsertString, valuesArray)

            await client.query(sql);
        })(table_name, values);
    }

    /**
     * Creates a new column in a specified table.
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
            const schemaData = await this.getSchemaData(table_name);
            const { name, type, length, precision, scale, defaultValue, nullable } = columnData;
            const columnNames = schemaData.map((columnData) => columnData['column_name']);

            validateSQLName(table_name, name);

            let sqlType = ``;

            if (columnNames.includes(name)) {
                throw new Error(`Duplicate column name: ${name}`);
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
            validateSQLName(table_name);

            const exists = await this.exists(table_name);

            if (exists) 
                throw new Error(`table "${table_name}" already exists`);
            
            const sql = format(`CREATE TABLE %I ();`, table_name);

            await client.query(sql);
        })(table_name);
    }

    /**
     * Retrieves records from a table.
     * @param {string} table_name The name of the table.
     * @param {function(object): boolean} [specification] A function to filter the results.
     * It receives a row object and should return `true` to include the row in the result.
     * @param {Array<string>} columns An array of columns to select from the table.
     * @returns {Promise<Array<object>>} A promise that resolves to an array of row objects.
     */
    async get(table_name, specification, columns) {
        return await this.decorator(async (table_name, specification, columns, client) => {
            const expression = columns?.length ? columns.join(', ') : '*';
            const sql = format(`SELECT %s FROM %I;`, expression, table_name);

            const { rows } = await client.query(sql);

            if (specification) {
                return rows.filter(specification);
            }
            
            return rows;
        })(table_name, specification, columns);
    }

    /**
     * Counts the number of rows in a given table
     * @param {string} table_name the name of the table
     * @returns the number of rows in the table
     */
    async countRows(table_name) {
        return await this.decorator(async (table_name, client) => {
            validateSQLName(table_name)

            const sql = format(`SELECT COUNT(*) FROM %I`, table_name);
            const { rows } = await client.query(sql);

            return parseInt(rows[0].count);
        })(table_name);
    }

    /**
     * Returns the first item in the table
     * @param {string} table_name the name of the table
     * @returns the very first row in the table
     */
    async firstItem(table_name) {
        return await this.decorator(async (table_name, client) => {
            validateSQLName(table_name);

            const sql = format(`SELECT * FROM %I LIMIT 1`, table_name);
            const { rows } = await client.query(sql);

            return rows[0];
        })(table_name);
    }

    /**
     * Returns the last item in the table
     * @param {string} table_name the name of the table
     * @returns the last row in a given table
     */
    async lastItem(table_name) {
        validateSQLName(table_name);

        const hasPrimaryKeys = await this.getPrimaryKeys(table_name);
        let obj;

        if (hasPrimaryKeys.length) {
            obj = await this.decorator(async (table_name, client) => {
                const sql = format(`SELECT * FROM %I ORDER BY (%s) DESC LIMIT 1`, 
                    table_name, hasPrimaryKeys.map(col => col.column_name));

                return await client.query(sql);
            })(table_name);

            obj = obj.rows;
        } else {
            // If a tabel has no primary keys we can only get the last row 
            // by quering all the rows and then returning the last one from that.
            obj = await this.get(table_name);
        }

        return obj[obj.length - 1];
    }

    /**
     * Deletes rows from a table based on a condition.
     * @param {string} table_name The name of the table.
     * @param {Object<string, Array<string>>} mapping The mapping to decide which columns to use 
     * in WHERE clause and operators with which to join the columns.
     * @param {array} mapping.columns An array of columns.
     * @param {array} mapping.ops An array of sql logical operators ('OR', 'AND').
     * @param {function(object): boolean} condition A function that filters which rows to delete.
     */
    async delete(table_name, mapping, condition) {
        await this.decorator(async (table_name, mapping, condition, client) => {
            const { columns, ops } = mapping || {};
            if (!columns?.length || !ops?.length) 
                throw new Error(`Mapping is not provided. Instead got: ${columns} as columns and ${ops} as operators`);

            validateSQLName(table_name, ...columns);

            const selectedByCondition = await this.get(table_name, condition, columns);

            const sqlStrings = columns.reduce((acc, col) => {
                const valuesToDeleteSet = new Set(selectedByCondition.map((obj) => obj[col]));
                const valuesToDelete = [...valuesToDeleteSet];

                if (valuesToDelete.every((value) => value === null)) {
                    acc.push(format(`%I IS NULL`, col));
                } else if (valuesToDelete.some((value) => value === null)) {
                    acc.push(format(`%1$I IS NULL OR %1$I IN (%L)`, col, 
                        valuesToDelete.filter((value) => value !== null)));
                } else {
                    acc.push(format(`%I IN (%L)`, col, valuesToDelete));
                } 
                
                return acc;
            }, []);
            
            const operation = ops.reduce((acc, op, idx) => {
                if (sqlStrings[idx] && sqlStrings[idx + 1]) {
                    acc = sqlStrings[idx] + ` ${op} ` + sqlStrings[idx + 1];
                    return acc;
                }

                return acc;
            }, '') || sqlStrings[0];
            
            const sql = format(`DELETE FROM %I WHERE %s;`, table_name, operation);

            client.query(sql);
        })(table_name, mapping, condition);
    }

    /**
     * Deletes a column from a table.
     * @param {string} table_name The name of the table.
     * @param {string} column The name of the column to delete.
     */
    async deleteColumn(table_name, column) {
        await this.decorator(async (table_name, column, client) => {
            validateSQLName(table_name, column);

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
            validateSQLName(table_name);

            const sql = format(`DROP TABLE %I`, table_name);

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
                        (['string', 'number', 'object'].includes(typeof value) || Array.isArray(value)) && 
                        typeof data === 'object' && typeof key === 'string' && typeof op === 'string' &&
                        operators.includes(op)
                    ) {
                        if (Array.isArray(value)) {
                            return format(`%I IN (%L)`, key, value);
                        } else if (value === null) {
                            return format(`%I IS NULL`, key);
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
// const model = new Model(dbConfig, 'public');

// examples:
// await model.delete('some_table', {columns: ['salary', 'job'], ops: ['AND']}, (obj) => obj.salary > 5000 && obj.job !== 'seller');
// await model.update('some_table', {name: 'new name'}, {job: {value: 'janitor'}, op: '='}, AND: null, salary: {value: 5000, op: '<'});
// const res = await model.get('some_table', null, ['age', 'salary'])
// console.log(res);

export {Model, dbConfig};