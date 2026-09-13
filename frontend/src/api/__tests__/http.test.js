import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { apiFetch } from "../http";

function mockFetchOnce(status, body) {
	global.fetch = vi.fn().mockResolvedValue({
		ok: status >= 200 && status < 300,
		status,
		json: () => Promise.resolve(body)
	});
}

describe("apiFetch", () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("attaches the sessionStorage token as a Bearer header", async () => {
		sessionStorage.setItem("thesis_token", "abc123");
		mockFetchOnce(200, { ok: true });

		await apiFetch("/some/path");

		const [, options] = global.fetch.mock.calls[0];
		expect(options.headers.Authorization).toBe("Bearer abc123");
	});

	test("sends no Authorization header when there's no stored token", async () => {
		mockFetchOnce(200, { ok: true });

		await apiFetch("/some/path");

		const [, options] = global.fetch.mock.calls[0];
		expect(options.headers.Authorization).toBeUndefined();
	});

	test("doesn't override an explicitly-passed Authorization header", async () => {
		sessionStorage.setItem("thesis_token", "abc123");
		mockFetchOnce(200, { ok: true });

		await apiFetch("/some/path", { headers: { Authorization: "Bearer explicit" } });

		const [, options] = global.fetch.mock.calls[0];
		expect(options.headers.Authorization).toBe("Bearer explicit");
	});

	test("sets Content-Type: application/json for a plain object body", async () => {
		mockFetchOnce(200, {});

		await apiFetch("/some/path", { method: "POST", body: "{}" });

		const [, options] = global.fetch.mock.calls[0];
		expect(options.headers["Content-Type"]).toBe("application/json");
	});

	test("omits Content-Type for a FormData body, letting the browser set the boundary", async () => {
		mockFetchOnce(200, {});

		await apiFetch("/upload", { method: "POST", body: new FormData() });

		const [, options] = global.fetch.mock.calls[0];
		expect(options.headers["Content-Type"]).toBeUndefined();
	});

	test("returns the parsed JSON body on success", async () => {
		mockFetchOnce(200, { message: "hello" });

		const result = await apiFetch("/some/path");

		expect(result).toEqual({ message: "hello" });
	});

	test("throws using the response's message field on failure", async () => {
		mockFetchOnce(400, { message: "Bad request" });

		await expect(apiFetch("/some/path")).rejects.toThrow("Bad request");
	});

	test("falls back to the detail field when message is absent", async () => {
		// ai-service's error responses use `detail`, not `message` — both
		// must surface correctly to the caller.
		mockFetchOnce(400, { detail: "Invalid image" });

		await expect(apiFetch("/some/path")).rejects.toThrow("Invalid image");
	});

	test("falls back to a generic status message when the body has neither", async () => {
		mockFetchOnce(500, {});

		await expect(apiFetch("/some/path")).rejects.toThrow("Request failed with status 500");
	});

	test("doesn't throw when the response body isn't valid JSON", async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: () => Promise.reject(new Error("not json"))
		});

		await expect(apiFetch("/some/path")).resolves.toEqual({});
	});
});
