import { CSVDatabase, QueryBuilder } from "./CSVDatabase.js";

describe(`QueryBuilder tests`, () => {
    let db;

    test(`Create a table`, async () => {
        db = new CSVDatabase('./DB');

        await db.createTable('tests');
        const tables = await db.listTables();

        expect(tables.includes('tests.csv')).toBe(true);
    });

    test(`Invalid table name`, () => {
        expect(() => db.table('../tests.csv')).toThrow();
    });

    describe(`Alter method tests`, () => {
        test(`Add column`, async () => {
            await db.table('tests.csv')
                .alter('age', 'fav_color')
                .addColumns();

            const columns = await db.getColumns('tests.csv');

            expect(columns).toStrictEqual(['age', 'fav_color']);
        });

        test(`User didn't specify columns to add`, async () => {
            await expect(
                db.table('tests.csv')
                    .alter()
                    .addColumns()
            ).rejects.toThrow();
        });

        test(`User tries to add an existing column`, async () => {
            await expect(
                db.table('tests.csv')
                    .alter('age')
                    .addColumns()
            ).rejects.toThrow();
        });

        test(`Remove column`, async () => {
            await db.table('tests.csv')
                .alter('fav_color')
                .removeColumns();

            const columns = await db.getColumns('tests.csv');

            expect(!columns.includes('fav_color')).toBe(true);
        });

        test(`Column to remove doesn't exist`, async () => {
            await expect(
                db.table('tests.csv')
                    .alter('something')
                    .removeColumns()
            ).rejects.toThrow();
        });

        test(`Remove all columns`, async () => {
            await db.table('tests.csv')
                .alter()
                .removeColumns();

            const columns = await db.getColumns('tests.csv');

            expect(columns).toBeUndefined();

            await db.table('tests.csv')
                .alter('first_name', 'last_name', 'age', 'salary')
                .addColumns();
        });
    })

    describe(`Insert method tests`, () => {
        test(`Add a row`, async () => {
            const data = [
                {first_name: 'Bob', last_name: 'Billy', age: '43', salary: '4500'},
                {first_name: 'Bob', last_name: 'Porway', age: '34', salary: '5100'},
                {first_name: 'Sally', last_name: 'Cate', age: '33', salary: '5000'}
            ];

            await db.table('tests.csv')
                .insert(data);

            const tableContents = await db.table('tests.csv').select().get();

            expect(tableContents).toStrictEqual(data);
        });

        test(`User didn't provide values argument`, async () => {
            await expect(
                db.table('tests.csv')
                    .insert()
            ).rejects.toThrow();
        });

        test(`User provided empty values argument`, async () => {
            const tableContentsBefore = await db.table('tests.csv').select().get();

            await db.table('tests.csv').insert([]);

            const tableContentsAfter = await db.table('tests.csv').select().get();

            expect(tableContentsBefore).toStrictEqual(tableContentsAfter);
        });

        test(`Insert with returning`, async () => {
            const data = {first_name: 'Pedro', last_name: 'Gondino', age: '23', salary: '5000'};

            const returned = await db.table('tests.csv')
                .returning()
                .insert(data);

            const tableContents = await db.table('tests.csv').select().get();

            expect(tableContents).toContainEqual(data);
            expect(returned[0]).toStrictEqual(data);
        });

        test(`Insert with returning specific columns`, async () => {
            const data = {first_name: 'Guanto', last_name: 'Ginto', age: '24', salary: '1000'};

            const returned = await db.table('tests.csv')
                .returning('first_name', 'age')
                .insert(data);

            const tableContents = await db.table('tests.csv')
                .select('first_name', 'age')
                .get();

            expect(tableContents).toContainEqual(returned[0]);
        });
    })

    describe(`Update method tests`, () => {
        test(`Update a row`, async () => {
            const tableContentsBefore = await db.table('tests.csv').select().get();

            await db.table('tests.csv')
                .where(row => parseInt(row.salary) < 4600)
                .update({salary: '4250'});

            const tableContentsAfter = await db.table('tests.csv').select().get();
            
            expect(tableContentsBefore.every(row => row.salary !== '4250')).toBe(true);
            expect(tableContentsAfter.every(row => ['4250', '5000', '5100'].includes(row.salary))).toBe(true);
        });

        test(`User didn't provide values argument`, async () => {
            await expect(
                db.table('tests.csv').update()
            ).rejects.toThrow();
        });

        test(`Update not existing column`, async () => {
            await expect(
                db.table('tests.csv').update({fav_color: 'blue'})
            ).rejects.toThrow();
        });

        test(`Update with no condition`,  async () => {
            await db.table('tests.csv').update({age: 30});

            const tableContents = await db.table('tests.csv').select('age').get();

            expect(tableContents.every(row => row.age === '30')).toBe(true);
        });

        test(`Update with returning`, async () => {
            const returned = await db.table('tests.csv')
                .returning('age')
                .update({age: 33});

            expect(returned.every(row => row.age === '30')).toBe(true);
        });

        test(`Update with condition and returning`, async () => {
            const returned = await db.table('tests.csv')
                .returning()
                .where(row => row.age >= 30 && row.age < 40)
                .update({age: 22});

            expect(returned.every(row => row.age === '33')).toBe(true);
        });
    });

    describe(`Get method tests`, () => {
        test(`Get all table`, async () => {
            const res = await db.table('tests.csv').select().get();
            const expected = await db.readTable('tests.csv');

            expect(res).toStrictEqual(expected);
        });

        test(`Get with where`, async () => {
            const tableContents = await db.table('tests.csv')
                .select()
                .where(row => parseInt(row.salary) < 5000)
                .get();

            const expected = (await db.readTable('tests.csv'))
                .filter((row) => parseInt(row.salary) < 5000);

            expect(tableContents).toStrictEqual(expected);
        });

        test(`Get with order`, async () => {
            const tableContents = await db.table('tests.csv')
                .select()
                .orderBy('first_name')
                .get();

            const expected = (await db.readTable('tests.csv'))
                .sort((a, b) => a.first_name.charCodeAt() - b.first_name.charCodeAt());

            expect(tableContents).toStrictEqual(expected);
        });

        test(`Get with descending`, async () => {
            const tableContents = await db.table('tests.csv').select().desc().get();
            const expected = (await db.readTable('tests.csv')).reverse();

            expect(tableContents).toStrictEqual(expected);
        });
    });

    describe(`Utility methods tests`, () => {
        test(`Count rows`, async () => {
            const rows = await db.table('tests.csv').select().count();
            const expected = (await db.readTable('tests.csv')).length;

            expect(rows).toBe(expected);
        });

        test(`Get the first row in the table`, async () => {
            const first = await db.table('tests.csv').select().first();
            const expected = (await db.readTable('tests.csv'))[0];

            expect(first).toStrictEqual(expected);
        });

        test(`Get the last row in the table`, async () => {
            // Get the person with the lowest salary
            const last = await db.table('tests.csv').orderBy('salary').desc().last();
            const expected = (await db.readTable('tests.csv'))
                .sort((a, b) => parseInt(a.salary) - parseInt(b.salary))[0];

            expect(last).toStrictEqual(expected);
        });
    })

    describe(`Delete method tests`, () => {
        test(`Delete a row`, async () => {
            const deletedGinto = await db.table('tests.csv').select().where(row => row.last_name === 'Ginto').get();
            await db.table('tests.csv')
                .where(row => row.last_name === 'Ginto')
                .delete();

            const tableContents = await db.table('tests.csv').get();

            expect(tableContents).not.toContainEqual(deletedGinto);
        });

        test(`Delete a row with returning`, async () => {
            const deletedBilly = await db.table('tests.csv')
                .returning()
                .where(row => row.last_name === 'Billy')
                .delete();

            const tableContents = await db.table('tests.csv').get();

            expect(tableContents).not.toContainEqual(deletedBilly);
        });

        test(`Delete a row with returning and specific columns`, async () => {
            const deletedGondino = await db.table('tests.csv')
                .returning('first_name')
                .where(row => row.last_name === 'Gondino')
                .delete();

            const tableContents = await db.table('tests.csv').select('first_name').get();

            expect(tableContents).not.toContainEqual(deletedGondino);
        });

        test(`Delete all rows`, async () => {
            await db.table('tests.csv').delete();

            const tableContents = await db.table('tests.csv').select().get();

            expect(tableContents).toStrictEqual([]);
        });
    });

    test(`Delete the table`, async () => {
        await db.deleteTable('tests');

        const tables = await db.listTables();

        expect(tables.includes('tests.csv')).toBe(false);
    });
});