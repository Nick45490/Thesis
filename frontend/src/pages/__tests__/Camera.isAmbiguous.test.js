import { describe, expect, test } from "vitest";
import { isAmbiguous } from "../Camera";

// isAmbiguous is the confirm-UX gate calibrated this session against
// ai-service/evaluate.py's real confidenceStats/threshold sweep (see the
// comment above it in Camera.jsx) — it's the difference between a wrong scan
// silently landing in someone's collection and them getting a picker to
// correct it. A silent regression here would be much harder to notice than
// a failing test.
describe("isAmbiguous", () => {
	test("not ambiguous when top-1 is confident and clearly ahead of top-2", () => {
		const candidates = [{ confidence: 0.8 }, { confidence: 0.3 }];
		expect(isAmbiguous(candidates)).toBe(false);
	});

	test("ambiguous when top-1 confidence is below the 0.30 floor, even with no close second place", () => {
		const candidates = [{ confidence: 0.25 }];
		expect(isAmbiguous(candidates)).toBe(true);
	});

	test("not ambiguous when top-1 is exactly at the 0.30 floor", () => {
		const candidates = [{ confidence: 0.3 }];
		expect(isAmbiguous(candidates)).toBe(false);
	});

	test("ambiguous when top-2 is within the 0.6 ratio of top-1", () => {
		// top-2 (0.5) / top-1 (0.8) = 0.625 >= 0.6
		const candidates = [{ confidence: 0.8 }, { confidence: 0.5 }];
		expect(isAmbiguous(candidates)).toBe(true);
	});

	test("not ambiguous when top-2 is just below the 0.6 ratio of top-1", () => {
		// top-2 (0.47) / top-1 (0.8) = 0.5875 < 0.6
		const candidates = [{ confidence: 0.8 }, { confidence: 0.47 }];
		expect(isAmbiguous(candidates)).toBe(false);
	});

	test("false for an empty, null, or non-array candidate list, never a crash", () => {
		expect(isAmbiguous([])).toBe(false);
		expect(isAmbiguous(null)).toBe(false);
		expect(isAmbiguous(undefined)).toBe(false);
	});

	test("only the low-confidence-floor check applies with a single candidate", () => {
		const candidates = [{ confidence: 0.9 }];
		expect(isAmbiguous(candidates)).toBe(false);
	});
});
