import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

class QueryBuilder {
    /**
     * @param {string} tableName The name of the table.
     * @param {CSVDatabase} database The database instance.
     */
    constructor(tableName, database) {
        this.tableName = tableName;
        this.database = database;
        this._select = ['*'];
        this._where = [];
        this._order = [];
        this._desc = false;
        this._returning = ['*'];
        this._alter = ['*'];
    }

    /**
     * Specifies the columns to select.
     * @param  {...string} columns The columns to select.
     * @returns {QueryBuilder} The QueryBuilder instance.
     */
    select(...columns) {
        this._select = columns?.length > 0 ? columns : ['*'];
        return this;
    }

    /**
     * Adds a where clause to the query.
     * @param {Function(object): boolean} condition A function to filter the rows.
     * @returns {QueryBuilder} The QueryBuilder instance.
     */
    where(condition) {
        this._where.push(condition);
        return this;
    }

    /**
     * Specifies the columns to return.
     * @param  {...string} columns The columns to return.
     * @returns {QueryBuilder} The QueryBuilder instance.
     */
    returning(...columns) {
        this._returning = columns?.length > 0 ? columns : ['*'];
        return this;
    }

    /**
     * Specifies the columns to order by.
     * @param  {...string} columns The columns to order by.
     * @returns {QueryBuilder} The QueryBuilder instance.
     */
    orderBy(...columns) {
        this._order = columns?.length > 0 ? columns : [];
        return this;
    }

    /**
     * Specifies that the order should be descending.
     * @returns {QueryBuilder} The QueryBuilder instance.
     */
    descending() {
        this._desc = true;
        return this;
    }

    /**
     * Specifies the columns to alter.
     * @param  {...string} columns The columns to alter.
     * @returns {QueryBuilder} The QueryBuilder instance.
     */
    alter(...columns) {
        this._alter = columns?.length ? columns : ['*'];
        return this;
    }

    /**
     * Executes the query and returns the result.
     * @returns {Promise<Array<object>>} The result of the query.
     */
    async get() {
        let data = await this.database.readTable(this.tableName);

        // Apply where clauses
        if (this._where.length > 0) {
            data = data.filter(row => {
                return this._where.every(condition => condition(row));
            });
        }

        // Apply select
        if (this._select.length > 0 && this._select[0] !== '*') {
            data = data.map(row => {
                const newRow = {};
                this._select.forEach(column => {
                    if (Object.hasOwn(row, column)) {
                        newRow[column] = row[column];
                    }
                });
                return newRow;
            });
        }

        // Apply order
        if (this._order.length > 0) {
            data.sort((a, b) => {
                if (a[this._order[0]] > b[this._order[0]])
                    return 1;
                else if (a[this._order[0]] < b[this._order[0]])
                    return -1;

                return 0;
            });
        }

        if (this._desc) {
            data.reverse();
        }

        return data;
    }

    /**
     * Deletes rows from the table.
     * @returns {Promise<Array<object>|undefined>} The deleted rows if `returning` was called.
     */
    async delete() {
        let condition = this._where.length ? (row) => this._where.every((con) => con(row)) : null; 
        
        let rowsToDelete = [];
        if (this._returning.length) {
            rowsToDelete = await this.database.readTable(this.tableName);
            if (condition) rowsToDelete = rowsToDelete.filter(condition);
        }

        await this.database.deleteRows(this.tableName, condition);
        
        if (this._returning.length) {
            if (!this._returning.includes('*')) {
                return rowsToDelete.map(row => {
                    const newRow = {};
                    this._returning.forEach(column => {
                        if (Object.hasOwn(row, column)) {
                            newRow[column] = row[column];
                        }
                    });
                    return newRow;
                });
            } else {
                return rowsToDelete;
            }
        }
    }

    /**
     * Inserts rows into the table.
     * @param {Array<object>|object} values The values to insert.
     * @returns {Promise<Array<object>|undefined>} The inserted rows if `returning` was called.
     */
    async insert(values) {
        if (!values)
            throw new Error(`Didn't get the values argument. It should be either an array of objects or one single object`);

        await this.database.writeToTable(this.tableName, values);

        values = Array.isArray(values) ? values : [values];

        if (this._returning.length && !this._returning.includes('*')) {
            return values.map(row => {
                const newRow = {};
                this._returning.forEach(column => {
                    if (Object.hasOwn(row, column)) {
                        newRow[column] = row[column];
                    }
                });
                return newRow;
            });
        } else if (this._returning.length && this._returning[0] === '*') {
            return values;
        }
    }

