const jwt = require("jsonwebtoken");

function getTokenFromHeader(authHeader) {
	if (!authHeader) {
		return null;
	}

	const [scheme, token] = authHeader.split(" ");
	if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
		return null;
	}

	return token;
}

function requireAuth(req, res, next) {
	const token = getTokenFromHeader(req.headers.authorization);

	if (!token) {
		return res.status(401).json({ message: "Missing or invalid authorization header" });
	}

	const jwtSecret = process.env.JWT_SECRET;
	if (!jwtSecret) {
		return res.status(500).json({ message: "Gateway JWT secret is not configured" });
	}

	try {
		const payload = jwt.verify(token, jwtSecret);
		req.user = {
			id: payload.sub || payload.id || payload.userId || null,
			email: payload.email || null,
			roles: payload.roles || payload.role || []
		};

		return next();
	} catch (error) {
		return res.status(401).json({ message: "Invalid or expired token" });
	}
}

module.exports = {
	requireAuth
};
