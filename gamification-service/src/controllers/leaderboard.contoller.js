const { listLeaderboard } = require("../db");
const { LEADERBOARD_PERIODS } = require("../leaderboardPeriod");

async function getLeaderboard(req, res) {
	try {
		const limit  = Number(req.query.limit || 20);
		const period = req.query.period || "all";
		if (!LEADERBOARD_PERIODS.has(period)) {
			return res.status(400).json({ message: `period must be one of: ${[...LEADERBOARD_PERIODS].join(", ")}` });
		}
		return res.status(200).json({
			leaderboard: await listLeaderboard(limit, period)
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Failed to load leaderboard" });
	}
}

module.exports = {
	getLeaderboard
};
