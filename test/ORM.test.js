import { jest } from "@jest/globals";
import { Pool } from "pg";
import { Model } from "../src/ORM.js";

jest.useFakeTimers();

const model = new Model({});

const mockClient = Pool().connect();
const mockEnd = Pool().end;

const nameFieldMock = {
    column_name: "name",
    column_default: null,
    is_nullable: "NO",
    data_type: "character varying",
};

const jobFieldMock = {
    column_name: "job",
    column_default: "chemist",
    is_nullable: "YES",
    data_type: "character varying",
};

const ageFieldMock = {
    column_name: "age",
    column_default: null,
    is_nullable: "YES",
    data_type: "integer",
};

const gpaFieldMock = {
    column_name: "gpa",
    column_default: null,
    is_nullable: "YES",
    data_type: "decimal",
};

const dateFieldMock = {
    column_name: "date_of_birth",
    column_default: null,
    is_nullable: "NO",
    data_type: "date",
};

const users = [
    { name: "Micah", age: 29, job: "rat" },
    { name: "Gustavo", age: 32, job: null },
    { name: "Gustavo", age: null, job: null },
];

const joinedUsers = [
    { name: "Micah", address: "Some city" },
    { name: "Gustavo", address: "Another city" },
    { name: "Gustavo", address: "Yet another city" },
];

beforeEach(() => {
    mockClient.query.mockReset();
})

describe("Create tests table", () => {
    test("Create tests table test", async () => {
        // model.createTable('tests') fires client.query two times
        // and the model.exists calls client.query one time.
        // That's why I need to mock client.query three times
        mockClient.query
            .mockResolvedValueOnce({ rows: [{ exists: false }] })
            .mockResolvedValueOnce({});

        await model.createTable("tests");

        mockClient.query
            .mockResolvedValueOnce({ rows: [{ exists: true }] });

        const exists = await model.exists("tests");

        expect(exists).toBe(true);
    });

    test(`Create already existing table`, async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [{ exists: true }] });

        await expect(model.createTable("tests")).rejects.toThrow();
    });
});

describe("Module's add method tests", () => {
    test("Create name and job columns", async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({});
        mockClient.query
            .mockResolvedValueOnce({ rows: [nameFieldMock] })
            .mockResolvedValueOnce({});

        await model
            .table("tests")
            .add({ name: "name", type: "string", length: 64, nullable: false });
        await model.table("tests").add({
            name: "job",
            type: "string",
            length: 64,
            defaultValue: "chemist",
        });

        mockClient.query.mockResolvedValueOnce({
            rows: [nameFieldMock, jobFieldMock],
        });

        const schemaData = await model.getSchemaData("tests");
        expect(schemaData.map((col) => col["column_name"])).toStrictEqual([
            "name",
            "job",
        ]);
    });

    test(`Test adding duplicate columns`, async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [nameFieldMock, jobFieldMock] });

        await expect(
            model.table("tests").add({ name: "job", type: "string", length: 64 })
        ).rejects.toThrow();
    });

    test(`Test adding invalid column name`, async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [nameFieldMock, jobFieldMock] });

        await expect(
            model
                .table("tests")
                .add({ name: "age and salary", type: "int", defaultValue: 30 })
        ).rejects.toThrow();
    });

    test(`Column with type of string but no length`, async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [nameFieldMock, jobFieldMock] });

        await expect(
            model.table("tests").add({ name: "address", type: "string" })
        ).rejects.toThrow();
    });

    test(`Create int type column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [nameFieldMock, jobFieldMock] })
            .mockResolvedValueOnce({});

        await model
            .table("tests")
            .add({ name: "age", type: "int", nullable: true });

        mockClient.query.mockResolvedValueOnce({
            rows: [nameFieldMock, jobFieldMock, ageFieldMock],
        });

        const schemaData = await model.getSchemaData("tests");

        expect(schemaData.some((obj) => obj["column_name"] === "age")).toBe(true);
    });

    test(`Test for error when creating float type column and not providing 'scale' and 'precision'`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            });

        await expect(
            model.table("tests").add({ name: "gpa", type: "float", nullable: false })
        ).rejects.toThrow();
    });

    test(`Create float type column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({});

        await model
            .table("tests")
            .add({ name: "gpa", type: "float", precision: 3, scale: 2 });

        mockClient.query.mockResolvedValueOnce({
            rows: [nameFieldMock, jobFieldMock, ageFieldMock, gpaFieldMock],
        });

        const schemaData = await model.getSchemaData("tests");

        expect(schemaData.some((obj) => obj["column_name"] === "gpa")).toBe(true);
    });

    test(`Create date type column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock, gpaFieldMock],
            })
            .mockResolvedValueOnce({});

        await model
            .table("tests")
            .add({ name: "date_of_birth", type: "date", nullable: false });

        mockClient.query.mockResolvedValueOnce({
            rows: [
                nameFieldMock,
                jobFieldMock,
                ageFieldMock,
                gpaFieldMock,
                dateFieldMock,
            ],
        });

        const schemaData = await model.getSchemaData("tests");

        expect(
            schemaData.some((obj) => obj["column_name"] === "date_of_birth")
        ).toBe(true);
    });

    test(`Unsupported column type`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [
                    nameFieldMock,
                    jobFieldMock,
                    ageFieldMock,
                    gpaFieldMock,
                    dateFieldMock,
                ],
            });

        await expect(
            model.table("tests").add({ name: "something", type: "something" })
        ).rejects.toThrow();
    });
});

describe(`Model's del method tests`, () => {
    test(`Delete column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [
                    nameFieldMock,
                    jobFieldMock,
                    ageFieldMock,
                    gpaFieldMock,
                    dateFieldMock,
                ],
            })
            .mockResolvedValueOnce({});

        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock, gpaFieldMock],
            })
            .mockResolvedValueOnce({});

        await model.table("tests").del("date_of_birth");
        await model.table("tests").del("gpa");

        mockClient.query.mockResolvedValueOnce({
            rows: [nameFieldMock, jobFieldMock, ageFieldMock],
        });

        const schemaData = await model.getSchemaData("tests");

        expect(
            schemaData.every(
                (obj) => !["date_of_birth", "gpa"].includes(obj["column_name"])
            )
        ).toBe(true);
    });

    test(`Invalid column name`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            });

        await expect(() =>
            model.table("tests").del("somethinga")
        ).rejects.toThrow();
    });
});

describe(`Model's getPrimaryKeys methods tests`, () => {
    test("has primary keys", async () => {
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        const primaryKeys = await model.getPrimaryKeys("tests");

        expect(primaryKeys.length).toBe(0);
    });
});