    /**
     * Updates rows in the table.
     * @param {object} values The values to update.
     * @returns {Promise<Array<object>|undefined>} The updated rows if `returning` was called.
     */
    async update(values) {
        if (!values)
            throw new Error(`Didn't get the values argument. It should be an object, 
                where keys are columns and values are new items for those columns`);
        
        const condition = this._where.length ? (row) => this._where.every((con) => con(row)) : null; 
        let rowsToUpdate;

        if (this._returning.length) {
            rowsToUpdate = await this.database.readTable(this.tableName);
            if (condition) rowsToUpdate = rowsToUpdate.filter(condition);
        }

        await this.database.updateTable(this.tableName, condition, values);

        if (!this._returning.includes('*')) {
            return rowsToUpdate.map(row => {
                const newRow = {};
                this._returning.forEach(column => {
                    if (Object.hasOwn(row, column)) {
                        newRow[column] = row[column];
                    }
                });
                return newRow;
            });
        } else if (this._returning[0] === '*') {
            return rowsToUpdate;
        }
    }

    /**
     * Adds a column to the table.
     * @returns {Promise<void>}
     */
    async addColumns() {
        if (this._alter.length === 1 && this._alter[0] === '*')
            throw new Error(`User didn't specify what columns to add`)

        await this.database.appendColumns(this.tableName, this._alter);
    }

    /**
     * Deletes a column from the table.
     * @returns {Promise<void>}
     */
    async removeColumns() {
        if (this._alter.length === 1 && this._alter[0] === '*') {
            const columns = await this.database.getColumns(this.tableName);
            await this.database.deleteColumns(this.tableName, columns);
        } else {
            await this.database.deleteColumns(this.tableName, this._alter);
        }
    }

    /**
     * Returns the number of rows in the table.
     * @returns {Promise<number>} The number of rows.
     */
    async count() {
        let data = await this.get();
        return data.length;
    }

    /**
     * Returns the first row in the table.
     * @returns {Promise<object>} The first row.
     */
    async first() {
        let data = await this.get();
        return data[0];
    }

    /**
     * Returns the last row in the table.
     * @returns {Promise<object>} The last row.
     */
    async last() {
        const data = await this.get();
        return data[data.length - 1];
    }
}

class CSVDatabase {
    /**
     * @param {string} folderPath The path to the database folder.
     */
    constructor(folderPath) {
        this.databasePath = /\/$/.test(folderPath) ? folderPath : folderPath + '/';
    }

    /**
     * Creates a new query builder for a table.
     * @param {string} tableName The name of the table.
     * @returns {QueryBuilder} A new QueryBuilder instance.
     */
    table(tableName) {
        if (tableName.includes('..')) {
            throw new Error('Invalid table name');
        }
        return new QueryBuilder(tableName, this);
    }

    /**
     * Returns the list of all tables in a database
     * @returns An array of strings
     */
    async listTables() {
        return await fs.promises.readdir(this.databasePath);
    }

    /**
     * Creates a new file.
     * @param {string} tableName the name of the table
     */
    async createTable(tableName) {
        await fs.promises.writeFile(
            `${this.databasePath}${tableName}.csv`, '', 'utf-8'
        );
    }

    /**
     * Removes the table from the database.
     * @returns {Promise<void>}
     */
    async deleteTable(tableName) {
        await fs.promises.rm(this.databasePath + tableName + '.csv');
    }

    /**
     * Returns the columns of a given table.
     * @param {string} tablePath The path to the table 
     * @returns Array of columns.
     */
    async getColumns(tablePath) {
        const content = await fs.promises.readFile(this.databasePath + tablePath, 'utf-8');
        if (!content) return [];
        const records = parse(content, { delimiter: ',', trim: true, skip_empty_lines: true });
        return records[0];
    }

    /**
     * Retrieves an array of objects where each object represents one row.
     * @param {string} tablePath path to the table within the database 
     * @returns An array of objects where keys are columns and values are the items of that row
     */
    async readTable(tablePath) {
        const content = await fs.promises.readFile(this.databasePath + tablePath, 'utf-8');
        const records = parse(content, {columns: true, trim: true, skip_empty_lines: true});
        return records;
    }

