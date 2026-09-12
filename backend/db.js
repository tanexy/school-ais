const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(path.join(__dirname, 'school.db'));

function pragma(sql) {
  db.exec('PRAGMA ' + sql);
}

pragma('journal_mode = WAL');
pragma('foreign_keys = ON');

db.pragma = pragma;

db.transaction = function transaction(fn) {
  return function wrappedTransaction(...args) {
    db.exec('BEGIN');
    try {
      const result = fn.apply(this, args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch (_) { /* ignore */ }
      throw err;
    }
  };
};

const rawPrepare = db.prepare.bind(db);
db.prepare = function prepare(sql) {
  const stmt = rawPrepare(sql);
  const rawRun = stmt.run.bind(stmt);
  stmt.run = function run(...args) {
    const info = rawRun(...args);
    return {
      changes: typeof info.changes === 'bigint' ? Number(info.changes) : info.changes,
      lastInsertRowid: typeof info.lastInsertRowid === 'bigint' ? Number(info.lastInsertRowid) : info.lastInsertRowid,
    };
  };
  return stmt;
};

module.exports = db;