describe("Model's insert method tests", () => {
    test("Insert into tests table values", async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({});

        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({});

        await model.table("tests").insert([{ name: "Micah", age: 29, job: "rat" }]);
        await model.table("tests").insert({ name: "Gustavo", age: 32 });

        // mocking queries for model.table("tests").returning("name").insert({ name: "Gustavo" }); call
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({ rows: [{ name: "Gustavo" }] });

        // mocking queries for model.table("tests").select().get() call
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: users
            });

        const insertWithReturning = await model
            .table("tests")
            .returning("name")
            .insert({ name: "Gustavo" });

        const rows = await model.table("tests").select().get();

        expect(rows.length).toBeGreaterThan(0);
        expect(insertWithReturning[0].name).toBe("Gustavo");
    });

    test(`Insert into invalid table name, column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            });

        await expect(async () => {
            await model.table("tests and something else").insert({ name: "Bob" });
        }).rejects.toThrow();

        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            });

        await expect(async () => {
            await model.table("tests").insert({ and: "John" });
        }).rejects.toThrow();
    });

    test(`Test for missing mandatory column in object argument`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })

        // Since name column can't be nullable and doesn't have default value it's mandatory
        await expect(
            model.table("tests").insert({ job: "janitor" })
        ).rejects.toThrow();
    });

    test(`Test for not existing columns provided by user`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })

        // weather column doesn't exist in the tests table
        await expect(
            model
                .table("tests")
                .insert({ name: "Jack", job: "Janitor", age: 33, weather: "hot" })
        ).rejects.toThrow();
    });
});

describe("Model's get tests", () => {
    test("get all rows from table", async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [nameFieldMock, jobFieldMock, ageFieldMock] })
            .mockResolvedValueOnce({
                rows: [
                    { name: "Micah", age: 29, job: "rat" },
                    { name: "Gustavo", age: 32, job: null },
                    { name: "Gustavo", age: null, job: null },
                ],
            });

        const res = await model.table("tests").select().get();
        expect(res[0].name).toBe("Micah");
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

        const descTableContents = await model.table("tests").select().get();

        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: users.reverse(),
            });

        const reversedTableContents = await model
            .table("tests")
            .select()
            .desc()
            .get();

        expect(descTableContents.reverse()).toStrictEqual(reversedTableContents);
    });

    test(`use limit with get`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: users,
            });

        const tableContents = await model.table("tests").select().get();

        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: users.slice(0, 2),
            });

        const tableContentsWithLimit = await model
            .table("tests")
            .select()
            .limit(2)
            .get();

        expect(tableContents.slice(0, 2)).toStrictEqual(tableContentsWithLimit);
    });

    test(`use orderBy with get`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: users.sort((a, b) => a.age !== null && b.age !== null ? a.age - b.age : -1),
            });

        const tableContentsOrderedByAge = await model
            .table("tests")
            .select()
            .orderBy("age")
            .get();

        expect(tableContentsOrderedByAge[0].age).toStrictEqual(29);
    });

    test("get specific rows from table", async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [nameFieldMock, jobFieldMock, ageFieldMock],
            })
            .mockResolvedValueOnce({
                rows: users.filter((u) => u.job === "chemist" || u.job === "rat"),
            });

        const query = await model
            .table("tests")
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

        const queryWithIsNull = await model
            .table("tests")
            .select()
            .where("job", null)
            .and("age", null)
            .get();

        expect(query.map((row) => row.name)).toStrictEqual(["Micah"]);
        expect(queryWithIsNull.map((row) => [row.job, row.age])).toStrictEqual([
            [null, null],
        ]);
    });

    test(`Use 'and' and 'or' methods without calling where first`, () => {
        expect(() => model.table("tests").select().and("job", null)).toThrow();
        expect(() => model.table("tests").select().or("age", null)).toThrow();
    });
});

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

    test(`Use innerJoin with "onOr" without calling "on" first`, () => {
        const query = model.table("tests")
            .select("name", "address")
            .innerJoin("users_addresses");
    
        expect(() => query.onOr()).toThrow();
    });

    test(`Use innerJoin with "onAnd" without calling "on" first`, () => {
        const query = model.table("tests")
            .select("name", "address")
            .innerJoin("users_addresses");
    
        expect(() => query.onAnd()).toThrow();
    });
});

describe(`Models count method tests`, () => {
    test(`Count rows`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ count: users.length }]
            });

        const rows = await model.table("tests").count();

        expect(rows).toBe(3);
    });

    test(`Count rows with a specific column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ count: 2 }]
            });

        const rows = await model.table("tests").count("age");

        expect(rows).toBe(2);
    });
});

