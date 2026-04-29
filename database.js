const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./database_baza.db", (err) => {
  if (err) {
    console.error(`[!] Error oppening database ${err.message}`);
  } else {
    console.log(`[!] Connected to the SQLite database`);
  }
})

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      role TEXT CHECK(role IN ('user', 'admin')) DEFAULT 'user'
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_read INTEGER DEFAULT 0, -- 0: not read, 1: read
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    );
  `);
});

module.exports = db;
