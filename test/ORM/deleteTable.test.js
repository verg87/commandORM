import { jest } from "@jest/globals";
import { model, mockClient } from ".";

describe("Model's deleteTable method tests", () => {
    const deleteTableSpy = jest.spyOn(model, "deleteTable");

    test("Delete tests table test", async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [{ exists: true }] })
            .mockResolvedValueOnce({});

        await model.deleteTable("tests");

        expect(deleteTableSpy).toHaveBeenCalled();
    });

    test(`Delete table that doesn't exist`, async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [{ exists: false }] });

        await expect(model.deleteTable("tests")).rejects.toThrow();
    });
});