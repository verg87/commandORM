import { model, mockEnd } from "../";

describe(`Model's close method tests`, () => {
    test(`Close all connections to postgreSQL`, async () => {
        await model.close();

        expect(mockEnd).toHaveBeenCalled();
    });
});