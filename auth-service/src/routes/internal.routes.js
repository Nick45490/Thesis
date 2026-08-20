const express = require("express");
const { checkFriends, getUsersByIds } = require("../controllers/internal.controller");
const { requireInternalSecret } = require("../middleware/internalSecret.middleware");

const router = express.Router();

router.use(requireInternalSecret);
router.get("/friends/:userA/:userB", checkFriends);
router.get("/users", getUsersByIds);

module.exports = router;
