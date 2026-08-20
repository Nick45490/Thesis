const {
	buildCollectionCatalogue,
	buildCompletionistCatalogue,
	buildCountryCatalogue,
	completionistRarity,
	evaluateCollectionMilestones,
	makeToCompletionistCode,
} = require("../achievementEmitter");

describe("evaluateCollectionMilestones", () => {
	test("returns only milestones whose stat has reached its target", () => {
		const unlocked = evaluateCollectionMilestones({ discoveredGenerations: 5, discoveredManufacturers: 0 });
		const codes = unlocked.map((a) => a.code);

		expect(codes).toContain("FIRST_SCAN");
		expect(codes).toContain("COLLECTOR_5");
		expect(codes).not.toContain("COLLECTOR_10");
		expect(codes).not.toContain("BRAND_NOVICE");
	});

	test("returns nothing when every stat is at zero", () => {
		expect(evaluateCollectionMilestones({})).toEqual([]);
	});

	test("each returned entry has no progress fields, just the display fields", () => {
		const [first] = evaluateCollectionMilestones({ discoveredGenerations: 1 });
		expect(Object.keys(first).sort()).toEqual(["code", "description", "rarity", "title"].sort());
	});
});

describe("buildCollectionCatalogue", () => {
	test("caps current progress at the target even when the stat exceeds it", () => {
		const catalogue = buildCollectionCatalogue({ discoveredGenerations: 999 }, {});
		const firstScan = catalogue.find((a) => a.code === "FIRST_SCAN");
		expect(firstScan.current).toBe(1); // capped, not 999
		expect(firstScan.target).toBe(1);
	});

	test("marks unlocked from the unlockedMap independent of current progress", () => {
		const catalogue = buildCollectionCatalogue({}, { FIRST_SCAN: "2026-01-01T00:00:00Z" });
		const firstScan = catalogue.find((a) => a.code === "FIRST_SCAN");
		expect(firstScan.unlocked).toBe(true);
		expect(firstScan.unlockedAt).toBe("2026-01-01T00:00:00Z");

		const notUnlocked = catalogue.find((a) => a.code === "COLLECTOR_5");
		expect(notUnlocked.unlocked).toBe(false);
		expect(notUnlocked.unlockedAt).toBeNull();
	});

	test("returns every catalogue entry, not just unlocked ones", () => {
		const catalogue = buildCollectionCatalogue({}, {});
		expect(catalogue.length).toBeGreaterThan(10);
	});
});

describe("completionistRarity", () => {
	test("scales rarity with how many generations a make actually has", () => {
		expect(completionistRarity(1)).toBe("rare");
		expect(completionistRarity(5)).toBe("rare");
		expect(completionistRarity(6)).toBe("epic");
		expect(completionistRarity(20)).toBe("epic");
		expect(completionistRarity(21)).toBe("legendary");
	});
});

describe("makeToCompletionistCode", () => {
	test("uppercases and replaces non-alphanumeric characters with underscores", () => {
		expect(makeToCompletionistCode("BMW")).toBe("COMPLETIONIST_BMW");
		expect(makeToCompletionistCode("Mercedes-Benz")).toBe("COMPLETIONIST_MERCEDES_BENZ");
		expect(makeToCompletionistCode("Land Rover")).toBe("COMPLETIONIST_LAND_ROVER");
	});

	test("collapses repeated separators and trims leading/trailing underscores", () => {
		expect(makeToCompletionistCode("Rolls-Royce")).toBe("COMPLETIONIST_ROLLS_ROYCE");
		expect(makeToCompletionistCode("DS Automobiles")).toBe("COMPLETIONIST_DS_AUTOMOBILES");
	});
});

describe("buildCompletionistCatalogue", () => {
	const totalMakeCounts = { BMW: 10, Ferrari: 3 };

	test("only includes makes with at least one catalogue generation", () => {
		const result = buildCompletionistCatalogue({}, { ...totalMakeCounts, Yugo: 0 }, {});
		const codes = result.map((r) => r.code);
		expect(codes).toContain("COMPLETIONIST_BMW");
		expect(codes).toContain("COMPLETIONIST_FERRARI");
		expect(codes).not.toContain("COMPLETIONIST_YUGO");
	});

	test("caps current at total and derives rarity from total via completionistRarity", () => {
		const result = buildCompletionistCatalogue({ BMW: 999 }, totalMakeCounts, {});
		const bmw = result.find((r) => r.code === "COMPLETIONIST_BMW");
		expect(bmw.current).toBe(10);
		expect(bmw.rarity).toBe("epic"); // completionistRarity(10)
		const ferrari = result.find((r) => r.code === "COMPLETIONIST_FERRARI");
		expect(ferrari.rarity).toBe("rare"); // completionistRarity(3)
	});

	test("sorts unlocked entries first, then by ascending target", () => {
		const result = buildCompletionistCatalogue(
			{},
			{ BMW: 10, Ferrari: 3 },
			{ COMPLETIONIST_BMW: "2026-01-01T00:00:00Z" },
		);
		expect(result[0].code).toBe("COMPLETIONIST_BMW"); // unlocked comes first regardless of target size
		expect(result[1].code).toBe("COMPLETIONIST_FERRARI");
	});
});

describe("buildCountryCatalogue", () => {
	test("aggregates make counts into their mapped country", () => {
		// BMW and Mercedes-Benz both map to germany
		const result = buildCountryCatalogue(
			{ BMW: 4, "Mercedes-Benz": 2 },
			{ BMW: 10, "Mercedes-Benz": 5 },
			{},
		);
		const germany = result.find((r) => r.code === "COUNTRY_GERMANY");
		expect(germany.current).toBe(6);
		expect(germany.target).toBe(15);
	});

	test("excludes countries with no catalogue presence at all", () => {
		const result = buildCountryCatalogue({}, { BMW: 10 }, {});
		expect(result.some((r) => r.code === "COUNTRY_ITALY")).toBe(false);
	});

	test("ignores makes with no known country mapping instead of throwing", () => {
		expect(() => buildCountryCatalogue({}, { SomeUnknownMake: 5 }, {})).not.toThrow();
	});
});
