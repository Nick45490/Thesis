/**
 * Checks how many real user scan photos exist in user_collections.scan_photo,
 * and how they're distributed across generations — the actual data needed to
 * decide whether feeding real scans back into the AI training pipeline
 * (closing the stock-photo-vs-real-photo domain gap) is worth building now,
 * or something to revisit once usage grows.
 *
 * Run from the collection-service directory so it picks up its own .env and
 * node_modules (same DATABASE_URL collection-service itself uses):
 *   cd collection-service
 *   node scripts/check-real-scans.js
 */

require("dotenv").config();
const { Pool } = require("pg");
const path = require("path");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
	const totalRes = await pool.query(`SELECT COUNT(*)::int AS n FROM user_collections`);
	const withScanRes = await pool.query(
		`SELECT COUNT(*)::int AS n FROM user_collections WHERE scan_photo IS NOT NULL`
	);
	const perGenRes = await pool.query(
		`SELECT generation_id, COUNT(*)::int AS n
		 FROM user_collections
		 WHERE scan_photo IS NOT NULL
		 GROUP BY generation_id
		 ORDER BY n DESC`
	);

	const total = totalRes.rows[0].n;
	const withScan = withScanRes.rows[0].n;
	const distinctGenerations = perGenRes.rows.length;

	console.log(`Total collection items: ${total}`);
	console.log(`Items with a real scan photo: ${withScan} (${total ? (withScan / total * 100).toFixed(1) : 0}%)`);
	console.log(`Distinct generations with at least one real scan: ${distinctGenerations} / 813 catalogue generations`);
	console.log();

	if (distinctGenerations === 0) {
		console.log("No real scan photos found — the domain-matched-data pipeline isn't worth building yet.");
		await pool.end();
		return;
	}

	// Cross-reference against catalogue data for human-readable names
	const catalogue = require(path.join(__dirname, "../../catalogue-service/seed/data.json"));
	const modelById = Object.fromEntries(catalogue.models.map((m) => [m.id, m]));
	const mfrById = Object.fromEntries(catalogue.manufacturers.map((m) => [m.id, m]));
	const genById = Object.fromEntries(catalogue.generations.map((g) => [g.id, g]));

	function label(generationId) {
		const gen = genById[generationId];
		if (!gen) return `(unknown generation id ${generationId})`;
		const model = modelById[gen.modelId];
		const mfr = model ? mfrById[model.manufacturerId] : null;
		return `${mfr ? mfr.name : "?"} ${model ? model.name : "?"} (${gen.code})`;
	}

	const counts = perGenRes.rows.map((r) => r.n);
	const distribution = {};
	for (const n of counts) distribution[n] = (distribution[n] || 0) + 1;

	console.log("Real scans per generation (how many generations have N real scans):");
	for (const n of Object.keys(distribution).sort((a, b) => a - b)) {
		console.log(`  ${n} scan(s): ${distribution[n]} generation(s)`);
	}

	console.log("\nTop 20 generations by real scan count:");
	for (const row of perGenRes.rows.slice(0, 20)) {
		console.log(`  ${row.n}x  ${label(row.generation_id)}`);
	}

	const usableForAugmentation = counts.filter((n) => n >= 3).length;
	console.log(`\nGenerations with >= 3 real scans (a plausible minimum to actually help that class's embedding): ${usableForAugmentation}`);

	await pool.end();
}

main().catch((err) => {
	console.error("Failed:", err.message);
	process.exit(1);
});
