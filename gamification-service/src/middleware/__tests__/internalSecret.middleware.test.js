const { requireInternalSecret } = require("../internalSecret.middleware");

function mockRes() {
	const res = {};
	res.status = jest.fn().mockReturnValue(res);
	res.json = jest.fn().mockReturnValue(res);
	return res;
}

describe("requireInternalSecret", () => {
	const ORIGINAL_ENV = process.env.INTERNAL_SERVICE_SECRET;

	afterEach(() => {
		process.env.INTERNAL_SERVICE_SECRET = ORIGINAL_ENV;
	});

	test("calls next() when the header matches the configured secret", () => {
		process.env.INTERNAL_SERVICE_SECRET = "top-secret";
		const req = { headers: { "x-internal-secret": "top-secret" } };
		const res = mockRes();
		const next = jest.fn();

		requireInternalSecret(req, res, next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(res.status).not.toHaveBeenCalled();
	});

	test("rejects with 401 when the header is missing", () => {
		process.env.INTERNAL_SERVICE_SECRET = "top-secret";
		const req = { headers: {} };
		const res = mockRes();
		const next = jest.fn();

		requireInternalSecret(req, res, next);

		expect(next).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(401);
		expect(res.json).toHaveBeenCalledWith(
			expect.objectContaining({ message: expect.any(String) }),
		);
	});

	test("rejects with 401 when the header doesn't match the configured secret", () => {
		process.env.INTERNAL_SERVICE_SECRET = "top-secret";
		const req = { headers: { "x-internal-secret": "wrong-value" } };
		const res = mockRes();
		const next = jest.fn();

		requireInternalSecret(req, res, next);

		expect(next).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(401);
	});

	// Fail-closed: an unconfigured secret must never be treated as "no check
	// required" — otherwise deploying without the env var silently disables
	// the whole guard instead of blocking every request.
	test("rejects every request when INTERNAL_SERVICE_SECRET itself is unset, even with a matching empty header", () => {
		delete process.env.INTERNAL_SERVICE_SECRET;
		const req = { headers: { "x-internal-secret": "" } };
		const res = mockRes();
		const next = jest.fn();

		requireInternalSecret(req, res, next);

		expect(next).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(401);
	});
});
