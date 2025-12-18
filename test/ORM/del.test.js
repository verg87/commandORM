import { model, mockClient } from ".";
import {
    nameFieldMock,
    jobFieldMock,
    ageFieldMock,
    gpaFieldMock,
    dateFieldMock,
} from "../../__mocks__/mocks.js";

describe(`Model's del method tests`, () => {
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

        await model.table("tests").del("date_of_birth");
        await model.table("tests").del("gpa");

        mockClient.query.mockResolvedValueOnce({
            rows: [nameFieldMock, jobFieldMock, ageFieldMock],
        });

        const schemaData = await model.getSchemaData("tests");

        expect(
            schemaData.every(
                (obj) => !["date_of_birth", "gpa"].includes(obj["column_name"])
            )
        ).toBe(true);
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