const request = require('supertest');
const { buildSessionMiddleware } = require('../../src/modules/session/store');
const sessionRoutes = require('../../src/modules/session/routes');
const authController = require('../../src/modules/auth/controller');

jest.mock('../../src/modules/auth/controller');

process.env.COOKIE_SECURE = 'false';

let app;

beforeEach(() => {
  jest.clearAllMocks();
  app = require('./helpers/sessionApp');
});

afterEach(() => {});

describe('Session Routes', () => {
  describe('POST /auth/login', () => {
    it('creates a session and redirects to /dashboard', async () => {
      authController.findUserByUsername.mockResolvedValueOnce({ id: 7, username: 'admin', password: 'hash', role: 'admin' });
      authController.verifyPassword.mockResolvedValueOnce(true);

      const login = await request(app)
        .post('/auth/login')
        .send({ username: 'admin', password: 'pw12345' })
        .expect(302);

      expect(login.headers.location).toBe('/dashboard');
      expect(login.headers['set-cookie']).toBeDefined();

      const session = await request(app)
        .get('/auth/session')
        .set('Cookie', login.headers['set-cookie'][0].split(';')[0])
        .expect(200);

      expect(session.body.authenticated).toBe(true);
      expect(session.headers['x-user-id']).toBe('7');
      expect(session.headers['x-user-name']).toBe('admin');
      expect(session.headers['x-user-role']).toBe('admin');
    });

    it('rejects bad password', async () => {
      authController.findUserByUsername.mockResolvedValueOnce({ id: 1, username: 'admin', password: 'hash', role: 'admin' });
      authController.verifyPassword.mockResolvedValueOnce(false);

      const res = await request(app)
        .post('/auth/login')
        .send({ username: 'admin', password: 'wrong' })
        .expect(302);

      expect(res.headers.location).toBe('/login?error=2');
    });

    it('handles missing fields', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ username: '', password: '' })
        .expect(302);

      expect(res.headers.location).toBe('/login?error=1');
    });
  });

  describe('POST /auth/signup', () => {
    it('creates the user, a session and redirects to /dashboard', async () => {
      authController.findUserByUsername.mockResolvedValueOnce(null);
      authController.createUser.mockResolvedValueOnce({ id: 9, username: 'alice', role: 'user' });

      const res = await request(app)
        .post('/auth/signup')
        .send({ username: 'alice', password: 'password123', confirmPassword: 'password123' })
        .expect(302);

      expect(res.headers.location).toBe('/dashboard');
      expect(authController.createUser).toHaveBeenCalledWith('alice', 'password123', 'user');
    });

    it('rejects password mismatch', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ username: 'alice', password: 'password123', confirmPassword: 'other456' })
        .expect(302);

      expect(res.headers.location).toBe('/signup?error=2');
    });
  });

  describe('GET /auth/session', () => {
    it('returns unauthenticated without session', async () => {
      const res = await request(app).get('/auth/session').expect(200);

      expect(res.body.authenticated).toBe(false);
      expect(res.headers['x-user-id']).toBeUndefined();
    });

    it('returns authenticated with headers when session exists', async () => {
      const cookie = await loginAs(app, 3, 'bob', 'user');

      const res = await request(app)
        .get('/auth/session')
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body.authenticated).toBe(true);
      expect(res.headers['x-user-id']).toBe('3');
      expect(res.headers['x-user-name']).toBe('bob');
      expect(res.headers['x-user-role']).toBe('user');
    });
  });

  describe('Root aliases (frontend forms via API Gateway)', () => {
    it('POST /login creates a session and redirects to /dashboard', async () => {
      authController.findUserByUsername.mockResolvedValueOnce({ id: 10, username: 'dave', password: 'hash', role: 'user' });
      authController.verifyPassword.mockResolvedValueOnce(true);

      const res = await request(app)
        .post('/login')
        .send({ username: 'dave', password: 'pw12345' })
        .expect(302);

      expect(res.headers.location).toBe('/dashboard');

      const session = await request(app)
        .get('/auth/session')
        .set('Cookie', res.headers['set-cookie'][0].split(';')[0])
        .expect(200);

      expect(session.body.authenticated).toBe(true);
      expect(session.headers['x-user-name']).toBe('dave');
    });

    it('POST /signup creates the user and a session', async () => {
      authController.findUserByUsername.mockResolvedValueOnce(null);
      authController.createUser.mockResolvedValueOnce({ id: 11, username: 'eve', role: 'user' });

      const res = await request(app)
        .post('/signup')
        .send({ username: 'eve', password: 'password123', confirmPassword: 'password123' })
        .expect(302);

      expect(res.headers.location).toBe('/dashboard');
      expect(authController.createUser).toHaveBeenCalledWith('eve', 'password123', 'user');
    });

    it('GET /logout destroys the session and redirects to /', async () => {
      const cookie = await loginAs(app, 12, 'frank', 'user');

      const logout = await request(app)
        .get('/logout')
        .set('Cookie', cookie)
        .expect(302);

      expect(logout.headers.location).toBe('/');

      const after = await request(app)
        .get('/auth/session')
        .set('Cookie', cookie)
        .expect(200);

      expect(after.body.authenticated).toBe(false);
    });
  });

  describe('GET /auth/logout', () => {
    it('destroys the session and redirects to /', async () => {
      const cookie = await loginAs(app, 4, 'carol', 'user');

      const logout = await request(app)
        .get('/auth/logout')
        .set('Cookie', cookie)
        .expect(302);

      expect(logout.headers.location).toBe('/');

      const after = await request(app)
        .get('/auth/session')
        .set('Cookie', cookie)
        .expect(200);

      expect(after.body.authenticated).toBe(false);
    });
  });
});

async function loginAs(app, id, username, role) {
  authController.findUserByUsername.mockResolvedValueOnce({ id, username, password: 'hash', role });
  authController.verifyPassword.mockResolvedValueOnce(true);

  const res = await request(app)
    .post('/auth/login')
    .send({ username, password: 'pw12345' });

  return res.headers['set-cookie'][0].split(';')[0];
}