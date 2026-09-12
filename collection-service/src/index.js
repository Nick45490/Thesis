const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const collectionRoutes = require("./routes/collection.routes");
const { initDb, checkDbHealth, closePool } = require("./db");
const { requireInternalSecret } = require("./middleware/internalSecret.middleware");

const app = express();

// Trust exactly one hop of X-Forwarded-For — see gateway/src/index.js for why.
app.set("trust proxy", 1);

const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map((o) => o.trim());

app.use(helmet());
app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

app.get("/health", async (req, res) => {
	try {
		await checkDbHealth();
		res.status(200).json({
			service: "collection-service",
			status: "ok",
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		res.status(503).json({
			service: "collection-service",
			status: "degraded",
			error: "database unreachable",
			timestamp: new Date().toISOString()
		});
	}
});

app.use("/", requireInternalSecret, collectionRoutes);

app.use((req, res) => {
	res.status(404).json({ message: "Route not found" });
});

const port = Number(process.env.PORT || 3003);
// Defaults to loopback-only — see auth-service/src/index.js for why.
const host = process.env.HOST || "127.0.0.1";

async function start() {
	await initDb();
	const server = app.listen(port, host, () => {
		console.log(`Collection service listening on ${host}:${port}`);
	});

	function shutdown(signal) {
		console.log(`${signal} received, closing server`);
		server.close(async () => {
			await closePool();
			process.exit(0);
		});
		setTimeout(() => process.exit(1), 10000).unref();
	}
	process.on("SIGTERM", () => shutdown("SIGTERM"));
	process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
	console.error("Collection service failed to start", error);
	process.exit(1);
});

