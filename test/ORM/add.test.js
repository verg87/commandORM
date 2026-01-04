import { beforeEach, jest } from "@jest/globals";
import { model, mockClient } from "../";
import {
    nameFieldMock,
    jobFieldMock,
    ageFieldMock,
    gpaFieldMock,
    dateFieldMock,
} from "../../__mocks__/mocks.js";

describe("Module's add method tests", () => {
    const table = model.table("tests");
    const addSpy = jest.spyOn(table, "add");

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("Create name and job columns", async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({});
        mockClient.query
            .mockResolvedValueOnce({ rows: [nameFieldMock] })
            .mockResolvedValueOnce({});

        await table
            .add({ name: "name", type: "string", length: 64, nullable: false });
        await table.add({
            name: "job",
            type: "string",
            length: 64,
            defaultValue: "chemist",
        });

        expect(addSpy).toHaveBeenCalledTimes(2);
    });

    test(`Add a primary key column to the table`, async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [nameFieldMock, jobFieldMock] })
            .mockResolvedValueOnce({});

        await table
            .add({name: "id", type: "pk"});

        expect(addSpy).toHaveBeenCalledTimes(1);
        expect(addSpy).toHaveBeenCalledWith({name: "id", type: "pk"});
    });

    test(`Add a serial primary key with a default value`, async () => {
        mockClient.query
            .mockResolvedValueOnce({rows: [nameFieldMock, jobFieldMock]});

        await expect(
            model.table("tests").add({name: "id", type: "pk", defaultValue: 12})
        ).rejects.toThrow();
    })

    test(`Test adding duplicate columns`, async () => {
        mockClient.query.mockResolvedValueOnce({
            rows: [nameFieldMock, jobFieldMock],
        });

        await expect(
            model.table("tests").add({ name: "job", type: "string", length: 64 })
        ).rejects.toThrow();
    });

    test(`Test adding invalid column name`, async () => {
        mockClient.query.mockResolvedValueOnce({
            rows: [nameFieldMock, jobFieldMock],
        });

        await expect(
            model
                .table("tests")
                .add({ name: "1column with number", type: "int", defaultValue: 30 })
        ).rejects.toThrow();
    });

    test(`Column with type of string but no length`, async () => {
        mockClient.query.mockResolvedValueOnce({
            rows: [nameFieldMock, jobFieldMock],
        });

        await expect(
            model.table("tests").add({ name: "address", type: "string" })
        ).rejects.toThrow();
    });

    test(`Create int type column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [nameFieldMock, jobFieldMock] })
            .mockResolvedValueOnce({});

        await table
            .add({ name: "age", type: "int", nullable: true });

        expect(addSpy).toHaveBeenCalledTimes(1);
    });

    test(`Test for error when creating float type column and not providing 'scale' and 'precision'`, async () => {
        mockClient.query.mockResolvedValueOnce({
            rows: [nameFieldMock, jobFieldMock, ageFieldMock],
        });

        await expect(
            model.table("tests").add({ name: "gpa", type: "float", nullable: false })
        ).rejects.toThrow();
    });

    test(`Create float type column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({});

        await table
            .add({ name: "gpa", type: "float", precision: 3, scale: 2 });

        expect(addSpy).toHaveBeenCalledTimes(1);
        expect(addSpy).toHaveBeenCalledWith({ name: "gpa", type: "float", precision: 3, scale: 2 });
    });

    test(`Create date type column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock, gpaFieldMock],
            })
            .mockResolvedValueOnce({});

        await table
            .add({ name: "date_of_birth", type: "date", nullable: false });

        expect(addSpy).toHaveBeenCalledTimes(1);
    });

    test(`Unsupported column type`, async () => {
        mockClient.query.mockResolvedValueOnce({
            rows: [
                nameFieldMock,
                jobFieldMock,
                ageFieldMock,
                gpaFieldMock,
                dateFieldMock,
            ],
        });

        await expect(
            model.table("tests").add({ name: "something", type: "something" })
        ).rejects.toThrow();
    });
});
