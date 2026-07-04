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

function getCarRarity(make, model) {
	if (LEGENDARY_MAKES.has(make)) return "legendary";
	if (EPIC_MAKES.has(make))      return "epic";
	if (RARE_MAKES.has(make))      return "rare";
	if (QUICK_MODEL_RE.some((re) => re.test(model))) return "rare";
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
		const rarity    = getCarRarity(make, model);
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
const DISTANCE_MARGIN_MULT = { quarter: 1.0, half: 1.25, full: 1.5 };

function computePointsAwarded(loserMake, loserModel, distance, winnerMake, winnerModel, marginSeconds) {
	const winnerTier = RARITY_TIER[getCarRarity(winnerMake, winnerModel)];
	const loserTier  = RARITY_TIER[getCarRarity(loserMake, loserModel)];
	const thresholdS = 2 + (winnerTier - loserTier);
	const effectiveMargin = marginSeconds * (DISTANCE_MARGIN_MULT[distance] || 1.0);
	const overMs     = Math.max(0, (effectiveMargin - thresholdS) * 1000);
	const bonus      = Math.floor(overMs / 20);

	const underdogGap  = loserTier - winnerTier; // positive only when winner is lower rarity
	const underdogMult = underdogGap > 0 ? 1 + underdogGap * 0.5 : 1;

	return Math.round((50 + bonus) * underdogMult);
}

module.exports = { getCarRarity, estimateDragTime, computePointsAwarded };
