import { isMemory, query } from './db.js';
import { db } from '../data.js';

export async function findUserByPhone(phone) {
  if (isMemory()) {
    return db.users.find((u) => u.phone === phone) || null;
  }

  const sql = `
    SELECT
      id, phone, email, password_hash AS "passwordHash", role, name,
      volunteer_id AS "volunteerId", volunteer_status AS "volunteerStatus",
      created_at AS "createdAt"
    FROM users
    WHERE phone = $1;
  `;
  const { rows } = await query(sql, [phone]);
  return rows[0] || null;
}

export async function findUserByEmail(email) {
  if (isMemory()) {
    return db.users.find((u) => u.email === email.toLowerCase()) || null;
  }

  const sql = `
    SELECT
      id, phone, email, password_hash AS "passwordHash", role, name,
      volunteer_id AS "volunteerId", volunteer_status AS "volunteerStatus",
      created_at AS "createdAt"
    FROM users
    WHERE LOWER(email) = LOWER($1);
  `;
  const { rows } = await query(sql, [email]);
  return rows[0] || null;
}

export async function findUserById(id) {
  if (isMemory()) {
    return db.users.find((u) => u.id === id) || null;
  }

  const sql = `
    SELECT
      id, phone, email, password_hash AS "passwordHash", role, name,
      volunteer_id AS "volunteerId", volunteer_status AS "volunteerStatus",
      created_at AS "createdAt"
    FROM users
    WHERE id = $1;
  `;
  const { rows } = await query(sql, [id]);
  return rows[0] || null;
}

export async function createUser(user) {
  if (isMemory()) {
    db.users.push(user);
    return user;
  }

  const sql = `
    INSERT INTO users (id, phone, email, password_hash, role, name, volunteer_id, volunteer_status, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
    RETURNING
      id, phone, email, password_hash AS "passwordHash", role, name,
      volunteer_id AS "volunteerId", volunteer_status AS "volunteerStatus",
      created_at AS "createdAt";
  `;
  const { rows } = await query(sql, [
    user.id,
    user.phone || null,
    user.email ? user.email.toLowerCase() : null,
    user.passwordHash || null,
    user.role || 'attendee',
    user.name || '',
    user.volunteerId || null,
    user.volunteerStatus || null,
  ]);
  return rows[0];
}

export async function updateUser(id, patch) {
  if (isMemory()) {
    const u = db.users.find((x) => x.id === id);
    if (!u) return null;
    if (patch.role) u.role = patch.role;
    if (patch.name !== undefined) u.name = patch.name;
    if (patch.volunteerId !== undefined) u.volunteerId = patch.volunteerId;
    if (patch.volunteerStatus !== undefined) u.volunteerStatus = patch.volunteerStatus;
    return u;
  }

  const current = await findUserById(id);
  if (!current) return null;

  const newRole = patch.role || current.role;
  const newName = patch.name !== undefined ? patch.name : current.name;
  const newVolId = patch.volunteerId !== undefined ? patch.volunteerId : current.volunteerId;
  const newVolStatus = patch.volunteerStatus !== undefined ? patch.volunteerStatus : current.volunteerStatus;

  const sql = `
    UPDATE users
    SET role = $2, name = $3, volunteer_id = $4, volunteer_status = $5
    WHERE id = $1
    RETURNING
      id, phone, email, password_hash AS "passwordHash", role, name,
      volunteer_id AS "volunteerId", volunteer_status AS "volunteerStatus",
      created_at AS "createdAt";
  `;
  const { rows } = await query(sql, [id, newRole, newName, newVolId, newVolStatus]);
  return rows[0] || null;
}
