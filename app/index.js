const express = require("express");
const session = require("express-session");
const path = require("path"); 
const app = express();

app.set("view engine", "ejs"); 
app.set("views", path.join(__dirname, "views")); // dossier des vues
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);


// Import des routes
const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");

app.use("/", authRoutes);
app.use("/", usersRoutes);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
