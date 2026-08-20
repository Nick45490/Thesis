const { applyIdentityHeaders, sanitizePrefix } = require("../routes");

function mockProxyReq() {
	const headers = {};
	return {
		headers,
		removeHeader: jest.fn((name) => { delete headers[name]; }),
		setHeader: jest.fn((name, value) => { headers[name] = value; }),
	};
}

describe("sanitizePrefix", () => {
	test("strips trailing slashes", () => {
		expect(sanitizePrefix("/auth/")).toBe("/auth");
		expect(sanitizePrefix("/auth///")).toBe("/auth");
	});

	test("leaves a prefix with no trailing slash unchanged", () => {
		expect(sanitizePrefix("/auth")).toBe("/auth");
	});
});

describe("applyIdentityHeaders", () => {
	const ORIGINAL_SECRET = process.env.INTERNAL_SERVICE_SECRET;

	afterEach(() => {
		process.env.INTERNAL_SERVICE_SECRET = ORIGINAL_SECRET;
	});

	test("strips a caller-supplied x-user-id/x-user-email on an unauthenticated (public) route", () => {
		delete process.env.INTERNAL_SERVICE_SECRET;
		const proxyReq = mockProxyReq();
		proxyReq.headers["x-user-id"] = "attacker-supplied-id";
		proxyReq.headers["x-user-email"] = "attacker@evil.com";
		const req = { headers: {} }; // no req.user — never went through requireAuth

		applyIdentityHeaders(proxyReq, req);

		expect(proxyReq.removeHeader).toHaveBeenCalledWith("x-user-id");
		expect(proxyReq.removeHeader).toHaveBeenCalledWith("x-user-email");
		expect(proxyReq.setHeader).not.toHaveBeenCalledWith("x-user-id", expect.anything());
		expect(proxyReq.setHeader).not.toHaveBeenCalledWith("x-user-email", expect.anything());
	});

	test("sets x-user-id/x-user-email from the JWT-verified req.user on a protected route", () => {
		delete process.env.INTERNAL_SERVICE_SECRET;
		const proxyReq = mockProxyReq();
		const req = { user: { id: "user-123", email: "real@user.com" } };

		applyIdentityHeaders(proxyReq, req);

		expect(proxyReq.headers["x-user-id"]).toBe("user-123");
		expect(proxyReq.headers["x-user-email"]).toBe("real@user.com");
	});

	test("always strips before re-adding, so a spoofed header can't survive alongside the real one", () => {
		delete process.env.INTERNAL_SERVICE_SECRET;
		const proxyReq = mockProxyReq();
		proxyReq.headers["x-user-id"] = "attacker-supplied-id";
		const req = { user: { id: "real-user-id" } };

		applyIdentityHeaders(proxyReq, req);

		const removeOrder = proxyReq.removeHeader.mock.invocationCallOrder[0];
		const setOrder = proxyReq.setHeader.mock.invocationCallOrder[0];
		expect(removeOrder).toBeLessThan(setOrder);
		expect(proxyReq.headers["x-user-id"]).toBe("real-user-id");
	});

	test("attaches x-internal-secret from the environment when configured", () => {
		process.env.INTERNAL_SERVICE_SECRET = "shared-secret";
		const proxyReq = mockProxyReq();
		const req = { headers: {} };

		applyIdentityHeaders(proxyReq, req);

		expect(proxyReq.headers["x-internal-secret"]).toBe("shared-secret");
	});

	test("omits x-internal-secret entirely when unconfigured", () => {
		delete process.env.INTERNAL_SERVICE_SECRET;
		const proxyReq = mockProxyReq();
		const req = { headers: {} };

		applyIdentityHeaders(proxyReq, req);

		expect(proxyReq.headers["x-internal-secret"]).toBeUndefined();
	});
});
