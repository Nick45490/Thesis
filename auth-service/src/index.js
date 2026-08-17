const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const authRoutes = require("./routes/auth.routes");
const friendsRoutes = require("./routes/friends.routes");
const usersRoutes = require("./routes/users.routes");
const internalRoutes = require("./routes/internal.routes");
const { initDb } = require("./db");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

app.get("/health", (req, res) => {
	res.status(200).json({
		service: "auth-service",
		status: "ok",
		timestamp: new Date().toISOString()
	});
});

app.use("/", authRoutes);
app.use("/friends", friendsRoutes);
app.use("/users", usersRoutes);
app.use("/internal", internalRoutes);

app.use((req, res) => {
	res.status(404).json({ message: "Route not found" });
});

const port = Number(process.env.PORT || 3001);

async function start() {
	await initDb();
	app.listen(port, () => {
		console.log(`Auth service listening on port ${port}`);
	});
}

start().catch((error) => {
	console.error("Auth service failed to start", error);
	process.exit(1);
});

