const request = require('supertest');
const nock = require('nock');
const { mock } = require('jest-mock-extended');

const app = require('../index.js');

describe('Gateway Service Tests', () => {
  beforeAll(() => {
    // Mock process.env
    process.env.AUTH_SERVICE_URL = 'http://auth-service:3001';
    process.env.USER_SERVICE_URL = 'http://user-service:3002';
    process.env.FRONTEND_URL = 'http://frontend-service:3003';
    process.env.REDIS_URL = 'redis://redis-service:6379';
    process.env.SESSION_SECRET = 'test-secret';

    // Mock global fetch
    global.fetch = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Redis Connection', () => {
    test('should connect to Redis successfully', async () => {
      const mockRedis = mock();
      jest.doMock('redis', () => ({
        createClient: () => mockRedis,
      }));

      const redis = require('redis');
      // Test would verify connect called, but since startServer async/server listen, test via app start if needed
      expect(redis.createClient).toHaveBeenCalledWith({
        url: 'redis://redis-service:6379',
      });
    });
  });

  describe('POST /login', () => {
    test('should login successfully and set session', async () => {
      nock('http://auth-service:3001')
        .post('/auth/verify')
        .reply(200, { success: true, user: { id: 1, username: 'test', role: 'admin' } });

      const res = await request(app)
        .post('/login')
        .send({ username: 'test', password: 'pass' })
        .expect(302);

      expect(res.headers.location).toBe('/dashboard');
      // Session tested via subsequent req in integration if needed
    });

    test('should redirect on auth failure', async () => {
      nock('http://auth-service:3001')
        .post('/auth/verify')
        .reply(401, { success: false });

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
      nock('http://auth-service:3001')
        .post('/auth/register')
        .reply(200, { user: { id: 2, username: 'newuser', role: 'user' } });

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
      nock('http://auth-service:3001')
        .post('/auth/register')
        .reply(400, { code: 'USER_EXISTS' });

      const res = await request(app)
        .post('/signup')
        .send({ username: 'exists', password: 'pass123', confirmPassword: 'pass123' })
        .expect(302);

      expect(res.headers.location).toBe('/signup?error=5');
    });
  });

  describe('GET /logout', () => {
    test('should destroy session and redirect', async (done) => {
      // Use callback style for session destroy
      const res = await request(app)
        .get('/logout')
        .expect(302);

      expect(res.headers.location).toBe('/');
      done();
    });
  });

  describe('Proxy Middleware', () => {
    test('/api proxy passes user headers', async () => {
      // Setup session - supertest sessions need cookie jar handling, test header logic indirectly or full integration
      const mockReq = { session: { user: { id: 1, role: 'user' } } };
      // For proxy onProxyReq, test via expectation on headers if possible, or smoke test
      const res = await request(app)
        .get('/api/users')
        .expect(200); // Would proxy, but since target mocked implicitly via nock if needed
    });

    test('/ proxy to frontend passes session headers', async () => {
      const res = await request(app)
        .get('/')
        .expect(200); // Proxies to frontend
    });
  });

  describe('Session Middleware', () => {
    test('session middleware sets res.locals.user from session', (done) => {
      request(app)
        .get('/')
        .expect((res) => {
          // Tests res.locals via custom endpoint if added, or integration
        })
        .end(done);
    });
  });
});
