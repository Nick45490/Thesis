const {
	findGenerationById,
	findManufacturerById,
	findModelById,
	listGenerations,
	listManufacturers,
	listModels
} = require("../db");

describe("listManufacturers", () => {
	test("returns every manufacturer when no search term is given", () => {
		const all = listManufacturers();
		expect(all.length).toBeGreaterThan(0);
		expect(all.every((m) => typeof m.id === "number" && typeof m.name === "string")).toBe(true);
	});

	test("filters case-insensitively by substring", () => {
		const results = listManufacturers("bmw");
		expect(results.length).toBeGreaterThan(0);
		expect(results.every((m) => m.name.toLowerCase().includes("bmw"))).toBe(true);
	});

	test("returns an empty array for a search term matching nothing", () => {
		expect(listManufacturers("not-a-real-manufacturer-xyz")).toEqual([]);
	});

	test("takes the first value when a repeated query param becomes an array", () => {
		// Express parses ?q=a&q=b into ["a", "b"] — this must degrade to using
		// the first value rather than throwing on array.toLowerCase().
		const results = listManufacturers(["bmw", "audi"]);
		expect(results.every((m) => m.name.toLowerCase().includes("bmw"))).toBe(true);
	});

	test("trims whitespace and ignores an empty/whitespace-only search", () => {
		const all = listManufacturers();
		expect(listManufacturers("   ")).toEqual(all);
	});
});

describe("findManufacturerById", () => {
	test("finds a real manufacturer by id", () => {
		const [first] = listManufacturers();
		expect(findManufacturerById(first.id)).toEqual(first);
	});

	test("accepts a numeric-string id", () => {
		const [first] = listManufacturers();
		expect(findManufacturerById(String(first.id))).toEqual(first);
	});

	test("returns null for a non-existent id", () => {
		expect(findManufacturerById(999999)).toBeNull();
	});

	test("returns null for a non-numeric id instead of throwing", () => {
		expect(findManufacturerById("not-a-number")).toBeNull();
	});
});

describe("listModels", () => {
	test("returns every model when no filters are given", () => {
		const all = listModels();
		expect(all.length).toBeGreaterThan(0);
	});

	test("filters by manufacturerId", () => {
		const [manufacturer] = listManufacturers();
		const models = listModels({ manufacturerId: manufacturer.id });
		expect(models.length).toBeGreaterThan(0);
		expect(models.every((m) => m.manufacturerId === manufacturer.id)).toBe(true);
	});

	test("filters by q substring, case-insensitively", () => {
		const models = listModels({ q: "golf" });
		expect(models.length).toBeGreaterThan(0);
		expect(models.every((m) => m.name.toLowerCase().includes("golf"))).toBe(true);
	});

	test("combines manufacturerId and q filters", () => {
		const golfModel = listModels({ q: "golf" })[0];
		expect(golfModel).toBeDefined();

		const models = listModels({ manufacturerId: golfModel.manufacturerId, q: "golf" });
		expect(models.length).toBeGreaterThan(0);
		expect(models.every((m) => m.manufacturerId === golfModel.manufacturerId)).toBe(true);
	});

	test("an unmatched manufacturerId yields an empty list, not a throw", () => {
		expect(listModels({ manufacturerId: 999999 })).toEqual([]);
	});
});

describe("findModelById", () => {
	test("finds a real model by id", () => {
		const [first] = listModels();
		expect(findModelById(first.id)).toEqual(first);
	});

	test("returns null for a non-existent id", () => {
		expect(findModelById(999999)).toBeNull();
	});
});

describe("listGenerations", () => {
	test("returns every generation when no filter is given", () => {
		expect(listGenerations().length).toBeGreaterThan(0);
	});

	test("filters by modelId", () => {
		const [model] = listModels();
		const generations = listGenerations({ modelId: model.id });
		expect(generations.length).toBeGreaterThan(0);
		expect(generations.every((g) => g.modelId === model.id)).toBe(true);
	});

	test("an unmatched modelId yields an empty list, not a throw", () => {
		expect(listGenerations({ modelId: 999999 })).toEqual([]);
	});
});

describe("findGenerationById", () => {
	test("finds a real generation by id", () => {
		const [first] = listGenerations();
		expect(findGenerationById(first.id)).toEqual(first);
	});

	test("returns null for a non-existent id", () => {
		expect(findGenerationById(999999)).toBeNull();
	});

	test("returns null for a non-numeric id instead of throwing", () => {
		expect(findGenerationById("nope")).toBeNull();
	});
});
