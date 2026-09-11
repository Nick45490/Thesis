const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:3001";

// Fail closed — if auth-service is unreachable or errors, callers get an
// empty map and challenges simply render without usernames rather than the
// request failing outright (same fail-closed-on-network-error style as
// collection-service's isFriendOf()).
async function getUsernamesByIds(ids) {
	const uniqueIds = [...new Set(ids.filter((id) => id != null))];
	if (uniqueIds.length === 0) return {};

	const res = await fetch(
		`${AUTH_SERVICE_URL}/internal/users?ids=${uniqueIds.join(",")}`,
		{
			headers: { "x-internal-secret": process.env.INTERNAL_SERVICE_SECRET || "" },
			// A hung (not down) auth-service would otherwise block this call
			// indefinitely — a refused connection already fails fast, but a
			// stalled one wouldn't without an explicit deadline.
			signal: AbortSignal.timeout(5000)
		}
	).catch(() => null);

	if (!res?.ok) return {};
	return await res.json().catch(() => ({}));
}

module.exports = { getUsernamesByIds };
