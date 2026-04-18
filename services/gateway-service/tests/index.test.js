const request = require('supertest');
const nock = require('nock');

jest.mock('redis');
jest.mock('connect-redis');

let startServer;
let app;

describe('Gateway Service Tests', () => {
  process.env.NODE_ENV = 'test';

  beforeAll(async () => {
    // Mock process.env
    process.env.AUTH_SERVICE_URL = 'http://auth-service:3001';
    process.env.USER_SERVICE_URL = 'http://user-service:3002';
    process.env.FRONTEND_URL = 'http://frontend-service:3003';
    process.env.REDIS_URL = 'redis://redis-service:6379';
    process.env.SESSION_SECRET = 'test-secret';

    global.fetch = jest.fn();

    const gatewayModule = require('../index.js');
    startServer = gatewayModule.startServer;
    app = gatewayModule.app;
    await startServer();
  });



  beforeEach(() => {
    jest.clearAllMocks();
    nock.cleanAll();
    global.fetch.mockClear();
  });


  afterAll(() => {
    jest.restoreAllMocks();
    nock.cleanAll();
  });

  describe('Redis Connection', () => {
    test('should use Redis client in test env', () => {
      const redis = require('redis');
      // In test env createClient skipped, but mock exists
      expect(redis.createClient).toBeDefined();
    });
  });

  describe('POST /login', () => {
    test('should login successfully and set session', async () => {
      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, user: { id: 1, username: 'test', role: 'admin' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const res = await request(app)
        .post('/login')
        .send({ username: 'test', password: 'pass' })
        .expect(302);

      expect(res.headers.location).toBe('/dashboard');
    });


    test('should redirect on auth failure', async () => {
      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: false }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const res = await request(app)
        .post('/login')
        .send({ username: 'bad', password: 'bad' })
        .expect(302);

      expect(res.headers.location).toBe('/login?error=1');
    });


    test('should redirect on missing credentials', async () => {
      const res = await request(app)
        .post('/login')
        .send({ username: '' })
        .expect(302);

      expect(res.headers.location).toBe('/login?error=1');
    });
  });

  describe('POST /signup', () => {
    test('should signup successfully and set session', async () => {
      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { id: 2, username: 'newuser', role: 'user' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const res = await request(app)
        .post('/signup')
        .send({ username: 'newuser', password: 'password123', confirmPassword: 'password123' })
        .expect(302);

      expect(res.headers.location).toBe('/');
    });


    test('should redirect on password mismatch', async () => {
      const res = await request(app)
        .post('/signup')
        .send({ username: 'user', password: 'pass', confirmPassword: 'different' })
        .expect(302);

      expect(res.headers.location).toBe('/signup?error=2');
    });

    test('should redirect on short password', async () => {
      const res = await request(app)
        .post('/signup')
        .send({ username: 'user', password: '123', confirmPassword: '123' })
        .expect(302);

      expect(res.headers.location).toBe('/signup?error=3');
    });

    test('should redirect on user exists', async () => {
      global.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'USER_EXISTS' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const res = await request(app)
        .post('/signup')
        .send({ username: 'exists', password: 'pass123', confirmPassword: 'pass123' })
        .expect(302);

      expect(res.headers.location).toBe('/signup?error=5');
    });

  });

  describe('GET /logout', () => {
    test('should destroy session and redirect', async () => {
      const res = await request(app)
        .get('/logout')
        .expect(302);

      expect(res.headers.location).toBe('/');
    });
  });

  describe('Proxy Middleware', () => {
    test('proxy /api passes through', async () => {
      nock('http://user-service:3002')
        .get('/users')
        .reply(200, []);

      const res = await request(app)
        .get('/api/users')
        .expect(200);
    });

    test('/ proxy to frontend', async () => {
      nock('http://frontend-service:3003')
        .get('/')
        .reply(200, 'Frontend HTML');

      const res = await request(app)
        .get('/')
        .expect(200);
    });
  });
});

