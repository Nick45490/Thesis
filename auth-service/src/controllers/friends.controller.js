const {
	acceptFriendRequest,
	createFriendRequest,
	createInviteCode,
	findUserById,
	getFriendsForUser,
	getPendingRequestsForUser,
	redeemInviteCode,
	removeFriendship
} = require("../db");

async function listFriends(req, res) {
	try {
		const userId = req.auth.userId;
		const [friends, pendingRequests] = await Promise.all([
			getFriendsForUser(userId),
			getPendingRequestsForUser(userId)
		]);

		return res.status(200).json({
			friends,
			pendingRequests
		});
	} catch (error) {
		return res.status(500).json({ message: "Failed to load friends" });
	}
}

async function sendFriendRequest(req, res) {
	try {
		const requesterId = req.auth.userId;
		const targetId = Number(req.body.friendUserId);

		if (!targetId) {
			return res.status(400).json({ message: "friendUserId is required" });
		}

		if (targetId === requesterId) {
			return res.status(400).json({ message: "You cannot send a friend request to yourself" });
		}

		const targetUser = await findUserById(targetId);
		if (!targetUser) {
			return res.status(404).json({ message: "Target user not found" });
		}

		const request = await createFriendRequest(requesterId, targetId);
		return res.status(201).json({ request });
	} catch (error) {
		return res.status(500).json({ message: "Failed to send friend request" });
	}
}

async function acceptRequest(req, res) {
	try {
		const targetId = req.auth.userId;
		const requesterId = Number(req.body.requesterId);

		if (!requesterId) {
			return res.status(400).json({ message: "requesterId is required" });
		}

		const result = await acceptFriendRequest(requesterId, targetId);
		if (!result) {
			return res.status(404).json({ message: "Pending request not found" });
		}

		return res.status(200).json({
			message: "Friend request accepted",
			request: result
		});
	} catch (error) {
		return res.status(500).json({ message: "Failed to accept friend request" });
	}
}

async function removeFriend(req, res) {
	try {
		const userId = req.auth.userId;
		const friendId = Number(req.params.friendId);

		if (!friendId) {
			return res.status(400).json({ message: "friendId must be a number" });
		}

		const removed = await removeFriendship(userId, friendId);
		if (!removed) {
			return res.status(404).json({ message: "Friend relationship not found" });
		}

		return res.status(200).json({ message: "Friend removed" });
	} catch (error) {
		return res.status(500).json({ message: "Failed to remove friend" });
	}
}

async function generateInviteCode(req, res) {
	try {
		const { code, expiresAt } = await createInviteCode(req.auth.userId);
		return res.status(200).json({ code, expiresAt });
	} catch {
		return res.status(500).json({ message: "Failed to generate invite code" });
	}
}

async function redeemCode(req, res) {
	try {
		const { code } = req.body;
		if (!code) return res.status(400).json({ message: "code is required" });

		const result = await redeemInviteCode(code, req.auth.userId);

		if (result.error === "invalid")  return res.status(404).json({ message: "Invalid invite code" });
		if (result.error === "used")     return res.status(409).json({ message: "This code has already been used" });
		if (result.error === "expired")  return res.status(410).json({ message: "This code has expired" });
		if (result.error === "self")     return res.status(400).json({ message: "You cannot use your own code" });

		return res.status(201).json({
			message: "Friend request sent",
			request: result.request,
			to: result.codeOwner ? { id: result.codeOwner.id, username: result.codeOwner.username } : null,
		});
	} catch {
		return res.status(500).json({ message: "Failed to redeem invite code" });
	}
}

module.exports = {
	acceptRequest,
	generateInviteCode,
	listFriends,
	redeemCode,
	removeFriend,
	sendFriendRequest
};
