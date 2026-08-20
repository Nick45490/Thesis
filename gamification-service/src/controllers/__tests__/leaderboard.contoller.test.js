jest.mock("../../db", () => ({
	listLeaderboard: jest.fn(),
}));

const { listLeaderboard } = require("../../db");
const { getLeaderboard } = require("../leaderboard.contoller");

function mockRes() {
	const res = {};
	res.status = jest.fn().mockReturnValue(res);
	res.json = jest.fn().mockReturnValue(res);
	return res;
}

beforeEach(() => {
	jest.clearAllMocks();
});

describe("getLeaderboard", () => {
	test("defaults to period=all and limit=20 when neither is given", async () => {
		listLeaderboard.mockResolvedValue([]);
		const req = { query: {} };
		const res = mockRes();

		await getLeaderboard(req, res);

		expect(listLeaderboard).toHaveBeenCalledWith(20, "all");
		expect(res.status).toHaveBeenCalledWith(200);
	});

	test("passes through a valid period and limit", async () => {
		listLeaderboard.mockResolvedValue([]);
		const req = { query: { period: "weekly", limit: "5" } };
		const res = mockRes();

		await getLeaderboard(req, res);

		expect(listLeaderboard).toHaveBeenCalledWith(5, "weekly");
	});

	test("rejects an invalid period with 400 before touching the database", async () => {
		const req = { query: { period: "yearly" } };
		const res = mockRes();

		await getLeaderboard(req, res);

		expect(listLeaderboard).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(400);
	});

	test("returns 500 when the db call throws", async () => {
		listLeaderboard.mockRejectedValue(new Error("db down"));
		const req = { query: {} };
		const res = mockRes();

		await getLeaderboard(req, res);

		expect(res.status).toHaveBeenCalledWith(500);
	});
});
