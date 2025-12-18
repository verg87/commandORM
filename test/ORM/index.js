import { jest } from "@jest/globals";
import { Pool } from "pg";
import { Model } from "../../src/ORM.js";

jest.useFakeTimers();

const model = new Model({});

const mockClient = Pool().connect();
const mockEnd = Pool().end;

export { model, mockClient, mockEnd };