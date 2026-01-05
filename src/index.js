import { Model } from "./Model.js";
import { CSVDatabase } from "./CSVDatabase.js";
import { dbConfig } from "../dbConfig.js";

export { Model, CSVDatabase }

const model = new Model(dbConfig);
const table = model.table("employees");

// console.log(table.model.inTransaction);

// model.begin();

// console.log(table.model.inTransaction);
const res = await table.select().orderBy("employee_name").desc().get()
console.log(res);

const usual = await table.select().get();
console.log(usual);