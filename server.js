require('dotenv').config();
const express = require("express");
const app = express();
const session = require("express-session");
const db = require("./database");
const bcrypt = require("bcryptjs");
const PORT = process.env.PORT || 3000;
const path = require("path");
const { validation } = require("./utils-server/utils-server");

const { Server } = require('socket.io');
const http = require('http');
const { error } = require('console');
const server = http.createServer(app);
const io = new Server(server);

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

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join', (userId) => {
    if (!userId) {
      console.log('Error: Attempt to join room with null ID');
      return;
    }
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their private room`);
  });

  socket.on('disconnect', () => {
    console.log("User disconnected");
  });
});

// register
app.post("/register", async (req, res) => {
  let {username, email, password} = req.body;

  const usernameRes = validation.isValidUsername(username);
  if (!usernameRes.valid) return res.status(400).json({ message: usernameRes.error });

  const emailRes = validation.isValidEmail(email);
  if (!emailRes.valid) return res.status(400).json({ message: emailRes.error })

  const passwordRes = validation.isValidPassword(password);
  if (!passwordRes.valid) return res.status(400).json({ message: passwordRes.error })

  const clearUsername = usernameRes.value;
  const clearEmail = emailRes.value;
  const clearPassword = passwordRes.value;

  const hashedPassword = await bcrypt.hash(clearPassword, 10);

  const sql = "INSERT INTO users (username, email, password) VALUES (?, ?, ?);"

  db.run(sql, [clearUsername, clearEmail, hashedPassword], function(err) {
    if (err) {
      console.error(err.message);
      return res.status(400).json({error: "User already exists or error"});
    }
    res.json({message: "Success! User is created!", id: this.lastID})
    })
})

// login
app.post("/login", async (req, res) => {
  let {email, password} = req.body;

  const emailRes = validation.isValidEmail(email);
  if (!emailRes.valid) return res.status(400).json({ message: emailRes.error });

  const passwordRes = validation.isValidPassword(password);
  if (!passwordRes.valid) return res.status(400).json({ message: passwordRes.error });

  const clearEmail = emailRes.value;
  const clearPassword = passwordRes.value;

  const sql = "SELECT * FROM users WHERE email = ?";

  db.get(sql, [clearEmail], async (err, user) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({error: "Database error"});
    }

    if (!user) {
      return res.status(400).json({error: "Invalid email or password!"});
    }

    const isMatchPassword = await bcrypt.compare(clearPassword, user.password);

    if (!isMatchPassword) {
      return res.status(400).json({error: "Invalid email or password!"})
    }

    req.session.userID = user.id;
    req.session.username = user.username;
    req.session.role = user.role;

    res.json({
      message: "Welcome!",
      username: user.username,
    })

  })
})

function checkAuth(req, res, next) {
  if (!req.session.userID) {
	  return res.status(401).json({ error: "Unauthorized! Please log in." });
  }
  next();
}

function isAdmin(req, res, next) {
  if (!req.session.userID) {
    return res.status(401).json({ error: "Unauthorized! Please log in." });
  }
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden! You do not have administrator privileges.' })
  }
  next();
}

// open access for profile.html
app.get("/profile", checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "private", "profile.html"));
})

// display username, email in settings
app.get("/api/profile", checkAuth, (req, res) => {
  const sql = "SELECT id, username, email, role FROM users WHERE id = ?";

  db.get(sql, [req.session.userID], (err, user) => {
    if (err || !user) {
      return res.status(500).json({error: "Database error"})
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
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
  let {username} = req.body;

  const usernameRes = validation.isValidUsername(username);
  if (!usernameRes.valid) return res.status(400).json({ message: usernameRes.error });
  const clearUsername = usernameRes.value;

  const sql = `UPDATE users SET username = ? WHERE id = ?`;

  db.run(sql, [clearUsername, req.session.userID], function(err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({error: "Database error"});
    }

    req.session.username = clearUsername;

    res.json({
      message: "Success!",
      username: clearUsername
    })

  })
})

// change email
app.put("/change-email", checkAuth, (req, res) => {
  let { email } = req.body;

  const emailRes = validation.isValidEmail(email);
  if (!emailRes.valid) return res.status(400).json({ message: emailRes.error });
  const clearEmail = emailRes.value;

  const sql = `UPDATE users SET email = ? WHERE id = ? `;

  db.run(sql, [clearEmail, req.session.userID], function(err) {
    if (err) {
      return res.status(500).json({error: "Database error"});
    }

    res.json({
      message: "Success!",
      email: clearEmail
    })

  })
})

// change password
app.put("/change-password", checkAuth, async (req, res) => {
  const {currPassword, newPassword1, newPassword2} = req.body;

  const currPasswordRes = validation.isValidPassword(currPassword);
  const newPassword1Res = validation.isValidPassword(newPassword1);
  const newPassword2Res = validation.isValidPassword(newPassword2);

  if (!currPasswordRes.valid || !newPassword1Res.valid || !newPassword2Res.valid) {
    return res.status(400).json({ error: "Invalid password format!" });
  }

  const clearCurrPassword = currPasswordRes.value;
  const clearNewPassword1 = newPassword1Res.value;
  const clearNewPassword2 = newPassword2Res.value;

  if (clearNewPassword1 !== clearNewPassword2) {
    return res.status(400).json({
      error: "New passwords mismatch."
    });
  }

  const SQL_checkCurrPass = "SELECT password FROM users WHERE id = ?";

  db.get(SQL_checkCurrPass, [req.session.userID], async (err, user) => {
    if (err || !user) return res.status(500).json({ error: "User not found!" })

    const isCurrPassword = await bcrypt.compare(clearCurrPassword, user.password);

    if (!isCurrPassword) return res.status(401).json({ error: "Current password incorrect" })

    const hashedPassword = await bcrypt.hash(clearNewPassword1, 10);

    const updatePassword = "UPDATE users SET password = ? WHERE id = ?";

    db.run(updatePassword, [hashedPassword, req.session.userID], (err) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json({ message: "Password updated successfully!" })
    })
  })
})

// delete account
app.delete("/delete-account", checkAuth, async (req, res) => {
  const { password } = req.body;

  const passwordRes = validation.isValidPassword(password);
  if (!passwordRes.valid) return res.status(400).json({ message: passwordRes.error })
  const clearPassword = passwordRes.value;

  const userID = req.session.userID;

  const SQL_checkCurrPass = "SELECT password FROM users WHERE id = ?";

  db.get(SQL_checkCurrPass, [userID], async (err, user) => {
    if (err || !user) return res.status(500).json({ error: "Database error!" });

    const isPassword = await bcrypt.compare(clearPassword, user.password);

    if (!isPassword) return res.status(401).json({ error: "Password incorrect" });

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
  const { username } = req.body;

  const usernameRes = validation.isValidUsername(username);
  if (!usernameRes.valid) return res.status(400).json({ message: usernameRes.error })
  const clearUsername = usernameRes.value;

  const sqlSearchUsers = "SELECT id, username FROM users WHERE username = ? AND id != ?";

  db.get(sqlSearchUsers, [clearUsername, req.session.userID], async (err, user) => {
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
  const { receiver_id, content } = req.body;
  const sender_id = req.session.userID;

  const contentRes = validation.isValidMessage(content);
  if (!contentRes.valid) return res.status(400).json({ message: contentRes.error });
  const clearContent = contentRes.value;

  const sqlSendMessage = `
    INSERT INTO messages (sender_id, receiver_id, content)
    VALUES (?, ?, ?)`;

  db.run(sqlSendMessage, [sender_id, receiver_id, clearContent], function(err) {
    if (err) {
      console.error("Database error: ", err.message);
      return res.status(500).json({ error: "Database error" });
    }

    const newMessage = {
      sender_id: sender_id,
      receiver_id: receiver_id,
      content: clearContent,
      sent_at: new Date().toISOString()
    };

    io.to(`user_${receiver_id}`).emit('new_message', newMessage);
    io.to(`user_${sender_id}`).emit('new_message', newMessage);

    res.json({ message: 'Message sent successfully!' })
  })
})

// show messages
app.get('/api/messages/:otherId', checkAuth, (req, res) => {
  const myId = req.session.userID;
  const otherId = req.params.otherId;

  const sqlShowMessages = `
    SELECT * FROM messages
    WHERE (sender_id = ? AND receiver_id = ?)
    OR (sender_id = ? AND receiver_id = ?)
    ORDER BY sent_at ASC
  `;

  db.all(sqlShowMessages, [myId, otherId, otherId, myId], (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  })
})

app.get('/admin-panel', isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'private', 'admin-panel.html'));
})

server.listen(PORT, () => {
  console.log(`[!] SERVER is running on http://localhost:${PORT}`);
})
