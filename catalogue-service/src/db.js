const seedData = require("../seed/data.json");

function toInt(value) {
	const converted = Number.parseInt(value, 10);
	return Number.isNaN(converted) ? null : converted;
}

function listManufacturers(query) {
	const search = (query || "").toLowerCase().trim();
	if (!search) {
		return seedData.manufacturers;
	}

	return seedData.manufacturers.filter((manufacturer) =>
		manufacturer.name.toLowerCase().includes(search)
	);
}

function findManufacturerById(id) {
	const manufacturerId = toInt(id);
	if (!manufacturerId) {
		return null;
	}

	return seedData.manufacturers.find((manufacturer) => manufacturer.id === manufacturerId) || null;
}

function listModels(filters = {}) {
	const manufacturerId = toInt(filters.manufacturerId);
	const query = (filters.q || "").toLowerCase().trim();

	return seedData.models.filter((model) => {
		const manufacturerOk = manufacturerId ? model.manufacturerId === manufacturerId : true;
		const queryOk = query ? model.name.toLowerCase().includes(query) : true;
		return manufacturerOk && queryOk;
	});
}

function findModelById(id) {
	const modelId = toInt(id);
	if (!modelId) {
		return null;
	}

	return seedData.models.find((model) => model.id === modelId) || null;
}

function listGenerations(filters = {}) {
	const modelId = toInt(filters.modelId);
	return seedData.generations.filter((generation) =>
		modelId ? generation.modelId === modelId : true
	);
}

function findGenerationById(id) {
	const generationId = toInt(id);
	if (!generationId) {
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
