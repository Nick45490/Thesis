// Every route in this service is meant to be reached only through the gateway
// (per CLAUDE.md, /gamification is a protected prefix requiring a valid JWT) —
// but this service is also bound to its own port directly, and controllers trust
// the gateway-injected x-user-id header with no verification of their own. This
// middleware closes that gap: without a matching x-internal-secret header (set
// by the gateway on every proxied request), x-user-id can't be trusted at all.
function requireInternalSecret(req, res, next) {
	const expected = process.env.INTERNAL_SERVICE_SECRET;
	if (!expected || req.headers["x-internal-secret"] !== expected) {
		return res.status(401).json({ message: "Missing or invalid internal credentials" });
	}
	return next();
}

module.exports = { requireInternalSecret };
