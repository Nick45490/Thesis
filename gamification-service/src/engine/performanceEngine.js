const LEGENDARY_MAKES = new Set([
	"Ferrari", "Lamborghini", "McLaren", "Bugatti", "Koenigsegg", "Pagani", "Rimac",
]);

const EPIC_MAKES = new Set([
	"Porsche", "Aston Martin", "Maserati", "Lotus", "De Tomaso",
	"Bentley", "Rolls-Royce",
]);

const RARE_MAKES = new Set([
	"BMW", "Mercedes-Benz", "Audi", "Cadillac", "Lexus", "Genesis",
	"Dodge", "Chevrolet", "Volvo", "Jaguar", "Land Rover", "Alfa Romeo",
	"Infiniti", "Acura", "Lincoln", "Tesla",
]);

// High-performance variants of common-make models get bumped to "rare"
const QUICK_MODEL_RE = [
	/type[\s-]?r/i, /gti/i, /\bgtr?\b/i, /gt86/i, /gr86/i, /gr yaris/i,
	/gr corolla/i, /focus\s+(st|rs)/i, /fiesta\s+st/i, /megane\s+rs/i,
	/clio\s+rs/i, /civic\s+si/i, /\bwrx\b/i, /\bsti\b/i, /evolution/i,
	/\bevo\b/i, /veloster\s+n/i, /i30\s+n/i, /\bgts\b/i,
	/\bstinger\b/i, /\bsupra\b/i, /370z/i, /mx-?5/i, /rx-?8/i, /\bbrz\b/i,
];

// Quarter-mile base times in seconds, by rarity tier
const QUARTER_TIME = {
	legendary: 10.5,
	epic:      12.2,
	rare:      14.0,
	common:    16.5,
};

// Multipliers over quarter-mile time to estimate half- and full-mile times
const DISTANCE_MULT = {
	quarter: 1.0,
	half:    1.62,
	full:    2.48,
};

// Tier index — threshold = 2 + (winnerTier - loserTier) seconds.
// Same rarity always requires 2s; each tier of advantage adds 1s more.
const RARITY_TIER = {
	common:    0,
	rare:      1,
	epic:      2,
	legendary: 3,
};

// Make/model-based rarity — kept only as a fallback for when engine data (hp/weight)
// is missing, since performance-based rarity can't be computed without it.
function _legacyMakeRarity(make, model) {
	if (LEGENDARY_MAKES.has(make)) return "legendary";
	if (EPIC_MAKES.has(make))      return "epic";
	if (RARE_MAKES.has(make))      return "rare";
	if (QUICK_MODEL_RE.some((re) => re.test(model))) return "rare";
	return "common";
}

// Rarity is derived from a car's power-to-weight ratio (horsepower / weightKg) —
// e.g. a BMW M5 (genuine performance) now correctly ranks above a Lamborghini Urus
// (a heavy SUV), regardless of badge prestige. Falls back to make/model when engine
// data is unavailable. Cutoffs calibrated against the catalogue's real engine
// distribution (top ~1.5% = legendary, ~3.5% = epic, ~15% = rare).
function getCarRarity(horsepower, weightKg, make, model) {
	if (!horsepower || !weightKg) return _legacyMakeRarity(make, model);
	const ratio = horsepower / weightKg;
	if (ratio >= 0.40) return "legendary";
	if (ratio >= 0.28) return "epic";
	if (ratio >= 0.17) return "rare";
	return "common";
}

/**
 * Returns an estimated drag time in seconds (3 decimal places).
 * Uses Hollander's ET formula when hp+weight are available:
 *   quarter_ET = 6.269 × (weight_lbs / hp) ^ (1/3)
 * Falls back to rarity-tier base times when engine data is missing.
 * Adds ±4% variance for rematches.
 * For half/full mile, heavier high-power cars recover via a reduced weight penalty.
 */
function estimateDragTime(horsepower, weightKg, make, model, distance) {
	let quarterTime;

	if (horsepower && weightKg && horsepower > 0 && weightKg > 0) {
		const weightLbs = weightKg * 2.20462;
		const base      = 6.269 * Math.pow(weightLbs / horsepower, 1 / 3);
		const variance  = 1 + (Math.random() * 0.08 - 0.04);
		quarterTime     = Math.round(base * variance * 1000) / 1000;
	} else {
		const rarity    = getCarRarity(horsepower, weightKg, make, model);
		const base      = QUARTER_TIME[rarity];
		const variance  = 1 + (Math.random() * 0.08 - 0.04);
		quarterTime     = Math.round(base * variance * 1000) / 1000;
	}

	if (distance === "quarter") return quarterTime;

	// For longer distances the weight penalty shrinks — powerful cars gain top speed
	const pwRatio    = (horsepower && weightKg) ? horsepower / weightKg : 0.1;
	const topSpeedAdj = Math.min(0.06, pwRatio * 0.15); // up to 6% faster at high speed

	if (distance === "half") {
		return Math.round(quarterTime * (DISTANCE_MULT.half  - topSpeedAdj) * 1000) / 1000;
	}
	return Math.round(quarterTime * (DISTANCE_MULT.full - topSpeedAdj * 1.5) * 1000) / 1000;
}

// Grip multiplier by drivetrain — AWD/4WD put power to all four wheels (better
// corner-exit traction), RWD is the balanced baseline, FWD loses grip under power
// as the same wheels have to steer and accelerate (penalty grows with horsepower).
// Compound catalogue values (e.g. "RWD/AWD", for generations offering both across
// trims) average each listed option's own grip value.
const DRIVETRAIN_GRIP = { AWD: 1.08, RWD: 1.00, "4WD": 1.08 };

