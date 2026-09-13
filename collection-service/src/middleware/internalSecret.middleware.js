// Every route in this service is meant to be reached only through the gateway
// (per CLAUDE.md, /collection is a protected prefix requiring a valid JWT) — but
// this service is also bound to its own port directly, and controllers trust the
// gateway-injected x-user-id header with no verification of their own. This
// middleware closes that gap: without a matching x-internal-secret header (set
// by the gateway on every proxied request), x-user-id can't be trusted at all.
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
