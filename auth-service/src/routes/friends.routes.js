const express = require("express");
const {
	acceptRequest,
	generateInviteCode,
	listFriends,
	redeemCode,
	removeFriend,
	sendFriendRequest
} = require("../controllers/friends.controller");
const { requireAuth } = require("../jwt");

const router = express.Router();

router.use(requireAuth);
router.get("/", listFriends);
router.post("/request", sendFriendRequest);
router.post("/accept", acceptRequest);
router.delete("/:friendId", removeFriend);
router.post("/invite/generate", generateInviteCode);
router.post("/invite/redeem", redeemCode);

module.exports = router;
