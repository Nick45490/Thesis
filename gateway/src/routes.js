const { createProxyMiddleware } = require("http-proxy-middleware");
const { requireAuth } = require("./auth.middleware");
const { authLimiter, createRateLimiter } = require("./rateLimit");

function sanitizePrefix(prefix) {
	return prefix.replace(/\/+$/, "");
}

// Strip first — http-proxy-middleware forwards the client's original
// headers by default, so a caller-supplied x-user-id/x-user-email would
// otherwise pass straight through unmodified on any route where req.user
// isn't set (e.g. the public /auth, /catalogue prefixes). Only re-added
// once verified from the JWT. Proves the request actually came through the
// gateway — services that trust x-user-id (collection, gamification)
// require x-internal-secret and are also reachable directly on their own
// ports, so without it x-user-id alone would let anyone impersonate any
// user. Extracted from the proxyReq handler below so it's unit-testable
// without spinning up http-proxy-middleware.
function applyIdentityHeaders(proxyReq, req) {
	proxyReq.removeHeader("x-user-id");
	proxyReq.removeHeader("x-user-email");
	if (req.user?.id) {
		proxyReq.setHeader("x-user-id", req.user.id);
	}
	if (req.user?.email) {
		proxyReq.setHeader("x-user-email", req.user.email);
	}
	if (process.env.INTERNAL_SERVICE_SECRET) {
		proxyReq.setHeader("x-internal-secret", process.env.INTERNAL_SERVICE_SECRET);
	}
}

function createServiceProxy(target, prefix, timeoutMs = 30000) {
	return createProxyMiddleware({
		target,
		changeOrigin: true,
		xfwd: true,
		proxyTimeout: timeoutMs,
		timeout: timeoutMs,
		pathRewrite: {
			[`^${prefix}`]: ""
		},
		on: {
			proxyReq: applyIdentityHeaders
		}
	});
}

function registerGatewayRoutes(app) {
	const serviceConfig = [
		{
			prefix: sanitizePrefix(process.env.AUTH_PREFIX || "/auth"),
			target: process.env.AUTH_SERVICE_URL || "http://auth-service:3001",
			protected: false,
			limiter: authLimiter
		},
		{
			prefix: sanitizePrefix(process.env.CATALOGUE_PREFIX || "/catalogue"),
			target: process.env.CATALOGUE_SERVICE_URL || "http://catalogue-service:3002",
			protected: false
		},
		{
			prefix: sanitizePrefix(process.env.COLLECTION_PREFIX || "/collection"),
			target: process.env.COLLECTION_SERVICE_URL || "http://collection-service:3003",
			protected: true
		},
		{
			prefix: sanitizePrefix(process.env.GAMIFICATION_PREFIX || "/gamification"),
			target: process.env.GAMIFICATION_SERVICE_URL || "http://gamification-service:3004",
			protected: true
		},
		{
			prefix: sanitizePrefix(process.env.AI_PREFIX || "/recognize"),
			target: process.env.AI_SERVICE_URL || "http://ai-service:8000",
			protected: true,
			timeoutMs: 120000
		}
	];

	serviceConfig.forEach(({ prefix, target, protected: needsAuth, limiter, timeoutMs }) => {
		const middleware = [];

		if (limiter) {
			middleware.push(limiter);
		} else {
			middleware.push(createRateLimiter());
		}

		if (needsAuth) {
			middleware.push(requireAuth);
		}

		middleware.push(createServiceProxy(target, prefix, timeoutMs));
		app.use(prefix, ...middleware);
	});
}

module.exports = {
	registerGatewayRoutes,
	applyIdentityHeaders,
	sanitizePrefix
};
