import {Model, dbConfig} from './ORM.js';

const model = new Model(dbConfig, 'public');

// await model.deleteTable('tests');

describe('Create tests table', () => {
    test('Create tests table test', async () => {
        await model.createTable('tests');
        const exists = await model.exists('tests');

        expect(exists).toBe(true);
    });
});

describe('Module\'s createColumn method tests', () => {  
    test('Create name and job columns', async () => {
        await model.createColumn('tests', {name: 'name', type: 'string', length: 64, nullable: false});
        await model.createColumn('tests', {name: 'job', type: 'string', length: 64, defaultValue: 'chemist'});

        const schemaData = await model.getSchemaData('tests');
        expect(schemaData.map((col) => col['column_name'])).toStrictEqual(['name', 'job']);
    }); 
});

describe('Module\'s add method tests', () => {
    test('Insert into tests table values', async () => {
        await model.add('tests', {name: "Micah", job: "rat"});
        await model.add('tests', {name: "Gustavo"});
        await model.add('tests', {name: "Gustavo"});

        const rows = await model.get('tests');

        expect(rows.length).toBeGreaterThan(0);
    });
});

describe('Module\'s get tests', () => {
    test('get all rows from table', async () => {
        const res = await model.get('tests');
        expect(res[0].name).toBe('Micah');
    });

    test('get specific rows from table', async () => {
        const res = await model.get('tests', (obj) => ['chemist', 'rat'].includes(obj['job']));
        expect(res.map((row) => row.name)).toStrictEqual(["Micah", "Gustavo", "Gustavo"]);
    });
});

describe('Delete tests table', () => {
    test('Delete tests table test', async () => {
        await model.deleteTable('tests');
        const exists = await model.exists('tests');

        expect(exists).toBe(false);
    });
});