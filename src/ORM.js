import { Pool } from 'pg';
import format from 'pg-format';
import { QueryBuilder } from './queryBuilder.js';

const validateSQLName = (...args) => {
    if (!args.every((arg) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(arg))) 
        throw new Error(`Column/Table names can consist of only upper or lower cased letters, underscores and numbers`);
}

class Model {
    /**
     * @param {object} config The database configuration object.
     */
    constructor(config) {
        this.pool = new Pool(config);
        this.schemaName = config._schemaName;
    }

    /** 
     * Wrapper method to remove the constant try and finally blocks
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
     * @param {string} tableName the name of the table
     * @returns An array with objects inside. Each object represents one primary key and their type
     */
    async getPrimaryKeys(tableName) {
        return await this.decorator(async (tableName, client) => {
            const sql = `
                SELECT c.column_name, c.data_type
                FROM information_schema.table_constraints tc 
                JOIN information_schema.constraint_column_usage AS ccu USING (constraint_schema, constraint_name) 
                JOIN information_schema.columns AS c ON c.table_schema = tc.constraint_schema
                AND tc.table_name = c.table_name AND ccu.column_name = c.column_name
                WHERE constraint_type = 'PRIMARY KEY' and tc.table_name = $1;
            `;

            const { rows } = await client.query(sql, [tableName]);

            return rows;
        })(tableName);
    }

    /**
     * Retrieves the schema information for a given table.
     * @param {string} tableName The name of the table.
     * @returns {Promise<Array<object>>} A promise that resolves to an array of objects,
     * each representing a column in the table. Each object contains `column_name`,
     * `column_default`, `is_nullable`, and `data_type`.
     */
    async getSchemaData(tableName) {
        return await this.decorator(async (tableName, client) => {
            const query = `
                SELECT column_name, column_default, is_nullable, data_type
                FROM information_schema.columns
                WHERE table_schema=$1
                AND table_name=$2;
            `;

            const { rows } = await client.query(query, [this.schemaName, tableName]);

            return rows;
        })(tableName);
    }

    /**
     * Checks if a table with the given name exists in the database.
     * @param {string} tableName The name of the table to check.
     * @returns {Promise<boolean>} A promise that resolves to true if the table exists, false otherwise.
     */
    async exists(tableName) {
        return await this.decorator(async (tableName, client) => {
            const sql = `
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = $1
                    AND table_name = $2
                );
            `;

            const { rows } = await client.query(sql, [this.schemaName, tableName]);
            return rows[0].exists;
        })(tableName);
    }

    /**
     * Creates a new table in the database.
     * @param {string} tableName The name of the table to create.
     * @throws {Error} If the table already exists.
     * @throws {Error} If table name isn't valid.
     */
    async createTable(tableName) {
        await this.decorator(async (tableName, client) => {
            if ((await this.exists(tableName)))
                throw new Error(`The "${tableName}" table already exists`);
            
            validateSQLName(tableName);

            const sql = format(`CREATE TABLE %I ()`, tableName);

            await client.query(sql);
        })(tableName);
    }

    /**
     * Deletes a table from the database.
     * @param {string} tableName The name of the table to delete.
     */
    async deleteTable(tableName) {
        await this.decorator(async (tableName, client) => {
            if (!(await this.exists(tableName)))
                throw new Error(`The "${tableName}" table doesn't exist`);
            
            validateSQLName(tableName);

            const sql = format(`DROP TABLE %I`, tableName);

            await client.query(sql);
        })(tableName);
    }

    /**
     * Sets the table to be used for the query.
     * @param {string} tableName The name of the table.
     * @returns {TableQueryBuilder} The current instance of the TableQueryBuilder.
     */
    table(tableName) {
        validateSQLName(tableName);

        return new TableQueryBuilder(this, tableName);
    }
}

class TableQueryBuilder extends QueryBuilder {
    /**
     * @param {Model} model The model instance.
     * @param {string} tableName The name of the table.
     */
    constructor(model, tableName) {
        super();
        this.model = model;
        this.tableName = tableName;
        this.sql = {delete: '', select: '', where: '', order: '', limit: '', returning: ''}; 
    }

    /**
     * Checks if a table has been selected and if it exists in the database.
     * @throws {Error} If no table has been selected.
     * @throws {Error} If the selected table does not exist.
     */
    async checkForTable() {
        if (!(await this.model.exists(this.tableName)))
            throw new Error(`The "${this.tableName}" table doesn't exist in the database`);
    }

    /**
     * Specifies the columns to be selected.
     * @param {...string} columns The columns to select. If no columns are provided, all columns are selected.
     * @returns {TableQueryBuilder} The current instance of the TableQueryBuilder.
     */
    select(...columns) {
        this._select = columns?.length ? columns.filter(col => col !== '*') : ['*'];
        this.sql.select = format(`SELECT %s FROM %I`, this._select, this.tableName);
        return this;
    }

