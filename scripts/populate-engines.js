/**
 * Populates engine data for every generation in catalogue-service/seed/data.json
 * using the Claude API (claude-haiku). No npm install needed — uses built-in https.
 *
 * Usage:
 *   $env:ANTHROPIC_API_KEY = "sk-ant-..."
 *   node scripts/populate-engines.js
 *
 * Safe to re-run — already-populated generations are skipped.
 * Saves progress every 50 entries. Writes missing_engines.json at the end.
 */

const https = require("https");
const fs    = require("fs");
const path  = require("path");

const DATA_PATH    = path.join(__dirname, "../catalogue-service/seed/data.json");
const MISSING_PATH = path.join(__dirname, "../missing_engines.json");

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL   = "claude-haiku-4-5-20251001";
const DELAY   = 120; // ms between requests

const SYSTEM_PROMPT = `You are a car specifications database. Given a car's manufacturer, model, generation code, year range, and drivetrain, return realistic engine variants actually offered for that generation in European/world markets.

Return ONLY a raw JSON array of 3-4 engine objects with exactly these fields:
- name: string  (e.g. "1.4 TSI 150hp", "2.0 TDI 184hp", "Electric 204hp")
- fuelType: "petrol" | "diesel" | "hybrid" | "electric"
- horsepower: integer (PS)
- torqueNm: integer (Nm)
- weightKg: integer (curb weight in kg for that engine variant)

Rules:
- Cover the range: base, mid, top power options
- Include diesel if sold with diesels in Europe
- Include electric/hybrid only if that generation actually had one
- Weight must vary per engine (heavier engines = heavier car, ~30-80kg difference)
- No markdown, no explanation — only the JSON array`;

// ---------------------------------------------------------------------------

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

function callClaude(userMessage) {
	return new Promise((resolve, reject) => {
		const body = JSON.stringify({
			model:      MODEL,
			max_tokens: 1024,
			system: [
				{
					type:          "text",
					text:          SYSTEM_PROMPT,
					cache_control: { type: "ephemeral" },
				},
			],
			messages: [{ role: "user", content: userMessage }],
		});

		const req = https.request(
			{
				hostname: "api.anthropic.com",
				path:     "/v1/messages",
				method:   "POST",
				headers:  {
					"content-type":      "application/json",
					"x-api-key":         API_KEY,
					"anthropic-version": "2023-06-01",
					"anthropic-beta":    "prompt-caching-2024-07-31",
				},
				timeout: 30000,
			},
			(res) => {
				let raw = "";
				res.on("data", (c) => (raw += c));
				res.on("end", () => {
					try {
						const parsed = JSON.parse(raw);
						if (parsed.error) return reject(new Error(parsed.error.message));
						resolve(parsed);
					} catch (e) {
						reject(e);
					}
				});
			}
		);

		req.on("error",   reject);
		req.on("timeout", () => { req.destroy(); reject(new Error("request timeout")); });
		req.write(body);
		req.end();
	});
}

function extractEngines(response) {
	const text = response?.content?.[0]?.text?.trim() ?? "";
	// Strip markdown fences if model adds them despite instructions
	const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
	return JSON.parse(json);
}

function validate(engines) {
	if (!Array.isArray(engines) || engines.length < 2) return false;
	const fuels = new Set(["petrol", "diesel", "hybrid", "electric"]);
	return engines.every(
		(e) =>
			typeof e.name       === "string" && e.name.length > 0 &&
			fuels.has(e.fuelType) &&
			Number.isInteger(e.horsepower) && e.horsepower > 0 &&
			Number.isInteger(e.torqueNm)   && e.torqueNm   > 0 &&
			Number.isInteger(e.weightKg)   && e.weightKg   > 0
	);
}

// ---------------------------------------------------------------------------

async function main() {
	if (!API_KEY) {
		console.error("Set ANTHROPIC_API_KEY before running:\n  $env:ANTHROPIC_API_KEY = \"sk-ant-...\"");
		process.exit(1);
	}

	const data     = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
	const mfrById  = Object.fromEntries(data.manufacturers.map((m) => [m.id, m]));
	const modById  = Object.fromEntries(data.models.map((m) => [m.id, m]));

	const missing  = [];
	let populated  = 0;
	let skipped    = 0;
	const total    = data.generations.length;

	console.log(`Populating engines for ${total} generations via Claude API...\n`);

	for (let i = 0; i < data.generations.length; i++) {
		const gen = data.generations[i];
		const mod = modById[gen.modelId];
		const mfr = mfrById[mod.manufacturerId];
		const tag = `[${String(i + 1).padStart(3)}/${total}] ${mfr.name} ${mod.name} ${gen.code} (${gen.startYear})`;

		process.stdout.write(`${tag} ... `);

		// Skip already populated
		if (gen.engines && gen.engines.length >= 2) {
			console.log("skipped.");
			skipped++;
			continue;
		}

		const yearRange = gen.endYear ? `${gen.startYear}–${gen.endYear}` : `${gen.startYear}–present`;
		const prompt    = `Manufacturer: ${mfr.name}\nModel: ${mod.name}\nGeneration: ${gen.code}\nYears: ${yearRange}\nDrivetrain: ${gen.drivetrain}`;

		try {
			const response = await callClaude(prompt);
			const engines  = extractEngines(response);

			if (validate(engines)) {
				gen.engines = engines;
				populated++;
				console.log(`${engines.length} engines.`);
			} else {
				console.log("invalid format.");
				missing.push({ generationId: gen.id, manufacturer: mfr.name, model: mod.name, generation: gen.code, year: gen.startYear, reason: "invalid response format" });
			}
		} catch (err) {
			console.log(`error: ${err.message}`);
			missing.push({ generationId: gen.id, manufacturer: mfr.name, model: mod.name, generation: gen.code, year: gen.startYear, reason: err.message });
		}

		await sleep(DELAY);

		// Checkpoint every 50
		if ((i + 1) % 50 === 0) {
			fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
			console.log(`\n  ── checkpoint saved (${i + 1}/${total}) ──\n`);
		}
	}

	// Final save
	fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
	fs.writeFileSync(MISSING_PATH, JSON.stringify(missing, null, 2));

	console.log("\n════════════════════════════════════════");
	console.log(`Total      : ${total}`);
	console.log(`Populated  : ${populated}`);
	console.log(`Skipped    : ${skipped}`);
	console.log(`Failed     : ${missing.length}`);
	console.log("════════════════════════════════════════");

	if (missing.length > 0) {
		console.log("\nGenerations without engine data:");
		missing.forEach((m) =>
			console.log(`  - ${m.manufacturer} ${m.model} ${m.generation} (${m.year}) — ${m.reason}`)
		);
		console.log(`\nFull list → ${MISSING_PATH}`);
	}

	const cost = ((populated * 200 * 0.25) + (populated * 400 * 1.25)) / 1_000_000;
	console.log(`\nEstimated API cost: ~$${cost.toFixed(3)}`);
}

main().catch((err) => {
	console.error("Fatal:", err.message);
	process.exit(1);
});
