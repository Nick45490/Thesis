// Rarity is derived from a car's power-to-weight ratio (horsepower / weightKg),
// not its manufacturer — a scanned engine variant with genuine performance earns
// its tier regardless of badge. Cutoffs calibrated against the actual catalogue's
// engine distribution (top ~1.5% = legendary, ~3.5% = epic, ~15% = rare).
function getCarRarity(horsepower, weightKg) {
	if (!horsepower || !weightKg) return "common";
	const ratio = horsepower / weightKg;
	if (ratio >= 0.40) return "legendary";
	if (ratio >= 0.28) return "epic";
	if (ratio >= 0.17) return "rare";
	return "common";
}

module.exports = { getCarRarity };
