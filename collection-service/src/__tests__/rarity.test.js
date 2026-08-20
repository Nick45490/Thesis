const { getCarRarity } = require("../rarity");

describe("getCarRarity", () => {
	test("classifies by power-to-weight ratio across all four tiers", () => {
		expect(getCarRarity(700, 1500)).toBe("legendary"); // 0.467
		expect(getCarRarity(450, 1550)).toBe("epic");       // 0.290
		expect(getCarRarity(280, 1550)).toBe("rare");       // 0.181
		expect(getCarRarity(150, 1550)).toBe("common");     // 0.097
	});

	test("is exact at the tier boundaries", () => {
		expect(getCarRarity(0.40 * 1000, 1000)).toBe("legendary");
		expect(getCarRarity(0.28 * 1000, 1000)).toBe("epic");
		expect(getCarRarity(0.17 * 1000, 1000)).toBe("rare");
		// Just under a boundary falls into the tier below
		expect(getCarRarity(0.399 * 1000, 1000)).toBe("epic");
	});

	test("defaults to common when horsepower or weight is missing", () => {
		expect(getCarRarity(null, 1500)).toBe("common");
		expect(getCarRarity(500, null)).toBe("common");
		expect(getCarRarity(undefined, undefined)).toBe("common");
		expect(getCarRarity(0, 1500)).toBe("common");
	});
});