    /**
     * Appends row(s) to the table.
     * @param {string} tablePath the path to the table within database
     * @param {Array<object> | Object<string|number>} data represents new row(s) to add.
     */
    async writeToTable(tablePath, data) {
        const rows = Array.isArray(data) ? data : [data];
        if (!rows.length) {
            return;
        }
           
        const columns = await this.getColumns(tablePath);
        const csvString = stringify(rows, { header: false, columns });
           
        await fs.promises.appendFile(this.databasePath + tablePath, '\n' + csvString, 'utf-8');
    }

    /**
     * Deletes a row from the table based on the given callback.
     * @param {string} tablePath the path of the table within the database.
     * @param {Function(object): boolean} condition A function to filter the rows that should be deleted.
     * It receives a row object and should return `true` to delete the row. If no condition provided, all rows are deleted.
     */
    async deleteRows(tablePath, condition) {
        const allRows = await this.readTable(tablePath);
        const rowsToKeep = condition ? allRows.filter(row => !condition(row)) : [];
        
        const columns = await this.getColumns(tablePath);
        const csvString = stringify(rowsToKeep, { header: true, columns });
                
        await fs.promises.writeFile(this.databasePath + tablePath, csvString, 'utf-8');
    }

    /**
     * Appends columns to the table.
     * @param {string} tablePath The path to the table.
     * @param {Array<string>|string} columns The columns to append.
     * @returns {Promise<void>}
     */
    async appendColumns(tablePath, columns) {
        const allColumns = await this.getColumns(tablePath) || [];
        columns = Array.isArray(columns) ? columns : [columns];
        if (columns.some((col) => allColumns.includes(col)))
            throw new Error(`Some of the provided columns already exist in the "${tablePath}" table.
                Provided columns: ${columns}, existing columns: ${allColumns}`);

        const allData = await this.readTable(tablePath);
        const newHeader = [...allColumns, ...columns];

        const csvString = stringify(allData, { header: true, columns: newHeader });
        await fs.promises.writeFile(this.databasePath + tablePath, csvString, 'utf-8');
    }

    /**
     * Deletes columns from the table.
     * @param {string} tablePath The path to the table.
     * @param {Array<string>|string} columns The columns to delete.
     * @returns {Promise<void>}
     */
    async deleteColumns(tablePath, columns) {
        const allColumns = await this.getColumns(tablePath) || [];
        columns = Array.isArray(columns) ? columns : [columns];
        if (!columns.every((col) => allColumns.includes(col))) 
            throw new Error(`Provided columns: ${columns}, existing columns: ${allColumns}`);

        const newColumns = allColumns.filter(col => !columns.includes(col));
        const allData = await this.readTable(tablePath);

        const csvString = stringify(allData, { header: true, columns: newColumns });
        await fs.promises.writeFile(this.databasePath + tablePath, csvString, 'utf-8');
    }

    /**
     * Updates the table.
     * @param {string} tablePath The path to the table.
     * @param {Function(object): boolean} condition A function to filter the rows that should be updated.
     * @param {object} data The data to update.
     * @returns {Promise<void>}
     */
    async updateTable(tablePath, condition, data) {
        const allRows = await this.readTable(tablePath);
        const columns = await this.getColumns(tablePath);

        if (!Object.keys(data).every((key) => columns.includes(key))) 
            throw new Error(`Some of the provided columns don't exist in the "${tablePath}" table`);
        
        const updatedRows = allRows.map(row => {
            if (condition(row)) {
                return { ...row, ...data };
            }
            return row;
        });

        const csvString = stringify(updatedRows, { header: true, columns });
        await fs.promises.writeFile(this.databasePath + tablePath, csvString, 'utf-8');
    }
}

// const db = new CSVDatabase('./DB/');

async function main() {
    const results = await db
        .table('index.csv')
        .returning()
        // .alter()
        // .addColumns();
        .select('First Name', 'Age')
        .where(row => row.Age < 30 || row['Last Name'] === 'Volnito')
        // .orderBy('First Name')
        // .descending()
        // .update({'First Name': "Doe"});
        .get();

    console.log(results);
}

// main();

export {CSVDatabase, QueryBuilder};