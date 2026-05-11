const router = require('express').Router();
const db = require('../database');

function isAdmin(req, res, next) {
  if (!req.session.userID) {
    return res.status(401).json({ error: "Unauthorized! Please log in." });
  }
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden! You do not have administrator privileges.' })
  }
  next();
}

router.get('/api/load-users', isAdmin, (req, res) => {
  const sql = 'SELECT id, username, email, created_at, role FROM users';

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Database error' })
    }
    res.json(rows);
  })
})

router.delete('/api/delete-user', isAdmin, (req, res) => {
  const { username } = req.body;
  const sql = 'DELETE FROM users WHERE username = ?';
  db.run(sql, [username], (err) => {
    if (err) {
      console.error('Database error: ', err.message);
      return res.status(500).json({ error: 'Failed to delete from DB' });
    }
    res.json({ message: `User ${username} deleted.` })
  })
})

module.exports = router;
