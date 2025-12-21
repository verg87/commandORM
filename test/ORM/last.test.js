import { jest } from "@jest/globals";
import { model, mockClient } from ".";
import {
    nameFieldMock,
    jobFieldMock,
    ageFieldMock,
    users
} from "../../__mocks__/mocks.js";

describe(`Models last method tests`, () => {
    const table = model.table("tests");
    const lastSpy = jest.spyOn(table, "last");

    test(`Get the last item`, async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: users.filter((u) => u.name === "Gustavo" && u.age === null),
            });

        const lastItem = await table.last();

        expect(lastItem.name).toBe("Gustavo");
        expect(lastSpy).toHaveBeenCalled();
    });

    test(`Get the last item with primary keys`, async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [ "age" ] }) // Found a primary key
            .mockResolvedValueOnce({
                rows: users.filter((u) => u.name === "Gustavo" && u.age === null),
            });

        const lastItem = await table.last();

        expect(lastItem.name).toBe("Gustavo");
        expect(lastSpy).toHaveBeenCalled();
    });
});