import { jest } from "@jest/globals";
import { model, mockClient } from "../";
import { users } from "../../__mocks__/mocks.js";

describe(`Models update method tests`, () => {
    const table = model.table("tests");
    const updateSpy = jest.spyOn(table, "update");

    test(`Update where age is 29`, async () => {
        const updatedUser = users.filter((u) => u.age === 29)[0];
        updatedUser.age = 31;

        mockClient.query
            .mockResolvedValueOnce({
                rows: [updatedUser]
            });

        const updateWithReturning = await table
            .returning()
            .where("age", 29)
            .update({ age: 31 });

        expect(updateWithReturning[0].age).toBe(31);
        expect(updateSpy).toHaveBeenCalled();
    });

    test(`Invalid condition items`, async () => {
        expect(() => {
            model
                .table("tests")
                .where("job", "wrong", "condition")
                .and("age", "correct stru")
                .update({ name: "less" });
        }).toThrow();
    });
});