const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const { globalLimiter } = require("./rateLimit");
const { registerGatewayRoutes } = require("./routes");

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(globalLimiter);

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
