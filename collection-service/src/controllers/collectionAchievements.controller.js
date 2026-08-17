const { getCollectionAchievementCatalogue, getCompletionistUnlockedMap, getCountryUnlockedMap, getMakeCollectionCounts, getProgressStats } = require("../db");
const { buildCompletionistCatalogue, buildCountryCatalogue } = require("../achievementEmitter");

const CATALOGUE_URL = process.env.CATALOGUE_URL || "http://localhost:3002";

function resolveUserId(req) {
	return Number(req.headers["x-user-id"]);
}

async function getMyCollectionAchievements(req, res) {
	try {
		const userId = resolveUserId(req);
		if (!userId) {
			return res.status(401).json({ message: "Missing user identity" });
		}

		const [progress, userMakeCounts, completionistUnlocked, countryUnlocked, catalogueRes] = await Promise.all([
			getProgressStats(userId),
			getMakeCollectionCounts(userId),
			getCompletionistUnlockedMap(userId),
			getCountryUnlockedMap(userId),
			fetch(`${CATALOGUE_URL}/generation-counts`)
				.then((r) => r.json())
				.catch(() => ({ counts: {} })),
		]);

		const totalCounts            = catalogueRes.counts || {};
		const catalogue              = await getCollectionAchievementCatalogue(userId, progress);
		const completionistCatalogue = buildCompletionistCatalogue(userMakeCounts, totalCounts, completionistUnlocked);
		const countryCatalogue       = buildCountryCatalogue(userMakeCounts, totalCounts, countryUnlocked);

		return res.status(200).json({ catalogue, completionistCatalogue, countryCatalogue, progress });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Failed to fetch collection achievements" });
	}
}

module.exports = { getMyCollectionAchievements };
