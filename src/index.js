import { Model } from "./ORM.js";
import { CSVDatabase } from "./CSVDatabase.js";
import { dbConfig } from "../dbConfig.js";

export { Model, CSVDatabase }

const model = new Model(dbConfig);
const table = model.table("test");

await table.rename("identification", "id");