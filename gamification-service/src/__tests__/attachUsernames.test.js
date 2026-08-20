const { attachUsernames } = require("../db");

describe("attachUsernames", () => {
	const challenge = {
		id: 1,
		challengerUserId: 10,
		challengerUsername: null,
		opponentUserId: 20,
		opponentUsername: null,
	};

	test("fills in both usernames when both are present in the map", () => {
		const usernamesById = { 10: { username: "alice" }, 20: { username: "bob" } };

		const result = attachUsernames(challenge, usernamesById);

		expect(result.challengerUsername).toBe("alice");
		expect(result.opponentUsername).toBe("bob");
	});

	test("leaves a username null when its id is missing from the map (e.g. auth-service was unreachable)", () => {
		const usernamesById = { 10: { username: "alice" } }; // opponent missing

		const result = attachUsernames(challenge, usernamesById);

		expect(result.challengerUsername).toBe("alice");
		expect(result.opponentUsername).toBeNull();
	});

	test("doesn't mutate the original challenge object", () => {
		const usernamesById = { 10: { username: "alice" }, 20: { username: "bob" } };

		attachUsernames(challenge, usernamesById);

		expect(challenge.challengerUsername).toBeNull();
		expect(challenge.opponentUsername).toBeNull();
	});

	test("preserves every other field on the challenge unchanged", () => {
		const result = attachUsernames(challenge, {});

		expect(result.id).toBe(1);
		expect(result.challengerUserId).toBe(10);
		expect(result.opponentUserId).toBe(20);
	});
});
