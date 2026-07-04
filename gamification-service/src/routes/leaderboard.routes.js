const express = require("express");
const { getLeaderboard } = require("../controllers/leaderboard.contoller");

const router = express.Router();

router.get("/", getLeaderboard);

module.exports = router;
