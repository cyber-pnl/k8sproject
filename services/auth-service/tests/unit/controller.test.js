const authController = require('../../src/modules/auth/controller');
const bcrypt = require('bcrypt');

// Mock the database query
jest.mock('../../src/shared/database', () => ({
  query: jest.fn()
}));

const { query } = require('../../src/shared/database');

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findUserByUsername', () => {
    it('should return user when found', async () => {
      const mockUser = { id: 1, username: 'test', password: '$2b$', role: 'user' };
      query.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await authController.findUserByUsername('test');

      expect(result).toEqual(mockUser);
      expect(query).toHaveBeenCalledWith('SELECT * FROM users WHERE username = $1', ['test']);
    });

    it('should return null when user not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await authController.findUserByUsername('nonexistent');

      expect(result).toBeNull();
      expect(query).toHaveBeenCalledWith('SELECT * FROM users WHERE username = $1', ['nonexistent']);
    });
  });

  describe('createUser', () => {
    it('should create user with hashed password', async () => {
      const mockUser = { id: 1, username: 'newuser', role: 'user' };
      const hashSpy = jest.spyOn(bcrypt, 'hash').mockResolvedValueOnce('hashedpw');
      query.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await authController.createUser('newuser', 'pw123', 'user');

      expect(bcrypt.hash).toHaveBeenCalledWith('pw123', 10);
      expect(query).toHaveBeenCalledWith(
        "INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role",
        ['newuser', 'hashedpw', 'user']
      );
      expect(result).toEqual(mockUser);
      hashSpy.mockRestore();
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true);

      const result = await authController.verifyPassword('pw123', 'hashedpw');

      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('pw123', 'hashedpw');
      compareSpy.mockRestore();
    });

    it('should reject incorrect password', async () => {
      const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(false);

      const result = await authController.verifyPassword('wrong', 'hashedpw');

      expect(result).toBe(false);
      compareSpy.mockRestore();
    });
  });
});

