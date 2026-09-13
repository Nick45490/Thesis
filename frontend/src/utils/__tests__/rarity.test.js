import { describe, expect, test } from "vitest";
import { getCarRarity, getBestEngine } from "../rarity";

describe("getCarRarity", () => {
	// Exact tier boundaries — must stay in sync with collection-service's
	// rarity.js and gamification-service's performanceEngine.js getCarRarity.
	// A silent drift here means a car could show one rarity in the browser
	// and award points/achievements for a different one server-side.
	test("legendary at and above a 0.40 power-to-weight ratio", () => {
		expect(getCarRarity(400, 1000)).toBe("legendary"); // exactly 0.40
		expect(getCarRarity(500, 1000)).toBe("legendary");
	});

	test("epic between 0.28 and 0.40", () => {
		expect(getCarRarity(280, 1000)).toBe("epic"); // exactly 0.28
		expect(getCarRarity(399, 1000)).toBe("epic");
	});

	test("rare between 0.17 and 0.28", () => {
		expect(getCarRarity(170, 1000)).toBe("rare"); // exactly 0.17
		expect(getCarRarity(279, 1000)).toBe("rare");
	});

	test("common below 0.17", () => {
		expect(getCarRarity(169, 1000)).toBe("common");
		expect(getCarRarity(50, 1000)).toBe("common");
	});

	test("common when either input is missing or zero, never a crash", () => {
		expect(getCarRarity(0, 1000)).toBe("common");
		expect(getCarRarity(300, 0)).toBe("common");
		expect(getCarRarity(null, 1000)).toBe("common");
		expect(getCarRarity(300, undefined)).toBe("common");
	});
});

describe("getBestEngine", () => {
	test("picks the highest-horsepower engine from the list", () => {
		const engines = [
			{ name: "1.4 TSI", horsepower: 150 },
			{ name: "2.0 TSI", horsepower: 220 },
			{ name: "1.6 TDI", horsepower: 115 }
		];
		expect(getBestEngine(engines).name).toBe("2.0 TSI");
	});

	test("returns null for an empty or missing engines array", () => {
		expect(getBestEngine([])).toBeNull();
		expect(getBestEngine(null)).toBeNull();
		expect(getBestEngine(undefined)).toBeNull();
	});

	test("returns the only engine when there's just one", () => {
		const engines = [{ name: "Electric", horsepower: 204 }];
		expect(getBestEngine(engines).name).toBe("Electric");
	});
});
