import { model } from "../";

describe(`TableQueryBuilder toSql method tests`, () => {
    test(`Returns correct sql query`, () => {
        const table = model.table("tests");

        const sql = table.select("name")
            .where("age", ">", 30)
            .and("income", ">", 30000)
            .toSql();

        expect(["name", "age", "income"].every(field => sql.indexOf(field) > -1)).toBe(true);
    })
});