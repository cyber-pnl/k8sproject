const mockRedis = {
  createClient: jest.fn(() => ({
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    isOpen: true
  }))
};

mockRedis.createClient().connect.mockResolvedValue(undefined);

module.exports = mockRedis;

