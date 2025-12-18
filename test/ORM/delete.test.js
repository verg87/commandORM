import { model, mockClient } from ".";
import {
    nameFieldMock,
    jobFieldMock,
    ageFieldMock,
    users
} from "../../__mocks__/mocks.js";

describe(`Model's delete method tests`, () => {
    test(`Delete rows`, async () => {
        mockClient.query
            .mockResolvedValueOnce({});

        await model
            .table("tests")
            .where("age", "<", 30)
            .or("name", ["Micah", "Pedro", "Gustavo"])
            .delete();

        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: users.filter((u) => u.age >= 30 && !["Micah", "Pedro", "Gustavo"].includes(u.name))
            });

        const rows = await model.table("tests").select().get();

        expect(rows).toStrictEqual([]);
    });
});