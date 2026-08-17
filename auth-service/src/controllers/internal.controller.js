const { areFriends } = require("../db");

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

module.exports = { checkFriends };
