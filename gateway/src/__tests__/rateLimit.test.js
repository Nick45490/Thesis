const { userKeyGenerator } = require("../rateLimit");

describe("userKeyGenerator", () => {
	test("keys by the authenticated user's id when present", () => {
		const req = { user: { id: "user-123" }, ip: "1.2.3.4" };
		expect(userKeyGenerator(req)).toBe("user:user-123");
	});

	test("two different users get two different keys, even from the same IP", () => {
		const reqA = { user: { id: "user-A" }, ip: "1.2.3.4" };
		const reqB = { user: { id: "user-B" }, ip: "1.2.3.4" };
		expect(userKeyGenerator(reqA)).not.toBe(userKeyGenerator(reqB));
	});

	test("the same user gets the same key regardless of IP", () => {
		const reqFromIpA = { user: { id: "user-123" }, ip: "1.2.3.4" };
		const reqFromIpB = { user: { id: "user-123" }, ip: "5.6.7.8" };
		expect(userKeyGenerator(reqFromIpA)).toBe(userKeyGenerator(reqFromIpB));
	});

	// Defensive fallback only — every route this is applied to already runs
	// requireAuth first, so req.user should always be set in practice. This
	// just guarantees a missing req.user degrades to IP-keying rather than
	// silently sharing one "undefined" bucket across every such request.
	test("falls back to the client IP when req.user is missing", () => {
		const req = { ip: "9.9.9.9" };
		expect(userKeyGenerator(req)).toBe("9.9.9.9");
	});
});
