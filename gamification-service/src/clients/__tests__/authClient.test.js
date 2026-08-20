const { getUsernamesByIds } = require("../authClient");

function mockFetchOnce(response) {
	global.fetch = jest.fn().mockResolvedValue(response);
}

describe("getUsernamesByIds", () => {
	const ORIGINAL_FETCH = global.fetch;
	const ORIGINAL_SECRET = process.env.INTERNAL_SERVICE_SECRET;

	afterEach(() => {
		global.fetch = ORIGINAL_FETCH;
		process.env.INTERNAL_SERVICE_SECRET = ORIGINAL_SECRET;
	});

	test("returns {} without calling fetch when given no ids", async () => {
		global.fetch = jest.fn();

		const result = await getUsernamesByIds([]);

		expect(result).toEqual({});
		expect(global.fetch).not.toHaveBeenCalled();
	});

	test("dedupes and filters out null/undefined ids before requesting", async () => {
		mockFetchOnce({ ok: true, json: async () => ({}) });

		await getUsernamesByIds([1, 2, 1, null, undefined, 2]);

		const url = global.fetch.mock.calls[0][0];
		expect(url).toContain("ids=1,2");
	});

	test("sends the internal secret header", async () => {
		process.env.INTERNAL_SERVICE_SECRET = "shared-secret";
		mockFetchOnce({ ok: true, json: async () => ({}) });

		await getUsernamesByIds([1]);

		const options = global.fetch.mock.calls[0][1];
		expect(options.headers["x-internal-secret"]).toBe("shared-secret");
	});

	test("returns the parsed username map on success", async () => {
		const payload = { 1: { username: "alice" }, 2: { username: "bob" } };
		mockFetchOnce({ ok: true, json: async () => payload });

		const result = await getUsernamesByIds([1, 2]);

		expect(result).toEqual(payload);
	});

	// Fail closed: a network error or a down auth-service must degrade to "no
	// usernames" rather than the challenge fetch failing outright.
	test("fails closed to {} when the request rejects (network error)", async () => {
		global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

		const result = await getUsernamesByIds([1]);

		expect(result).toEqual({});
	});

	test("fails closed to {} on a non-ok response", async () => {
		mockFetchOnce({ ok: false, status: 500, json: async () => ({}) });

		const result = await getUsernamesByIds([1]);

		expect(result).toEqual({});
	});

	test("fails closed to {} when the response body isn't valid JSON", async () => {
		mockFetchOnce({ ok: true, json: async () => { throw new Error("bad json"); } });

		const result = await getUsernamesByIds([1]);

		expect(result).toEqual({});
	});
});
