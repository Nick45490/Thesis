// auth-service is public by design (the gateway's /auth prefix requires no JWT),
// but routes under /internal are meant only for other backend services to call
// (e.g. collection-service checking a friendship before releasing someone's
// collection) — they must not be reachable by an ordinary end user.
function requireInternalSecret(req, res, next) {
	const expected = process.env.INTERNAL_SERVICE_SECRET;
	if (!expected || req.headers["x-internal-secret"] !== expected) {
		return res.status(401).json({ message: "Missing or invalid internal credentials" });
	}
	return next();
}

module.exports = { requireInternalSecret };
