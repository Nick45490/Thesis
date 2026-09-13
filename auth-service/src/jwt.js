const jwt = require("jsonwebtoken");

// Fails closed, matching the gateway's own JWT check — silently falling back
// to a public placeholder string would mean anyone who knows that literal
// value ("change-me") could forge a valid token.
function getJwtSecret() {
	return process.env.JWT_SECRET || null;
}

function signUserToken(user) {
	const secret = getJwtSecret();
	if (!secret) {
		throw new Error("JWT_SECRET is not configured");
	}
	return jwt.sign(
		{
			email: user.email,
			username: user.username
		},
		secret,
		{
			expiresIn: process.env.JWT_EXPIRES_IN || "7d",
			subject: String(user.id)
		}
	);
}

// JWT_SECRET_PREVIOUS lets tokens issued before a secret rotation keep
// working until they naturally expire, instead of logging out every active
// session the instant the secret changes. Only ever used for verifying —
// signUserToken above always signs new tokens with the current secret alone.
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
	const authHeader = req.headers.authorization;
	if (!authHeader) {
		return res.status(401).json({ message: "Missing authorization header" });
	}

	const [scheme, token] = authHeader.split(" ");
	if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
		return res.status(401).json({ message: "Invalid authorization header format" });
	}

	const secret = getJwtSecret();
	if (!secret) {
		return res.status(500).json({ message: "Auth service JWT secret is not configured" });
	}

	try {
		const payload = verifyWithRotation(token, secret, process.env.JWT_SECRET_PREVIOUS);
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
	signUserToken,
	verifyWithRotation
};
