import { model, mockClient } from ".";
import {
    nameFieldMock,
    jobFieldMock,
    ageFieldMock,
    users
} from "../../__mocks__/mocks.js";

describe(`Models last method tests`, () => {
    test(`Get the last item`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: users,
            });

        const allItems = await model.table("tests").select().get();

        mockClient.query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: users.filter((u) => u.name === "Gustavo" && u.age === null),
            });

        const lastItem = await model.table("tests").last();

        expect(lastItem).toStrictEqual(allItems[allItems.length - 1]);
    });

    test(`Get the last item with primary keys`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: users,
            });

        const allItems = await model.table("tests").select().get();

        mockClient.query
            .mockResolvedValueOnce({ rows: [ "age" ] }) // Found a primary key
            .mockResolvedValueOnce({
                rows: users.filter((u) => u.name === "Gustavo" && u.age === null),
            });

        const lastItem = await model.table("tests").last();

        expect(lastItem).toStrictEqual(allItems[allItems.length - 1]);
    });
});