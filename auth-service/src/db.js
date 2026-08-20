const { Pool } = require("pg");

const pool = new Pool({
	connectionString: process.env.DATABASE_URL
});

let initialized = false;

async function initDb() {
	if (initialized) {
		return;
	}

	await pool.query(`
		CREATE TABLE IF NOT EXISTS users (
			id SERIAL PRIMARY KEY,
			email VARCHAR(255) UNIQUE NOT NULL,
			username VARCHAR(120) NOT NULL,
			password_hash VARCHAR(255) NOT NULL,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`);

	await pool.query(`
		ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT
	`);

	await pool.query(`
		CREATE TABLE IF NOT EXISTS friend_requests (
			id SERIAL PRIMARY KEY,
			requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			status VARCHAR(30) NOT NULL DEFAULT 'pending',
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP,
			UNIQUE (requester_id, target_id)
		)
	`);

	await pool.query(`
		CREATE TABLE IF NOT EXISTS friend_invite_codes (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			code VARCHAR(10) NOT NULL UNIQUE,
			expires_at TIMESTAMP NOT NULL,
			used_at TIMESTAMP,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`);

	initialized = true;
}

function safeUser(user) {
	const { passwordHash, ...rest } = user;
	return rest;
}

function mapUserRow(row) {
	if (!row) {
		return null;
	}

	return {
		id: row.id,
		email: row.email,
		username: row.username,
		passwordHash: row.password_hash,
		profilePhoto: row.profile_photo || null,
		createdAt: row.created_at
	};
}

async function updateProfilePhoto(userId, photoDataUrl) {
	const result = await pool.query(
		`UPDATE users SET profile_photo = $1 WHERE id = $2 RETURNING id, email, username, profile_photo, created_at`,
		[photoDataUrl, Number(userId)]
	);
	return mapUserRow(result.rows[0]);
}

async function createUser({ email, username, passwordHash }) {
	const result = await pool.query(
		`INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, email, username, created_at`,
		[email, username, passwordHash]
	);

	return {
		id: result.rows[0].id,
		email: result.rows[0].email,
		username: result.rows[0].username,
		createdAt: result.rows[0].created_at
	};
}

async function findUserByEmail(email) {
	const result = await pool.query(
		`SELECT id, email, username, password_hash, profile_photo, created_at FROM users WHERE lower(email) = lower($1) LIMIT 1`,
		[email]
	);

	return mapUserRow(result.rows[0]);
}

async function findUserById(id) {
	const result = await pool.query(
		`SELECT id, email, username, password_hash, profile_photo, created_at FROM users WHERE id = $1 LIMIT 1`,
		[Number(id)]
	);

	return mapUserRow(result.rows[0]);
}

async function findUsersByIds(ids) {
	const numericIds = ids.map(Number).filter((n) => Number.isInteger(n));
	if (numericIds.length === 0) return [];

	const result = await pool.query(
		`SELECT id, username FROM users WHERE id = ANY($1::int[])`,
		[numericIds]
	);
	return result.rows.map((row) => ({ id: row.id, username: row.username }));
}

async function listUsers() {
	const result = await pool.query(`SELECT id, email, username, created_at FROM users ORDER BY id ASC`);
	return result.rows.map((row) => ({
		id: row.id,
		email: row.email,
		username: row.username,
		createdAt: row.created_at
	}));
}

