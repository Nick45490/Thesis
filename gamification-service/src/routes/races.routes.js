const express = require("express");
const { createRace, getMyRaces } = require("../controllers/races.controller");

const router = express.Router();

router.get("/", getMyRaces);
router.post("/", createRace);

module.exports = router;
