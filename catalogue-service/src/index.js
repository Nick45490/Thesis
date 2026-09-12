const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const manufacturerRoutes = require("./routes/manufacturers.routes");
const generationRoutes = require("./routes/generations.routes");
const modelRoutes = require("./routes/models.routes");

const app = express();

// Trust exactly one hop of X-Forwarded-For — see gateway/src/index.js for why.
app.set("trust proxy", 1);

const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map((o) => o.trim());

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: corsOrigins }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (req, res) => {
	res.status(200).json({
		service: "catalogue-service",
		status: "ok",
		timestamp: new Date().toISOString()
	});
});

const { listGenerations, listManufacturers, listModels } = require("./db");

app.get("/stats", (req, res) => {
	res.json({
		generations:   listGenerations().length,
		models:        listModels().length,
		manufacturers: listManufacturers().length,
	});
});

app.get("/generation-counts", (req, res) => {
	const counts = {};
	for (const make of listManufacturers()) {
		const modelIds = new Set(listModels({ manufacturerId: make.id }).map((m) => m.id));
		counts[make.name] = listGenerations().filter((g) => modelIds.has(g.modelId)).length;
	}
	res.json({ counts });
});

app.use("/manufacturers", manufacturerRoutes);
app.use("/generations", generationRoutes);
app.use("/models", modelRoutes);

app.use((req, res) => {
	res.status(404).json({ message: "Route not found" });
});

// Catches anything thrown synchronously in a route handler (e.g. a malformed
// query param) so it returns a clean 500 instead of Express's default handler,
// which leaks a stack trace to the client.
app.use((error, req, res, next) => {
	console.error(error);
	res.status(500).json({
		message: "Catalogue service error",
		details: process.env.NODE_ENV === "development" ? error.message : undefined
	});
});

const port = Number(process.env.PORT || 3002);
// Defaults to loopback-only — see auth-service/src/index.js for why.
const host = process.env.HOST || "127.0.0.1";
const server = app.listen(port, host, () => {
	console.log(`Catalogue service listening on ${host}:${port}`);
});

function shutdown(signal) {
	console.log(`${signal} received, closing server`);
	server.close(() => process.exit(0));
	setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
