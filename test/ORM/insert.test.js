import { model, mockClient } from ".";
import {
    nameFieldMock,
    jobFieldMock,
    ageFieldMock,
    users
} from "../../__mocks__/mocks.js";

describe("Model's insert method tests", () => {
    test("Insert into tests table values", async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [], // returning primary keys for that table
            })
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({});

        mockClient.query
            .mockResolvedValueOnce({
                rows: [],
            })
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({});

        await model.table("tests").insert([{ name: "Micah", age: 29, job: "rat" }]);
        await model.table("tests").insert({ name: "Gustavo", age: 32 });

        // mocking queries for model.table("tests").returning("name").insert({ name: "Gustavo" }); call
        mockClient.query
            .mockResolvedValueOnce({
                rows: [],
            })
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({ rows: [{ name: "Gustavo" }] });

        // mocking queries for model.table("tests").select().get() call
        mockClient.query
            .mockResolvedValueOnce({
                rows: [],
            })
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: users
            });

        const insertWithReturning = await model
            .table("tests")
            .returning("name")
            .insert({ name: "Gustavo" });

        const rows = await model.table("tests").select().get();

        expect(rows.length).toBeGreaterThan(0);
        expect(insertWithReturning[0].name).toBe("Gustavo");
    });

    test(`Insert into invalid table name, column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [],
            })
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            });

        await expect(async () => {
            await model.table("tests and something else").insert({ name: "Bob" });
        }).rejects.toThrow();

        mockClient.query
            .mockResolvedValueOnce({
                rows: [],
            })
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            });

        await expect(async () => {
            await model.table("tests").insert({ and: "John" });
        }).rejects.toThrow();
    });

    test(`Test for missing mandatory column in object argument`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [],
            })
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })

        // Since name column can't be nullable and doesn't have default value it's mandatory
        await expect(
            model.table("tests").insert({ job: "janitor" })
        ).rejects.toThrow();
    });

    test(`Test for not existing columns provided by user`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [],
            })
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })

        // weather column doesn't exist in the tests table
        await expect(
            model
                .table("tests")
                .insert({ name: "Jack", job: "Janitor", age: 33, weather: "hot" })
        ).rejects.toThrow();
    });
});