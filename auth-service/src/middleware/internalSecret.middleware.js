// auth-service is public by design (the gateway's /auth prefix requires no JWT),
// but routes under /internal are meant only for other backend services to call
// (e.g. collection-service checking a friendship before releasing someone's
// collection) — they must not be reachable by an ordinary end user.
// INTERNAL_SERVICE_SECRET_PREVIOUS lets this value be rotated without a
// perfectly-synchronized simultaneous restart of every service: roll the new
// secret out to every receiver first (as _PREVIOUS here, alongside the still-
// current old one), then update the gateway to send the new value, then once
// that's confirmed, drop _PREVIOUS in a final deploy. The gateway itself only
// ever sends the current value, never the previous one.
function requireInternalSecret(req, res, next) {
	const received = req.headers["x-internal-secret"];
	const validSecrets = [process.env.INTERNAL_SERVICE_SECRET, process.env.INTERNAL_SERVICE_SECRET_PREVIOUS]
		.filter(Boolean);
	if (validSecrets.length === 0 || !validSecrets.includes(received)) {
		return res.status(401).json({ message: "Missing or invalid internal credentials" });
	}
	return next();
}

module.exports = { requireInternalSecret };
