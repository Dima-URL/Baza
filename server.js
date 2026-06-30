require('dotenv').config();
const path = require('path');
const express = require("express");
const app = express();
const session = require("express-session");
const db = require("./database");
const bcrypt = require("bcryptjs");
const PORT = process.env.PORT || 3000;
const { validation } = require("./utils-server/utils-server");
const { Server } = require('socket.io');
const http = require('http');
const server = http.createServer(app);
const io = new Server(server);
const { v4: uuidv4, validate } = require('uuid');
const middleware = require('./middleware.js');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const AUTH_ERROR_MSG = 'Invalid email or password.';
const SERVER_ERROR_MSG = 'A server error occurred. Please try again later.';

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(express.static("./public"));

const adminRoute = require('./routes/admin_routes.js');
const { type } = require('os');
app.use('/', adminRoute);

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
  if (!emailRes.valid) return res.status(400).json({ message: emailRes.error });

  const passwordRes = validation.isValidPassword(password);
  if (!passwordRes.valid) return res.status(400).json({ message: passwordRes.error });

  const userId = uuidv4();
  const clearUsername = usernameRes.value;
  const clearEmail = emailRes.value;
  const clearPassword = passwordRes.value;
  const hashedPassword = await bcrypt.hash(clearPassword, 10);

  const sql = "INSERT INTO users (id, username, email, password) VALUES (?, ?, ?, ?);"

  db.run(sql, [userId, clearUsername, clearEmail, hashedPassword], function(err) {
    if (err) {
      console.error('User already exists or error.', err.message);
      return res.status(400).json({ error: "User already exists or error" });
    }
    return res.json({ message: "Success! User is created!", id: userId });
    })
})

// 2FA
app.post('/check-code2fa', (req, res) => {
  let { userCode } = req.body;

  if (typeof userCode != 'string') {
    return res.status(400).json({ error: 'Code incorrect or invalid format!' });
  }

  userCode = userCode.trim();

  if (!/^\d{4}$/.test(userCode)) {
    return res.status(400).json({ error: 'Code incorrect or invalid format!' });
  }

  if (req.session.correct2faCode !== userCode) {
    return res.status(401).json({ error: 'Code incorrect!'});
  }

  const sql = 'SELECT id, username, role FROM users WHERE id = ?';
  db.get(sql, [req.session.tempUserID], (err, user) => {
    if (err) {
      console.log('Failed check 2FA, ', err.message);
      return res.status(500).json({ error: SERVER_ERROR_MSG });
    }
      req.session.userID = req.session.tempUserID;
      req.session.username = user.username;
      req.session.role = user.role;

      delete req.session.tempUserID;
      delete req.session.correct2faCode;

      return res.json({ message: "Welcome!", user: user.username });
  })
})

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  statusCode: 429,
  message: { error: 'Too many login attempts. Pleasy try again later.' },
  standardHeaders: true,
  legacyHeaders: false
})

// login
app.post("/login", loginLimiter, async (req, res) => {
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
      console.error('Failed login, ', err.message);
      return res.status(500).json({ error: SERVER_ERROR_MSG });
    }

    if (!user) {
      const fakeHash = '$2b$10$s6eA28lQfeDZkJTVPRTtGeWJYQ2jpJDZIiNLVnPDaEfiWfg0sk25e';
      await bcrypt.compare(clearPassword, fakeHash);
      return res.status(400).json({error: AUTH_ERROR_MSG});
    }

    const isMatchPassword = await bcrypt.compare(clearPassword, user.password);

    if (!isMatchPassword) {
      return res.status(400).json({error: AUTH_ERROR_MSG});
    }

    const generatedCode = String(crypto.randomInt(0, 10000)).padStart(4, '0');
    console.log(generatedCode);

    req.session.correct2faCode = generatedCode;
    req.session.tempUserID = user.id;

    return res.json({ message: "MFA_REQUIRED" });
  })
})

app.get('/login-page', (req, res) => {
  return res.sendFile(path.join(__dirname, 'private', 'login.html'));
})

