import { beforeEach, jest } from "@jest/globals";
import { model, mockClient } from "../";
import {
    idFieldMock,
    nameFieldMock,
    jobFieldMock,
    ageFieldMock,
} from "../../__mocks__/mocks.js";

describe(`Model's upsert method tests`, () => {
    const table = model.table("tests");
    const upsertSpy = jest.spyOn(table, "upsert");

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test(`Update existing data`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ column_name: "id", data_type: "integer" }],
            })
            .mockResolvedValueOnce({
                rows: [idFieldMock, nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({});

        await table.upsert({ id: 2, name: "Pete", age: 20, job: "waiter" });

        expect(upsertSpy).toHaveBeenCalled();
    });

    test(`Update existing data with some columns not specified`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ column_name: "id", data_type: "integer" }],
            })
            .mockResolvedValueOnce({
                rows: [idFieldMock, nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({});

        await table.upsert({ id: 3, name: "Pete", job: "waiter" });

        expect(upsertSpy).toHaveBeenCalled();
    });

    test(`Insert data`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ column_name: "id", data_type: "integer" }],
            })
            .mockResolvedValueOnce({
                rows: [idFieldMock, nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({});

        await table.upsert({ name: "Pete", age: 20, job: "waiter" });

        expect(upsertSpy).toHaveBeenCalled();
    });

    test(`Upserting table with no primary keys`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [],
            })
            .mockResolvedValueOnce({
                rows: [idFieldMock, nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: [],
            });

        await table.upsert({ name: "Pete", age: 20, job: "waiter" });

        expect(upsertSpy).toHaveBeenCalled();
    });

    test(`Upsert with missing mandatory columns`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ column_name: "id", data_type: "integer" }],
            })
            .mockResolvedValueOnce({
                rows: [idFieldMock, nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({});

        await expect(
            table.upsert({ id: 3, age: 23, job: "waiter" })
        ).rejects.toThrow();

        expect(upsertSpy).toHaveBeenCalledTimes(1);
    });
});
