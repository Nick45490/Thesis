const { areFriends, findUsersByIds } = require("../db");

// Service-to-service only (see internalSecret.middleware.js) — lets another
// backend service check a friendship before releasing another user's data,
// without reaching into auth-service's tables directly.
async function checkFriends(req, res) {
	try {
		const userA = Number(req.params.userA);
		const userB = Number(req.params.userB);

		if (!userA || !userB) {
			return res.status(400).json({ message: "userA and userB must be numeric ids" });
		}

		const friends = await areFriends(userA, userB);
		return res.status(200).json({ friends });
	} catch {
		return res.status(500).json({ message: "Failed to check friendship" });
	}
}

// Service-to-service only — lets another backend service resolve usernames
// for a batch of user ids (e.g. gamification-service labeling a race
// challenge) without a cross-service SQL JOIN into auth-service's own
// `users` table. Returns only the minimal, non-sensitive `username` field.
async function getUsersByIds(req, res) {
	try {
		const idsParam = req.query.ids;
		if (!idsParam) {
			return res.status(400).json({ message: "ids query parameter is required" });
		}

		const ids = String(idsParam).split(",").map((s) => s.trim()).filter(Boolean);
		const users = await findUsersByIds(ids);
		const byId = Object.fromEntries(users.map((u) => [u.id, { username: u.username }]));
		return res.status(200).json(byId);
	} catch {
		return res.status(500).json({ message: "Failed to fetch users" });
	}
}

module.exports = { checkFriends, getUsersByIds };
