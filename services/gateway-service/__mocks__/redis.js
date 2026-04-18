const mockRedis = {
  createClient: jest.fn(() => ({
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    isOpen: true
  }))
};

module.exports = mockRedis;

