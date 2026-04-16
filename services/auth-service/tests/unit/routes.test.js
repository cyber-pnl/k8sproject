const request = require('supertest');
const express = require('express');
const authRoutes = require('../../src/modules/auth/routes');
const authController = require('../../src/modules/auth/controller');

// Mock controller
jest.mock('../../src/modules/auth/controller');

const app = express();
app.use(express.json());
app.use(authRoutes);

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/verify', () => {
    it('should verify valid credentials', async () => {
      authController.findUserByUsername.mockResolvedValueOnce({ id: 1, username: 'test', password: 'hash', role: 'user' });
      authController.verifyPassword.mockResolvedValueOnce(true);

      const res = await request(app)
        .post('/auth/verify')
        .send({ username: 'test', password: 'pw123' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.user).toEqual({ id: 1, username: 'test', role: 'user' });
      expect(authController.findUserByUsername).toHaveBeenCalledWith('test');
    });

    it('should return 401 for invalid password', async () => {
      authController.findUserByUsername.mockResolvedValueOnce({ id: 1, username: 'test', password: 'hash', role: 'user' });
      authController.verifyPassword.mockResolvedValueOnce(false);

      await request(app)
        .post('/auth/verify')
        .send({ username: 'test', password: 'wrong' })
        .expect(401)
        .expect(res => expect(res.body.success).toBe(false));
    });

    it('should return 400 for missing credentials', async () => {
      await request(app)
        .post('/auth/verify')
        .send({ username: 'test' })
        .expect(400)
        .expect(res => expect(res.body.success).toBe(false));
    });
  });

  describe('POST /auth/register', () => {
    it('should register new user', async () => {
      authController.findUserByUsername.mockResolvedValueOnce(null);
      authController.createUser.mockResolvedValueOnce({ id: 2, username: 'new', role: 'user' });

      const res = await request(app)
        .post('/auth/register')
        .send({ username: 'new', password: 'pw123456' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(authController.findUserByUsername).toHaveBeenCalledWith('new');
    });

    it('should reject existing user', async () => {
      authController.findUserByUsername.mockResolvedValueOnce({ id: 1 });

      const res = await request(app)
        .post('/auth/register')
        .send({ username: 'exists', password: 'pw123456' })
        .expect(409);

      expect(res.body.code).toBe('USER_EXISTS');
    });

    it('should reject short password', async () => {
      await request(app)
        .post('/auth/register')
        .send({ username: 'short', password: '123' })
        .expect(400);
    });
  });
});

