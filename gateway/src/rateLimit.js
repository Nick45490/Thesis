const rateLimit = require("express-rate-limit");

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const DEFAULT_MAX = Number(process.env.RATE_LIMIT_MAX || 1000);
const AUTH_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 200);
// /recognize triggers YOLO+CLIP inference per request — much more expensive
// than a typical CRUD route, so it gets its own tighter ceiling instead of
// sharing the generous default limit.
const AI_MAX = Number(process.env.AI_RATE_LIMIT_MAX || 30);

function createRateLimiter(max = DEFAULT_MAX) {
	return rateLimit({
		windowMs: WINDOW_MS,
		max,
		standardHeaders: true,
		legacyHeaders: false,
		message: {
			message: "Too many requests, please try again later"
		}
	});
}

// Keys by the authenticated user's id instead of the client's IP — must run
// after requireAuth so req.user is actually populated. Falls back to req.ip
// only as a defensive measure (every route this is applied to already
// requires auth first, so req.user should always be set by the time this
// runs) so a request is never accidentally left unlimited if that ever isn't
// true, rather than silently keying everyone under the same "undefined".
function userKeyGenerator(req) {
	return req.user?.id ? `user:${req.user.id}` : req.ip;
}

function createUserRateLimiter(max = DEFAULT_MAX) {
	return rateLimit({
		windowMs: WINDOW_MS,
		max,
		standardHeaders: true,
		legacyHeaders: false,
		keyGenerator: userKeyGenerator,
		message: {
			message: "Too many requests, please try again later"
		}
	});
}

const authLimiter = createRateLimiter(AUTH_MAX);
const aiLimiter = createRateLimiter(AI_MAX);
// Per-user limiters, applied on top of (not instead of) the IP-based ones
// above — those alone leave a real gap: a single authenticated user rotating
// IPs evades an IP-keyed limit entirely, and several legitimate users behind
// one shared IP/NAT get lumped into a single bucket regardless of who's
// actually making the requests. Reuses the same ceilings as their IP-based
// counterparts rather than introducing another set of env vars.
const aiUserLimiter = createUserRateLimiter(AI_MAX);
const userLimiter = createUserRateLimiter(DEFAULT_MAX);

module.exports = {
	createRateLimiter,
	createUserRateLimiter,
	userKeyGenerator,
	authLimiter,
	aiLimiter,
	aiUserLimiter,
	userLimiter
};
