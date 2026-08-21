const {
	getCarRarity,
	estimateDragTime,
	estimateCircuitTime,
	computePointsAwarded,
	RARITY_TIER,
	CIRCUIT_TRACKS,
	DEFAULT_TRACK,
} = require("../performanceEngine");

// applyVariance() applies ±4% via Math.random() — pin it at 0.5 so
// `1 + (Math.random() * 0.08 - 0.04)` resolves to exactly 1 (no variance),
// making every estimate deterministic for these assertions.
function withoutVariance(fn) {
	const spy = jest.spyOn(Math, "random").mockReturnValue(0.5);
	try {
		return fn();
	} finally {
		spy.mockRestore();
	}
}

describe("getCarRarity", () => {
	test("uses power-to-weight ratio when engine data is present", () => {
		expect(getCarRarity(700, 1500, "Volkswagen", "Golf")).toBe("legendary"); // 0.467
		expect(getCarRarity(450, 1550, "Volkswagen", "Golf")).toBe("epic");      // 0.290
		expect(getCarRarity(280, 1550, "Volkswagen", "Golf")).toBe("rare");      // 0.181
		expect(getCarRarity(150, 1550, "Volkswagen", "Golf")).toBe("common");    // 0.097
	});

	test("a genuine performance car outranks a heavy prestige SUV on ratio alone", () => {
		// BMW M5-like: high power-to-weight (0.329 -> epic) vs. a heavier,
		// less power-dense Lamborghini Urus-like SUV (0.273 -> rare) — the
		// legacy make-prestige rarity would rank these the other way around.
		const m5 = getCarRarity(625, 1900, "BMW", "M5");
		const urus = getCarRarity(600, 2200, "Lamborghini", "Urus");
		expect(RARITY_TIER[m5]).toBeGreaterThan(RARITY_TIER[urus]);
	});

	test("falls back to make/model when engine data is missing", () => {
		expect(getCarRarity(null, null, "Ferrari", "458 Italia")).toBe("legendary");
		expect(getCarRarity(undefined, undefined, "Porsche", "911")).toBe("epic");
		expect(getCarRarity(0, 1500, "BMW", "M3")).toBe("rare");
		expect(getCarRarity(200, 0, "Toyota", "Corolla")).toBe("common");
	});

	test("high-performance variants of common makes get bumped to rare via model name", () => {
		expect(getCarRarity(null, null, "Honda", "Civic Type R")).toBe("rare");
		expect(getCarRarity(null, null, "Volkswagen", "Golf GTI")).toBe("rare");
		expect(getCarRarity(null, null, "Subaru", "Impreza STI")).toBe("rare");
	});

	test("an ordinary common-make model without a performance badge stays common", () => {
		expect(getCarRarity(null, null, "Toyota", "Corolla")).toBe("common");
	});
});

describe("estimateDragTime", () => {
	test("uses Hollander's ET formula when hp+weight are available (quarter mile)", () => {
		const t = withoutVariance(() => estimateDragTime(500, 1500, "BMW", "M3", "quarter"));
		const weightLbs = 1500 * 2.20462;
		const expected = 6.269 * Math.pow(weightLbs / 500, 1 / 3);
		expect(t).toBeCloseTo(expected, 2);
	});

	test("falls back to rarity-tier base time when engine data is missing", () => {
		const t = withoutVariance(() => estimateDragTime(null, null, "Ferrari", "458 Italia", "quarter"));
		expect(t).toBeCloseTo(10.5, 2); // legendary base
	});

	test("more power-to-weight always yields a faster (lower) quarter time", () => {
		const fast = withoutVariance(() => estimateDragTime(600, 1400, "Porsche", "911", "quarter"));
		const slow = withoutVariance(() => estimateDragTime(150, 1600, "Toyota", "Corolla", "quarter"));
		expect(fast).toBeLessThan(slow);
	});

	test("half and full mile times are longer than quarter mile for the same car", () => {
		const quarter = withoutVariance(() => estimateDragTime(400, 1500, "BMW", "M3", "quarter"));
		const half = withoutVariance(() => estimateDragTime(400, 1500, "BMW", "M3", "half"));
		const full = withoutVariance(() => estimateDragTime(400, 1500, "BMW", "M3", "full"));
		expect(half).toBeGreaterThan(quarter);
		expect(full).toBeGreaterThan(half);
	});

	test("applies up to ±4% variance across repeated calls", () => {
		const base = withoutVariance(() => estimateDragTime(400, 1500, "BMW", "M3", "quarter"));
		const times = Array.from({ length: 50 }, () => estimateDragTime(400, 1500, "BMW", "M3", "quarter"));
		for (const t of times) {
			expect(t).toBeGreaterThanOrEqual(base * 0.96 - 0.01);
			expect(t).toBeLessThanOrEqual(base * 1.04 + 0.01);
		}
	});
});

