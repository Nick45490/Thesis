const express = require("express");
const { findUserById, listUsers, safeUser } = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
	try {
		res.status(200).json({ users: await listUsers() });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Failed to list users" });
	}
});

router.get("/:id", async (req, res) => {
	const id = Number(req.params.id);
	if (!Number.isInteger(id)) {
		return res.status(400).json({ message: "id must be a numeric user id" });
	}

	try {
		const user = await findUserById(id);
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		return res.status(200).json({ user: safeUser(user) });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Failed to fetch user" });
	}
});

module.exports = router;