function drivetrainGrip(drivetrain, horsepower) {
	const fwdGrip = 1.00 - Math.min(0.10, (horsepower || 0) / 4000);
	if (!drivetrain) return 1.00; // unknown → RWD baseline
	if (drivetrain === "FWD") return fwdGrip;
	if (DRIVETRAIN_GRIP[drivetrain] != null) return DRIVETRAIN_GRIP[drivetrain];
	const parts = drivetrain.split("/").map((d) => (d === "FWD" ? fwdGrip : (DRIVETRAIN_GRIP[d] ?? 1.00)));
	return parts.reduce((a, b) => a + b, 0) / parts.length;
}

/**
 * Circuit mode is modeled on the real Silverstone Grand Prix Circuit (5.891 km,
 * current F1 layout) — 3 straights (2,400m combined) + 15 named corners, each
 * rated 1-10 on how much braking it needs before entry (10 = lightest braking,
 * e.g. Copse taken flat-out; 1 = heaviest, e.g. Village/Luffield). Contribution
 * to lap time is (11 - rating), so heavy-braking corners cost more.
 */
const CIRCUIT_STRAIGHTS_M = 2400; // Start/Finish 800 + Wellington 700 + Hangar 900
const CIRCUIT_CORNER_SUM  = 81;   // sum of (11 - rating) across all 15 corners

const CIRCUIT_STRAIGHT_CONST = 1.0;
const CIRCUIT_CORNER_CONST   = 0.67;
const CIRCUIT_FALLBACK_MULT  = 10; // rarity-tier fallback multiplier, calibrated to this lap's range

// Small secondary nudge only (±2-3% typical) — weight decides between cars that
// are already close on torque-to-weight/grip, never overrides a real power gap
// (an earlier version let weight dominate corners outright and had a Lamborghini
// Urus losing to a VW Golf GTI on weight alone, which isn't realistic).
function circuitAgilityFactor(weightKg) {
	return 1 + 0.03 * ((weightKg - 1500) / 1000);
}

/**
 * Returns an estimated circuit lap time in seconds (3 decimal places).
 * Straights are driven by power-to-weight (same physics as drag), scaled by
 * total straight distance. Corners are driven primarily by torque-to-weight ×
 * drivetrain grip (so a high-torque AWD car can still beat a higher-hp RWD car
 * here even if it loses the drag race), with the small agility nudge above.
 * Falls back to a rarity-tier base time when horsepower/torque/weight are
 * missing. Adds ±4% variance for rematches, same as drag.
 */
function estimateCircuitTime(horsepower, weightKg, torqueNm, drivetrain, make, model) {
	let base;

	if (horsepower && weightKg && torqueNm && horsepower > 0 && weightKg > 0 && torqueNm > 0) {
		const straightTime = CIRCUIT_STRAIGHT_CONST
			* Math.pow(weightKg / horsepower, 1 / 3)
			* (CIRCUIT_STRAIGHTS_M / 100);

		const effective = (torqueNm / weightKg) * drivetrainGrip(drivetrain, horsepower);
		const cornerTime = CIRCUIT_CORNER_CONST
			* CIRCUIT_CORNER_SUM
			* Math.pow(1 / effective, 1 / 3)
			* circuitAgilityFactor(weightKg);

		base = straightTime + cornerTime;
	} else {
		const rarity = getCarRarity(horsepower, weightKg, make, model);
		base = QUARTER_TIME[rarity] * CIRCUIT_FALLBACK_MULT;
	}

	const variance = 1 + (Math.random() * 0.08 - 0.04);
	return Math.round(base * variance * 1000) / 1000;
}

/**
 * Points awarded to the winner.
 * Base: always 50 pts.
 * Threshold: 2s + 1s per rarity tier the winner is above the loser.
 *   same rarity → 2s, one tier up → 3s, two tiers up → 4s, three tiers up → 5s.
 *   Negative thresholds (underdog win) mean any margin earns bonus.
 * Bonus: 1 pt per 20 ms the margin exceeds the threshold.
 * Underdog multiplier: applied when winner rarity is below loser rarity.
 *   1 tier below → ×1.5, 2 tiers → ×2.0, 3 tiers → ×2.5.
 */
// Circuit's base time runs ~5x a quarter mile's, so raw margins are proportionally
// larger without being proportionally more decisive — discounted here (rather than
// amplified like half/full) to keep the threshold/bonus math feeling consistent.
// A starting value, tunable once there's real played data to calibrate against.
const DISTANCE_MARGIN_MULT = { quarter: 1.0, half: 1.25, full: 1.5, circuit: 0.17 };

function computePointsAwarded(loserHorsepower, loserWeightKg, distance, winnerHorsepower, winnerWeightKg, marginSeconds) {
	const winnerTier = RARITY_TIER[getCarRarity(winnerHorsepower, winnerWeightKg)];
	const loserTier  = RARITY_TIER[getCarRarity(loserHorsepower, loserWeightKg)];
	const thresholdS = 2 + (winnerTier - loserTier);
	const effectiveMargin = marginSeconds * (DISTANCE_MARGIN_MULT[distance] || 1.0);
	const overMs     = Math.max(0, (effectiveMargin - thresholdS) * 1000);
	const bonus      = Math.floor(overMs / 20);

	const underdogGap  = loserTier - winnerTier; // positive only when winner is lower rarity
	const underdogMult = underdogGap > 0 ? 1 + underdogGap * 0.5 : 1;

	return Math.round((50 + bonus) * underdogMult);
}

module.exports = { getCarRarity, estimateDragTime, estimateCircuitTime, computePointsAwarded };
