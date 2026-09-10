const router = require('express').Router();
const db = require('../db');

const SERVER_ERROR_MSG = 'Database error.';

function isAdmin(req, res, next) {
  if (!req.session.userID) {
    return res.status(401).json({ error: 'Unauthorized! Please log in.' });
  }
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden! You do not have administrator privileges.' })
  }
  next();
}

router.get('/api/load-users', isAdmin, async (req, res) => {
  try {
    const sqlGetUsers = `SELECT user_id, username, email, created_at, role FROM users`;
    const result = await db.query(sqlGetUsers);
    return res.json(result.rows);

  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: SERVER_ERROR_MSG });
  }
})

router.delete('/api/delete-user', isAdmin, async (req, res) => {
  const { username } = req.body;
  try {
    const sqlDeleteUser = `DELETE FROM users WHERE username = $1`;
    await db.query(sqlDeleteUser, [username]);
    return res.json({ message: `User ${username} deleted.` });

  } catch (err) {
    console.error('Database error "delete-user": ', err.message);
    return res.status(500).json({ error: SERVER_ERROR_MSG });
  }
})

module.exports = router;
