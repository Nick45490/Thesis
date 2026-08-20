const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const manufacturerRoutes = require("./routes/manufacturers.routes");
const generationRoutes = require("./routes/generations.routes");
const modelRoutes = require("./routes/models.routes");

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors());
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
app.listen(port, () => {
	console.log(`Catalogue service listening on port ${port}`);
});
