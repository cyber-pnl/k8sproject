const usersService = require('../../src/modules/users/service');

// Mock database and redis
jest.mock('../../src/shared/database', () => ({
  query: jest.fn()
}));

jest.mock('../../src/shared/redis', () => ({
  getClient: jest.fn()
}));

const { query } = require('../../src/shared/database');
const { getClient } = require('../../src/shared/redis');

describe('Users Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    const mockUsers = [
      { id: 1, username: 'user1', role: 'user', created_at: '2024-01-01' }
    ];

    it('should return from cache if available', async () => {
      const mockRedis = { isOpen: true, get: jest.fn().mockResolvedValue(JSON.stringify(mockUsers)) };
      getClient.mockReturnValue(mockRedis);

      const result = await usersService.getAllUsers();

      expect(result.source).toBe('cache');
      expect(result.data).toEqual(mockUsers);
      expect(getClient).toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
    });

    it('should fetch from DB and cache if no cache', async () => {
      const mockRedis = { isOpen: true, get: jest.fn().mockResolvedValue(null), setEx: jest.fn() };
      getClient.mockReturnValue(mockRedis);
      query.mockResolvedValueOnce({ rows: mockUsers });

      const result = await usersService.getAllUsers();

      expect(result.source).toBe('database');
      expect(result.data).toEqual(mockUsers);
      expect(query).toHaveBeenCalledWith(
        "SELECT id, username, role, created_at FROM users ORDER BY created_at DESC"
      );
      expect(mockRedis.setEx).toHaveBeenCalledWith('users:all', 300, JSON.stringify(mockUsers));
    });

    it('should fallback to DB if Redis error', async () => {
      getClient.mockReturnValue({ isOpen: true, get: jest.fn().mockRejectedValue(new Error()) });
      query.mockResolvedValueOnce({ rows: mockUsers });

      const result = await usersService.getAllUsers();

      expect(result.source).toBe('database');
    });
  });

  describe('deleteUser', () => {
    it('should delete user and invalidate cache', async () => {
      const mockRedis = { isOpen: true, del: jest.fn() };
      getClient.mockReturnValue(mockRedis);
      query.mockResolvedValueOnce({});

      await usersService.deleteUser(1);

      expect(query).toHaveBeenCalledWith('DELETE FROM users WHERE id = $1', [1]);
      expect(mockRedis.del).toHaveBeenCalledWith('users:all');
    });
  });
});

