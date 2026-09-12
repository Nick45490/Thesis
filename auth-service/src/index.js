const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const authRoutes = require("./routes/auth.routes");
const friendsRoutes = require("./routes/friends.routes");
const usersRoutes = require("./routes/users.routes");
const internalRoutes = require("./routes/internal.routes");
const { initDb, checkDbHealth, closePool } = require("./db");

const app = express();

// Trust exactly one hop of X-Forwarded-For — this service is meant to sit
// behind the gateway (and, in production, a reverse proxy in front of that),
// but is also reachable directly on its own port today; if that direct port
// is ever fronted by its own proxy too, req.ip needs this to resolve to the
// real client rather than the proxy.
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
			service: "auth-service",
			status: "ok",
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		res.status(503).json({
			service: "auth-service",
			status: "degraded",
			error: "database unreachable",
			timestamp: new Date().toISOString()
		});
	}
});

app.use("/", authRoutes);
app.use("/friends", friendsRoutes);
app.use("/users", usersRoutes);
app.use("/internal", internalRoutes);

app.use((req, res) => {
	res.status(404).json({ message: "Route not found" });
});

const port = Number(process.env.PORT || 3001);
// Defaults to loopback-only — this and every other backend service should
// only be reachable from the gateway (or a process on the same box), never
// directly from the public internet. Only the gateway itself should bind to
// a public interface.
const host = process.env.HOST || "127.0.0.1";

async function start() {
	await initDb();
	const server = app.listen(port, host, () => {
		console.log(`Auth service listening on ${host}:${port}`);
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
	console.error("Auth service failed to start", error);
	process.exit(1);
});

