import format from "pg-format";
import { QueryBuilder } from "./QueryBuilder.js";
import { validateSQLName } from "./validation.js";

class TableQueryBuilder extends QueryBuilder {
    /**
     * @param {Model} model The model instance.
     * @param {string} tableName The name of the table.
     */
    constructor(model, tableName) {
        super();
        this.model = model;
        this.tableName = tableName;
        this.sql = {
            delete: "",
            select: "",
            join: "",
            on: "",
            where: "",
            order: "",
            desc: "",
            limit: "",
            returning: "",
        };
    }

    /**
     * Clears the sql actions and returns a promise of a decorator call with a callback.
     * @param {string} sql The SQL string that have been created.
     * @returns {Promise<any>} The result of a query.
     */
    async #__execute(sql) {
        for (const action in this.sql) {
            this.sql[action] = "";
        }

        return await this.model.decorator(async (sql, client) => {
            return (await client.query(sql)).rows;
        })(sql);
    }

    /**
     * Specifies the columns to be selected.
     * @param {...string} columns The columns to select. If no columns are provided, all columns are selected.
     * @returns {TableQueryBuilder} The current instance of the TableQueryBuilder.
     */
    select(...columns) {
        this._select = columns?.length
            ? columns.filter((col) => col !== "*")
            : ["*"];
        this.sql.select = format(`SELECT %s FROM %I`, this._select, this.tableName);
        return this;
    }

    /**
     * Contains logic that is shared between all join methods.
     * @param {any[] | function[]} args On what match or matches to perform the join.
     * Can accept function as a parameter. Note that the callback must not be an arrow function
     * @returns {TableQueryBuilder} The current instance of the TableQueryBuilder.
     * @throws {Error} If sql join query is empty.
     */
    #__join(...args) {
        if (!this.sql.join) {
            throw new Error("Sql join query can not be empty");
        }

        if (args[0] instanceof Function && args.length === 1) {
            const self = this;

            const joinConditionContext = {
                sql: self.sql,
                on: self.on,
                onOr: self.onOr,
                onAnd: self.onAnd,
            };

            args[0].apply(joinConditionContext);
        } else if (args.length) {
            this.on(...args);
        }
    }

    /**
     * Adds an INNER JOIN clause to the query.
     * @param {string} table Table to perform inner join with.
     * @param {any[] | function[]} args On what match or matches to perform the join.
     * Can accept function as a parameter. Note that the callback must not be an arrow function
     * @returns {TableQueryBuilder} The current instance of the TableQueryBuilder.
     */
    innerJoin(table, ...args) {
        this.sql.join = format(`INNER JOIN %I`, table);
        this.#__join(...args);

        return this;
    }

    /**
     * Adds an LEFT JOIN clause to the query.
     * @param {string} table Table to perform left join with.
     * @param {any[] | function[]} args On what match or matches to perform the join.
     * Can accept function as a parameter. Note that the callback must not be an arrow function
     * @returns {TableQueryBuilder} The current instance of the TableQueryBuilder.
     */
    leftJoin(table, ...args) {
        this.sql.join = format(`LEFT JOIN %I`, table);
        this.#__join(...args);

        return this;
    }

    /**
     * Adds an RIGHT JOIN clause to the query.
     * @param {string} table Table to perform right join with.
     * @param {any[] | function[]} args On what match or matches to perform the join.
     * Can accept function as a parameter. Note that the callback must not be an arrow function
     * @returns {TableQueryBuilder} The current instance of the TableQueryBuilder.
     */
    rightJoin(table, ...args) {
        this.sql.join = format(`RIGHT JOIN %I`, table);
        this.#__join(...args);

        return this;
    }

    /**
     * Creates a condition for the JOIN clause.
     * @param {...string} args The arguments for the JOIN clause.
     * @returns {TableQueryBuilder} The current instance of the TableQueryBuilder.
     * @throws {Error} If no arguments were given.
     */
    on(...args) {
        const operators = ["=", "!=", "<>", ">=", "<=", "<", ">"];

        let [leftTable, leftColumn] = args[0]?.trim()?.split(".") ?? [];
        let [rightTable, rightColumn] = args[2]?.trim()?.split(".") ?? [];

        if (operators.includes(args[1]) && args.length === 3) {
            this.sql.on = format(
                `ON %I.%I %s %I.%I`,
                leftTable,
                leftColumn,
                args[1],
                rightTable,
                rightColumn
            );
        } else if (Array.isArray(args[1]) && args.length === 2) {
            this.sql.on = format(`ON %I.%I IN (%L)`, leftTable, leftColumn, args[1]);
        } else if (
            typeof args[0] === "string" &&
            typeof args[1] === "string" &&
            args.length === 2
        ) {
            [rightTable, rightColumn] = args[1].trim().split(".");

            this.sql.on = format(
                `ON %I.%I = %I.%I`,
                leftTable,
                leftColumn,
                rightTable,
                rightColumn
            );
        } else if (
            typeof args[0] === "string" &&
            typeof args[1] === "number" &&
            args.length === 2
        ) {
            this.sql.on = format(`ON %I.%I = %s`, leftTable, leftColumn, args[1]);
        } else if (
            typeof args[0] === "string" &&
            args[1] === null &&
            args.length === 2
        ) {
            this.sql.on = format(`ON %I.%I IS NULL`, leftTable, leftColumn);
        } else {
            throw new Error("A join clause must have columns provided");
        }

        return this;
    }

    /**
     * Adds an OR condition to the ON clause.
     * @param {...any} args The arguments for the OR condition.
     * @returns {TableQueryBuilder} The current instance of the TableQueryBuilder.
     * @throws {Error} If the `on` method has not been called first.
     */
    onOr(...args) {
        if (!this.sql.on)
            throw new Error(
                `You can't call "onOr" method without first calling "on" method`
            );

        const onToAdd = this.sql.on + " OR ";
        this.on(...args);

        // slice(3) - we are slicing off the "ON " clause since it's length is 3(with a whitespace)
        this.sql.on = onToAdd + this.sql.on.slice(3);

        return this;
    }

    /**
     * Adds an AND condition to the ON clause.
     * @param {...any} args The arguments for the AND condition.
     * @returns {TableQueryBuilder} The current instance of the TableQueryBuilder.
     * @throws {Error} If the `on` method has not been called first.
     */
    onAnd(...args) {
        if (!this.sql.on)
            throw new Error(
                `You can't call "onAnd" method without first calling "on" method`
            );

        const onToAdd = this.sql.on + " AND ";
        this.on(...args);

        // slice(3) - we are slicing off the "ON " clause since it's length is 3(with a whitespace)
        this.sql.on = onToAdd + this.sql.on.slice(3);

        return this;
    }

    /**
     * Adds a WHERE clause to the query.
     * @param {...any} args The arguments for the WHERE clause.
     * @returns {TableQueryBuilder} The current instance of the TableQueryBuilder.
     * @throws {Error} If no arguments were provided.
     */
    where(...args) {
        const operators = ["=", "!=", "<>", ">=", "<=", "<", ">"];
        if (operators.includes(args[1]) && args.length === 3) {
            this.sql.where = format(
                `WHERE %I %s %L`,
                args[0].trim(),
                args[1],
                args[2]
            );
        } else if (Array.isArray(args[1]) && args.length === 2) {
            this.sql.where = format(`WHERE %I IN (%L)`, args[0].trim(), args[1]);
        } else if (
            typeof args[0] === "string" &&
            ["string", "number"].includes(typeof args[1]) &&
            args.length === 2
        ) {
            this.sql.where = format(`WHERE %I = %L`, args[0].trim(), args[1]);
        } else if (
            typeof args[0] === "string" &&
            args[1] === null &&
            args.length === 2
        ) {
            this.sql.where = format(`WHERE %I IS NULL`, args[0]);
        } else {
            throw new Error("Invalid arguments for where method");
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
            throw new Error(
                `You can't call "or" method without first calling where method`
            );

        const whereToAdd = this.sql.where + " OR ";
        this.where(...args);

        // slice(6) - we are slicing off the "WHERE " clause since it's length is 6(with a whitespace)
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
            throw new Error(
                `You can't call "and" method without first calling where method`
            );

        const whereToAdd = this.sql.where + " AND ";
        this.where(...args);

        // slice(6) - we are slicing off the "WHERE " clause since it's length is 6(with a whitespace)
        this.sql.where = whereToAdd + this.sql.where.slice(6);

        return this;
    }

    /**
     * Specifies the columns to be returned by the query.
     * @param {...string} columns The columns to return.
     * @returns {TableQueryBuilder} The current instance of the TableQueryBuilder.
     */
    returning(...columns) {
        this.sql.returning = format(
            `RETURNING %s`,
            columns.length ? columns.filter((v) => v !== "*") : "*"
        );
        return this;
    }

    /**
     * Specifies the columns to order the results by.
     * @param {...string} columns The columns to order by.
     * @returns {TableQueryBuilder} The current instance of the TableQueryBuilder.
     */
    orderBy(...columns) {
        this._order = columns?.length ? columns.filter((col) => col !== "*") : [];
        this.sql.order = this._order.length
            ? format(`ORDER BY %s`, this._order)
            : "";
        return this;
    }

    /**
     * Sets the order to descending.
     * @returns {TableQueryBuilder} The current instance of the TableQueryBuilder.
     */
    desc() {
        this.sql.desc = "DESC";
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
        if (!this.sql.select) throw new Error(`Columns haven't been selected`);

        const schemaData = await this.model.getSchemaData(this.tableName);
        const columns = schemaData.map((row) => row.column_name);

        if (
            !this._select.every((col) => columns.includes(col)) &&
            this._select[0] !== "*" &&
            !this.sql.join
        )
            throw new Error(
                `Some of the selected columns don't exist in the "${this.tableName}" table`
            );

        const sql =
            Object.values(this.sql)
                .filter((value) => value)
                .join(" ")
                .trim() + ";";

        return await this.#__execute(sql);
    }

    /**
     * Deletes rows from the table.
     * @returns {Promise<Array<object>>} A promise that resolves to an array of the deleted rows.
     */
    async delete() {
        const { where, returning } = this.sql;
        const sql = format(
            `DELETE FROM %I %s %s;`,
            this.tableName,
            where,
            returning
        );

        return await this.#__execute(sql);
    }

    /**
     * Contains similar logic that is shared between public insert and upsert methods.
     * @param {object|Array<object>} values An object or an array of objects representing the rows to insert.
     * @returns {Promise<Array<any>>} A promise that resolves to an array representing the sql query and schema data.
     * @throws {Error} If any of the provided columns do not exist in the table.
     * @throws {Error} If any of the mandatory columns are missing.
     */
    async #__insert(values) {
        const rows = Array.isArray(values) ? values : [values];

        const primaryKeys = await this.model.getPrimaryKeys(this.tableName);
        let schemaData = await this.model.getSchemaData(this.tableName);

        // If values doesn't have primary keys
        if (primaryKeys.some((col) => !values[col.column_name])) {
            // We remove data about primary keys in schemaData
            const primaryKeyColumns = primaryKeys.map((col) => col.column_name);
            schemaData = schemaData.filter(
                (col) => !primaryKeyColumns.includes(col.column_name)
            );
        }

        const columns = schemaData.map((col) => col.column_name);

        const mandatoryColumns = schemaData
            .filter((col) => col.is_nullable === "NO" && !col.column_default)
            .map((col) => col.column_name);

        const sortedValues = rows.map((values) => {
            const valueKeys = Object.keys(values);
            validateSQLName(...valueKeys);

            if (!valueKeys.every((col) => columns.includes(col)))
                throw new Error(
                    `Some of the provided columns don't exist in table "${this.tableName}"`
                );

            if (
                !mandatoryColumns.every((col) => valueKeys.includes(col) && values[col])
            )
                throw new Error(`Missing mandatory columns: ${mandatoryColumns}`);

            return schemaData.map(
                (col) => values[col.column_name] || col.column_default
            );
        });

        const sqlValuesString = sortedValues.map((row) => format(`(%L)`, row));

        const sql = format(
            `INSERT INTO %I (%I) VALUES %s`,
            this.tableName,
            columns,
            sqlValuesString
        );

        return [sql, schemaData, primaryKeys];
    }

    /**
     * Inserts one or more rows into the table.
     * @param {object|Array<object>} values An object or an array of objects representing the rows to insert.
     * @returns {Promise<Array<object>>} A promise that resolves to an array of the inserted rows.
     */
    async insert(values) {
        let [sql, _, __] = await this.#__insert(values);

        sql = format(`%s %s`, sql, this.sql.returning);

        return await this.#__execute(sql);
    }

    /**
     * Updates rows in the table.
     * @param {object} values An object representing the columns to update and their new values.
     * @returns {Promise<Array<object>>} A promise that resolves to an array of the updated rows.
     */
    async update(values) {
        const set = Object.entries(values).map(([key, value]) =>
            format(`%I = %L`, key, value)
        );

        const { where, returning } = this.sql;
        const sql = format(
            `UPDATE %I SET %s %s %s;`,
            this.tableName,
            set,
            where,
            returning
        );

        return await this.#__execute(sql);
    }

    /**
     * Inserts or updates multiple rows in a table.
     * @param {object|Array<object>} values An object or an array of objects representing the rows to upsert.
     * @returns {Promise<Array<object>>} A promise that resolves to an array of the upserted rows.
     */
    async upsert(values) {
        let [sql, schemaData, primaryKeys] = await this.#__insert(values);

        if (!primaryKeys.length) {
            // Do an insert
            sql = format(`%s %s`, sql, this.sql.returning);

            return await this.#__execute(sql);
        }

        const primaryKeyColumns = primaryKeys.map((col) => col.column_name);
        const columnsToUpdate = schemaData.filter(
            (col) => !primaryKeyColumns.includes(col.column_name)
        );

        const sqlSetValuesString = columnsToUpdate
            .map((col) => {
                if (values[col.column_name]) {
                    return format(`%1$I = EXCLUDED.%1$I`, col.column_name);
                }

                return format(`%I = %L`, col.column_name, col.column_default);
            })
            .join(", ");

        sql = format(
            `%s ON CONFLICT (%I) DO UPDATE SET %s %s`,
            sql,
            primaryKeys[0].column_name,
            sqlSetValuesString,
            this.sql.returning
        );

        return await this.#__execute(sql);
    }

    /**
     * Contains logic that is used in both modify and add methods.
     * @param {object} columnData - The object containing column data.
     * @returns {Promise<object>}
     */
    async #__alter(columnData) {
        const schemaData = await this.model.getSchemaData(this.tableName);
        let { name, type, length, precision, scale, defaultValue, nullable } =
            columnData;

        const initialColumn = schemaData.filter(
            (col) => col["column_name"] === name
        );
        const initialDataType =
            initialColumn.length === 1 ? initialColumn[0]["data_type"] : null;

        type = type.toLowerCase();

        validateSQLName(name);

        const sqlType = (() => {
            switch (type) {
                case "string": {
                    if (!length) throw new Error("String type requires max length");

                    return `VARCHAR(${length})`;
                }
                case "float": {
                    if (!precision || !scale)
                        throw new Error("Float type requires max and min");

                    return `DECIMAL(${precision}, ${scale})`;
                }
                case "pk": {
                    return "SERIAL PRIMARY KEY";
                }
                case "int":
                case "timestamp":
                case "time":
                case "date":
                    return type.toUpperCase();
                default:
                    throw new Error(`Unsupported data type: ${type["name"]}`);
            }
        })();

        const defaultClause =
            defaultValue !== undefined ? format(`DEFAULT %L`, defaultValue) : "";
        const nullClause = nullable === false ? "NOT NULL" : "";

        const sql = format(`ALTER TABLE %I`, this.tableName);

        return {
            sql,
            name,
            sqlType,
            defaultClause,
            nullClause,
            initialColumn,
            initialDataType,
        };
    }

    /**
     * Creates a new column in a specified table.
     * @param {object} columnData - An object containing the configuration for the new column.
     * @param {string} columnData.name - The name of the new column. Must be a valid SQL identifier.
     * @param {string} columnData.type - The data type of the column. Supported types: 'string', 'int', 'float', 'date', 'timestamp', 'time', 'pk'.
     * @param {number} [columnData.length] - The maximum length for 'string' type columns. Required if type is 'string'.
     * @param {number} [columnData.precision] - The total number of digits for 'float' type columns. Required if type is 'float'.
     * @param {number} [columnData.scale] - The number of digits to the right of the decimal point for 'float' type columns. Required if type is 'float'.
     * @param {*} [columnData.defaultValue] - The default value for the column. If a string or date, it will be wrapped in single quotes.
     * @param {boolean} [columnData.nullable=true] - Whether the column can accept NULL values. Set to `false` for NOT NULL.
     * @throws {Error} If a column with that name already exists.
     * @throws {Error} If a default value is specified for a serial primary key.
     */
    async add(columnData) {
        const { type, defaultValue } = columnData;

        let { sql, name, sqlType, defaultClause, nullClause, initialColumn } =
            await this.#__alter(columnData);

        if (initialColumn.length) {
            throw new Error(`There is already column with name ${name}.`);
        }

        if (type === "pk" && defaultValue) {
            throw new Error(`Can't add a serial primary key with a default value.`);
        }

        sql = format(
            `%s ADD COLUMN %I %s %s %s;`,
            sql,
            name,
            sqlType,
            nullClause,
            defaultClause
        );

        await this.#__execute(sql);
    }

    /**
     * Modifies an existing column, their type, default value and etc.
     * @param {object} columnData - An object containing the configuration for the new column.
     * @param {string} columnData.name - The name of the new column. Must be a valid SQL identifier.
     * @param {string} columnData.type - The data type of the column. Supported types: 'string', 'int', 'float', 'date', 'timestamp', 'time'
     * @param {number} [columnData.length] - The maximum length for 'string' type columns. Required if type is 'string'.
     * @param {number} [columnData.precision] - The total number of digits for 'float' type columns. Required if type is 'float'.
     * @param {number} [columnData.scale] - The number of digits to the right of the decimal point for 'float' type columns. Required if type is 'float'.
     * @param {*} [columnData.defaultValue] - The default value for the column. If a string or date, it will be wrapped in single quotes.
     * @param {boolean} [columnData.nullable=true] - Whether the column can accept NULL values. Set to `false` for NOT NULL.
     * @throws {Error} If the provided column doesn't exist in the table.
     * @throws {Error} If initial column type is not convertable to the provided one.
     * @throws {Error} If an unsupported data type is specified.
     */
    async modify(columnData) {
        const { type } = columnData;

        let {
            sql,
            name,
            sqlType,
            defaultClause,
            nullClause,
            initialColumn,
            initialDataType,
        } = await this.#__alter(columnData);

        if (!initialColumn.length) {
            throw new Error(`There is no such column as ${name}.`);
        }

        switch (type) {
            case "float":
            case "int": {
                const numericTypes = [
                    "integer",
                    "decimal",
                    "smallint",
                    "bigint",
                    "real",
                    "double precision",
                    "numeric",
                ];

                if (!numericTypes.includes(initialDataType)) {
                    throw new Error(
                        "Can not convert non-numeric data types into numeric."
                    );
                }

                break;
            }
            case "date":
            case "time":
            case "timestamp": {
                const dateTypes = [
                    "date",
                    "time",
                    "timestamp",
                    "timestamp without time zone",
                    "interval",
                ];

                if (!dateTypes.includes(initialDataType)) {
                    throw new Error(
                        "Can not convert non-date types into date like types."
                    );
                }

                break;
            }
            case "string":
                break;
            default:
                throw new Error(`Unsupported data type: ${type}.`);
        }

        const nullAction = (() => {
            if (nullClause) {
                return format(`%s ALTER COLUMN %I SET %s;`, sql, name, nullClause);
            }

            return "";
        })();

        const defaultAction = (() => {
            if (defaultClause) {
                return format(`%s ALTER COLUMN %I SET %s;`, sql, name, defaultClause);
            }

            return "";
        })();

        sql = format(
            `%s ALTER COLUMN %I TYPE %s; %s %s`,
            sql,
            name,
            sqlType,
            nullAction,
            defaultAction
        );

        await this.#__execute(sql);
    }

    /**
     * Renames a column.
     * @param {string} oldName The previous name of the column.
     * @param {string} newName The new name of the column.
     */
    async rename(oldName, newName) {
        validateSQLName(oldName, newName);

        const schemaData = await this.model.getSchemaData(this.tableName);
        const columns = schemaData.map((col) => col.column_name);

        if (!columns.includes(oldName))
            throw new Error(
                `There's no such column as "${oldName}" in the table "${this.tableName}"`
            );

        const sql = format(
            `ALTER TABLE %I RENAME COLUMN %I TO %I`,
            this.tableName,
            oldName,
            newName
        );

        await this.#__execute(sql);
    }

    /**
     * Deletes a column from a table.
     * @param {string} column The name of the column to delete.
     */
    async del(column) {
        validateSQLName(column);

        const schemaData = await this.model.getSchemaData(this.tableName);
        const columns = schemaData.map((col) => col.column_name);

        if (!columns.includes(column))
            throw new Error(
                `There's no such column as "${column}" in the table "${this.tableName}"`
            );

        const sql = format(`ALTER TABLE %I DROP COLUMN %I`, this.tableName, column);

        await this.#__execute(sql);
    }

    /**
     * Counts the number of rows in a given table
     * @param {string} [column] The name of the column to count.
     * If omitted "*" is used.
     * @returns Promise<int> the number of rows in the table
     */
    async count(column) {
        if (column) {
            validateSQLName(column);
        } else {
            column = "*";
        }

        const sql = format(`SELECT COUNT(%s) FROM %I`, column, this.tableName);

        const rows = await this.#__execute(sql);

        return parseInt(rows[0].count);
    }

    /**
     * Sums up all values in a given column
     * @param {string} column The name of the column to sum.
     * @returns {Promise<number>} A promise that resolves to the sum of the values in the specified column.
     */
    async sum(column) {
        validateSQLName(column);

        const sql = format(`SELECT SUM(%s) FROM %I`, column, this.tableName);

        const rows = await this.#__execute(sql);

        return parseInt(rows[0].sum);
    }

    /**
     * Averages out values in a given column
     * @param {string} column The name of the column to average out.
     * @param {number} [precision] The number of decimal places. If omitted, the result will be returned as is.
     * @returns {Promise<number>} A promise that resolves to the average of the values in the specified column.
     * @throws {Error} If the precision is not within the range of 0-100.
     */
    async avg(column, precision) {
        validateSQLName(column);

        if (typeof precision === "number" && (precision > 100 || precision < 0))
            throw new Error("Precision must in range of 0-100");

        const sql = format(`SELECT AVG(%s) FROM %I`, column, this.tableName);

        const rows = await this.#__execute(sql);

        if (typeof precision === "number") {
            return parseFloat(parseFloat(rows[0].avg).toFixed(parseInt(precision)));
        }

        return parseFloat(rows[0].avg);
    }

    /**
     * Finds the lowest column value.
     * If a given column has data type of string then it finds the value based on alphabetical order.
     * @param {string} column The name of the column.
     * @returns {Promise<number|string>} A promise that resolves to the lowest value in the specified column.
     */
    async min(column) {
        validateSQLName(column);

        const sql = format(`SELECT MIN(%s) FROM %I`, column, this.tableName);

        const rows = await this.#__execute(sql);

        return /^\d+(\.\d+)?$/.test(rows[0].min)
            ? parseFloat(rows[0].min)
            : rows[0].min;
    }

    /**
     * Finds the largest column value.
     * If a given column has data type of string then it finds the value based on alphabetical order.
     * @param {string} column The name of the column.
     * @returns {Promise<number|string>} A promise that resolves to the largest value in the specified column.
     */
    async max(column) {
        validateSQLName(column);

        const sql = format(`SELECT MAX(%s) FROM %I`, column, this.tableName);

        const rows = await this.#__execute(sql);

        return /^\d+(\.\d+)?$/.test(rows[0].max)
            ? parseFloat(rows[0].max)
            : rows[0].max;
    }

    /**
     * Returns the first item in the table
     * @returns the very first row in the table
     */
    async first() {
        const sql = format(`SELECT * FROM %I LIMIT 1`, this.tableName);

        const rows = await this.#__execute(sql);

        return rows[0];
    }

    /**
     * Returns the last item in the table
     * @returns the last row in a given table
     */
    async last() {
        const hasPrimaryKeys = await this.model.getPrimaryKeys(this.tableName);
        let obj;

        if (hasPrimaryKeys.length) {
            const sql = format(
                `SELECT * FROM %I ORDER BY (%s) DESC LIMIT 1`,
                this.tableName,
                hasPrimaryKeys.map((col) => col.column_name)
            );

            obj = await this.#__execute(sql);
        } else {
            obj = await this.select().get();
        }

        return obj[obj.length - 1];
    }
}

export { TableQueryBuilder };
