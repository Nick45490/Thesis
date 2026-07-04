const express = require("express");
const { getMyAchievements } = require("../controllers/achievements.contoller");

const router = express.Router();

router.get("/", getMyAchievements);

module.exports = router;
