const { evaluateCollectionMilestones, completionistRarity, makeToCompletionistCode, MANUFACTURER_COUNTRY, COUNTRY_THEMES } = require("../achievementEmitter");
const { addCollectionItem, getMakeCollectionCounts, getProgressStats, listCollection, removeCollectionItem, unlockCollectionAchievements } = require("../db");

const CATALOGUE_URL = process.env.CATALOGUE_URL || "http://localhost:3002";
let _catalogueCountsCache = null;
async function getCatalogueCounts() {
	if (_catalogueCountsCache) return _catalogueCountsCache;
	const res = await fetch(`${CATALOGUE_URL}/generation-counts`).catch(() => null);
	if (!res?.ok) return {};
	const data = await res.json();
	_catalogueCountsCache = data.counts || {};
	return _catalogueCountsCache;
}

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:3001";
async function isFriendOf(requesterId, targetId) {
	const res = await fetch(
		`${AUTH_SERVICE_URL}/internal/friends/${requesterId}/${targetId}`,
		{ headers: { "x-internal-secret": process.env.INTERNAL_SERVICE_SECRET || "" } }
	).catch(() => null);
	// Fail closed — a network error or auth-service being down must not turn into
	// "assume they're friends" for what is otherwise the actual access check.
	if (!res?.ok) return false;
	const data = await res.json().catch(() => null);
	return data?.friends === true;
}

const { isValidCollectionPayload, normalizeItemPayload } = require("../models/user.collection");

function resolveUserId(req) {
	return Number(req.headers["x-user-id"] || req.user?.id);
}

async function getMyCollection(req, res) {
	try {
		const userId = resolveUserId(req);
		if (!userId) {
			return res.status(401).json({ message: "Missing user identity" });
		}

		return res.status(200).json({
			items: await listCollection(userId)
		});
	} catch (error) {
		return res.status(500).json({ message: "Failed to fetch collection" });
	}
}

async function addToCollection(req, res) {
	try {
		const userId = resolveUserId(req);
		if (!userId) {
			return res.status(401).json({ message: "Missing user identity" });
		}

		const item = normalizeItemPayload(req.body);
		if (!isValidCollectionPayload(item)) {
			return res.status(400).json({
				message: "generationId, manufacturerName, modelName and generationCode are required"
			});
		}

		const result = await addCollectionItem(userId, item);
		const progress = await getProgressStats(userId);

		let unlockedAchievements = [];
		if (result.created) {
			const candidates = evaluateCollectionMilestones(progress);
			const justUnlockedCodes = new Set(await unlockCollectionAchievements(userId, candidates));
			unlockedAchievements = candidates.filter((a) => justUnlockedCodes.has(a.code));

			const scannedMake = item.manufacturerName;
			const [totalCounts, userMakeCounts] = await Promise.all([
				getCatalogueCounts(),
				getMakeCollectionCounts(userId),
			]);

			// Check make completionist
			const makeTotal = totalCounts[scannedMake] || 0;
			if (makeTotal > 0 && (userMakeCounts[scannedMake] || 0) >= makeTotal) {
				const code  = makeToCompletionistCode(scannedMake);
				const entry = {
					code,
					title:       `${scannedMake} Completionist`,
					description: `Collected all ${makeTotal} ${scannedMake} generations.`,
					rarity:      completionistRarity(makeTotal),
				};
				const newCodes = new Set(await unlockCollectionAchievements(userId, [entry]));
				if (newCodes.has(code)) unlockedAchievements.push(entry);
			}

			// Check country completionist
			const country = MANUFACTURER_COUNTRY[scannedMake];
			if (country && COUNTRY_THEMES[country]) {
				const theme = COUNTRY_THEMES[country];
				const countryMakes = Object.entries(MANUFACTURER_COUNTRY)
					.filter(([, c]) => c === country)
					.map(([make]) => make);
				const countryTotal = countryMakes.reduce((sum, make) => sum + (totalCounts[make] || 0), 0);
				const countryUser  = countryMakes.reduce((sum, make) => sum + (userMakeCounts[make] || 0), 0);
				if (countryTotal > 0 && countryUser >= countryTotal) {
					const entry = {
						code:        theme.code,
						title:       theme.name,
						description: `Collected all ${countryTotal} ${theme.adjective} generations.`,
						rarity:      "legendary",
					};
					const newCodes = new Set(await unlockCollectionAchievements(userId, [entry]));
					if (newCodes.has(theme.code)) unlockedAchievements.push(entry);
				}
			}
		}

		return res.status(result.created ? 201 : 200).json({
			created: result.created,
			item: result.item,
			progress,
			unlockedAchievements
		});
	} catch (error) {
		return res.status(500).json({ message: "Failed to update collection" });
	}
}

async function removeFromCollection(req, res) {
	try {
		const userId = resolveUserId(req);
		if (!userId) {
			return res.status(401).json({ message: "Missing user identity" });
		}

		const removed = await removeCollectionItem(userId, req.params.generationId);
		if (!removed) {
			return res.status(404).json({ message: "Collection item not found" });
		}

		return res.status(200).json({
			message: "Collection item removed"
		});
	} catch (error) {
		return res.status(500).json({ message: "Failed to remove collection item" });
	}
}

async function getUserCollection(req, res) {
	try {
		const targetId = Number(req.params.userId);
		if (!targetId) {
			return res.status(400).json({ message: "Invalid userId" });
		}

		const requesterId = resolveUserId(req);
		if (!requesterId) {
			return res.status(401).json({ message: "Missing user identity" });
		}

		if (requesterId !== targetId && !(await isFriendOf(requesterId, targetId))) {
			return res.status(403).json({ message: "You can only view friends' collections" });
		}

		const [items, progress] = await Promise.all([
			listCollection(targetId),
			getProgressStats(targetId),
		]);

		return res.status(200).json({ items, progress });
	} catch (error) {
		return res.status(500).json({ message: "Failed to fetch user collection" });
	}
}

module.exports = {
	addToCollection,
	getMyCollection,
	getUserCollection,
	removeFromCollection
};