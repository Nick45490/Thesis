const { LEADERBOARD_PERIODS, periodStart } = require("../leaderboardPeriod");

describe("periodStart", () => {
	test("'all' has no start — always null, i.e. unfiltered", () => {
		expect(periodStart("all", new Date(2026, 7, 19, 15, 30))).toBeNull();
	});

	test("weekly: returns the most recent Monday at local midnight, mid-week", () => {
		// Wednesday, Aug 19 2026 -> Monday, Aug 17 2026
		const result = periodStart("weekly", new Date(2026, 7, 19, 15, 30));
		expect(result).toEqual(new Date(2026, 7, 17, 0, 0, 0, 0));
	});

	test("weekly: on a Monday, returns that same day at midnight (not a week back)", () => {
		const result = periodStart("weekly", new Date(2026, 7, 17, 10, 0));
		expect(result).toEqual(new Date(2026, 7, 17, 0, 0, 0, 0));
	});

	test("weekly: on a Sunday, still returns the Monday that started the current week", () => {
		// Sunday, Aug 23 2026 belongs to the week that started Monday Aug 17 2026,
		// not the upcoming Monday (Aug 24) — Sunday is the end of the week here.
		const result = periodStart("weekly", new Date(2026, 7, 23, 12, 0));
		expect(result).toEqual(new Date(2026, 7, 17, 0, 0, 0, 0));
	});

	test("weekly: correctly crosses a month boundary", () => {
		// Saturday, Aug 1 2026 -> Monday, Jul 27 2026
		const result = periodStart("weekly", new Date(2026, 7, 1, 23, 0));
		expect(result).toEqual(new Date(2026, 6, 27, 0, 0, 0, 0));
	});

	test("monthly: returns the 1st of the current month at local midnight", () => {
		const result = periodStart("monthly", new Date(2026, 7, 19, 15, 30));
		expect(result).toEqual(new Date(2026, 7, 1, 0, 0, 0, 0));
	});

	test("monthly: on the 1st itself, still returns that day at midnight", () => {
		const result = periodStart("monthly", new Date(2026, 7, 1, 23, 0));
		expect(result).toEqual(new Date(2026, 7, 1, 0, 0, 0, 0));
	});

	test("defaults to the real current time when `now` isn't provided", () => {
		expect(periodStart("weekly")).toBeInstanceOf(Date);
	});

	test("LEADERBOARD_PERIODS lists exactly the three supported values", () => {
		expect([...LEADERBOARD_PERIODS].sort()).toEqual(["all", "monthly", "weekly"]);
	});
});
