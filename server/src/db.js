// SQLite 저장소 (Node 내장 node:sqlite 사용, 별도 설치 없음)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      nickname TEXT NOT NULL UNIQUE COLLATE NOCASE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT
    );
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      games INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0,
      kills INTEGER NOT NULL DEFAULT 0, total_damage INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS match_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      played_at TEXT NOT NULL DEFAULT (datetime('now')),
      map TEXT NOT NULL, mode TEXT NOT NULL, winner_team TEXT, players_json TEXT NOT NULL
    );
  `);
  const q = {
    insertUser: db.prepare('INSERT INTO users (username, password_hash, nickname) VALUES (?, ?, ?)'),
    insertStats: db.prepare('INSERT INTO user_stats (user_id) VALUES (?)'),
    byUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
    byId: db.prepare('SELECT id, username, nickname, created_at FROM users WHERE id = ?'),
    nickTaken: db.prepare('SELECT 1 FROM users WHERE nickname = ?'),
    touch: db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?"),
    stats: db.prepare('SELECT games, wins, losses, kills, total_damage FROM user_stats WHERE user_id = ?'),
    addMatch: db.prepare('INSERT INTO match_history (map, mode, winner_team, players_json) VALUES (?, ?, ?, ?)'),
    addStats: db.prepare('UPDATE user_stats SET games = games + 1, wins = wins + ?, losses = losses + ?, kills = kills + ?, total_damage = total_damage + ? WHERE user_id = ?'),
  };
  return {
    raw: db,
    createUser(username, hash, nickname) {
      const r = q.insertUser.run(username, hash, nickname);
      const id = Number(r.lastInsertRowid); q.insertStats.run(id); return id;
    },
    findByUsername: u => q.byUsername.get(u),
    findById: id => q.byId.get(id),
    nicknameTaken: n => !!q.nickTaken.get(n),
    touchLogin: id => q.touch.run(id),
    getStats: id => q.stats.get(id) || { games: 0, wins: 0, losses: 0, kills: 0, total_damage: 0 },
    recordMatch(map, mode, winnerTeam, players) {
      q.addMatch.run(map, mode, winnerTeam, JSON.stringify(players));
      for (const p of players) q.addStats.run(p.win ? 1 : 0, p.win ? 0 : 1, p.kills || 0, p.damage || 0, p.userId);
    },
    close: () => db.close(),
  };
}
