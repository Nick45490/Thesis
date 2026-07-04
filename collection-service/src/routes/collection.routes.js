const express = require("express");
const {
	addToCollection,
	getMyCollection,
	getUserCollection,
	removeFromCollection
} = require("../controllers/collection.controller");
const { getMyCollectionAchievements } = require("../controllers/collectionAchievements.controller");
const { getProgress } = require("../controllers/progress.controller");

const router = express.Router();

router.get("/", getMyCollection);
router.post("/", addToCollection);
router.delete("/:generationId", removeFromCollection);
router.get("/progress", getProgress);
router.get("/achievements", getMyCollectionAchievements);
router.get("/user/:userId", getUserCollection);

module.exports = router;
