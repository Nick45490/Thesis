const bcrypt = require("bcryptjs");
const { createUser, findUserByEmail, findUserById, safeUser, updateProfilePhoto } = require("../db");
const { signUserToken } = require("../jwt");

async function register(req, res) {
	try {
		const { email, username, password } = req.body;

		if (!email || !username || !password) {
			return res.status(400).json({ message: "email, username and password are required" });
		}

		const existing = await findUserByEmail(email);
		if (existing) {
			return res.status(409).json({ message: "Email is already registered" });
		}

		const passwordHash = await bcrypt.hash(password, 10);
		const user = await createUser({ email, username, passwordHash });
		const token = signUserToken(user);

		return res.status(201).json({
			user,
			token
		});
	} catch (error) {
		return res.status(500).json({ message: "Failed to register user" });
	}
}

async function login(req, res) {
	try {
		const { email, password } = req.body;

		if (!email || !password) {
			return res.status(400).json({ message: "email and password are required" });
		}

		const user = await findUserByEmail(email);
		if (!user) {
			return res.status(401).json({ message: "Invalid credentials" });
		}

		const passwordMatches = await bcrypt.compare(password, user.passwordHash);
		if (!passwordMatches) {
			return res.status(401).json({ message: "Invalid credentials" });
		}

		return res.status(200).json({
			user: safeUser(user),
			token: signUserToken(user)
		});
	} catch (error) {
		return res.status(500).json({ message: "Failed to login user" });
	}
}

async function me(req, res) {
	try {
		const user = await findUserById(req.auth.userId);
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		return res.status(200).json({ user: safeUser(user) });
	} catch (error) {
		return res.status(500).json({ message: "Failed to fetch profile" });
	}
}

async function uploadPhoto(req, res) {
	try {
		const { photo } = req.body;
		if (!photo || !photo.startsWith("data:image/")) {
			return res.status(400).json({ message: "Invalid photo data" });
		}
		const user = await updateProfilePhoto(req.auth.userId, photo);
		return res.status(200).json({ user: safeUser(user) });
	} catch {
		return res.status(500).json({ message: "Failed to update profile photo" });
	}
}

module.exports = {
	login,
	me,
	register,
	uploadPhoto,
};