    /**
     * Adds a WHERE clause to the query.
     * @param {...any} args The arguments for the WHERE clause.
     * @returns {TableQueryBuilder} The current instance of the TableQueryBuilder.
     */
    where(...args) {
        const operators = ['=', '!=', '<>', '>=', '<=', '<', '>'];
        if (operators.includes(args[1]) && args.length === 3) {
            this.sql.where = format(`WHERE %I %s %L`, args[0].trim(), args[1], args[2]);
        } else if (Array.isArray(args[1]) && args.length === 2) {
            this.sql.where = format(`WHERE %I IN (%L)`, args[0].trim(), args[1]);
        } else if (
            typeof args[0] === 'string' && 
            ['string', 'number'].includes(typeof args[1]) 
            && args.length === 2
        ) {
            this.sql.where = format(`WHERE %I = %L`, args[0].trim(), args[1]);
        } else if (typeof args[0] === 'string' && args[1] === null && args.length === 2) {
            this.sql.where = format(`WHERE %I IS NULL`, args[0]);
        } else {
            throw new Error('Invalid arguments for where method');
        }

        return this;
    }

    /**
     * Adds an OR condition to the WHERE clause.
     * @param {...any} args The arguments for the OR condition.
     * @returns {TableQueryBuilder} The current instance of the TableQueryBuilder.
     * @throws {Error} If the `where` method has not been called first.
     */
    or(...args) {
        if (!this.sql.where)
            throw new Error(`You can't call "or" method without first calling where method`);

        const whereToAdd = this.sql.where + ' OR ';
        this.where(...args);

        this.sql.where = whereToAdd + this.sql.where.slice(6);

        return this;
    }

    /**
     * Adds an AND condition to the WHERE clause.
     * @param {...any} args The arguments for the AND condition.
     * @returns {TableQueryBuilder} The current instance of the TableQueryBuilder.
     * @throws {Error} If the `where` method has not been called first.
     */
    and(...args) {
        if (!this.sql.where)
            throw new Error(`You can't call "and" method without first calling where method`);

        const whereToAdd = this.sql.where + ' AND ';
        this.where(...args);

        this.sql.where = whereToAdd + this.sql.where.slice(6);

        return this;
    }

    /**
     * Specifies the columns to be returned by the query.
     * @param {...string} columns The columns to return.
     * @returns {TableQueryBuilder} The current instance of the TableQueryBuilder.
     */
    returning(...columns) {
        this.sql.returning = format(`RETURNING %s`, columns.length ? columns.filter(v => v !== '*') : '*');
        return this;
    }

    /**
     * Specifies the columns to order the results by.
     * @param {...string} columns The columns to order by.
     * @returns {TableQueryBuilder} The current instance of the TableQueryBuilder.
     */
    orderBy(...columns) {
        this._order = columns?.length ? columns.filter(col => col !== '*') : [];
        this.sql.order = this._order.length ? format(`ORDER BY %s`, this._order) : '';
        return this;
    }

    /**
     * Sets the order to descending.
     * @returns {TableQueryBuilder} The current instance of the TableQueryBuilder.
     */
    desc() {
        this._desc = true;
        return this;
    }

    /**
     * Limits the number of rows returned by the query.
     * @param {number} number The maximum number of rows to return.
     * @returns {TableQueryBuilder} The current instance of the TableQueryBuilder.
     */
    limit(number) {
        this.sql.limit = format(`LIMIT %s`, number);
        return this;
    }

    /**
     * Executes the select query and returns the results.
     * @returns {Promise<Array<object>>} A promise that resolves to an array of objects, where each object is a row from the database.
     * @throws {Error} If no columns have been selected.
     * @throws {Error} If any of the selected columns do not exist in the table.
     */
    async get() {
        return await this.model.decorator(async (client) => {
            await this.checkForTable();

            if (!this.sql.select)
                throw new Error(`Columns haven't been selected`);

            const schemaData = await this.model.getSchemaData(this.tableName);
            const columns = schemaData.map(row => row.column_name);

            if (!this._select.every((col) => columns.includes(col)) && this._select[0] !== '*')
                throw new Error(`Some of the selected columns don't exist in the "${this.tableName}" table`);


            

            const sql = Object.values(this.sql)
                .filter((value) => value)
                .join(' ')
                .trim() + ';';

            const res = (await client.query(sql)).rows;

            if (this._desc)
                res.reverse();

            return res;
        })();
    }

    /**
     * Deletes rows from the table.
     * @returns {Promise<Array<object>>} A promise that resolves to an array of the deleted rows.
     */
    async delete() {
        return await this.model.decorator(async (client) => {
            await this.checkForTable();

            const { where, returning } = this.sql;
            const sql = format(`DELETE FROM %I %s %s;`, this.tableName, where, returning);

            return (await client.query(sql)).rows;
        })();
    }

