const { isValidCollectionPayload, normalizeItemPayload } = require("../user.collection");

describe("normalizeItemPayload", () => {
	test("coerces and trims the core fields", () => {
		const result = normalizeItemPayload({
			generationId: "42",
			manufacturerName: "  BMW  ",
			modelName: "M3",
			generationCode: "G80",
		});

		expect(result.generationId).toBe(42);
		expect(result.manufacturerName).toBe("BMW");
		expect(result.modelName).toBe("M3");
		expect(result.generationCode).toBe("G80");
	});

	test("normalizes a nested engine object, coercing numeric fields", () => {
		const result = normalizeItemPayload({
			generationId: 1,
			engine: { name: "S58", fuelType: "petrol", horsepower: "510", torqueNm: "650", weightKg: "not-a-number" },
		});

		expect(result.engine).toEqual({
			name: "S58",
			fuelType: "petrol",
			horsepower: 510,
			torqueNm: 650,
			weightKg: null,
		});
	});

	test("engine is null when not provided or not an object", () => {
		expect(normalizeItemPayload({ generationId: 1 }).engine).toBeNull();
		expect(normalizeItemPayload({ generationId: 1, engine: "not-an-object" }).engine).toBeNull();
	});

	test("only accepts a scanPhoto that's a data:image/ URI, dropping anything else", () => {
		const withValid = normalizeItemPayload({ generationId: 1, scanPhoto: "data:image/jpeg;base64,abcd" });
		expect(withValid.scanPhoto).toBe("data:image/jpeg;base64,abcd");

		const withUrl = normalizeItemPayload({ generationId: 1, scanPhoto: "https://evil.example/x.jpg" });
		expect(withUrl.scanPhoto).toBeNull();

		const withMissing = normalizeItemPayload({ generationId: 1 });
		expect(withMissing.scanPhoto).toBeNull();
	});

	test("drivetrain falls back to null when blank", () => {
		expect(normalizeItemPayload({ generationId: 1, drivetrain: "" }).drivetrain).toBeNull();
		expect(normalizeItemPayload({ generationId: 1, drivetrain: "AWD" }).drivetrain).toBe("AWD");
	});

	test("handles a completely empty payload without throwing", () => {
		const result = normalizeItemPayload();
		expect(result.generationId).toBeNaN();
		expect(result.manufacturerName).toBe("");
		expect(result.engine).toBeNull();
	});
});

describe("isValidCollectionPayload", () => {
	const valid = { generationId: 42, manufacturerName: "BMW", modelName: "M3", generationCode: "G80" };

	test("accepts a fully-populated normalized item", () => {
		expect(isValidCollectionPayload(valid)).toBe(true);
	});

	test("rejects a non-positive or non-integer generationId", () => {
		expect(isValidCollectionPayload({ ...valid, generationId: 0 })).toBe(false);
		expect(isValidCollectionPayload({ ...valid, generationId: -5 })).toBe(false);
		expect(isValidCollectionPayload({ ...valid, generationId: 1.5 })).toBe(false);
		expect(isValidCollectionPayload({ ...valid, generationId: NaN })).toBe(false);
	});

	test("rejects when any required string field is missing", () => {
		expect(isValidCollectionPayload({ ...valid, manufacturerName: "" })).toBe(false);
		expect(isValidCollectionPayload({ ...valid, modelName: "" })).toBe(false);
		expect(isValidCollectionPayload({ ...valid, generationCode: "" })).toBe(false);
	});
});
