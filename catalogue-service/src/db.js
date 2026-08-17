const seedData = require("../seed/data.json");

function toInt(value) {
	const converted = Number.parseInt(value, 10);
	return Number.isNaN(converted) ? null : converted;
}

// Express parses a repeated query param (?q=a&q=b) into an array, which has no
// .toLowerCase — take the first value so a duplicated param degrades instead
// of throwing.
function firstOf(value) {
	return Array.isArray(value) ? value[0] : value;
}

function listManufacturers(query) {
	const search = (firstOf(query) || "").toLowerCase().trim();
	if (!search) {
		return seedData.manufacturers;
	}

	return seedData.manufacturers.filter((manufacturer) =>
		manufacturer.name.toLowerCase().includes(search)
	);
}

function findManufacturerById(id) {
	const manufacturerId = toInt(id);
	if (manufacturerId == null) {
		return null;
	}

	return seedData.manufacturers.find((manufacturer) => manufacturer.id === manufacturerId) || null;
}

function listModels(filters = {}) {
	const manufacturerId = toInt(filters.manufacturerId);
	const query = (firstOf(filters.q) || "").toLowerCase().trim();

	return seedData.models.filter((model) => {
		const manufacturerOk = manufacturerId != null ? model.manufacturerId === manufacturerId : true;
		const queryOk = query ? model.name.toLowerCase().includes(query) : true;
		return manufacturerOk && queryOk;
	});
}

function findModelById(id) {
	const modelId = toInt(id);
	if (modelId == null) {
		return null;
	}

	return seedData.models.find((model) => model.id === modelId) || null;
}

function listGenerations(filters = {}) {
	const modelId = toInt(filters.modelId);
	return seedData.generations.filter((generation) =>
		modelId != null ? generation.modelId === modelId : true
	);
}

function findGenerationById(id) {
	const generationId = toInt(id);
	if (generationId == null) {
		return null;
	}

	return seedData.generations.find((generation) => generation.id === generationId) || null;
}

module.exports = {
	findGenerationById,
	findManufacturerById,
	findModelById,
	listGenerations,
	listManufacturers,
	listModels
};
