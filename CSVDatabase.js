import fs from 'node:fs';
import test from 'node:test';


class CSVDatabase {
    constructor(folderPath) {
        this.databasePath = folderPath;
    }

    listTables() {
        return fs.readdirSync(this.databasePath);
    }

    async readTable(tablePath) {
        const text = await fs.promises.readFile(this.databasePath + tablePath, 'utf-8');
        const columnNewLineIndex = text.search('\n');

        const columnString = text.slice(0, columnNewLineIndex).trim();
        const columns = columnString.split(',').map((col) => col.trim());

        const values = text.slice(columnNewLineIndex + 1).split(',').map((value) => value.replace(/\r|\n|\r\n/, ''));
        console.log(values);

        return columns
    }
}

const db = new CSVDatabase('./DB/');
const res = await db.readTable('index.csv');
console.log(res);