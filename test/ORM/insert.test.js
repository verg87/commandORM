import { jest } from "@jest/globals";
import { model, mockClient } from ".";
import {
    nameFieldMock,
    jobFieldMock,
    ageFieldMock,
} from "../../__mocks__/mocks.js";

describe("Model's insert method tests", () => {
    const table = model.table("tests");
    const insertSpy = jest.spyOn(table, "insert");

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

        await table.insert([{ name: "Micah", age: 29, job: "rat" }]);
        await table.insert({ name: "Gustavo", age: 32 });

        // mocking queries for model.table("tests").returning("name").insert({ name: "Gustavo" }); call
        mockClient.query
            .mockResolvedValueOnce({
                rows: [],
            })
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({ rows: [{ name: "Gustavo" }] });

        const insertWithReturning = await table
            .returning("name")
            .insert({ name: "Gustavo" });

        expect(insertWithReturning[0].name).toBe("Gustavo");
        expect(insertSpy).toHaveBeenCalledTimes(3);
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