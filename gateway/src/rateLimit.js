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

const authLimiter = createRateLimiter(AUTH_MAX);
const aiLimiter = createRateLimiter(AI_MAX);

module.exports = {
	createRateLimiter,
	authLimiter,
	aiLimiter
};
