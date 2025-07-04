import {Model, dbConfig} from './ORM.js';

const db = new Model(dbConfig);

// await db.deleteTable('tests');

describe('Create tests table', () => {
    test('Create tests table test', async () => {
        await db.createTable('tests');
        const exists = await db.exists('tests');

        expect(exists).toBe(true);
    });
});

describe('Module\'s createColumn method tests', () => {  
    test('Create name and job columns', async () => {
        await db.createColumn('tests', {name: 'name', type: 'string', length: 64, nullable: false});
        await db.createColumn('tests', {name: 'job', type: 'string', length: 64, defaultValue: 'chemist', nullable: true});

        const schemaData = await db.get_schema_data('tests');
        expect(schemaData.map((col) => col['column_name'])).toStrictEqual(['name', 'job']);
    }); 
});

describe('Module\'s add method tests', () => {
    test('Insert into tests table values', async () => {
        await db.add('tests', {name: "Micah", job: "rat"});
        await db.add('tests', {name: "Gustavo"});
        await db.add('tests', {name: "Gustavo"});

        const rows = await db.get('tests');

        expect(rows.length).toBeGreaterThan(0);
    });
});

describe('Module\'s get tests', () => {
    test('get all rows from table', async () => {
        const res = await db.get('tests');
        expect(res[0].name).toBe('Micah');
    });

    test('get specific rows from table', async () => {
        const res = await db.get('tests', (obj) => ['chemist', 'rat'].includes(obj['job']));
        expect(res.map((row) => row.name)).toStrictEqual(["Micah", "Gustavo", "Gustavo"]);
    });
});

describe('Delete tests table', () => {
    test('Delete tests table test', async () => {
        await db.deleteTable('tests');
        const exists = await db.exists('tests');

        expect(exists).toBe(false);
    });
});