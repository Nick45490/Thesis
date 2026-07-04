const express = require("express");
const { postChallenge, getChallenges, patchAccept, patchDecline } = require("../controllers/challenges.controller");

const router = express.Router();

router.get("/",         getChallenges);
router.post("/",        postChallenge);
router.patch("/:id/accept",  patchAccept);
router.patch("/:id/decline", patchDecline);

module.exports = router;
