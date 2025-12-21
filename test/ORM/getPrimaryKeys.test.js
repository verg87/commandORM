import { jest } from "@jest/globals";
import { model, mockClient } from ".";

describe(`Model's getPrimaryKeys methods tests`, () => {
    const getPrimaryKeysSpy = jest.spyOn(model, "getPrimaryKeys");

    test("has primary keys", async () => {
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        const primaryKeys = await model.getPrimaryKeys("tests");

        expect(primaryKeys.length).toBe(0);
        expect(getPrimaryKeysSpy).toHaveBeenCalled();
    });
});