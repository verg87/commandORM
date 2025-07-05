import {Model, dbConfig} from './ORM.js';

const model = new Model(dbConfig, 'public');

// await model.deleteTable('tests');

describe('Create tests table', () => {
    test('Create tests table test', async () => {
        await model.createTable('tests');
        const exists = await model.exists('tests');

        expect(exists).toBe(true);
    });

    test(`Create already existing table`, async () => {
        await expect(
            model.createTable('tests')
        ).rejects.toThrow();
    });
});

describe('Module\'s createColumn method tests', () => {  
    test('Create name and job columns', async () => {
        await model.createColumn('tests', {name: 'name', type: 'string', length: 64, nullable: false});
        await model.createColumn('tests', {name: 'job', type: 'string', length: 64, defaultValue: 'chemist'});

        const schemaData = await model.getSchemaData('tests');
        expect(schemaData.map((col) => col['column_name'])).toStrictEqual(['name', 'job']);
    }); 

    test(`Test adding duplicate columns`, async () => {
        await expect(
            model.createColumn('tests', {name: 'job', type: 'string', length: 64})
        ).rejects.toThrow();
    });

    test(`Test adding invalid column name`, async () => {
        await expect(
            model.createColumn('tests', {name: 'age and salary', type: 'int', defaultValue: 30})
        ).rejects.toThrow();
    });

    test(`Column with type of string but no length`, async () => {
        await expect(
            model.createColumn('tests', {name: 'address', type: 'string'})
        ).rejects.toThrow();
    });

    test(`Create int type column`, async () => {
        await model.createColumn('tests', {name: 'age', type: 'int', nullable: true});
        const schemaData = await model.getSchemaData('tests');

        expect(schemaData.some((obj) => obj['column_name'] === 'age')).toBe(true);
    });

    test(`Test for error when creating float type column and not providing 'scale' and 'precision'`, async () => {
        await expect(
            model.createColumn('tests', {name: 'gpa', type: 'float', nullable: false})
        ).rejects.toThrow();
    });

    test(`Create float type column`, async () => {
        await model.createColumn('tests', {name: 'gpa', type: 'float', precision: 3, scale: 2});
        const schemaData = await model.getSchemaData('tests');

        expect(schemaData.some((obj) => obj['column_name'] === 'gpa')).toBe(true);
    });

    test(`Create date type column`, async () => {
        await model.createColumn('tests', {name: 'date_of_birth', type: 'date', nullable: false});
        const schemaData = await model.getSchemaData('tests');

        expect(schemaData.some((obj) => obj['column_name'] === 'date_of_birth')).toBe(true);
    });

    test(`Unsupported column type`, async () => {
        await expect(
            model.createColumn('tests', {name: 'something', type: 'something'})
        ).rejects.toThrow();
    });
});

describe(`Model's deleteColumn method tests`, () => {
    test(`Delete column`, async () => {
        await model.deleteColumn('tests', 'date_of_birth');
        await model.deleteColumn('tests', 'gpa')
        const schemaData = await model.getSchemaData('tests');

        expect(schemaData.every((obj) => !['date_of_birth', 'gpa'].includes(obj['column_name']))).toBe(true);
    });

    test(`Invalid column name`, async () => {
        await expect(
            model.deleteColumn('tests', 'gpa and')
        ).rejects.toThrow();
    })
});

describe(`Model's getPrimaryKeys methods tests`, () => {
    test('has primary keys', async () => {
        const primaryKeys = await model.getPrimaryKeys('tests');

        expect(primaryKeys.length).toBe(0);
    });
});

describe('Model\'s add method tests', () => {
    test('Insert into tests table values', async () => {
        await model.add('tests', {name: "Micah", age: 29, job: 'rat'});
        await model.add('tests', {name: "Gustavo", age: 32});
        await model.add('tests', {name: "Gustavo"});

        const rows = await model.get('tests');

        expect(rows.length).toBeGreaterThan(0);
    });

    test(`Insert into invalid table name, column`, async () => {    
        await expect(
            model.add('tests and something else', {name: "Bob"})
        ).rejects.toThrow();

        await expect(
            model.add('tests', {'name and': "John"})
        ).rejects.toThrow();
    });

    test(`Test for missing mandatory column in object argument`, async () => {
        // Since name column can't be nullable and doesn't have default value it's mandatory
        await expect(
            model.add('tests', {job: 'janitor'})
        ).rejects.toThrow();
    });

    test(`Test for not existing columns provided by user`, async () => {
        // Age column doesn't exist in the tests table 
        await expect(
            model.add('tests', {name: 'Jack', job: 'Janitor', age: 33, weather: 'hot'})
        ).rejects.toThrow();
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

describe(`Models countRows method tests`, () => {
    test(`Count rows`, async () => {
        const rows = await model.countRows('tests');

        expect(rows).toBe(3);
    });
});

describe(`Models firstItem method tests`, () => {
    test(`Get the first item`, async () => {
        const allItems = await model.get('tests');
        const firstItem = await model.firstItem('tests');

        expect(firstItem).toStrictEqual(allItems[0]);
    });
})

describe(`Models lastItem method tests`, () => {
    test(`Get the last item`, async () => {
        const allItems = await model.get('tests');
        const lastItem = await model.lastItem('tests');

        expect(lastItem).toStrictEqual(allItems[allItems.length - 1]);
    });
});

describe(`Models update method tests`, () => {
    test(`Update where job is chemist and age is null`, async () => {
        const chemistWithAgeNullBefore = await model.get('tests', (obj) => obj.job === 'chemist' && obj.age === null);
        await model.update('tests', {name: 'Pedro'}, {job: {value: ['rat', 'chemist'], op: '='}, AND: null, age: {value: null, op: '='}});
        const chemistWithAgeNullAfter = await model.get('tests', (obj) => obj.job === 'chemist' && obj.age === null);

        expect(chemistWithAgeNullBefore[0].name).toBe('Gustavo');
        expect(chemistWithAgeNullAfter[0].name).toBe('Pedro');
    });

    test(`Update where age is 29`, async () => {
        const personBefore = await model.get('tests', (obj) => obj.job === 'rat');
        await model.update('tests', {age: 31}, {age: {value: 29, op: '='}});
        const personAfter = await model.get('tests', (obj) => obj.job === 'rat');

        expect(personBefore[0].age).toBe(29);
        expect(personAfter[0].age).toBe(31);
    });

    test(`Invalid condition items`, async () => {
        await expect(
            model.update('tests', {name: 'less'}, {job: ['wrong', 'condition', 'structure'], age: {value: 'correct structure', op: '='}})
        ).rejects.toThrow();
    });
});

describe(`Model's delete method tests`, () => {
    test(`Delete rows`, async () => {
        await model.delete('tests', {columns: ['age', 'name'], ops: ['AND', 'AND']}, (obj) => obj.age < 30 || ['Micah', 'Pedro', 'Gustavo'].includes(obj.name));
        const rows = await model.get('tests');

        expect(rows).toStrictEqual([]);
    });

    test(`Mapping not provided`, async () => {
        await expect(
            model.delete('tests', null, (obj) => obj.age > 30)
        ).rejects.toThrow();
    });
})

describe('Delete tests table', () => {
    test('Delete tests table test', async () => {
        await model.deleteTable('tests');
        const exists = await model.exists('tests');

        expect(exists).toBe(false);
    });
});