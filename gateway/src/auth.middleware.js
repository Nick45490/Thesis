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

// JWT_SECRET_PREVIOUS lets tokens issued before a secret rotation keep
// working until they naturally expire, instead of logging out every active
// session the instant the secret changes. Only ever used for verifying —
// auth-service always signs new tokens with the current secret alone.
function verifyWithRotation(token, secret, previousSecret) {
	try {
		return jwt.verify(token, secret);
	} catch (error) {
		if (previousSecret) {
			return jwt.verify(token, previousSecret);
		}
		throw error;
	}
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
		const payload = verifyWithRotation(token, jwtSecret, process.env.JWT_SECRET_PREVIOUS);
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
	requireAuth,
	getTokenFromHeader,
	verifyWithRotation
};
