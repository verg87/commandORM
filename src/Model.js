import format from "pg-format";
import { Pool } from "pg";
import { validateSQLName } from "./validation";
import { TableQueryBuilder } from "./TableQueryBuilder";

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
            } catch (error) {
                throw new Error(error.message ?? "Oops something went wrong");
            } finally {
                client.release();
            }
        };
    }

    /**
     * Closes all connections to the PostgreSQL server.
     * Should be run at the end of the programm.
     */
    async close() {
        await this.pool.end();
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
            if (await this.exists(tableName))
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

export { Model }  