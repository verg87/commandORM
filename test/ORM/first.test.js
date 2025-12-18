import { model, mockClient } from ".";
import {
    nameFieldMock,
    jobFieldMock,
    ageFieldMock,
    users
} from "../../__mocks__/mocks.js";

describe(`Models first method tests`, () => {
    test(`Get the first item`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: users,
            });

        const allItems = await model.table("tests").select().get();

        mockClient.query
            .mockResolvedValueOnce({
                rows: users.filter((u) => u.name === "Micah"),
            });

        const firstItem = await model.table("tests").first();

        expect(firstItem).toStrictEqual(allItems[0]);
    });
});