    /**
     * Inserts one or more rows into the table.
     * @param {object|Array<object>} values An object or an array of objects representing the rows to insert.
     * @returns {Promise<Array<object>>} A promise that resolves to an array of the inserted rows.
     * @throws {Error} If any of the provided columns do not exist in the table.
     * @throws {Error} If any of the mandatory columns are missing.
     */
    async insert(values) {
        return await this.model.decorator(async (values, client) => {
            await this.checkForTable();

            const rows = Array.isArray(values) ? values : [values];

            const schemaData = await this.model.getSchemaData(this.tableName);
            const columns = schemaData.map(col => col.column_name);

            const mandatoryColumns = schemaData
                .filter(col => col.is_nullable === 'NO' && !col.column_default)
                .map(col => col.column_name);

            const sortedValues = rows.map(values => {
                const valueKeys = Object.keys(values);
                validateSQLName(...valueKeys);

                if (!valueKeys.every((col) => columns.includes(col)))
                    throw new Error(`Some of the provided columns don't exist in table "${this.tableName}"`);

                if (!mandatoryColumns.every((col) => valueKeys.includes(col) && values[col]))
                    throw new Error(`Missing mandatory columns: ${mandatoryColumns}`);
            
                return columns.map(col => values[col] || null);
            });

            const sqlValuesString = sortedValues.map((row) => format(`(%L)`, row))

            const sql = format(`INSERT INTO %I VALUES %s %s;`, this.tableName, sqlValuesString, this.sql.returning);

            return (await client.query(sql)).rows;
        })(values);
    }

    /**
     * Updates rows in the table.
     * @param {object} values An object representing the columns to update and their new values.
     * @returns {Promise<Array<object>>} A promise that resolves to an array of the updated rows.
     */
    async update(values) {
        return await this.model.decorator(async (values, client) => {
            await this.checkForTable();

            const set = Object.entries(values)
                .map(([key, value]) => format(`%I = %L`, key, value));

            const { where, returning } = this.sql;
            const sql = format(`UPDATE %I SET %s %s %s;`, this.tableName, set, where, returning);
            
            return (await client.query(sql)).rows;
        })(values);
    }

    /**
     * Creates a new column in a specified table.
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
    async add(columnData) {
        await this.model.decorator(async (client) => {
            await this.checkForTable();

            const schemaData = await this.model.getSchemaData(this.tableName);
            let { name, type, length, precision, scale, defaultValue, nullable } = columnData;
            const columnNames = schemaData.map((col) => col['column_name']);

            type = type.toLowerCase();

            validateSQLName(name);

            if (columnNames.includes(name)) {
                throw new Error(`Duplicate column name: ${name}`);
            }

            const sqlType = (() => {
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
                this.tableName, name, sqlType, nullClause, defaultClause);

            await client.query(sql);
        })();
    }

    /**
     * Deletes a column from a table.
     * @param {string} column The name of the column to delete.
     */
    async del(column) {
        await this.model.decorator(async (column, client) => {
            await this.checkForTable();
            validateSQLName(column);

            const schemaData = await this.model.getSchemaData(this.tableName);
            const columns = schemaData.map(col => col.column_name);

            if (!columns.includes(column))
                throw new Error(`There's no such column as "${column}" in the table "${this.tableName}"`);

            const sql = format(`ALTER TABLE %I DROP COLUMN %I`, this.tableName, column);

            await client.query(sql);
        })(column);
    }

    /**
     * Counts the number of rows in a given table
     * @returns the number of rows in the table
     */
    async count() {
        return await this.model.decorator(async (client) => {
            await this.checkForTable();

            const sql = format(`SELECT COUNT(*) FROM %I`, this.tableName);

            const { rows } = await client.query(sql);

            return parseInt(rows[0].count);
        })();
    }

    /**
     * Returns the first item in the table
     * @returns the very first row in the table
     */
    async first() {
        return await this.model.decorator(async (client) => {
            await this.checkForTable();

            const sql = format(`SELECT * FROM %I LIMIT 1`, this.tableName);

            const { rows } = await client.query(sql);

            return rows[0];
        })();
    }

    /**
     * Returns the last item in the table
     * @returns the last row in a given table
     */
    async last() {
        await this.checkForTable();

        const hasPrimaryKeys = await this.model.getPrimaryKeys(this.tableName);
        let obj;

        if (hasPrimaryKeys.length) {
            obj = await this.model.decorator(async (client) => {
                const sql = format(`SELECT * FROM %I ORDER BY (%s) DESC LIMIT 1`, 
                    this.tableName, hasPrimaryKeys.map(col => col.column_name));

                return await client.query(sql);
            })();

            obj = obj.rows;
        } else {
            obj = await this.select().get();
        }

        return obj[obj.length - 1];
    }
}

export { Model };