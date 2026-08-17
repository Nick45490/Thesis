const { getAchievementCatalogue, getRaceStats, unlockAchievementsForUser } = require("../db");

function resolveUserId(req) {
	return Number(req.headers["x-user-id"]);
}

async function getMyAchievements(req, res) {
	try {
		const userId = resolveUserId(req);
		if (!userId) {
			return res.status(401).json({ message: "Missing user identity" });
		}

		const stats = await getRaceStats(userId);
		await unlockAchievementsForUser(userId, stats);
		const catalogue = await getAchievementCatalogue(userId, stats);

		return res.status(200).json({
			catalogue,
			stats
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Failed to fetch achievements" });
	}
}

module.exports = {
	getMyAchievements
};
