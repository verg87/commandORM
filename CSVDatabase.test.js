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
                {first_name: 'Sally', last_name: 'Cate', age: '33', salary: '5000'}
            ];

            await db.table('tests.csv')
                .insert(data);

            const tableContents = await db.table('tests.csv').get();

            expect(tableContents).toStrictEqual(data);
        });

        test(`User didn't provide values argument`, async () => {
            await expect(
                db.table('tests.csv')
                    .insert()
            ).rejects.toThrow();
        });
    })

    // describe(`Select method tests`, () => {
    //     test(`Select with get`, async () => {
    //         const res = await db.table('tests.csv').select().get();
    //     });
    // });

    test(`Delete the table`, async () => {
        await db.deleteTable('tests');

        const tables = await db.listTables();

        expect(tables.includes('tests.csv')).toBe(false);
    });
});