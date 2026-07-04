const { findManufacturerById, listManufacturers, listModels } = require("../db");

function getManufacturers(req, res) {
	const manufacturers = listManufacturers(req.query.q);
	return res.status(200).json({ manufacturers });
}

function getManufacturerById(req, res) {
	const manufacturer = findManufacturerById(req.params.id);
	if (!manufacturer) {
		return res.status(404).json({ message: "Manufacturer not found" });
	}

	return res.status(200).json({ manufacturer });
}

function getManufacturerModels(req, res) {
	const manufacturer = findManufacturerById(req.params.id);
	if (!manufacturer) {
		return res.status(404).json({ message: "Manufacturer not found" });
	}

	const models = listModels({ manufacturerId: manufacturer.id, q: req.query.q });
	return res.status(200).json({
		manufacturer,
		models
	});
}

module.exports = {
	getManufacturerById,
	getManufacturerModels,
	getManufacturers
};
