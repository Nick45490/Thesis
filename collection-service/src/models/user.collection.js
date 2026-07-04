function normalizeString(value) {
	return String(value || "").trim();
}

function normalizeItemPayload(payload = {}) {
	const engine = payload.engine && typeof payload.engine === "object" ? {
		name:       normalizeString(payload.engine.name),
		fuelType:   normalizeString(payload.engine.fuelType),
		horsepower: Number(payload.engine.horsepower) || null,
		torqueNm:   Number(payload.engine.torqueNm)   || null,
		weightKg:   Number(payload.engine.weightKg)   || null,
	} : null;

	return {
		generationId:     Number(payload.generationId),
		manufacturerName: normalizeString(payload.manufacturerName),
		modelName:        normalizeString(payload.modelName),
		generationCode:   normalizeString(payload.generationCode),
		engine,
		scanPhoto: typeof payload.scanPhoto === "string" && payload.scanPhoto.startsWith("data:image/") ? payload.scanPhoto : null,
	};
}

function isValidCollectionPayload(item) {
	return (
		Number.isInteger(item.generationId) &&
		item.generationId > 0 &&
		Boolean(item.manufacturerName) &&
		Boolean(item.modelName) &&
		Boolean(item.generationCode)
	);
}

module.exports = {
	isValidCollectionPayload,
	normalizeItemPayload
};
