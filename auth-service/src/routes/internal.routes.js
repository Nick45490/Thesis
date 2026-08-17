const express = require("express");
const { checkFriends } = require("../controllers/internal.controller");
const { requireInternalSecret } = require("../middleware/internalSecret.middleware");

const router = express.Router();

router.use(requireInternalSecret);
router.get("/friends/:userA/:userB", checkFriends);

module.exports = router;
