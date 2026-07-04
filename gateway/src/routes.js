const { createProxyMiddleware } = require("http-proxy-middleware");
const { requireAuth } = require("./auth.middleware");
const { authLimiter, createRateLimiter } = require("./rateLimit");

function sanitizePrefix(prefix) {
	return prefix.replace(/\/+$/, "");
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
			proxyReq: (proxyReq, req) => {
				if (req.user?.id) {
					proxyReq.setHeader("x-user-id", req.user.id);
				}
				if (req.user?.email) {
					proxyReq.setHeader("x-user-email", req.user.email);
				}
			}
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
	registerGatewayRoutes
};
