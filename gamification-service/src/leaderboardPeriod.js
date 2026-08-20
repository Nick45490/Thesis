const LEADERBOARD_PERIODS = new Set(["all", "weekly", "monthly"]);

// Start of the current period as a Date, or null for "all" (no filter).
// `now` is injectable so this stays pure and testable without mocking the
// global clock.
function periodStart(period, now = new Date()) {
	if (period === "weekly") {
		const day = now.getDay(); // 0 = Sunday .. 6 = Saturday
		const daysSinceMonday = (day + 6) % 7;
		const d = new Date(now);
		d.setHours(0, 0, 0, 0);
		d.setDate(d.getDate() - daysSinceMonday);
		return d;
	}
	if (period === "monthly") {
		const d = new Date(now);
		d.setHours(0, 0, 0, 0);
		d.setDate(1);
		return d;
	}
	return null;
}

module.exports = { LEADERBOARD_PERIODS, periodStart };
