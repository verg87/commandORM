import { jest } from "@jest/globals";
import { model, mockClient } from "../";
import {
    nameFieldMock,
    jobFieldMock,
    ageFieldMock,
    gpaFieldMock,
    dateFieldMock,
} from "../../__mocks__/mocks.js";

describe(`Model's del method tests`, () => {
    const table = model.table("tests");
    const delSpy = jest.spyOn(table, "del");

    test(`Delete column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [
                    nameFieldMock,
                    jobFieldMock,
                    ageFieldMock,
                    gpaFieldMock,
                    dateFieldMock,
                ],
            })
            .mockResolvedValueOnce({});

        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock, gpaFieldMock],
            })
            .mockResolvedValueOnce({});

        await table.del("date_of_birth");
        await table.del("gpa");

        expect(delSpy).toHaveBeenCalledTimes(2);
    });

    test(`Invalid column name`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            });

        await expect(() =>
            model.table("tests").del("somethinga")
        ).rejects.toThrow();
    });
});