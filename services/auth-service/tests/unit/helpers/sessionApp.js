const express = require('express');
const { buildSessionMiddleware } = require('../../../src/modules/session/store');
const sessionRoutes = require('../../../src/modules/session/routes');
const authRoutes = require('../../../src/modules/auth/routes');

const app = express();
app.use(buildSessionMiddleware());
app.use(sessionRoutes);
app.use(authRoutes);

module.exports = app;