import fs from 'node:fs';

class QueryBuilder {
    constructor(tableName, database) {
        this.tableName = tableName;
        this.database = database;
        this._select = ['*'];
        this._where = [];
        this._order = [];
        this._desc = false;
        this._returning = ['*'];
    }

    select(...columns) {
        this._select = columns.length > 0 ? columns : ['*'];
        return this;
    }

    where(condition) {
        this._where.push(condition);
        return this;
    }

    returning(...columns) {
        this._returning = columns.length > 0 ? columns : ['*'];
        return this;
    }

    orderBy(...columns) {
        this._order = columns.length > 0 ? columns : [];
        return this;
    }

    descending() {
        this._desc = true;
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

    async delete() {
        let condition = this._where.length ? (row) => this._where.every((con) => con(row)) : null; 
        await this.database.deleteRows(this.tableName, condition);
        
        if (this._returning.length) {
            let rowsToDelete = await this.database.readTable(this.tableName);
            if (condition) rowsToDelete = rowsToDelete.filter(condition);

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
        } else if (this._returning.length) {
            return values;
        }
    }

    async update(values) {
        if (!values)
            throw new Error(`Didn't get the values argument. It should be an object, 
                where keys are columns and values are new items for those columns`);
        
        const condition = this._where.length ? (row) => this._where.every((con) => con(row)) : null; 
        await this.database.updateTable(this.tableName, condition, values);

        if (this._returning.length && !this._returning.includes('*')) {
            return [values].map(row => {
                const newRow = {};
                this._returning.forEach(column => {
                    if (Object.hasOwn(row, column)) {
                        newRow[column] = row[column];
                    }
                });
                return newRow;
            });
        } else if (this._returning.length) {
            return values;
        }
    }

    async count() {
        let data = await this.get();
        return data.length;
    }

    async first() {
        let data = await this.get();
        return data[0];
    }

    async last() {
        const data = await this.get();
        return data[data.length - 1];
    }

    async remove() {
        await fs.promises.rm(this.database.databasePath + this.tableName);
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
        const rows = rowsAndColumns.slice(1).map(v => v.trim()).filter(v => v);

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
           
        const newRowsAsCsv = rows.map(values => {
            const valueKeys = Object.keys(values);
            for (const key of valueKeys) {
                if (!columns.includes(key)) {
                    throw new Error(`Column "${key}" does not exist in table "${tablePath}"`);
                }
            }
           
            return columns.map(col => {
                if (!Object.hasOwn(values, col)) {
                    throw new Error(`Missing value for column: ${col}`);
                }
                return values[col];
            }).join(', ');
        }).join('\n');
           
        await fs.promises.appendFile(this.databasePath + tablePath, '\n' + newRowsAsCsv, 'utf-8');
    }

    /**
     * Deletes a row from the table based on the given callback.
     * @param {string} tablePath the path of the table within the database.
     * @param {Function(object): boolean} condition A function to filter the rows that should be deleted.
     * It receives a row object and should return `true` to delete the row. If no condition provided, all rows are deleted.
     */
    async deleteRows(tablePath, condition) {
        const columns = await this.getColumns(tablePath);
        let rowsToKeep = [];
        
        if (condition) {
            const allRows = await this.readTable(tablePath);
            rowsToKeep = allRows.filter(row => !condition(row));
        }
        
        const headerString = columns.join(', ');
        const rowsString = rowsToKeep.map(row => 
            columns.map(col => row[col]).join(', ')
        ).join('\n');
        
        const newContent = headerString + (rowsString ? '\n' + rowsString : '');
                
        await fs.promises.writeFile(this.databasePath + tablePath, newContent, 'utf-8');
    }

    async deleteColumns(tablePath, columns) {
        const allColumns = await this.getColumns(tablePath);
        if (!columns.every((col) => allColumns.includes(col))) 
            throw new Error(`Provided columns: ${columns}, existing columns: ${allColumns}`);

        const indexes = columns.map((col) => allColumns.indexOf(col));
        
        const text = await fs.promises.readFile(this.databasePath + tablePath, 'utf-8');
        const rows = text.split('\n')
            .map((row) => {
                return row.split(',')
                    .filter((_, idx) => !indexes.includes(idx));
            });
            
        const rowStrings = rows.map((row) => {
            return row.map(v => v.trim()).join(', ');
        }).join('\n');

        await fs.promises.writeFile(this.databasePath + tablePath, rowStrings, 'utf-8');
    }

    async updateTable(tablePath, condition, data) {
        const allRows = await this.readTable(tablePath);
        const columns = await this.getColumns(tablePath);

        if (!Object.keys(data).every((key) => columns.includes(key))) 
            throw new Error(`Some of the provided columns don't exist in the "${tablePath}" table`);
        
        const rowsToUpdate = condition ? allRows.filter(condition) : [];

        const newContent = rowsToUpdate.map((row) => {
            Object.keys(row).map((key) => {
                if (Object.hasOwn(data, key))
                    row[key] = data[key];
            });

            return row;
        });

        await this.deleteRows(tablePath, condition);
        await this.writeToTable(tablePath, newContent);
    }
}

const db = new CSVDatabase('./DB/');

// db.updateTable('index.csv', (row) => row.Age < 30 || row['First Name'] === 'Pedro', {Age: 20})

async function main() {
    const results = await db
        .table('index.csv')
        .returning('First Name', 'Age')
        .insert({"First Name": 'Micah', "Last Name": 'Bell', job: 'rat', Age: 42});
        // .select('First Name', 'Age')
        // .where(row => row.Age < 30 || row['Last Name'] === 'Volnito')
        // .orderBy('First Name')
        // .descending()
        // .get();
        // .update({Age: 19});

    console.log(results);
}

main();