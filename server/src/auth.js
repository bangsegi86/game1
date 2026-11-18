// 회원가입·로그인·토큰
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { RULES, checkNickname } from '../../shared/gamedata.js';

export function loadSecret(dataDir) {
  const f = path.join(dataDir, 'secret.key');
  try { return fs.readFileSync(f, 'utf8').trim(); } catch {}
  const s = crypto.randomBytes(48).toString('hex');
  fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
}

export class AuthError extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

export function makeAuth(db, secret) {
  const sign = user => jwt.sign({ sub: user.id, nick: user.nickname }, secret, { expiresIn: '1h' });
  const publicUser = u => ({ id: u.id, username: u.username, nickname: u.nickname });
  return {
    async register({ username, password, nickname } = {}) {
      if (typeof username !== 'string' || !RULES.username.test(username)) throw new AuthError('아이디는 영문·숫자 4~16자로 정해 주세요.');
      if (typeof password !== 'string' || password.length < RULES.passwordMin || password.length > RULES.passwordMax) throw new AuthError('비밀번호를 입력해 주세요.');
      const nerr = checkNickname(nickname); if (nerr) throw new AuthError(nerr);
      nickname = nickname.trim();
      if (db.findByUsername(username)) throw new AuthError('이미 쓰고 있는 아이디예요.', 409);
      if (db.nicknameTaken(nickname)) throw new AuthError('이미 쓰고 있는 닉네임이에요.', 409);
      const hash = await bcrypt.hash(password, 10);
      const id = db.createUser(username, hash, nickname);
      db.touchLogin(id);
      const user = { id, username, nickname };
      return { token: sign(user), user: publicUser(user) };
    },
    async login({ username, password } = {}) {
      const row = typeof username === 'string' ? db.findByUsername(username) : null;
      const ok = row && typeof password === 'string' && await bcrypt.compare(password, row.password_hash);
      if (!ok) throw new AuthError('아이디 또는 비밀번호가 맞지 않아요.', 401);
      db.touchLogin(row.id);
      return { token: sign(row), user: publicUser(row) };
    },
    refresh: user => sign(user),
    verify(token) {
      try { const p = jwt.verify(token, secret); const u = db.findById(p.sub); return u ? publicUser(u) : null; } catch { return null; }
    },
  };
}
