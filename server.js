require('dotenv').config();
const express = require("express");
const app = express();
const session = require("express-session");
const db = require("./database");
const bcrypt = require("bcryptjs");
const PORT = process.env.PORT || 3000;
const path = require("path");
const { validation } = require("./utils-server/utils-server");

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 86400000
  }
}))

app.use(express.static("./public"))

app.listen(PORT, () => {
  console.log(`[!] Server is running on http://localhost:${PORT}`);
  console.log(`[!] WARNING: Unauthorized access is monitored.`);
})

// register
app.post("/register", async (req, res) => {
  let {rawUsername, rawEmail, rawPassword} = req.body;

  const usernameRes = validation.isValidUsername(rawUsername);
  if (!usernameRes.valid) return res.status(400).json({ message: usernameRes.error });

  const emailRes = validation.isValidEmail(rawEmail);
  if (!emailRes.valid) return res.status(400).json({ message: emailRes.error })

  const passwordRes = validation.isValidPassword(rawPassword);
  if (!passwordRes.valid) return res.status(400).json({ message: passwordRes.error })

  const username = usernameRes.value;
  const email = emailRes.value;
  const password = passwordRes.value;

  const hashedPassword = await bcrypt.hash(password, 10);

  const sql = "INSERT INTO users (username, email, password) VALUES (?, ?, ?);"

  db.run(sql, [username, email, hashedPassword], function(err) {
    if (err) {
      console.error(err.message);
      return res.status(400).json({error: "User already exists or error"});
    }
    res.json({message: "Success! User is created!", id: this.lastID})
    })
})

// login
app.post("/login", async (req, res) => {
  let {rawEmail, rawPassword} = req.body;

  const emailRes = validation.isValidEmail(rawEmail);
  if (!emailRes.valid) return res.status(400).json({ message: emailRes.error });

  const passwordRes = validation.isValidPassword(rawPassword);
  if (!passwordRes.valid) return res.status(400).json({ message: passwordRes.error });

  const email = emailRes.value;
  const password = passwordRes.value;

  const sql = "SELECT * FROM users WHERE email = ?";

  db.get(sql, [email], async (err, user) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({error: "Database error"})
    }

    if (!user) {
      return res.status(400).json({error: "Invalid email or password!"});
    }

    const isMatchPassword = await bcrypt.compare(password, user.password);

    if (!isMatchPassword) {
      return res.status(400).json({error: "Invalid email or password!"})
    }

    req.session.userID = user.id;
    req.session.username = user.username;

    res.json({
      message: "Welcome!",
      username: user.username
    })

  })
})

function checkAuth(req, res, next) {
  if (!req.session.userID) {
	  return res.status(401).json({error: "Unauthorized! Please log in."});
  }
  next();
}

// open access for profile.html
app.get("/profile", checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "private", "profile.html"));
})

// display username, email in settings
app.get("/api/profile", checkAuth, (req, res) => {
  const sql = "SELECT username, email FROM users WHERE id = ?";

  db.get(sql, [req.session.userID], (err, user) => {
    if (err || !user) {
      return res.status(500).json({error: "Database error"})
    }

    res.json({
      username: user.username,
      email: user.email
    })
  })
})

// logout
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({error: "Could not log out."})
    }
    res.clearCookie("connect.sid");
    res.json({message: "Logged out successfuly."})
  })
})

// change username
app.put("/change-username", checkAuth, (req, res) => {
  let {rawUsername} = req.body;

  const usernameRes = validation.isValidUsername(rawUsername);
  if (!usernameRes.valid) return res.status(400).json({ message: usernameRes.error });
  const username = usernameRes.value;

  const sql = `UPDATE users SET username = ? WHERE id = ?`;

  db.run(sql, [username, req.session.userID], function(err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({error: "Database error"});
    }

    req.session.username = username;

    res.json({
      message: "Success!",
      username: username
    })

  })
})

