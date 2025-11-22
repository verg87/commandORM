const mockClient = {
    query: jest.fn(() => {}),
    release: jest.fn(() => {}),
};

const mockPool = {
    connect: jest.fn(() => mockClient),
    end: jest.fn(() => {}),
};

export const Pool = jest.fn(() => mockPool);
export const Client = jest.fn(() => mockClient);