const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
};

const mockPool = {
    connect: jest.fn(() => Promise.resolve(mockClient)),
    end: jest.fn(() => Promise.resolve()),
};

import { Pool } from "pg";
// export const Pool = jest.fn(() => mockPool);
// export const Client = jest.fn(() => mockClient);
export { Pool }