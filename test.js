import { stringify } from 'csv-stringify/sync';
import fs from 'node:fs';

const content = await fs.promises.readFile('./DB/index.csv', 'utf-8');
const records = stringify([{name: 'Bob', age: 23, salary: 3000}], {header: false, columns: ['name', 'salary', 'age']})
// const records = parse(content, {trim: true, skip_empty_lines: true});
console.log(records);