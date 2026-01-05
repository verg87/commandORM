import { jest } from "@jest/globals";
import { model, mockClient } from "../";
import {
    nameFieldMock,
    jobFieldMock,
    ageFieldMock,
    users
} from "../../__mocks__/mocks.js";

beforeEach(() => {
    mockClient.query.mockReset();
    jest.clearAllMocks();
});

describe("Model's get tests", () => {
    const table = model.table("tests");
    const getSpy = jest.spyOn(table, "get");

    test("get all rows from table", async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [nameFieldMock, jobFieldMock, ageFieldMock] })
            .mockResolvedValueOnce({
                rows: users
            });

        const res = await table.select().get();

        expect(res[0].name).toBe("Micah");
        expect(getSpy).toHaveBeenCalledTimes(1);
    });

    test(`call get without select and with unknown columns`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            });

        await expect(model.table("tests").get()).rejects.toThrow();

        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            });

        await expect(
            model.table("tests").select("*", "something").get()
        ).rejects.toThrow();
    });

    test(`use desc with get`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: users,
            });

        const descTableContents = await table.select().get();

        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: users.reverse(),
            });

        const reversedTableContents = await table
            .select()
            .orderBy("name")
            .desc()
            .get();

        expect(descTableContents.reverse()).toStrictEqual(reversedTableContents);
        expect(getSpy).toHaveBeenCalledTimes(2);
    });

    test(`use limit with get`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: users,
            });

        const tableContents = await table.select().get();

        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: users.slice(0, 2),
            });

        const tableContentsWithLimit = await table
            .select()
            .limit(2)
            .get();

        expect(tableContents.slice(0, 2)).toStrictEqual(tableContentsWithLimit);
        expect(getSpy).toHaveBeenCalledTimes(2);
    });

    test(`use orderBy with get`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: users.sort((a, b) => a.age !== null && b.age !== null ? a.age - b.age : 0),
            });

        const tableContentsOrderedByAge = await table
            .select()
            .orderBy("age")
            .get();

        expect(tableContentsOrderedByAge[0].age).toStrictEqual(29);
        expect(getSpy).toHaveBeenCalledTimes(1);
    });

    test("get specific rows from table", async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: users.filter((u) => u.job === "chemist" || u.job === "rat"),
            });

        const query = await table
            .select()
            .where("job", ["chemist", "rat"])
            .get();

        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: users.filter((u) => u.job === null && u.age === null),
            });

        const queryWithIsNull = await table
            .select()
            .where("job", null)
            .and("age", null)
            .get();

        expect(query.map((row) => row.name)).toStrictEqual(["Micah"]);
        expect(queryWithIsNull.map((row) => [row.job, row.age])).toStrictEqual([
            [null, null],
        ]);
        expect(getSpy).toHaveBeenCalledTimes(2);
    });

    test(`Use 'and' and 'or' methods without calling where first`, () => {
        expect(() => model.table("tests").select().and("job", null)).toThrow();
        expect(() => model.table("tests").select().or("age", null)).toThrow();
    });
});