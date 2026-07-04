const express = require("express");
const {
	getManufacturerById,
	getManufacturerModels,
	getManufacturers
} = require("../controllers/manufacturers.controller");

const router = express.Router();

router.get("/", getManufacturers);
router.get("/:id", getManufacturerById);
router.get("/:id/models", getManufacturerModels);

module.exports = router;
