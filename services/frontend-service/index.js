const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const path = require("path");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(expressLayouts);
app.set("layout", "layout");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lit les headers injectés par le gateway
app.use((req, res, next) => {
  const userId = req.headers["x-user-id"];
  const userName = req.headers["x-user-name"];

  console.log("🔍 [Frontend] Headers reçus:", {
    "x-user-id": userId,
    "x-user-name": userName,
    "x-user-role": req.headers["x-user-role"],
    "content-type": req.headers["content-type"],
    url: req.url,
  });

  if (userId && userName) {
    const user = {
      id: userId,
      username: userName,
      role: req.headers["x-user-role"] || "user",
    };
    res.locals.user = user;
    res.locals.currentUser = user;
    console.log("✅ [Frontend] Utilisateur défini:", userName);
  } else {
    res.locals.user = null;
    res.locals.currentUser = null;
    console.log("❌ [Frontend] Aucun header utilisateur reçu pour:", req.url);
  }
  next();
});

// Routes
app.get("/", (req, res) => {
  res.render("home", {
    title: "KubeLearn | Master Kubernetes",
    description: "The modern platform to learn Kubernetes",
    user: res.locals.user,
    currentUser: res.locals.currentUser,
  });
});

app.get("/dashboard", (req, res) => {
  if (!res.locals.user) return res.redirect("/login");
  res.render("dashboard", {
    title: "Dashboard | KubeLearn",
    description: "Your personal learning dashboard.",
    user: res.locals.user,
    currentUser: res.locals.currentUser,
  });
});

app.get("/login", (req, res) => {
  if (res.locals.user) return res.redirect("/");
  res.render("login", {
    title: "Login | KubeLearn",
    user: null,
    currentUser: null,
    error: req.query.error || null,
  });
});

app.get("/signup", (req, res) => {
  if (res.locals.user) return res.redirect("/");
  res.render("signup", {
    title: "Signup | KubeLearn",
    user: null,
    currentUser: null,
    error: req.query.error || null,
  });
});

app.get("/logout", (req, res) => res.redirect("/logout"));

app.use((req, res) => res.status(404).send("Page not found"));
app.use((err, req, res, next) => {
  console.error("Frontend Service error:", err);
  res.status(500).send("Erreur serveur");
});

const port = process.env.PORT || 3003;
app.listen(port, () => console.log(`Frontend Service running on port ${port}`));

module.exports = app;