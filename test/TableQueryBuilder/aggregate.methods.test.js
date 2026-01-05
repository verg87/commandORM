import { model, mockClient } from "../";
import { users } from "../../__mocks__/mocks.js";

describe(`Models count method tests`, () => {
    test(`Count rows`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ count: users.length }]
            });

        const rows = await model.table("tests").count();

        expect(rows).toBe(3);
    });

    test(`Count rows with a specific column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ count: 2 }]
            });

        const rows = await model.table("tests").count("age");

        expect(rows).toBe(2);
    });
});

describe(`Models sum method tests`, () => {
    test(`Sums up a column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ sum: users.reduce((acc, value) => acc += value.age, 0) }]
            });

        const rows = await model.table("tests").sum("age");

        expect(rows).toBe(61);
    });

    test(`Sums up a column with invalid column name`, async () => {
        await expect(model.table("tests").sum(12)).rejects.toThrow();
    });
});

describe(`Models avg method tests`, () => {
    test(`Averages out a column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ avg: users.reduce((acc, value) => acc += value.age, 0)/2 }]
            });

        const rows = await model.table("tests").avg("age");

        expect(rows).toBe(30.5);
    });

    test(`Averages out a column with precision`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ avg: (users.reduce((acc, value) => acc += value.age, 0)/2).toFixed(0) }]
            });

        const rows = await model.table("tests").avg("age", 0);

        expect(rows).toBe(31);
    });

    test(`Average out a column with invalid precision range`, async () => {
        await expect(model.table("tests").avg("age", 101)).rejects.toThrow();
    });
});

describe(`Models min method tests`, () => {
    test(`Finds the lowest value in a column`, async () => {
        const ages = users.map((obj) => obj.age).filter((value) => value !== null);
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ min: Math.min(...ages) }]
            });

        const rows = await model.table("tests").min("age");

        expect(rows).toBe(29);
    });

    test(`Finds the lowest value from strings in a column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ min: users[2].name }]
            });

        const rows = await model.table("tests").min("name");

        expect(rows).toBe("Gustavo");
    });
});

describe(`Models max method tests`, () => {
    test(`Finds the largest value in a column`, async () => {
        const ages = users.map((obj) => obj.age).filter((value) => value !== null);
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ max: Math.max(...ages) }]
            });

        const rows = await model.table("tests").max("age");

        expect(rows).toBe(32);
    });

    test(`Finds the lowest value from strings in a column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ max: users[0].name }]
            });

        const rows = await model.table("tests").max("name");

        expect(rows).toBe("Micah");
    });
});