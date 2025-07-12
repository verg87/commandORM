import {Model, dbConfig} from './ORM.js';

const model = new Model(dbConfig);

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

describe(`TableQueryBuilder checkForTable method`, () => {
    test(`Table doesn't exist`, () => {
        return expect(model.table('tests_and_something').checkForTable()).rejects.toThrow();
    });
})

describe('Module\'s add method tests', () => {  
    test('Create name and job columns', async () => {
        await model.table('tests').add({name: 'name', type: 'string', length: 64, nullable: false});
        await model.table('tests').add({name: 'job', type: 'string', length: 64, defaultValue: 'chemist'});

        const schemaData = await model.getSchemaData('tests');
        expect(schemaData.map((col) => col['column_name'])).toStrictEqual(['name', 'job']);
    }); 

    test(`Test adding duplicate columns`, async () => {
        await expect(
            model.table('tests').add({name: 'job', type: 'string', length: 64})
        ).rejects.toThrow();
    });

    test(`Test adding invalid column name`, async () => {
        await expect(
            model.table('tests').add({name: 'age and salary', type: 'int', defaultValue: 30})
        ).rejects.toThrow();
    });

    test(`Column with type of string but no length`, async () => {
        await expect(
            model.table('tests').add({name: 'address', type: 'string'})
        ).rejects.toThrow();
    });

    test(`Create int type column`, async () => {
        await model.table('tests').add({name: 'age', type: 'int', nullable: true});
        const schemaData = await model.getSchemaData('tests');

        expect(schemaData.some((obj) => obj['column_name'] === 'age')).toBe(true);
    });

    test(`Test for error when creating float type column and not providing 'scale' and 'precision'`, async () => {
        await expect(
            model.table('tests').add({name: 'gpa', type: 'float', nullable: false})
        ).rejects.toThrow();
    });

    test(`Create float type column`, async () => {
        await model.table('tests').add({name: 'gpa', type: 'float', precision: 3, scale: 2});
        const schemaData = await model.getSchemaData('tests');

        expect(schemaData.some((obj) => obj['column_name'] === 'gpa')).toBe(true);
    });

    test(`Create date type column`, async () => {
        await model.table('tests').add({name: 'date_of_birth', type: 'date', nullable: false});
        const schemaData = await model.getSchemaData('tests');

        expect(schemaData.some((obj) => obj['column_name'] === 'date_of_birth')).toBe(true);
    });

    test(`Unsupported column type`, async () => {
        await expect(
            model.table('tests').add({name: 'something', type: 'something'})
        ).rejects.toThrow();
    });
});

describe(`Model's del method tests`, () => {
    test(`Delete column`, async () => {
        await model.table('tests').del('date_of_birth');
        await model.table('tests').del('gpa')
        const schemaData = await model.getSchemaData('tests');

        expect(schemaData.every((obj) => !['date_of_birth', 'gpa'].includes(obj['column_name']))).toBe(true);
    });

    test(`Invalid column name`, async () => {
        await expect(() =>
            model.table('tests').del('somethinga')
        ).rejects.toThrow();
    });

    // test(``)
});

describe(`Model's getPrimaryKeys methods tests`, () => {
    test('has primary keys', async () => {
        const primaryKeys = await model.getPrimaryKeys('tests');

        expect(primaryKeys.length).toBe(0);
    });
});

describe('Model\'s insert method tests', () => {
    test('Insert into tests table values', async () => {
        await model.table('tests').insert([{name: "Micah", age: 29, job: 'rat'}]);
        await model.table('tests').insert({name: "Gustavo", age: 32});
        const insertWithReturning = await model.table('tests').returning('name').insert({name: "Gustavo"});

        const rows = await model.table('tests').select().get();

        expect(rows.length).toBeGreaterThan(0);
        expect(insertWithReturning[0].name).toBe('Gustavo')
    });

    test(`Insert into invalid table name, column`, async () => {    
        await expect(async () => {
            await model.table('tests and something else').insert({name: "Bob"})
        }).rejects.toThrow();

        await expect(async () => {
            await model.table('tests').insert({'and': "John"})
        }).rejects.toThrow();
    });

    test(`Test for missing mandatory column in object argument`, async () => {
        // Since name column can't be nullable and doesn't have default value it's mandatory
        await expect(
            model.table('tests').insert({job: 'janitor'})
        ).rejects.toThrow();
    });

    test(`Test for not existing columns provided by user`, async () => {
        // Age column doesn't exist in the tests table 
        await expect(
            model.table('tests').insert({name: 'Jack', job: 'Janitor', age: 33, weather: 'hot'})
        ).rejects.toThrow();
    });
});

