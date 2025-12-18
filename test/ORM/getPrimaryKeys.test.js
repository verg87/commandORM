import { model, mockClient } from ".";

describe(`Model's getPrimaryKeys methods tests`, () => {
    test("has primary keys", async () => {
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        const primaryKeys = await model.getPrimaryKeys("tests");

        expect(primaryKeys.length).toBe(0);
    });
});