// open access for profile.html
app.get("/profile", middleware.checkAuth, (req, res) => {
  return res.sendFile(path.join(__dirname, "private", "profile.html"));
})

app.get("/api/profile", middleware.checkAuth, (req, res) => {
  if (!req.query.id) {
    const sql = "SELECT id, username, email, role, bio FROM users WHERE id = ?";
    db.get(sql, [req.session.userID], (err, user) => {
      if (err || !user) {
        console.log('Failed profile user, ', err.message);
        return res.status(500).json({ error: SERVER_ERROR_MSG });
      }
      return res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        bio: user.bio
      })
    })
  } else {
    const id = req.query.id;
    const sql = "SELECT id, username, email, role FROM users WHERE username = ?";
    db.get(sql, [id], (err, user) => {
      if (err || !user) {
        return res.status(500).json({ error: SERVER_ERROR_MSG });
      }
      return res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      })
    })
  }
})

// logout
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Could not log out." });
    }
    res.clearCookie("connect.sid");
    res.json({message: "Logged out successfuly."})
  })
})

// change username
app.put("/change-username", middleware.checkAuth, (req, res) => {
  let {username} = req.body;

  const usernameRes = validation.isValidUsername(username);
  if (!usernameRes.valid) return res.status(400).json({ message: usernameRes.error });
  const clearUsername = usernameRes.value;

  const sql = `UPDATE users SET username = ? WHERE id = ?`;

  db.run(sql, [clearUsername, req.session.userID], function(err) {
    if (err) {
      console.error('Failed change username, ', err.message);
      return res.status(500).json({ error: SERVER_ERROR_MSG });
    }

    req.session.username = clearUsername;

    return res.json({
      message: "Success!",
      username: clearUsername
    })

  })
})

// change email
app.put("/change-email", middleware.checkAuth, (req, res) => {
  let { email } = req.body;

  const emailRes = validation.isValidEmail(email);
  if (!emailRes.valid) return res.status(400).json({ message: emailRes.error });
  const clearEmail = emailRes.value;

  const sql = `UPDATE users SET email = ? WHERE id = ? `;

  db.run(sql, [clearEmail, req.session.userID], function(err) {
    if (err) {
      return res.status(500).json({ error: SERVER_ERROR_MSG });
    }

    return res.json({
      message: "Success!",
      email: clearEmail
    })

  })
})

// change password
app.put("/change-password", middleware.checkAuth, async (req, res) => {
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
    return res.status(400).json({ error: "New passwords mismatch." });
  }

  const SQL_checkCurrPass = "SELECT password FROM users WHERE id = ?";

  db.get(SQL_checkCurrPass, [req.session.userID], async (err, user) => {
    if (err || !user) return res.status(500).json({ error: "User not found!" })

    const isCurrPassword = await bcrypt.compare(clearCurrPassword, user.password);

    if (!isCurrPassword) return res.status(401).json({ error: "Current password incorrect" })

    const hashedPassword = await bcrypt.hash(clearNewPassword1, 10);

    const updatePassword = "UPDATE users SET password = ? WHERE id = ?";

    db.run(updatePassword, [hashedPassword, req.session.userID], (err) => {
      if (err) {
        console.error('Failed change password, ', err.message);
        return res.status(500).json({ error: SERVER_ERROR_MSG });
      }

      return res.json({ message: "Password updated successfully!" });
    })
  })
})

// delete account
app.delete("/delete-account", middleware.checkAuth, async (req, res) => {
  const { password } = req.body;

  const passwordRes = validation.isValidPassword(password);
  if (!passwordRes.valid) return res.status(400).json({ message: passwordRes.error });
  const clearPassword = passwordRes.value;

  const userID = req.session.userID;

  const SQL_checkCurrPass = "SELECT password FROM users WHERE id = ?";

  db.get(SQL_checkCurrPass, [userID], async (err, user) => {
    if (err || !user) {
      console.log('Failed password to delete account, ', err.message);
      return res.status(500).json({ error: SERVER_ERROR_MSG });
    }

    const isPassword = await bcrypt.compare(clearPassword, user.password);

    if (!isPassword) return res.status(401).json({ error: "Password incorrect" });

    const SQL_deleteAccount = "DELETE FROM users WHERE id = ?";

    db.run(SQL_deleteAccount, [userID], function(err) {
      if (err) {
        console.error("Failed delete account, ", err.message);
        return res.status(500).json({ error: SERVER_ERROR_MSG });
      }

      req.session.destroy((err) => {
        if (err) {
          console.error('Failed delete account, ', err.message);
          return res.status(500).json({ error: SERVER_ERROR_MSG });
        }
        res.clearCookie("connect.sid");
        return res.json({ message: "Account permanently deleted" });
      })
    })
  })
})

