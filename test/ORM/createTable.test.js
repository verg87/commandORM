import { model, mockClient } from ".";

describe("Model's createTable method tests", () => {
    test("Create tests table test", async () => {
        // model.createTable('tests') fires client.query two times
        // and the model.exists calls client.query one time.
        // That's why I need to mock client.query three times
        mockClient.query
            .mockResolvedValueOnce({ rows: [{ exists: false }] })
            .mockResolvedValueOnce({});

        await model.createTable("tests");

        mockClient.query
            .mockResolvedValueOnce({ rows: [{ exists: true }] });

        const exists = await model.exists("tests");

        expect(exists).toBe(true);
    });

    test(`Create already existing table`, async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [{ exists: true }] });

        await expect(model.createTable("tests")).rejects.toThrow();
    });
});