async function createFriendRequest(requesterId, targetId) {
	const existing = await pool.query(
		`SELECT requester_id, target_id, status, created_at, updated_at
		 FROM friend_requests
		 WHERE (requester_id = $1 AND target_id = $2) OR (requester_id = $2 AND target_id = $1)
		 LIMIT 1`,
		[requesterId, targetId]
	);

	if (existing.rowCount > 0) {
		const row = existing.rows[0];
		return {
			requesterId: row.requester_id,
			targetId: row.target_id,
			status: row.status,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			alreadyFriends: row.status === "accepted",
		};
	}

	const inserted = await pool.query(
		`INSERT INTO friend_requests (requester_id, target_id, status)
		 VALUES ($1, $2, 'pending')
		 RETURNING requester_id, target_id, status, created_at, updated_at`,
		[requesterId, targetId]
	);

	const row = inserted.rows[0];
	return {
		requesterId: row.requester_id,
		targetId: row.target_id,
		status: row.status,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

async function acceptFriendRequest(requesterId, targetId) {
	const result = await pool.query(
		`UPDATE friend_requests
		 SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
		 WHERE requester_id = $1 AND target_id = $2 AND status = 'pending'
		 RETURNING requester_id, target_id, status, created_at, updated_at`,
		[requesterId, targetId]
	);

	if (result.rowCount === 0) {
		return null;
	}

	const row = result.rows[0];
	return {
		requesterId: row.requester_id,
		targetId: row.target_id,
		status: row.status,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

async function removeFriendship(userA, userB) {
	const result = await pool.query(
		`DELETE FROM friend_requests
		 WHERE status = 'accepted'
		 AND ((requester_id = $1 AND target_id = $2) OR (requester_id = $2 AND target_id = $1))`,
		[userA, userB]
	);

	return result.rowCount > 0;
}

async function areFriends(userA, userB) {
	if (Number(userA) === Number(userB)) return true;
	const result = await pool.query(
		`SELECT 1 FROM friend_requests
		 WHERE status = 'accepted'
		 AND ((requester_id = $1 AND target_id = $2) OR (requester_id = $2 AND target_id = $1))
		 LIMIT 1`,
		[userA, userB]
	);
	return result.rowCount > 0;
}

async function getFriendsForUser(userId) {
	const result = await pool.query(
		`SELECT u.id, u.email, u.username, u.profile_photo, u.created_at
		 FROM friend_requests fr
		 JOIN users u ON u.id = CASE WHEN fr.requester_id = $1 THEN fr.target_id ELSE fr.requester_id END
		 WHERE fr.status = 'accepted' AND ($1 IN (fr.requester_id, fr.target_id))
		 ORDER BY u.username ASC`,
		[userId]
	);

	return result.rows.map((row) => ({
		id: row.id,
		email: row.email,
		username: row.username,
		profilePhoto: row.profile_photo || null,
		createdAt: row.created_at
	}));
}

async function getPendingRequestsForUser(userId) {
	const result = await pool.query(
		`SELECT fr.requester_id, fr.target_id, fr.created_at, u.id, u.email, u.username, u.created_at AS requester_created_at
		 FROM friend_requests fr
		 JOIN users u ON u.id = fr.requester_id
		 WHERE fr.status = 'pending' AND fr.target_id = $1
		 ORDER BY fr.created_at DESC`,
		[userId]
	);

	return result.rows.map((row) => ({
		requesterId: row.requester_id,
		targetId: row.target_id,
		createdAt: row.created_at,
		requester: {
			id: row.id,
			email: row.email,
			username: row.username,
			createdAt: row.requester_created_at
		}
	}));
}

function generateCode() {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
	let code = "";
	for (let i = 0; i < 6; i++) {
		code += chars[Math.floor(Math.random() * chars.length)];
	}
	return code;
}

async function createInviteCode(userId) {
	// Invalidate any existing unused codes for this user
	await pool.query(
		`DELETE FROM friend_invite_codes WHERE user_id = $1 AND used_at IS NULL`,
		[Number(userId)]
	);

	const code = generateCode();
	const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

	const result = await pool.query(
		`INSERT INTO friend_invite_codes (user_id, code, expires_at)
		 VALUES ($1, $2, $3)
		 RETURNING code, expires_at`,
		[Number(userId), code, expiresAt]
	);

	return { code: result.rows[0].code, expiresAt: result.rows[0].expires_at };
}

async function redeemInviteCode(code, redeemerId) {
	const result = await pool.query(
		`SELECT id, user_id, expires_at, used_at
		 FROM friend_invite_codes
		 WHERE code = $1
		 LIMIT 1`,
		[code.toUpperCase()]
	);

	if (!result.rowCount) return { error: "invalid" };

	const row = result.rows[0];
	if (row.used_at) return { error: "used" };
	if (new Date(row.expires_at) < new Date()) return { error: "expired" };
	if (row.user_id === Number(redeemerId)) return { error: "self" };

	// Mark as used atomically — guards against two concurrent redemptions of the
	// same code both passing the used_at check above before either UPDATE commits.
	const claim = await pool.query(
		`UPDATE friend_invite_codes SET used_at = NOW() WHERE id = $1 AND used_at IS NULL RETURNING id`,
		[row.id]
	);
	if (!claim.rowCount) return { error: "used" };

	// Create friend request from redeemer → code owner
	const request = await createFriendRequest(Number(redeemerId), row.user_id);
	const codeOwner = await findUserById(row.user_id);
	return { request, codeOwner };
}

module.exports = {
	acceptFriendRequest,
	areFriends,
	createFriendRequest,
	createInviteCode,
	createUser,
	findUserByEmail,
	findUserById,
	findUsersByIds,
	initDb,
	getFriendsForUser,
	getPendingRequestsForUser,
	listUsers,
	redeemInviteCode,
	removeFriendship,
	safeUser,
	updateProfilePhoto,
};