// search users
app.post("/api/search-user", middleware.checkAuth, async (req, res) => {
  const { username } = req.body;

  const usernameRes = validation.isValidUsername(username);
  if (!usernameRes.valid) return res.status(400).json({ message: usernameRes.error })
  const clearUsername = usernameRes.value;

  const sqlSearchUsers = "SELECT id, username FROM users WHERE username = ? AND id != ?";

  db.get(sqlSearchUsers, [clearUsername, req.session.userID], async (err, user) => {
    if (err) {
      console.error("Failed search users, ", err.message);
      return res.status(500).json({ error: SERVER_ERROR_MSG });
    }

    if (!user) { // if user not found
      return res.status(404).json({ error: "User not found!" });
    }

    return res.json({
      id: user.id,
      username: user.username
    })

  })
})

// send message
app.post("/api/send-message", middleware.checkAuth, async (req, res) => {
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
      console.error("Failed send message, ", err.message);
      return res.status(500).json({ error: SERVER_ERROR_MSG });
    }

    const newMessage = {
      sender_id: sender_id,
      receiver_id: receiver_id,
      content: clearContent,
      sent_at: new Date().toISOString()
    };

    io.to(`user_${receiver_id}`).emit('new_message', newMessage);
    io.to(`user_${sender_id}`).emit('new_message', newMessage);

    return res.json({ message: 'Message sent successfully!' });
  })
})

// show messages
app.get('/api/messages/:otherId', middleware.checkAuth, (req, res) => {
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
      console.error('Failed show messages, ', err.message);
      return res.status(500).json({ error: SERVER_ERROR_MSG });
    }
    return res.json(rows);
  })
})

app.get('/admin-panel', middleware.isAdmin, (req, res) => {
  return res.sendFile(path.join(__dirname, 'private', 'admin-panel.html'));
})

app.post('/get-transcript', (req, res) => {
  const senderId = req.session.userID;
  const { receiverId } = req.body;

  const sql = `SELECT content FROM messages
  WHERE sender_id = ? AND receiver_id = ?
  OR sender_id = ? AND receiver_id = ?`;

  db.all(sql, [senderId, receiverId, receiverId, senderId], (err, rows) => {
    if (err) {
      console.error('Failed get transcript, ', err.message);
      return res.status(500).json({ error: SERVER_ERROR_MSG });
    }
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'No messages found!' });
    const chatContent = rows.map(row => row.content).join('\n');
    const transcriptsName = uuidv4();
    const pathFile = `./chats/${transcriptsName}.txt`;

    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    fs.writeFile(pathFile, chatContent, 'utf-8', (err) => {
      if (err) return res.status(500).json({ error: 'Database error!' });
      res.download(pathFile, `transcript-${transcriptsName}.txt`, (downloadErr) => {
        if (downloadErr) console.log('Download error: ', downloadErr);
        fs.unlink(pathFile, () => {});
      })
    })
  })
})

