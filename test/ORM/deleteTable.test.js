import { model, mockClient } from ".";

describe("Model's deleteTable method tests", () => {
    test("Delete tests table test", async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [{ exists: true }] })
            .mockResolvedValueOnce({});

        await model.deleteTable("tests");

        mockClient.query
            .mockResolvedValueOnce({ rows: [{ exists: false }] });

        const exists = await model.exists("tests");

        expect(exists).toBe(false);
    });

    test(`Delete table that doesn't exist`, async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [{ exists: false }] });

        await expect(model.deleteTable("tests")).rejects.toThrow();
    });
});