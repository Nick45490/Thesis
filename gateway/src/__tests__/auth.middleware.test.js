const jwt = require("jsonwebtoken");
const { requireAuth, getTokenFromHeader } = require("../auth.middleware");

const SECRET = "test-jwt-secret";

function mockRes() {
	const res = {};
	res.status = jest.fn().mockReturnValue(res);
	res.json = jest.fn().mockReturnValue(res);
	return res;
}

describe("getTokenFromHeader", () => {
	test("extracts the token from a well-formed Bearer header", () => {
		expect(getTokenFromHeader("Bearer abc.def.ghi")).toBe("abc.def.ghi");
	});

	test("is case-insensitive on the scheme", () => {
		expect(getTokenFromHeader("bearer abc.def.ghi")).toBe("abc.def.ghi");
	});

	test("returns null when the header is missing", () => {
		expect(getTokenFromHeader(undefined)).toBeNull();
		expect(getTokenFromHeader(null)).toBeNull();
		expect(getTokenFromHeader("")).toBeNull();
	});

	test("returns null when the scheme isn't Bearer", () => {
		expect(getTokenFromHeader("Basic abc.def.ghi")).toBeNull();
	});

	test("returns null when there's a scheme but no token", () => {
		expect(getTokenFromHeader("Bearer")).toBeNull();
		expect(getTokenFromHeader("Bearer ")).toBeNull();
	});
});

describe("requireAuth", () => {
	const ORIGINAL_SECRET = process.env.JWT_SECRET;

	afterEach(() => {
		process.env.JWT_SECRET = ORIGINAL_SECRET;
	});

	test("accepts a valid token and populates req.user from standard claims", () => {
		process.env.JWT_SECRET = SECRET;
		const token = jwt.sign({ sub: "user-123", email: "a@b.com", roles: ["user"] }, SECRET);
		const req = { headers: { authorization: `Bearer ${token}` } };
		const res = mockRes();
		const next = jest.fn();

		requireAuth(req, res, next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(req.user).toEqual({ id: "user-123", email: "a@b.com", roles: ["user"] });
	});

	test("falls back through id/userId claim names when sub is absent", () => {
		process.env.JWT_SECRET = SECRET;
		const token = jwt.sign({ userId: "user-456" }, SECRET);
		const req = { headers: { authorization: `Bearer ${token}` } };
		const res = mockRes();
		const next = jest.fn();

		requireAuth(req, res, next);

		expect(req.user.id).toBe("user-456");
	});

	test("rejects with 401 when the authorization header is missing", () => {
		process.env.JWT_SECRET = SECRET;
		const req = { headers: {} };
		const res = mockRes();
		const next = jest.fn();

		requireAuth(req, res, next);

		expect(next).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(401);
	});

	test("rejects with 401 on an expired token", () => {
		process.env.JWT_SECRET = SECRET;
		const token = jwt.sign({ sub: "user-123" }, SECRET, { expiresIn: -10 });
		const req = { headers: { authorization: `Bearer ${token}` } };
		const res = mockRes();
		const next = jest.fn();

		requireAuth(req, res, next);

		expect(next).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(401);
	});

	test("rejects with 401 on a token signed with the wrong secret", () => {
		process.env.JWT_SECRET = SECRET;
		const token = jwt.sign({ sub: "user-123" }, "a-different-secret");
		const req = { headers: { authorization: `Bearer ${token}` } };
		const res = mockRes();
		const next = jest.fn();

		requireAuth(req, res, next);

		expect(next).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(401);
	});

	// Fail-closed: a misconfigured gateway (no JWT_SECRET) must reject every
	// protected request, not silently accept them or crash unverified.
	test("rejects with 500 when JWT_SECRET is unconfigured, even with a well-formed token", () => {
		delete process.env.JWT_SECRET;
		const token = jwt.sign({ sub: "user-123" }, SECRET);
		const req = { headers: { authorization: `Bearer ${token}` } };
		const res = mockRes();
		const next = jest.fn();

		requireAuth(req, res, next);

		expect(next).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(500);
	});
});
