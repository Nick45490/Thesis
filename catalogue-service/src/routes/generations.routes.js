const express = require("express");
const { getGenerationById, getGenerations } = require("../controllers/generations.controller");

const router = express.Router();

router.get("/", getGenerations);
router.get("/:id", getGenerationById);

module.exports = router;