describe(`Models sum method tests`, () => {
    test(`Sums up a column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ sum: users.reduce((acc, value) => acc += value.age, 0) }]
            });

        const rows = await model.table("tests").sum("age");

        expect(rows).toBe(61);
    });

    test(`Sums up a column with invalid column name`, async () => {
        await expect(model.table("tests").sum(12)).rejects.toThrow();
    });
});

describe(`Models avg method tests`, () => {
    test(`Averages out a column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ avg: users.reduce((acc, value) => acc += value.age, 0)/2 }]
            });

        const rows = await model.table("tests").avg("age");

        expect(rows).toBe(30.5);
    });

    test(`Averages out a column with precision`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ avg: (users.reduce((acc, value) => acc += value.age, 0)/2).toFixed(0) }]
            });

        const rows = await model.table("tests").avg("age", 0);

        expect(rows).toBe(31);
    });

    test(`Average out a column with invalid precision range`, async () => {
        await expect(model.table("tests").avg("age", 101)).rejects.toThrow();
    });
});

describe(`Models min method tests`, () => {
    test(`Finds the lowest value in a column`, async () => {
        const ages = users.map((obj) => obj.age).filter((value) => value !== null);
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ min: Math.min(...ages) }]
            });

        const rows = await model.table("tests").min("age");

        expect(rows).toBe(29);
    });

    test(`Finds the lowest value from strings in a column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ min: users[2].name }]
            });

        const rows = await model.table("tests").min("name");

        expect(rows).toBe("Gustavo");
    });
});

describe(`Models max method tests`, () => {
    test(`Finds the largest value in a column`, async () => {
        const ages = users.map((obj) => obj.age).filter((value) => value !== null);
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ max: Math.max(...ages) }]
            });

        const rows = await model.table("tests").max("age");

        expect(rows).toBe(32);
    });

    test(`Finds the lowest value from strings in a column`, async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ max: users[0].name }]
            });

        const rows = await model.table("tests").max("name");

        expect(rows).toBe("Micah");
    });
});

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

describe("Delete tests table", () => {
    test("Delete tests table test", async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [{ exists: true }] })
            .mockResolvedValueOnce({});

        await model.deleteTable("tests");

        mockClient.query
            .mockResolvedValueOnce({ rows: [{ exists: false }] });

        const exists = await model.exists("tests");

        expect(exists).toBe(false);
    });

    test(`Delete table that doesn't exist`, async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [{ exists: false }] });

        await expect(model.deleteTable("tests")).rejects.toThrow();
    });
});

describe(`Close method tests`, () => {
    test(`Close all connections to postgreSQL`, async () => {
        await model.close();

        expect(mockEnd).toHaveBeenCalled();
    });
});