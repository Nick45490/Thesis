const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const { registerGatewayRoutes } = require("./routes");

const app = express();

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
app.listen(port, () => {
	// Log startup once to make container and local startup checks easy.
	console.log(`Gateway listening on port ${port}`);
});
