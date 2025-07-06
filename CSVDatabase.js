import fs from 'node:fs';

class QueryBuilder {
    constructor(tableName, database) {
        this.tableName = tableName;
        this.database = database;
        this._select = ['*'];
        this._where = [];
    }

    select(...columns) {
        this._select = columns.length > 0 ? columns : ['*'];
        return this;
    }

    where(condition) {
        this._where.push(condition);
        return this;
    }

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

        return data;
    }
}

class CSVDatabase {
    constructor(folderPath) {
        this.databasePath = folderPath;
    }

    table(tableName) {
        return new QueryBuilder(tableName, this);
    }

    /**
     * Returns the list of all tables in a database
     * @returns An array of strings
     */
    listTables() {
        return fs.readdirSync(this.databasePath);
    }

    /**
     * Returns the columns of a given table.
     * @param {string} tablePath The path to the table 
     * @returns Array of columns.
     */
    async getColumns(tablePath) {
        const text = await fs.promises.readFile(this.databasePath + tablePath, 'utf-8');
        const columnString = text.split('\n')[0].trim();

        return columnString.split(',').map((col) => col.trim());
    }

    /**
     * Retrieves an array of objects where each object represents one row.
     * @param {string} tablePath path to the table within the database 
     * @returns An array of objects where keys are columns and values are the items of that row
     */
    async readTable(tablePath) {
        const text = await fs.promises.readFile(this.databasePath + tablePath, 'utf-8');
        const rowsAndColumns = text.split('\n');

        const columns = rowsAndColumns[0].trim().split(',').map((col) => col.trim());
        const rows = rowsAndColumns.slice(1).map(v => v.trim());

        return rows.reduce((acc, item) => {
            const obj = {};
            const row = item.split(',').map(v => v.trim());

            columns.map((column, idx) => {
                obj[column] = row[idx];
            })

            acc.push(obj);
            return acc;
        }, []);
    }

    /**
     * Appends a new row to the table.
     * @param {string} tablePath the path to the table within database
     * @param {Object<string, string|number>} values represents a newly row to add.
     */
    async writeToTable(tablePath, values) {
        const columns = (await this.getColumns(tablePath));
        const obj = {};

        columns.forEach((col) => {
            if (!Object.hasOwn(values, col)) 
                throw new Error(`Missing column: ${col}`);

            obj[col] = undefined;
        });

        Object.entries(values).map(([key, value]) => {
            obj[key] = value;
        })

        const csvString = '\n' + Object.values(obj).join(', ');
        await fs.promises.appendFile(this.databasePath + tablePath, csvString, 'utf-8');
    }

    /**
     * Deletes a row from the table based on the given callback.
     * @param {string} tablePath the path of the table within the database.
     * @param {Function(object): boolean} condition A function to filter the rows that should be deleted.
     * It receives a row object and should return `true` to include the row.
     */
    async deleteRow(tablePath, condition) {
        const rows = await this.readTable(tablePath);
        const rowsToDelete = rows.filter(condition);

        const stringsToDelete = rowsToDelete.reduce((acc, row) => {
            acc.push(Object.values(row).join(', '));
            return acc;
        }, []);

        const text = (await fs.promises.readFile(this.databasePath + tablePath, 'utf-8')).split('\n');

        let rowsString = text.slice(1).join('\n');
        stringsToDelete.forEach((str) => {
            rowsString = rowsString.split('\n' + str).join('');
        })
        
        const changedTable = [text[0], rowsString].join('\n');

        await fs.promises.writeFile(this.databasePath + tablePath, changedTable, 'utf-8');
    }
}

const db = new CSVDatabase('./DB/');

async function main() {
    const results = await db
        .table('index.csv')
        .select('First Name', 'Age')
        .where(row => row.Age > 25)
        .get();

    console.log(results);
}

main();