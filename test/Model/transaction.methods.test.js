import { describe, jest } from "@jest/globals";
import {
    nameFieldMock,
    jobFieldMock,
} from "../../__mocks__/mocks.js";
import { model, mockClient } from "../";

describe(`Model's begin method tests`, () => {
    test(`Begin a transaction`, async () => {
        await model.begin();

        expect(mockClient.query).toHaveBeenCalled();
    });
});

describe(`Model's commit method tests`, () => {
    const table = model.table("tests");

    const beginSpy = jest.spyOn(model, "begin");
    const commitSpy = jest.spyOn(model, "commit");

    test(`Commit a transaction`, async () => {
        await model.begin();

        mockClient.query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [nameFieldMock, jobFieldMock] })
            .mockResolvedValueOnce({ rows: [] });

        await table.insert({ "name": "Josh", "job": "plumber" });

        await model.commit();

        expect(beginSpy).toHaveBeenCalled();
        expect(commitSpy).toHaveBeenCalled();
    });
})

describe(`Model's rollback method tests`, () => {
    const table = model.table("tests");
    const rollbackSpy = jest.spyOn(model, "rollback");

    test("Rollback a transaction", async () => {
        try {
            await model.begin();

            mockClient.query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [nameFieldMock, jobFieldMock] })
                .mockResolvedValueOnce({ rows: [] });

            await table.insert({ "non-existing": 12 });

            await model.commit();
        } catch (err) {
            await model.rollback();
        }

        expect(rollbackSpy).toHaveBeenCalled();
    });
})