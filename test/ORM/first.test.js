import { jest } from "@jest/globals";
import { model, mockClient } from ".";
import { users } from "../../__mocks__/mocks.js";

describe(`Models first method tests`, () => {
    const table = model.table("tests");
    const firstSpy = jest.spyOn(table, "first");

    test(`Get the first item`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: users.filter((u) => u.name === "Micah"),
            });

        const firstItem = await table.first();

        expect(firstItem.name).toBe("Micah");
        expect(firstSpy).toHaveBeenCalled();
    });
});