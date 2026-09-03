const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const collectionRoutes = require("./routes/collection.routes");
const { initDb } = require("./db");
const { requireInternalSecret } = require("./middleware/internalSecret.middleware");

const app = express();

const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map((o) => o.trim());

app.use(helmet());
app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

app.get("/health", (req, res) => {
	res.status(200).json({
		service: "collection-service",
		status: "ok",
		timestamp: new Date().toISOString()
	});
});

app.use("/", requireInternalSecret, collectionRoutes);

app.use((req, res) => {
	res.status(404).json({ message: "Route not found" });
});

const port = Number(process.env.PORT || 3003);

async function start() {
	await initDb();
	app.listen(port, () => {
		console.log(`Collection service listening on port ${port}`);
	});
}

start().catch((error) => {
	console.error("Collection service failed to start", error);
	process.exit(1);
});

