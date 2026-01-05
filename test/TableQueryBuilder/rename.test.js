import { describe, jest } from "@jest/globals";
import { model, mockClient } from "../";
import { nameFieldMock, jobFieldMock } from "../../__mocks__/mocks.js";

describe(`Model's rename method tests`, () => {
    const table = model.table("tests");
    const renameSpy = jest.spyOn(table, "rename");

    test(`Rename a column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock],
            })
            .mockResolvedValueOnce({ rows: [] });

        await table.rename("job", "work");

        expect(renameSpy).toHaveBeenCalled();
    });

    test(`Rename a not existing column`, async () => {
        mockClient.query.mockResolvedValueOnce({
            rows: [],
        });

        await expect(table.rename("age", "years old")).rejects.toThrow();
    });
});
