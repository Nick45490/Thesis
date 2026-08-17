// Rarity is derived from a car's power-to-weight ratio (horsepower / weightKg),
// not its manufacturer. Same formula as collection-service/src/rarity.js and
// gamification-service/src/engine/performanceEngine.js's getCarRarity — kept in
// sync manually since there's no shared package across services.
//
// For an OWNED collection item, prefer reading `item.rarity` directly from the API
// (already computed server-side) instead of calling this. This utility is for
// previewing rarity on generations the user may not own yet (e.g. Browse.jsx's
// locked cards, CarDetail.jsx), where there's no stored item to read from — pick a
// representative engine (getBestEngine) from the generation's engines[] array.
export function getCarRarity(horsepower, weightKg) {
	if (!horsepower || !weightKg) return "common";
	const ratio = horsepower / weightKg;
	if (ratio >= 0.40) return "legendary";
	if (ratio >= 0.28) return "epic";
	if (ratio >= 0.17) return "rare";
	return "common";
}

// Picks the highest-horsepower engine from a generation's engines[] array, for
// rarity-preview purposes when no specific scanned engine is available.
export function getBestEngine(engines) {
	if (!engines || engines.length === 0) return null;
	return engines.reduce((best, e) => (e.horsepower > (best?.horsepower || 0) ? e : best), null);
}
