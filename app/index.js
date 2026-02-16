const express = require("express");
const session = require("express-session");
const path = require("path");
const { initDB } = require("./services/db.services");

const app = express();

// ========================
// CONFIG EXPRESS
// ========================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// ========================
// ROUTES
// ========================
const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");

app.use("/", authRoutes);
app.use("/", usersRoutes);

// ========================
// START SERVER
// ========================
async function startServer() {
  try {
    await initDB(); // attend que la DB soit prête
    app.listen(3000, () =>
      console.log("Server running on port 3000")
    );
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
