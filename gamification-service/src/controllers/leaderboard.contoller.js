const { listLeaderboard } = require("../db");

async function getLeaderboard(req, res) {
	try {
		const limit = Number(req.query.limit || 20);
		return res.status(200).json({
			leaderboard: await listLeaderboard(limit)
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Failed to load leaderboard" });
	}
}

module.exports = {
	getLeaderboard
};
