import { jest } from "@jest/globals";
import { model, mockClient } from "../";

describe("Model's createTable method tests", () => {
    const createTableSpy = jest.spyOn(model, "createTable");

    test("Create tests table test", async () => {
        // model.createTable('tests') fires client.query two times
        // and the model.exists calls client.query one time.
        // That's why I need to mock client.query three times
        mockClient.query
            .mockResolvedValueOnce({ rows: [{ exists: false }] })
            .mockResolvedValueOnce({});

        await model.createTable("tests");

        expect(createTableSpy).toHaveBeenCalled();
    });

    test(`Create already existing table`, async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [{ exists: true }] });

        await expect(model.createTable("tests")).rejects.toThrow();
    });
});