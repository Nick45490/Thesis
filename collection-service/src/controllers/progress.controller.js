const { getProgressStats, listCollection } = require("../db");

function resolveUserId(req) {
	return Number(req.headers["x-user-id"] || req.user?.id);
}

async function getProgress(req, res) {
	try {
		const userId = resolveUserId(req);
		if (!userId) {
			return res.status(401).json({ message: "Missing user identity" });
		}

		const [stats, items] = await Promise.all([getProgressStats(userId), listCollection(userId)]);
		return res.status(200).json({
			...stats,
			latestDiscoveries: items.slice(0, 5)
		});
	} catch (error) {
		return res.status(500).json({ message: "Failed to fetch progress" });
	}
}

module.exports = {
	getProgress
};
