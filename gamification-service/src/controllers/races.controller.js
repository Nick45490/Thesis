const { addRace, getRaceStats, listRaces, unlockAchievementsForUser } = require("../db");

function resolveUserId(req) {
	return Number(req.headers["x-user-id"] || req.user?.id);
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
		return res.status(500).json({ message: "Failed to fetch races" });
	}
}

async function createRace(req, res) {
	try {
		const userId = resolveUserId(req);
		if (!userId) {
			return res.status(401).json({ message: "Missing user identity" });
		}

		const input = {
			points: Number(req.body.points),
			distanceM: Number(req.body.distanceM),
			durationS: Number(req.body.durationS)
		};

		if (
			!Number.isFinite(input.points) ||
			!Number.isFinite(input.distanceM) ||
			!Number.isFinite(input.durationS) ||
			input.points < 0 ||
			input.distanceM <= 0 ||
			input.durationS <= 0
		) {
			return res.status(400).json({
				message: "points, distanceM and durationS must be valid positive numbers"
			});
		}

		const race = await addRace(userId, input);
		const stats = await getRaceStats(userId);
		const achievementState = await unlockAchievementsForUser(userId, stats);

		return res.status(201).json({
			race,
			stats,
			unlockedAchievements: achievementState.unlockedNow
		});
	} catch (error) {
		return res.status(500).json({ message: "Failed to create race" });
	}
}

module.exports = {
	createRace,
	getMyRaces
};
