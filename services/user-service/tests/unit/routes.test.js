const request = require('supertest');
const express = require('express');
const userRoutes = require('../../src/modules/users/routes');
const usersService = require('../../src/modules/users/service');
const authMiddleware = require('../../src/shared/middlewares/auth.middleware');

// Mock service and middleware
jest.mock('../../src/modules/users/service');
jest.mock('../../src/shared/middlewares/auth.middleware');

const app = express();
app.use(express.json());
app.use(userRoutes);

describe('User Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/users', () => {
    it('should return users from cache', async () => {
      authMiddleware.isAuthenticated.mockImplementation((req, res, next) => next());
      usersService.getAllUsers.mockResolvedValue({ source: 'cache', data: [{ id: 1, username: 'test' }] });

      const res = await request(app)
        .get('/api/users')
        .expect(200);

      expect(res.body.source).toBe('cache');
      expect(usersService.getAllUsers).toHaveBeenCalled();
    });

    it('should return 500 on error', async () => {
      authMiddleware.isAuthenticated.mockImplementation((req, res, next) => next());
      usersService.getAllUsers.mockRejectedValue(new Error('DB error'));

      await request(app)
        .get('/api/users')
        .expect(500);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete user', async () => {
      authMiddleware.isAdmin.mockImplementation((req, res, next) => next());
      usersService.deleteUser.mockResolvedValue();

      await request(app)
        .delete('/api/users/1')
        .expect(200);
    });
  });
});
