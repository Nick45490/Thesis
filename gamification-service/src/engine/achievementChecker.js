const RACING_CATALOGUE = [
	{
		code: "FIRST_RACE",
		title: "First Race",
		description: "Complete your first race.",
		rarity: "common",
		stat: "racesCompleted",
		target: 1,
	},
	{
		code: "RACER_5",
		title: "Regular Racer",
		description: "Complete 5 races.",
		rarity: "common",
		stat: "racesCompleted",
		target: 5,
	},
	{
		code: "RACER_10",
		title: "Committed Racer",
		description: "Complete 10 races.",
		rarity: "common",
		stat: "racesCompleted",
		target: 10,
	},
	{
		code: "RACER_25",
		title: "Seasoned Racer",
		description: "Complete 25 races.",
		rarity: "rare",
		stat: "racesCompleted",
		target: 25,
	},
	{
		code: "RACER_50",
		title: "Race Champion",
		description: "Complete 50 races.",
		rarity: "epic",
		stat: "racesCompleted",
		target: 50,
	},
	{
		code: "POINTS_100",
		title: "Point Scorer",
		description: "Earn 100 total points.",
		rarity: "common",
		stat: "totalPoints",
		target: 100,
	},
	{
		code: "POINTS_500",
		title: "High Scorer",
		description: "Earn 500 total points.",
		rarity: "rare",
		stat: "totalPoints",
		target: 500,
	},
	{
		code: "POINTS_2000",
		title: "Points Legend",
		description: "Earn 2,000 total points.",
		rarity: "epic",
		stat: "totalPoints",
		target: 2000,
	},
	{
		code: "POINTS_10000",
		title: "Points Master",
		description: "Earn 10,000 total points.",
		rarity: "legendary",
		stat: "totalPoints",
		target: 10000,
	},

	// Win-based
	{
		code: "WIN_1",
		title: "First Victory",
		description: "Win your first race.",
		rarity: "common",
		stat: "wins",
		target: 1,
	},
	{
		code: "WIN_5",
		title: "Winning Streak",
		description: "Win 5 races.",
		rarity: "common",
		stat: "wins",
		target: 5,
	},
	{
		code: "WIN_10",
		title: "Race Crusher",
		description: "Win 10 races.",
		rarity: "rare",
		stat: "wins",
		target: 10,
	},
	{
		code: "WIN_25",
		title: "Unbeatable",
		description: "Win 25 races.",
		rarity: "epic",
		stat: "wins",
		target: 25,
	},
	{
		code: "WIN_50",
		title: "Racing Legend",
		description: "Win 50 races.",
		rarity: "legendary",
		stat: "wins",
		target: 50,
	},

	// Underdog wins
	{
		code: "UNDERDOG_1",
		title: "David vs Goliath",
		description: "Beat a higher-rarity car with your lower-rarity car.",
		rarity: "rare",
		stat: "underdogWins",
		target: 1,
	},
	{
		code: "UNDERDOG_5",
		title: "Underdog Spirit",
		description: "Beat higher-rarity cars 5 times.",
		rarity: "epic",
		stat: "underdogWins",
		target: 5,
	},
	{
		code: "UNDERDOG_10",
		title: "Giant Slayer",
		description: "Beat higher-rarity cars 10 times.",
		rarity: "legendary",
		stat: "underdogWins",
		target: 10,
	},

	// Distance milestones
	{
		code: "HALF_MILE_1",
		title: "Half Miler",
		description: "Complete a half-mile race.",
		rarity: "common",
		stat: "halfMileRaces",
		target: 1,
	},
	{
		code: "HALF_MILE_5",
		title: "Distance Runner",
		description: "Complete 5 half-mile races.",
		rarity: "rare",
		stat: "halfMileRaces",
		target: 5,
	},
	{
		code: "FULL_MILE_1",
		title: "Full Mile",
		description: "Complete a full-mile race.",
		rarity: "rare",
		stat: "fullMileRaces",
		target: 1,
	},
	{
		code: "FULL_MILE_5",
		title: "Mile Champion",
		description: "Complete 5 full-mile races.",
		rarity: "epic",
		stat: "fullMileRaces",
		target: 5,
	},
];

function evaluateAchievementCodes(stats) {
	return RACING_CATALOGUE
		.filter((a) => (stats[a.stat] || 0) >= a.target)
		.map((a) => ({ code: a.code, title: a.title }));
}

function buildRacingCatalogue(stats, unlockedMap) {
	return RACING_CATALOGUE.map((a) => ({
		code: a.code,
		title: a.title,
		description: a.description,
		rarity: a.rarity,
		category: "racing",
		current: Math.min(stats[a.stat] || 0, a.target),
		target: a.target,
		unlocked: Boolean(unlockedMap[a.code]),
		unlockedAt: unlockedMap[a.code] || null,
	}));
}

module.exports = { RACING_CATALOGUE, buildRacingCatalogue, evaluateAchievementCodes };
