const { findGenerationById, findModelById, listGenerations } = require("../db");

function getGenerations(req, res) {
	const modelId = req.query.modelId;
	const model = modelId ? findModelById(modelId) : null;

	if (modelId && !model) {
		return res.status(404).json({ message: "Model not found" });
	}

	const generations = listGenerations({ modelId });
	return res.status(200).json({
		model,
		generations
	});
}

function getGenerationById(req, res) {
	const generation = findGenerationById(req.params.id);
	if (!generation) {
		return res.status(404).json({ message: "Generation not found" });
	}

	const model = findModelById(generation.modelId);
	return res.status(200).json({
		generation,
		model
	});
}

module.exports = {
	getGenerationById,
	getGenerations
};
