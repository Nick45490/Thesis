const { getRaceStats, listRaces } = require("../db");

function resolveUserId(req) {
	return Number(req.headers["x-user-id"]);
}

async function getMyRaces(req, res) {
	try {
		const userId = resolveUserId(req);
		if (!userId) {
			return res.status(401).json({ message: "Missing user identity" });
		}

		const [races, stats] = await Promise.all([listRaces(userId), getRaceStats(userId)]);
		return res.status(200).json({
			races,
			stats
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Failed to fetch races" });
	}
}

module.exports = {
	getMyRaces
};
