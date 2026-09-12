const { Pool } = require("pg");
const { buildCollectionCatalogue } = require("./achievementEmitter");
const { getCarRarity } = require("./rarity");

const pool = new Pool({
	connectionString: process.env.DATABASE_URL
});

let initialized = false;

// Used by /health so a dead DB connection actually shows up there instead
// of a static "ok" that's true regardless of whether the database answers.
async function checkDbHealth() {
	await pool.query("SELECT 1");
}

// Used on graceful shutdown so the process doesn't exit with open DB
// connections mid-close.
async function closePool() {
	await pool.end();
}

async function initDb() {
	if (initialized) {
		return;
	}

	await pool.query(`
		CREATE TABLE IF NOT EXISTS user_collections (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL,
			generation_id INTEGER NOT NULL,
			manufacturer_name VARCHAR(120) NOT NULL,
			model_name VARCHAR(120) NOT NULL,
			generation_code VARCHAR(120) NOT NULL,
			engine_name VARCHAR(120),
			engine_fuel_type VARCHAR(20),
			engine_horsepower INTEGER,
			engine_torque_nm INTEGER,
			engine_weight_kg INTEGER,
			discovered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			UNIQUE (user_id, generation_id)
		)
	`);

	await pool.query(`
		ALTER TABLE user_collections
			ADD COLUMN IF NOT EXISTS engine_name VARCHAR(120),
			ADD COLUMN IF NOT EXISTS engine_fuel_type VARCHAR(20),
			ADD COLUMN IF NOT EXISTS engine_horsepower INTEGER,
			ADD COLUMN IF NOT EXISTS engine_torque_nm INTEGER,
			ADD COLUMN IF NOT EXISTS engine_weight_kg INTEGER
	`);

	await pool.query(`
		ALTER TABLE user_collections
			ADD COLUMN IF NOT EXISTS scan_photo TEXT
	`);

	await pool.query(`
		ALTER TABLE user_collections
			ADD COLUMN IF NOT EXISTS drivetrain VARCHAR(20)
	`);

	await pool.query(`
		CREATE TABLE IF NOT EXISTS collection_achievements (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL,
			code VARCHAR(80) NOT NULL,
			title VARCHAR(120) NOT NULL,
			unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			UNIQUE (user_id, code)
		)
	`);

	initialized = true;
}

function mapCollectionRow(row) {
	const engine = row.engine_name ? {
		name:       row.engine_name,
		fuelType:   row.engine_fuel_type,
		horsepower: row.engine_horsepower,
		torqueNm:   row.engine_torque_nm,
		weightKg:   row.engine_weight_kg,
	} : null;
	return {
		generationId:     row.generation_id,
		manufacturerName: row.manufacturer_name,
		modelName:        row.model_name,
		generationCode:   row.generation_code,
		scanPhoto:        row.scan_photo || null,
		engine,
		drivetrain: row.drivetrain || null,
		rarity: engine ? getCarRarity(engine.horsepower, engine.weightKg) : "common",
		discoveredAt: row.discovered_at,
	};
}

async function listCollection(userId) {
	const result = await pool.query(
		`SELECT generation_id, manufacturer_name, model_name, generation_code,
		        engine_name, engine_fuel_type, engine_horsepower, engine_torque_nm, engine_weight_kg,
		        drivetrain, scan_photo, discovered_at
		 FROM user_collections
		 WHERE user_id = $1
		 ORDER BY discovered_at DESC`,
		[Number(userId)]
	);
	return result.rows.map(mapCollectionRow);
}

async function addCollectionItem(userId, item) {
	const engine = item.engine || {};

	// ON CONFLICT DO NOTHING makes the existence check atomic — two concurrent
	// scans of the same car no longer race between a SELECT and an INSERT.
	const inserted = await pool.query(
		`INSERT INTO user_collections
		   (user_id, generation_id, manufacturer_name, model_name, generation_code,
		    engine_name, engine_fuel_type, engine_horsepower, engine_torque_nm, engine_weight_kg,
		    drivetrain, scan_photo)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		 ON CONFLICT (user_id, generation_id) DO NOTHING
		 RETURNING generation_id, manufacturer_name, model_name, generation_code,
		           engine_name, engine_fuel_type, engine_horsepower, engine_torque_nm, engine_weight_kg,
		           drivetrain, scan_photo, discovered_at`,
		[
			Number(userId), Number(item.generationId),
			item.manufacturerName, item.modelName, item.generationCode,
			engine.name       || null,
			engine.fuelType   || null,
			engine.horsepower || null,
			engine.torqueNm   || null,
			engine.weightKg   || null,
			item.drivetrain   || null,
			item.scanPhoto    || null,
		]
	);

	if (inserted.rowCount > 0) {
		return { created: true, item: mapCollectionRow(inserted.rows[0]) };
	}

	// Already collected — backfill anything the existing row is still missing
	// (e.g. it was added before engine/drivetrain existed, or before a photo
	// was captured) rather than leaving a rescan as a total no-op. COALESCE
	// only fills NULL columns, never overwrites already-populated data.
	const updated = await pool.query(
		`UPDATE user_collections SET
		   scan_photo        = COALESCE(user_collections.scan_photo, $1),
		   engine_name       = COALESCE(user_collections.engine_name, $2),
		   engine_fuel_type  = COALESCE(user_collections.engine_fuel_type, $3),
		   engine_horsepower = COALESCE(user_collections.engine_horsepower, $4),
		   engine_torque_nm  = COALESCE(user_collections.engine_torque_nm, $5),
		   engine_weight_kg  = COALESCE(user_collections.engine_weight_kg, $6),
		   drivetrain        = COALESCE(user_collections.drivetrain, $7)
		 WHERE user_id = $8 AND generation_id = $9
		 RETURNING generation_id, manufacturer_name, model_name, generation_code,
		           engine_name, engine_fuel_type, engine_horsepower, engine_torque_nm, engine_weight_kg,
		           drivetrain, scan_photo, discovered_at`,
		[
			item.scanPhoto    || null,
			engine.name       || null,
			engine.fuelType   || null,
			engine.horsepower || null,
			engine.torqueNm   || null,
			engine.weightKg   || null,
			item.drivetrain   || null,
			Number(userId), Number(item.generationId),
		]
	);

	return { created: false, item: mapCollectionRow(updated.rows[0]) };
}

