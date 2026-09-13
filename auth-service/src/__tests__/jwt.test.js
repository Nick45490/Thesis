const jwt = require("jsonwebtoken");
const { requireAuth, signUserToken, verifyWithRotation } = require("../jwt");

const SECRET = "test-jwt-secret";

function mockRes() {
	const res = {};
	res.status = jest.fn().mockReturnValue(res);
	res.json = jest.fn().mockReturnValue(res);
	return res;
}

describe("signUserToken", () => {
	const ORIGINAL_SECRET = process.env.JWT_SECRET;

	afterEach(() => {
		process.env.JWT_SECRET = ORIGINAL_SECRET;
	});

	test("signs a token with the current secret containing the user's claims", () => {
		process.env.JWT_SECRET = SECRET;
		const token = signUserToken({ id: 42, email: "a@b.com", username: "alice" });
		const payload = jwt.verify(token, SECRET);

		expect(payload.sub).toBe("42");
		expect(payload.email).toBe("a@b.com");
		expect(payload.username).toBe("alice");
	});

	test("throws when JWT_SECRET is not configured", () => {
		delete process.env.JWT_SECRET;
		expect(() => signUserToken({ id: 1, email: "a@b.com", username: "alice" })).toThrow();
	});
});

describe("verifyWithRotation", () => {
	test("verifies with the current secret", () => {
		const token = jwt.sign({ sub: "1" }, "current");
		expect(verifyWithRotation(token, "current", "previous").sub).toBe("1");
	});

	test("falls back to the previous secret when verification with the current one fails", () => {
		const token = jwt.sign({ sub: "1" }, "previous");
		expect(verifyWithRotation(token, "current", "previous").sub).toBe("1");
	});

	test("throws when the token matches neither secret", () => {
		const token = jwt.sign({ sub: "1" }, "some-other-secret");
		expect(() => verifyWithRotation(token, "current", "previous")).toThrow();
	});

	test("throws immediately (no fallback) when no previous secret is given", () => {
		const token = jwt.sign({ sub: "1" }, "previous");
		expect(() => verifyWithRotation(token, "current", undefined)).toThrow();
	});
});

describe("requireAuth", () => {
	const ORIGINAL_SECRET = process.env.JWT_SECRET;
	const ORIGINAL_PREVIOUS = process.env.JWT_SECRET_PREVIOUS;

	afterEach(() => {
		process.env.JWT_SECRET = ORIGINAL_SECRET;
		process.env.JWT_SECRET_PREVIOUS = ORIGINAL_PREVIOUS;
	});

	test("accepts a valid token and populates req.auth", () => {
		process.env.JWT_SECRET = SECRET;
		const token = signUserToken({ id: 7, email: "a@b.com", username: "alice" });
		const req = { headers: { authorization: `Bearer ${token}` } };
		const res = mockRes();
		const next = jest.fn();

		requireAuth(req, res, next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(req.auth).toEqual({ userId: 7, email: "a@b.com", username: "alice" });
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

	test("rejects with 401 when the scheme isn't Bearer", () => {
		process.env.JWT_SECRET = SECRET;
		const req = { headers: { authorization: "Basic abc" } };
		const res = mockRes();
		const next = jest.fn();

		requireAuth(req, res, next);

		expect(next).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(401);
	});

	test("rejects with 401 on a token signed with the wrong secret", () => {
		process.env.JWT_SECRET = SECRET;
		const token = jwt.sign({ sub: "1" }, "a-different-secret");
		const req = { headers: { authorization: `Bearer ${token}` } };
		const res = mockRes();
		const next = jest.fn();

		requireAuth(req, res, next);

		expect(next).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(401);
	});

	// Fail-closed: a misconfigured service (no JWT_SECRET) must reject every
	// protected request, not silently accept them or crash unverified.
	test("rejects with 500 when JWT_SECRET is unconfigured, even with a well-formed token", () => {
		process.env.JWT_SECRET = SECRET;
		const token = jwt.sign({ sub: "1" }, SECRET);
		delete process.env.JWT_SECRET;
		const req = { headers: { authorization: `Bearer ${token}` } };
		const res = mockRes();
		const next = jest.fn();

		requireAuth(req, res, next);

		expect(next).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(500);
	});

	// The following four cover rotation: JWT_SECRET_PREVIOUS lets tokens
	// issued before a secret rotation keep working until they naturally
	// expire, instead of logging out every active session the instant the
	// secret changes.
	test("accepts a token signed with the current secret even while a previous one is also configured", () => {
		process.env.JWT_SECRET = "new-secret";
		process.env.JWT_SECRET_PREVIOUS = "old-secret";
		const token = jwt.sign({ sub: "1" }, "new-secret");
		const req = { headers: { authorization: `Bearer ${token}` } };
		const res = mockRes();
		const next = jest.fn();

		requireAuth(req, res, next);

		expect(next).toHaveBeenCalledTimes(1);
	});

	test("accepts a token signed with the previous secret during a rotation window", () => {
		process.env.JWT_SECRET = "new-secret";
		process.env.JWT_SECRET_PREVIOUS = "old-secret";
		const token = jwt.sign({ sub: "1" }, "old-secret");
		const req = { headers: { authorization: `Bearer ${token}` } };
		const res = mockRes();
		const next = jest.fn();

		requireAuth(req, res, next);

		expect(next).toHaveBeenCalledTimes(1);
	});

	test("rejects a token signed with neither the current nor the previous secret", () => {
		process.env.JWT_SECRET = "new-secret";
		process.env.JWT_SECRET_PREVIOUS = "old-secret";
		const token = jwt.sign({ sub: "1" }, "some-other-secret");
		const req = { headers: { authorization: `Bearer ${token}` } };
		const res = mockRes();
		const next = jest.fn();

		requireAuth(req, res, next);

		expect(next).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(401);
	});

	test("an unset previous secret doesn't relax the check — still fails closed", () => {
		process.env.JWT_SECRET = "new-secret";
		delete process.env.JWT_SECRET_PREVIOUS;
		const token = jwt.sign({ sub: "1" }, "old-secret");
		const req = { headers: { authorization: `Bearer ${token}` } };
		const res = mockRes();
		const next = jest.fn();

		requireAuth(req, res, next);

		expect(next).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(401);
	});
});