// change email
app.put("/change-email", checkAuth, (req, res) => {
  let {rawEmail} = req.body;

  const emailRes = validation.isValidEmail(rawEmail);
  if (!emailRes.valid) return res.status(400).json({ message: emailRes.error });
  const email = emailRes.value;

  const sql = `UPDATE users SET email = ? WHERE id = ? `;

  db.run(sql, [email, req.session.userID], function(err) {
    if (err) {
      return res.status(500).json({error: "Database error"});
    }

    res.json({
      message: "Success!",
      email: email
    })

  })
})

// change password
app.put("/change-password", checkAuth, async (req, res) => {
  const {rawCurrPassword, rawPassword, rawPassword_confirm} = req.body;

  const currPasswordRes = validation.isValidPassword(rawCurrPassword);
  const rawPasswordRes = validation.isValidPassword(rawPassword);
  const rawPasswordConfirmRes = validation.isValidPassword(rawPassword_confirm);

  if (!currPasswordRes.valid || !rawPasswordRes.valid || !rawPasswordConfirmRes.valid) {
    return res.status(400).json({ error: "Invalid password format!" });
  }

  const currPassword = currPasswordRes.value;
  const newPassword_1 = rawPasswordRes.value;
  const newPassword_2 = rawPasswordConfirmRes.value;

  if (newPassword_1 !== newPassword_2) {
    return res.status(400).json({
      error: "New passwords mismatch."
    });
  }

  const SQL_checkCurrPass = "SELECT password FROM users WHERE id = ?";

  db.get(SQL_checkCurrPass, [req.session.userID], async (err, user) => {
    if (err || !user) return res.status(500).json({ error: "User not found!" })

    const isCurrPassword = await bcrypt.compare(currPassword, user.password);

    if (!isCurrPassword) return res.status(401).json({ error: "Current password incorrect" })

    const hashedPassword = await bcrypt.hash(newPassword_1, 10);

    const updatePassword = "UPDATE users SET password = ? WHERE id = ?";

    db.run(updatePassword, [hashedPassword, req.session.userID], (err) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json({ message: "Password updated successfully!" })
    })
  })
})

// delete account
app.delete("/delete-account", checkAuth, async (req, res) => {
  const {rawPassword} = req.body;

  const passwordRes = validation.isValidPassword(rawPassword);
  if (!passwordRes.valid) return res.status(400).json({ message: passwordRes.error })
  const password = passwordRes.value;

  const userID = req.session.userID;

  const SQL_checkCurrPass = "SELECT password FROM users WHERE id = ?";

  db.get(SQL_checkCurrPass, [userID], async (err, user) => {
    if (err || !user) return res.status(500).json({ error: "Database error!" });

    const isPassword = await bcrypt.compare(password, user.password);

    if (!isPassword) return res.status(401).json({ error: "Password incorrect"});

    const SQL_deleteAccount = "DELETE FROM users WHERE id = ?";

    db.run(SQL_deleteAccount, [userID], function(err) {
      if (err){
        console.error("Database error: ", err.message);
        return res.status(500).json({ error: "Failed to delete from DB" });
      }

      req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: "Session cleanup failed." });
        res.clearCookie("connect.sid");
        res.json({ message: "Account permanently deleted" })
      })
    })
  })
})

// search users
app.post("/api/search-user", checkAuth, async (req, res) => {
  const { rawUsername } = req.body;

  const usernameRes = validation.isValidUsername(rawUsername);
  if (!usernameRes.valid) return res.status(400).json({ message: usernameRes.error })
  const username = usernameRes.value;

  const sqlSearchUsers = "SELECT id, username FROM users WHERE username = ? AND id != ?";

  db.get(sqlSearchUsers, [username, req.session.userID], async (err, user) => {
    if (err) {
      console.error("Database error: ", err.message);
      return res.status(500).json({ error: "Database error" });
    }

    if (!user) { // if user not found
      return res.status(404).json({ error: "User not found!" });
    }

    res.json({
      id: user.id,
      username: user.username
    })

  })
})

// send message
app.post("/api/send-message", checkAuth, async (req, res) => {
  const { message } = req.body;

  if (!validation.isValidMessage(message)) {

  }
})