async function removeCollectionItem(userId, generationId) {
	const result = await pool.query(
		`DELETE FROM user_collections WHERE user_id = $1 AND generation_id = $2`,
		[Number(userId), Number(generationId)]
	);

	return result.rowCount > 0;
}

async function getProgressStats(userId) {
	const result = await pool.query(
		`SELECT manufacturer_name, model_name, engine_horsepower, engine_weight_kg
		 FROM user_collections WHERE user_id = $1`,
		[Number(userId)]
	);

	const rows = result.rows;
	let legendary = 0, epic = 0, rare = 0;
	const seenMake  = new Set();
	const seenModel = new Set();

	for (const r of rows) {
		const make  = r.manufacturer_name;
		const model = r.model_name;
		seenMake.add(make.toLowerCase());
		seenModel.add((make + "::" + model).toLowerCase());
		const rarity = getCarRarity(r.engine_horsepower, r.engine_weight_kg);
		if      (rarity === "legendary") legendary++;
		else if (rarity === "epic")      epic++;
		else if (rarity === "rare")      rare++;
	}

	return {
		discoveredGenerations:    rows.length,
		discoveredModels:         seenModel.size,
		discoveredManufacturers:  seenMake.size,
		discoveredLegendary:      legendary,
		discoveredEpic:           epic,
		discoveredRare:           rare,
	};
}

async function unlockCollectionAchievements(userId, achievements) {
	// RETURNING tells us exactly which rows this call actually inserted, rather
	// than guessing from a wall-clock window — the old 2-second window could
	// both miss unlocks (slow request) and double-report them (two calls
	// landing within 2s of each other).
	const justUnlocked = [];
	for (const a of achievements) {
		const result = await pool.query(
			`INSERT INTO collection_achievements (user_id, code, title)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (user_id, code) DO NOTHING
			 RETURNING code`,
			[Number(userId), a.code, a.title]
		);
		if (result.rowCount > 0) justUnlocked.push(result.rows[0].code);
	}

	return justUnlocked;
}

async function getCollectionAchievementCatalogue(userId, progressStats) {
	const result = await pool.query(
		`SELECT code, unlocked_at FROM collection_achievements WHERE user_id = $1`,
		[Number(userId)]
	);
	const unlockedMap = Object.fromEntries(result.rows.map((r) => [r.code, r.unlocked_at]));
	return buildCollectionCatalogue(progressStats, unlockedMap);
}

async function getMakeCollectionCounts(userId) {
	const result = await pool.query(
		`SELECT manufacturer_name, COUNT(DISTINCT generation_id)::int AS cnt
		 FROM user_collections
		 WHERE user_id = $1
		 GROUP BY manufacturer_name`,
		[Number(userId)]
	);
	const counts = {};
	for (const row of result.rows) counts[row.manufacturer_name] = row.cnt;
	return counts;
}

async function getCompletionistUnlockedMap(userId) {
	const result = await pool.query(
		`SELECT code, unlocked_at FROM collection_achievements
		 WHERE user_id = $1 AND code LIKE 'COMPLETIONIST_%'`,
		[Number(userId)]
	);
	return Object.fromEntries(result.rows.map((r) => [r.code, r.unlocked_at]));
}

async function getCountryUnlockedMap(userId) {
	const result = await pool.query(
		`SELECT code, unlocked_at FROM collection_achievements
		 WHERE user_id = $1 AND code LIKE 'COUNTRY_%'`,
		[Number(userId)]
	);
	return Object.fromEntries(result.rows.map((r) => [r.code, r.unlocked_at]));
}

module.exports = {
	addCollectionItem,
	checkDbHealth,
	closePool,
	getCollectionAchievementCatalogue,
	getCompletionistUnlockedMap,
	getCountryUnlockedMap,
	getMakeCollectionCounts,
	getProgressStats,
	initDb,
	listCollection,
	removeCollectionItem,
	unlockCollectionAchievements
};