app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const emailRes = validation.isValidEmail(email);
  if (!emailRes.valid) return res.status(400).json({ message: emailRes.error });

  const sql = `SELECT id, email FROM users WHERE email = ?`

  db.get(sql, [email], (err, user) => {
    if (err) {
      console.error('Failed forgot password, ', err.message);
      return res.status(500).json({ error: SERVER_ERROR_MSG });
    }

    if (!user) {
      return res.json({ message: "If this email exists, a reset link has been generated." });
    }

    const user_id = user.id;

    const invalidateOldTokensSql = `
    UPDATE password_resets
    SET used = 2
    WHERE user_id = ? AND used = 0
    `;
    db.run(invalidateOldTokensSql, [user_id], (clearErr) => {
      if (clearErr) {
        console.error('Failed invalidate old token, ', clearErr.message);
        return res.status(500).json({ error: 'Failed invalidate token!' });
      }

      const generatedToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(generatedToken).digest('hex');
      const expires_at = Date.now() + 15 * 60 * 1000;

      const insertSql = `
      INSERT INTO password_resets (user_id, token, expires_at)
      VALUES (?, ?, ?)
      `;
      db.run(insertSql, [user_id, hashedToken, expires_at], (err) => {
        if (err) {
          console.error('Failed insert token, ', err.message);
          return res.status(500).json({ error: 'Database error' });
        }

        return res.json({
          message: `Link for reset password`,
          link: `/reset-password.html?token=${generatedToken}`
        })
      })
    })
  })
})

app.put('/reset-password', async (req, res) => {
  const { password_1, password_2, token } = req.body;

  if (!token) return res.status(400).json({ error: 'Token is missing' });
  const newPassword1Res = validation.isValidPassword(password_1);
  const newPassword2Res = validation.isValidPassword(password_2);

  if (!newPassword1Res.valid || !newPassword2Res.valid) {
    return res.status(400).json({ error: "Invalid password format!" });
  }

  const clearPassword1 = newPassword1Res.value;
  const clearPassword2 = newPassword2Res.value;

  if (clearPassword1 !== clearPassword2) {
    return res.status(400).json({ error: "New passwords mismatch." });
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const now = Date.now();

  const checkTokenSql = `
  SELECT user_id FROM password_resets
  WHERE token = ? AND expires_at > ? AND used = 0
  `

  db.get(checkTokenSql, [hashedToken, now], async (err, row) => {
    if (err) {
      console.error('Failed check token, ', err.message);
      return res.status(500).json({ error: SERVER_ERROR_MSG });
    }

    if (!row) return res.status(400).json({ error: 'Invalid or expired token.' });

    const userId = row.user_id;

    try {
      const encryptedPassword = await bcrypt.hash(clearPassword1, 10);
      const updatePassword = `UPDATE users SET password = ? WHERE id = ?`;

      db.run(updatePassword, [encryptedPassword, userId], (updateErr) => {
        if (updateErr) {
          console.error('Failed reset password, ', updateErr.message);
          return res.status(500).json({ error: 'Failed to update password.' });
        }

        const invalitadeTokenSql = `UPDATE password_resets SET used = 1 WHERE token = ?`;
        db.run(invalitadeTokenSql, [hashedToken], (tokenErr) => {
          if (tokenErr) {
            console.error('Failed to invalitade token, ', tokenErr.message);
            return res.status(500).json({ error: SERVER_ERROR_MSG });
          }
          console.log('Password successfully reset. You can log in now.');
          return res.json({ message: 'Password successfully reset. You can log in now.' });
        })
      })
    } catch (bcryptErr) {
      console.log(bcryptErr);
      return res.status(500).json({ error: 'Hashing error.' });
    }
  })
})

app.put('/update-bio', (req, res) => {
  if (!req.session.userID) return res.status(401).json({ error: 'Unauthorized' });

  let { bio } = req.body;

  if (typeof bio !== 'string') return res.status(400).json({ error: 'Invalid format.' });
  bio = bio.trim();
  if (bio.length > 300) return res.status(400).json({ error: 'Bio is too long.' });

  const insertBioSql = `UPDATE users SET bio = ? WHERE id = ?`;
  db.run(insertBioSql, [bio, req.session.userID], (err) => {
    if (err) {
      console.error('Failed update bio, ', err.message);
      return res.status(500).json({ error: SERVER_ERROR_MSG });
    }
    console.log(`User ${req.session.userID} updated bio successfully!`)
    return res.json({ message: 'Bio successfully updated!' });
  })
})

server.listen(PORT, () => {
  console.log(`[!] SERVER is running on http://localhost:${PORT}`);
})
