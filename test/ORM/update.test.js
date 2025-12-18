import { model, mockClient } from ".";
import {
    nameFieldMock,
    jobFieldMock,
    ageFieldMock,
    users
} from "../../__mocks__/mocks.js";

describe(`Models update method tests`, () => {
    test(`Update where age is 29`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: users.filter((u) => u.job === "rat"),
            });

        const personBefore = await model
            .table("tests")
            .select()
            .where("job", "rat")
            .get();

        // We are deep copying the user who's age is 29 and then 
        // changing the age to what we need without touching the original variable
        const updatedUser = JSON.parse(JSON.stringify(users.filter((u) => u.age === 29)[0]));
        updatedUser.age = 31;

        mockClient.query
            .mockResolvedValueOnce({
                rows: [updatedUser]
            });

        const updateWithReturning = await model
            .table("tests")
            .returning()
            .where("age", 29)
            .update({ age: 31 });

        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: [updatedUser]
            });

        const personAfter = await model
            .table("tests")
            .select()
            .where("job", "rat")
            .get();

        expect(personBefore[0].age).toBe(29);
        expect(personAfter[0].age).toBe(31);
        expect(updateWithReturning).toStrictEqual(personAfter);
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