describe("estimateCircuitTime", () => {
	test("uses the full physics model when hp+weight+torque are available", () => {
		const t = withoutVariance(() => estimateCircuitTime(500, 1500, 500, "AWD", "Audi", "RS6"));
		expect(t).toBeGreaterThan(0);
	});

	test("falls back to rarity-tier base time when engine data is incomplete", () => {
		const t = withoutVariance(() => estimateCircuitTime(null, null, null, null, "Ferrari", "458 Italia"));
		expect(t).toBeCloseTo(10.5 * 10, 2); // legendary base × CIRCUIT_FALLBACK_MULT
	});

	test("AWD grip advantage makes an otherwise-equal AWD car no slower than FWD", () => {
		const awd = withoutVariance(() => estimateCircuitTime(300, 1500, 400, "AWD", "Subaru", "WRX"));
		const fwd = withoutVariance(() => estimateCircuitTime(300, 1500, 400, "FWD", "Volkswagen", "Golf"));
		expect(awd).toBeLessThanOrEqual(fwd);
	});

	test("defaults to silverstone when no track is given, matching an explicit 'silverstone' call", () => {
		const implicit = withoutVariance(() => estimateCircuitTime(500, 1500, 500, "AWD", "Audi", "RS6"));
		const explicit = withoutVariance(() => estimateCircuitTime(500, 1500, 500, "AWD", "Audi", "RS6", "silverstone"));
		expect(implicit).toBe(explicit);
	});

	test("falls back to the default track's constants for an unknown track id", () => {
		const unknown = withoutVariance(() => estimateCircuitTime(500, 1500, 500, "AWD", "Audi", "RS6", "nonexistent-track"));
		const fallback = withoutVariance(() => estimateCircuitTime(500, 1500, 500, "AWD", "Audi", "RS6", DEFAULT_TRACK));
		expect(unknown).toBe(fallback);
	});

	test("a different track with different straights/corner-sum constants produces a different time for the same car", () => {
		const silverstone = withoutVariance(() => estimateCircuitTime(500, 1500, 500, "AWD", "Audi", "RS6", "silverstone"));
		const hockenheim = withoutVariance(() => estimateCircuitTime(500, 1500, 500, "AWD", "Audi", "RS6", "hockenheimring"));
		expect(silverstone).not.toBe(hockenheim);
	});
});

describe("CIRCUIT_TRACKS", () => {
	test("every registered track has positive straights and corner-sum constants", () => {
		for (const [name, cfg] of Object.entries(CIRCUIT_TRACKS)) {
			expect(cfg.straightsM).toBeGreaterThan(0);
			expect(cfg.cornerSum).toBeGreaterThan(0);
		}
	});

	test("DEFAULT_TRACK refers to a real entry in the registry", () => {
		expect(CIRCUIT_TRACKS[DEFAULT_TRACK]).toBeDefined();
	});
});

describe("computePointsAwarded", () => {
	test("awards the 50pt base with no bonus when margin is at the threshold", () => {
		// Same rarity tier -> threshold is 2s; margin exactly 2s -> no bonus
		const pts = computePointsAwarded(
			300, 1500, "quarter",
			300, 1500, 2.0,
			"Toyota", "Corolla", "Toyota", "Corolla",
		);
		expect(pts).toBe(50);
	});

	test("awards bonus points at 1 per 20ms the margin exceeds threshold", () => {
		const pts = computePointsAwarded(
			300, 1500, "quarter",
			300, 1500, 2.1, // 100ms over a 2s threshold -> 5 bonus pts
			"Toyota", "Corolla", "Toyota", "Corolla",
		);
		expect(pts).toBe(55);
	});

	test("underdog multiplier scales with tier gap when a lower-rarity car wins", () => {
		// Common car (winner, tier 0) beats a legendary car (loser, tier 3):
		// threshold = 2 + (0 - 3) = -1s, margin 2.0s -> overMs = 3000 -> bonus = 150
		// underdogGap = 3 -> ×2.5 -> (50 + 150) * 2.5 = 500
		const pts = computePointsAwarded(
			800, 1300, "quarter",     // loser: legendary Ferrari-like
			150, 1600, 2.0,
			"Toyota", "Corolla", "Ferrari", "458 Italia",
		);
		expect(pts).toBe(500);
	});

	test("a higher-rarity winner beating a lower-rarity loser gets no underdog multiplier", () => {
		const pts = computePointsAwarded(
			150, 1600, "quarter",
			800, 1300, 2.0,
			"Ferrari", "458 Italia", "Toyota", "Corolla",
		);
		// threshold = 2 + (3 - 0) = 5s; margin 2.0s is under threshold -> no bonus, no underdog mult
		expect(pts).toBe(50);
	});
});
