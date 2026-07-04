const COLLECTION_CATALOGUE = [
	{
		code: "FIRST_SCAN",
		title: "First Scan",
		description: "Discover your first car generation.",
		rarity: "common",
		stat: "discoveredGenerations",
		target: 1,
	},
	{
		code: "COLLECTOR_5",
		title: "Getting Started",
		description: "Discover 5 car generations.",
		rarity: "common",
		stat: "discoveredGenerations",
		target: 5,
	},
	{
		code: "COLLECTOR_10",
		title: "Car Enthusiast",
		description: "Discover 10 car generations.",
		rarity: "common",
		stat: "discoveredGenerations",
		target: 10,
	},
	{
		code: "COLLECTOR_25",
		title: "Dedicated Spotter",
		description: "Discover 25 car generations.",
		rarity: "rare",
		stat: "discoveredGenerations",
		target: 25,
	},
	{
		code: "COLLECTOR_50",
		title: "Seasoned Spotter",
		description: "Discover 50 car generations.",
		rarity: "rare",
		stat: "discoveredGenerations",
		target: 50,
	},
	{
		code: "COLLECTOR_100",
		title: "Century Club",
		description: "Discover 100 car generations.",
		rarity: "epic",
		stat: "discoveredGenerations",
		target: 100,
	},
	{
		code: "COLLECTOR_200",
		title: "Master Collector",
		description: "Discover 200 car generations.",
		rarity: "legendary",
		stat: "discoveredGenerations",
		target: 200,
	},
	{
		code: "BRAND_NOVICE",
		title: "Brand Curious",
		description: "Discover cars from 3 different manufacturers.",
		rarity: "common",
		stat: "discoveredManufacturers",
		target: 3,
	},
	{
		code: "BRAND_EXPLORER",
		title: "Brand Explorer",
		description: "Discover cars from 10 different manufacturers.",
		rarity: "rare",
		stat: "discoveredManufacturers",
		target: 10,
	},
	{
		code: "BRAND_MASTER",
		title: "Brand Master",
		description: "Discover cars from 20 different manufacturers.",
		rarity: "epic",
		stat: "discoveredManufacturers",
		target: 20,
	},

	// Rarity collection
	{
		code: "FIRST_RARE",
		title: "Rare Find",
		description: "Add a rare car to your collection.",
		rarity: "common",
		stat: "discoveredRare",
		target: 1,
	},
	{
		code: "FIRST_EPIC",
		title: "Epic Hunter",
		description: "Add an epic car to your collection.",
		rarity: "rare",
		stat: "discoveredEpic",
		target: 1,
	},
	{
		code: "FIRST_LEGENDARY",
		title: "Legend Acquired",
		description: "Add a legendary car to your collection.",
		rarity: "epic",
		stat: "discoveredLegendary",
		target: 1,
	},
	{
		code: "FIVE_LEGENDARY",
		title: "Legendary Collection",
		description: "Add 5 legendary cars to your collection.",
		rarity: "legendary",
		stat: "discoveredLegendary",
		target: 5,
	},
];

function evaluateCollectionMilestones(progressStats) {
	return COLLECTION_CATALOGUE
		.filter((a) => (progressStats[a.stat] || 0) >= a.target)
		.map((a) => ({ code: a.code, title: a.title, description: a.description, rarity: a.rarity }));
}

function buildCollectionCatalogue(progressStats, unlockedMap) {
	return COLLECTION_CATALOGUE.map((a) => ({
		code: a.code,
		title: a.title,
		description: a.description,
		rarity: a.rarity,
		category: "collection",
		current: Math.min(progressStats[a.stat] || 0, a.target),
		target: a.target,
		unlocked: Boolean(unlockedMap[a.code]),
		unlockedAt: unlockedMap[a.code] || null,
	}));
}

function completionistRarity(total) {
	if (total <= 5)  return "rare";
	if (total <= 20) return "epic";
	return "legendary";
}

