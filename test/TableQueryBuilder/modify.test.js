import { describe, jest } from "@jest/globals";
import { model, mockClient } from "../";
import {
    nameFieldMock,
    gpaFieldMock,
    dateFieldMock,
} from "../../__mocks__/mocks.js";

describe(`Model's modify method tests`, () => {
    const table = model.table("tests");
    const modifySpy = jest.spyOn(table, "modify");

    test(`Modify gpa column to be type of string with null and default clauses`, async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [nameFieldMock, gpaFieldMock] })
            .mockResolvedValueOnce({});

        await table.modify({
            name: "gpa",
            type: "string",
            length: 6,
            nullable: false,
            defaultValue: "3.5",
        });

        expect(modifySpy).toHaveBeenCalled();
    });

    test(`Modify gpa column to be type of int`, async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [nameFieldMock, gpaFieldMock] })
            .mockResolvedValueOnce({});

        await table.modify({ name: "gpa", type: "int" });

        expect(modifySpy).toHaveBeenCalled();
    });

    test(`Modify date of birth column to timestamp`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, gpaFieldMock, dateFieldMock],
            })
            .mockResolvedValueOnce({});

        await table.modify({ name: "date_of_birth", type: "timestamp" });

        expect(modifySpy).toHaveBeenCalled();
    });

    test(`Try to convert non-date data type into one`, async () => {
        mockClient.query.mockResolvedValueOnce({
            rows: [nameFieldMock, gpaFieldMock, dateFieldMock],
        });

        await expect(table.modify({ name: "gpa", type: "date" })).rejects.toThrow();
    });

    test(`Try to convert non-numeric data type into one`, async () => {
        mockClient.query.mockResolvedValueOnce({
            rows: [nameFieldMock, gpaFieldMock, dateFieldMock],
        });

        await expect(
            table.modify({
                name: "date_of_birth",
                type: "float",
                precision: 2,
                scale: 3,
            })
        ).rejects.toThrow();
    });

    test(`Try to convert to an unsupported type`, async () => {
        mockClient.query.mockResolvedValueOnce({
            rows: [nameFieldMock, gpaFieldMock, dateFieldMock],
        });

        await expect(
            table.modify({ name: "date_of_birth", type: "pk" })
        ).rejects.toThrow();
    });

    test(`Try to modify a non-existing column`, async () => {
        mockClient.query.mockResolvedValueOnce({
            rows: [nameFieldMock, gpaFieldMock, dateFieldMock],
        });

        await expect(
            table.modify({ name: "something", type: "int" })
        ).rejects.toThrow();
    });
});
