import { model, mockClient } from ".";
import {
    idFieldMock,
    nameFieldMock,
    jobFieldMock,
    ageFieldMock,
    gpaFieldMock,
    dateFieldMock,
} from "../../__mocks__/mocks.js";

describe("Module's add method tests", () => {
    test("Create name and job columns", async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({});
        mockClient.query
            .mockResolvedValueOnce({ rows: [nameFieldMock] })
            .mockResolvedValueOnce({});

        await model
            .table("tests")
            .add({ name: "name", type: "string", length: 64, nullable: false });
        await model.table("tests").add({
            name: "job",
            type: "string",
            length: 64,
            defaultValue: "chemist",
        });

        mockClient.query.mockResolvedValueOnce({
            rows: [nameFieldMock, jobFieldMock],
        });

        const schemaData = await model.getSchemaData("tests");
        expect(schemaData.map((col) => col["column_name"])).toStrictEqual([
            "name",
            "job",
        ]);
    });

    test(`Add a primary key column to the table`, async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [nameFieldMock, jobFieldMock] })
            .mockResolvedValueOnce({});

        await model
            .table("tests")
            .add({name: "id", type: "pk"});

        mockClient.query.mockResolvedValueOnce({
            rows: [idFieldMock, nameFieldMock, jobFieldMock],
        });

        const schemaData = await model.getSchemaData("tests");
        expect(schemaData.map((col) => col["column_name"])).toStrictEqual([
            "id",
            "name",
            "job",
        ]);
    });

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
                .add({ name: "age and salary", type: "int", defaultValue: 30 })
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

        await model
            .table("tests")
            .add({ name: "age", type: "int", nullable: true });

        mockClient.query.mockResolvedValueOnce({
            rows: [nameFieldMock, jobFieldMock, ageFieldMock],
        });

        const schemaData = await model.getSchemaData("tests");

        expect(schemaData.some((obj) => obj["column_name"] === "age")).toBe(true);
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

        await model
            .table("tests")
            .add({ name: "gpa", type: "float", precision: 3, scale: 2 });

        mockClient.query.mockResolvedValueOnce({
            rows: [nameFieldMock, jobFieldMock, ageFieldMock, gpaFieldMock],
        });

        const schemaData = await model.getSchemaData("tests");

        expect(schemaData.some((obj) => obj["column_name"] === "gpa")).toBe(true);
    });

    test(`Create date type column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock, gpaFieldMock],
            })
            .mockResolvedValueOnce({});

        await model
            .table("tests")
            .add({ name: "date_of_birth", type: "date", nullable: false });

        mockClient.query.mockResolvedValueOnce({
            rows: [
                nameFieldMock,
                jobFieldMock,
                ageFieldMock,
                gpaFieldMock,
                dateFieldMock,
            ],
        });

        const schemaData = await model.getSchemaData("tests");

        expect(
            schemaData.some((obj) => obj["column_name"] === "date_of_birth")
        ).toBe(true);
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
