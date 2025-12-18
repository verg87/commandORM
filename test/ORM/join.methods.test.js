import { model, mockClient } from "./index.js";
import {
    nameFieldMock,
    jobFieldMock,
    ageFieldMock,
    joinedUsers
} from "../../__mocks__/mocks.js";

describe(`Model's innerJoin method tests`, () => {
    test(`Use innerJoin with args`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: joinedUsers,
            });

        const rows = await model.table("tests")
            .select("name", "address")
            .innerJoin("users_addresses", "tests.user", 'users_addresses.user')
            .get();

        expect(rows).toStrictEqual(joinedUsers);
    });

    test(`Use innerJoin with a function`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: joinedUsers,
            });

        const rows = await model.table("tests")
            .select("name", "address")
            .innerJoin("users_addresses", function() {
                this.on("tests.user", "=", "users_addresses.user")
                    .onOr("tests.user", ["Micah", "Gustavo"]);
            })
            .get();

        expect(rows).toStrictEqual(joinedUsers);
    });

    test(`Use innerJoin with seperate "on" method call`, async () => {
        const joinedSelectedUsers = joinedUsers.filter((u) => u.name === "Micah");

        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: joinedSelectedUsers,
            });

        const rows = await model.table("tests")
            .select("name", "address")
            .innerJoin("users_addresses")
            .on("tests.user", "users_addresses.user")
            .onAnd("tests.age", 29)
            .get();

        expect(rows).toStrictEqual(joinedSelectedUsers);
    });

    test(`Use innerJoin with "on" method`, async () => {
        const joinedSelectedUsers = joinedUsers.filter((u) => u.name !== "Micah");

        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: joinedSelectedUsers,
            });

        const rows = await model.table("tests")
            .select("name", "address")
            .innerJoin("users_addresses")
            .on("tests.user", "users_addresses.user")
            .onAnd("tests.job", null)
            .get();

        expect(rows).toStrictEqual(joinedSelectedUsers);
    });

    test(`Use innerJoin with "on" without the proper arguments`, () => {
        const query = model.table("tests")
            .select("name", "address")
            .innerJoin("users_addresses");
    
        expect(() => query.on()).toThrow();
    });
});

describe(`Model's leftJoin method tests`, () => {
    test(`Use leftJoin with "onOr" without calling "on" first`, () => {
        const query = model.table("tests")
            .select("name", "address")
            .leftJoin("users_addresses");
    
        expect(() => query.onOr()).toThrow();
    });
});

describe(`Model's rightJoin method tests`, () => {
    test(`Use rightJoin with "onAnd" without calling "on" first`, () => {
        const query = model.table("tests")
            .select("name", "address")
            .rightJoin("users_addresses");
    
        expect(() => query.onAnd()).toThrow();
    });
});