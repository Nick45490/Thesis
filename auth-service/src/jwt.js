const jwt = require("jsonwebtoken");

function getJwtSecret() {
	return process.env.JWT_SECRET || "change-me";
}

function signUserToken(user) {
	return jwt.sign(
		{
			email: user.email,
			username: user.username
		},
		getJwtSecret(),
		{
			expiresIn: process.env.JWT_EXPIRES_IN || "7d",
			subject: String(user.id)
		}
	);
}

function requireAuth(req, res, next) {
	const authHeader = req.headers.authorization;
	if (!authHeader) {
		return res.status(401).json({ message: "Missing authorization header" });
	}

	const [scheme, token] = authHeader.split(" ");
	if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
		return res.status(401).json({ message: "Invalid authorization header format" });
	}

	try {
		const payload = jwt.verify(token, getJwtSecret());
		req.auth = {
			userId: Number(payload.sub),
			email: payload.email,
			username: payload.username
		};
		return next();
	} catch (error) {
		return res.status(401).json({ message: "Invalid or expired token" });
	}
}

module.exports = {
	requireAuth,
	signUserToken
};
