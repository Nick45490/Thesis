const express = require("express");
const { getMyRaces } = require("../controllers/races.controller");

const router = express.Router();

router.get("/", getMyRaces);

module.exports = router;
