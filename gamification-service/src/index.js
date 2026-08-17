const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const raceRoutes = require("./routes/races.routes");
const achievementRoutes = require("./routes/achievements.routes");
const leaderboardRoutes = require("./routes/leaderboard.routes");
const challengeRoutes = require("./routes/challenges.routes");
const { initDb } = require("./db");
const { requireInternalSecret } = require("./middleware/internalSecret.middleware");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (req, res) => {
	res.status(200).json({
		service: "gamification-service",
		status: "ok",
		timestamp: new Date().toISOString()
	});
});

app.use(requireInternalSecret);
app.use("/races", raceRoutes);
app.use("/achievements", achievementRoutes);
app.use("/leaderboard", leaderboardRoutes);
app.use("/challenges", challengeRoutes);

app.use((req, res) => {
	res.status(404).json({ message: "Route not found" });
});

const port = Number(process.env.PORT || 3004);

async function start() {
	await initDb();
	app.listen(port, () => {
		console.log(`Gamification service listening on port ${port}`);
	});
}

start().catch((error) => {
	console.error("Gamification service failed to start", error);
	process.exit(1);
});