function makeToCompletionistCode(make) {
	return "COMPLETIONIST_" + make.toUpperCase().replace(/[^A-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function buildCompletionistCatalogue(userMakeCounts, totalMakeCounts, unlockedMap) {
	return Object.entries(totalMakeCounts)
		.filter(([, total]) => total > 0)
		.map(([make, total]) => {
			const code    = makeToCompletionistCode(make);
			const current = Math.min(userMakeCounts[make] || 0, total);
			return {
				code,
				title:       `${make} Completionist`,
				description: `Collect all ${total} ${make} generations.`,
				rarity:      completionistRarity(total),
				category:    "completionist",
				current,
				target:      total,
				unlocked:    Boolean(unlockedMap[code]),
				unlockedAt:  unlockedMap[code] || null,
			};
		})
		.sort((a, b) => {
			if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
			return a.target - b.target;
		});
}

const MANUFACTURER_COUNTRY = {
	// Germany
	"Volkswagen": "germany", "BMW": "germany", "Mercedes-Benz": "germany",
	"Opel": "germany", "Audi": "germany", "Smart": "germany", "Porsche": "germany",
	// Italy
	"Ferrari": "italy", "Lamborghini": "italy", "Maserati": "italy",
	"Alfa Romeo": "italy", "Fiat": "italy", "Lancia": "italy",
	// France
	"Renault": "france", "Peugeot": "france", "Citroën": "france", "DS Automobiles": "france",
	// Sweden
	"Volvo": "sweden", "Saab": "sweden", "Polestar": "sweden",
	// UK
	"Land Rover": "uk", "Jaguar": "uk", "Bentley": "uk", "Rolls-Royce": "uk",
	"Aston Martin": "uk", "McLaren": "uk", "Lotus": "uk", "Mini": "uk",
	"MG": "uk", "Rover": "uk",
	// USA
	"Ford": "usa", "Chevrolet": "usa", "Dodge": "usa", "Chrysler": "usa",
	"RAM": "usa", "Cadillac": "usa", "Jeep": "usa", "Tesla": "usa",
	// Japan
	"Toyota": "japan", "Honda": "japan", "Nissan": "japan", "Mazda": "japan",
	"Mitsubishi": "japan", "Subaru": "japan", "Suzuki": "japan", "Lexus": "japan",
	// South Korea
	"Hyundai": "south_korea", "Kia": "south_korea", "Genesis": "south_korea", "Daewoo": "south_korea",
	// Romania
	"Dacia": "romania",
	// Spain
	"SEAT": "spain", "Cupra": "spain",
	// Czech Republic
	"Skoda": "czech_republic",
};

const COUNTRY_THEMES = {
	germany:      { code: "COUNTRY_GERMANY",      name: "German Reliability",      adjective: "German" },
	italy:        { code: "COUNTRY_ITALY",         name: "Italian Elegance",         adjective: "Italian" },
	france:       { code: "COUNTRY_FRANCE",        name: "French Sophistication",    adjective: "French" },
	sweden:       { code: "COUNTRY_SWEDEN",        name: "Swedish Coldness",         adjective: "Swedish" },
	uk:           { code: "COUNTRY_UK",            name: "British Royalty",          adjective: "British" },
	usa:          { code: "COUNTRY_USA",           name: "American Boldness",        adjective: "American" },
	japan:        { code: "COUNTRY_JAPAN",         name: "Japanese History",         adjective: "Japanese" },
	south_korea:  { code: "COUNTRY_SOUTH_KOREA",   name: "Korean Innovation",        adjective: "South Korean" },
	romania:      { code: "COUNTRY_ROMANIA",       name: "Romanian Spirit",          adjective: "Romanian" },
	spain:        { code: "COUNTRY_SPAIN",         name: "Spanish Passion",          adjective: "Spanish" },
	czech_republic: { code: "COUNTRY_CZECH",       name: "Czech Precision",          adjective: "Czech" },
};

function buildCountryCatalogue(userMakeCounts, totalMakeCounts, unlockedMap) {
	const totals = {};
	const user   = {};

	for (const [make, total] of Object.entries(totalMakeCounts)) {
		const country = MANUFACTURER_COUNTRY[make];
		if (!country) continue;
		totals[country] = (totals[country] || 0) + total;
		user[country]   = (user[country]   || 0) + (userMakeCounts[make] || 0);
	}

	return Object.entries(COUNTRY_THEMES)
		.filter(([country]) => (totals[country] || 0) > 0)
		.map(([country, theme]) => {
			const total   = totals[country];
			const current = Math.min(user[country] || 0, total);
			return {
				code:        theme.code,
				title:       theme.name,
				description: `Collect all ${total} ${theme.adjective} generations.`,
				rarity:      "legendary",
				category:    "country",
				current,
				target:      total,
				unlocked:    Boolean(unlockedMap[theme.code]),
				unlockedAt:  unlockedMap[theme.code] || null,
			};
		})
		.sort((a, b) => {
			if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
			return a.target - b.target;
		});
}

module.exports = {
	COLLECTION_CATALOGUE,
	MANUFACTURER_COUNTRY,
	COUNTRY_THEMES,
	buildCollectionCatalogue,
	buildCompletionistCatalogue,
	buildCountryCatalogue,
	completionistRarity,
	evaluateCollectionMilestones,
	makeToCompletionistCode,
};
