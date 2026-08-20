jest.mock("../../db", () => ({
	areFriends: jest.fn(),
	findUsersByIds: jest.fn(),
}));

const { areFriends, findUsersByIds } = require("../../db");
const { checkFriends, getUsersByIds } = require("../internal.controller");

function mockRes() {
	const res = {};
	res.status = jest.fn().mockReturnValue(res);
	res.json = jest.fn().mockReturnValue(res);
	return res;
}

beforeEach(() => {
	jest.clearAllMocks();
});

describe("getUsersByIds", () => {
	test("returns a {id: {username}} map for the requested ids", async () => {
		findUsersByIds.mockResolvedValue([
			{ id: 1, username: "alice" },
			{ id: 2, username: "bob" },
		]);
		const req = { query: { ids: "1,2" } };
		const res = mockRes();

		await getUsersByIds(req, res);

		expect(findUsersByIds).toHaveBeenCalledWith(["1", "2"]);
		expect(res.status).toHaveBeenCalledWith(200);
		expect(res.json).toHaveBeenCalledWith({
			1: { username: "alice" },
			2: { username: "bob" },
		});
	});

	test("trims whitespace and drops empty entries from the ids list", async () => {
		findUsersByIds.mockResolvedValue([]);
		const req = { query: { ids: " 1, 2,,3 " } };
		const res = mockRes();

		await getUsersByIds(req, res);

		expect(findUsersByIds).toHaveBeenCalledWith(["1", "2", "3"]);
	});

	test("returns 400 when the ids query parameter is missing", async () => {
		const req = { query: {} };
		const res = mockRes();

		await getUsersByIds(req, res);

		expect(findUsersByIds).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(400);
	});

	test("returns 500 when the db lookup throws", async () => {
		findUsersByIds.mockRejectedValue(new Error("db down"));
		const req = { query: { ids: "1" } };
		const res = mockRes();

		await getUsersByIds(req, res);

		expect(res.status).toHaveBeenCalledWith(500);
	});
});

describe("checkFriends", () => {
	test("returns { friends: true } when the users are friends", async () => {
		areFriends.mockResolvedValue(true);
		const req = { params: { userA: "1", userB: "2" } };
		const res = mockRes();

		await checkFriends(req, res);

		expect(areFriends).toHaveBeenCalledWith(1, 2);
		expect(res.json).toHaveBeenCalledWith({ friends: true });
	});

	test("returns 400 when either id is non-numeric", async () => {
		const req = { params: { userA: "abc", userB: "2" } };
		const res = mockRes();

		await checkFriends(req, res);

		expect(areFriends).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(400);
	});
});
