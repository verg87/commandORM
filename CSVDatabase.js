import fs from 'node:fs';


class CSVDatabase {
    constructor(folderPath) {
        this.databasePath = folderPath;
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
        const columnNewLineIndex = text.search('\n');

        const columnString = text.slice(0, columnNewLineIndex).trim();
        return columnString.split(',').map((col) => col.trim());
    }

    /**
     * Retrieves an array of objects where each object represents one row.
     * @param {string} tablePath path to the table within the database 
     * @returns An array of objects where keys are columns and values are the items of that row
     */
    async readTable(tablePath) {
        const text = await fs.promises.readFile(this.databasePath + tablePath, 'utf-8');
        const columnNewLineIndex = text.search('\n');

        const columnString = text.slice(0, columnNewLineIndex).trim();
        const columns = columnString.split(',').map((col) => col.trim());

        const rows = text.slice(columnNewLineIndex + 1).split('\n').map(v => v.trim());

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

    async deleteRow(tablePath, condition) {
        
    }
}

const db = new CSVDatabase('./DB/');
// db.writeToTable('index.csv', {"First Name": 'Clevland', Age: 38, job: 'none', "Last Name": 'Quandranto'});
// const res = await db.readTable('index.csv');
// console.log(res);