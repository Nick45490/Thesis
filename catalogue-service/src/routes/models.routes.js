const express = require("express");
const { findManufacturerById, findModelById, listGenerations, listModels } = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
	const models = listModels({ manufacturerId: req.query.manufacturerId, q: req.query.q });
	return res.status(200).json({ models });
});

router.get("/:id", (req, res) => {
	const model = findModelById(req.params.id);
	if (!model) {
		return res.status(404).json({ message: "Model not found" });
	}

	const manufacturer = findManufacturerById(model.manufacturerId);
	return res.status(200).json({
		model,
		manufacturer
	});
});

router.get("/:id/generations", (req, res) => {
	const model = findModelById(req.params.id);
	if (!model) {
		return res.status(404).json({ message: "Model not found" });
	}

	const generations = listGenerations({ modelId: model.id });
	return res.status(200).json({
		model,
		generations
	});
});

module.exports = router;
