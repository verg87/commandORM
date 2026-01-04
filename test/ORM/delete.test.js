import { jest } from "@jest/globals";
import { model, mockClient } from "../";

describe(`Model's delete method tests`, () => {
    const table = model.table("tests");
    const deleteSpy = jest.spyOn(table, "delete");

    test(`Delete rows`, async () => {
        mockClient.query
            .mockResolvedValueOnce({});

        await table
            .where("age", "<", 30)
            .or("name", ["Micah", "Pedro", "Gustavo"])
            .delete();

        expect(deleteSpy).toHaveBeenCalled();
    });
});