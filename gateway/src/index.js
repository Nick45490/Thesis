const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const { registerGatewayRoutes } = require("./routes");

const app = express();

// Trust exactly one hop of X-Forwarded-For (the reverse proxy in front of
// this gateway in production — Caddy, or a PaaS's edge). Without this,
// express-rate-limit's req.ip-based keying sees every request as coming from
// the proxy itself once one is introduced, collapsing all real users into one
// shared rate-limit bucket. `1`, not `true` — trusting every hop would let a
// client spoof its own X-Forwarded-For if more hops ever exist.
app.set("trust proxy", 1);

const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map((o) => o.trim());

app.use(helmet());
app.use(cors({ origin: corsOrigins }));
app.use(morgan("dev"));
// Rate limiting is applied per-prefix inside registerGatewayRoutes (auth gets
// its own stricter limiter, everything else gets a default one) — a second
// blanket limiter here used to stack on top of that, silently halving the
// effective ceiling on every non-auth route.

app.get("/health", (req, res) => {
	res.status(200).json({
		service: "gateway",
		status: "ok",
		timestamp: new Date().toISOString()
	});
});

registerGatewayRoutes(app);

app.use((req, res) => {
	res.status(404).json({ message: "Route not found" });
});

app.use((error, req, res, next) => {
	if (error?.code === "ECONNREFUSED") {
		return res.status(502).json({ message: "Upstream service unavailable" });
	}
	if (error?.code === "ETIMEDOUT" || error?.code === "ECONNRESET") {
		return res.status(504).json({ message: "Upstream service timed out" });
	}

	return res.status(500).json({
		message: "Gateway error",
		details: process.env.NODE_ENV === "development" ? error.message : undefined
	});
});

const port = Number(process.env.PORT || 8080);
// Unlike the other 4 services, the gateway is meant to be the one publicly
// reachable port — defaults to all interfaces, but still overridable (e.g. to
// 127.0.0.1 if a same-box reverse proxy is the only thing that should reach it).
const host = process.env.HOST || "0.0.0.0";
const server = app.listen(port, host, () => {
	// Log startup once to make container and local startup checks easy.
	console.log(`Gateway listening on ${host}:${port}`);
});

// A process manager (systemd, a PaaS) sends SIGTERM on every restart/deploy,
// not just crashes — without a handler, in-flight requests get hard-killed on
// every routine restart instead of finishing first.
function shutdown(signal) {
	console.log(`${signal} received, closing server`);
	server.close(() => process.exit(0));
	setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