describe('Model\'s get tests', () => {
    test('get all rows from table', async () => {
        const res = await model.table('tests').select().get();
        expect(res[0].name).toBe('Micah');
    });

    test(`call get without select and with unknown columns`, async () => {
        await expect(
            model.table('tests').get()
        ).rejects.toThrow();

        await expect(
            model.table('tests').select('*', 'something').get()
        ).rejects.toThrow();
    });

    test(`use desc, limit, orderBy with get`, async () => {
        const descTableContents = await model.table('tests').select().get();
        const reversedTableContents = await model.table('tests').select().desc().get();

        expect(descTableContents.reverse()).toStrictEqual(reversedTableContents);

        const tableContents = await model.table('tests').select().get();
        const tableContentsWithLimit = await model.table('tests').select().limit(2).get();

        expect(tableContents.slice(0, 2)).toStrictEqual(tableContentsWithLimit);

        const tableContentsOrderedByAge = await model.table('tests').select().orderBy('age').get();
        const tableContentsOrderedBy = await model.table('tests').select().orderBy().get();

        expect(tableContentsOrderedByAge[0].age).toStrictEqual(29);
        expect(tableContents).toStrictEqual(tableContentsOrderedBy)
    })

    test('get specific rows from table', async () => {
        const query = await model.table('tests').select().where('job', ['chemist', 'rat']).get();
        const queryWithIsNull = await model.table('tests').select().where('job', null).and('age', null).get();
        
        expect(query.map((row) => row.name)).toStrictEqual(["Micah"]);
        expect(queryWithIsNull.map(row => [row.job, row.age])).toStrictEqual([[null, null]])
    });

    test(`Use 'and' and 'or' methods without calling where first`, () => {
        expect(() => model.table('tests').select().and('job', null)).toThrow();
        expect(() => model.table('tests').select().or('age', null)).toThrow();
    })
});

describe(`Models countRows method tests`, () => {
    test(`Count rows`, async () => {
        const rows = await model.table('tests').count();

        expect(rows).toBe(3);
    });
});

describe(`Models first method tests`, () => {
    test(`Get the first item`, async () => {
        const allItems = await model.table('tests').select().get();
        const firstItem = await model.table('tests').first();

        expect(firstItem).toStrictEqual(allItems[0]);
    });
})

describe(`Models last method tests`, () => {
    test(`Get the last item`, async () => {
        const allItems = await model.table('tests').select().get();
        const lastItem = await model.table('tests').last();

        expect(lastItem).toStrictEqual(allItems[allItems.length - 1]);
    });
});

describe(`Models update method tests`, () => {
    // test(`Update where job is chemist and age is null`, async () => {
    //     const chemistWithAgeNullBefore = await model.table('tests')
    //         .select().where('job', 'chemist').and('age', null).get();

    //     await model.table('tests').where('job', ['rat', 'chemist'])
    //         .and('age', null).update({name: 'Pedro'});

    //     const chemistWithAgeNullAfter = await model.table('tests')
    //         .select().where('job', 'chemist').and('age', null).get();

    //     expect(chemistWithAgeNullBefore[0].name).toBe('Gustavo');
    //     expect(chemistWithAgeNullAfter[0].name).toBe('Pedro');
    // });

    // test(`Update with returning`, async () => {

    // })

    test(`Update where age is 29`, async () => {
        const personBefore = await model.table('tests')
            .select().where('job', 'rat').get();

        const updateWithReturning = await model.table('tests').returning().where('age', 29).update({age: 31});

        const personAfter = await model.table('tests')
            .select().where('job', 'rat').get();

        expect(personBefore[0].age).toBe(29);
        expect(personAfter[0].age).toBe(31);
        expect(updateWithReturning).toStrictEqual(personAfter);
    });

    test(`Invalid condition items`, async () => {
        expect(() => {
            model.table('tests').where('job', 'wrong', 'condition')
                .and('age', 'correct stru').update({name: 'less'})
        }).toThrow();
    });
});

describe(`Model's delete method tests`, () => {
    test(`Delete rows`, async () => {
        await model.table('tests').where('age', '<', 30).or('name', ['Micah', 'Pedro', 'Gustavo']).delete();
        const rows = await model.table('tests').select().get();

        expect(rows).toStrictEqual([]);
    });
})

describe('Delete tests table', () => {
    test('Delete tests table test', async () => {
        await model.deleteTable('tests');
        const exists = await model.exists('tests');

        expect(exists).toBe(false);
    });

    test(`Delete table that doesn't exist`, async () => {
        await expect(
            model.deleteTable('tests')
        ).rejects.toThrow();
    });
});