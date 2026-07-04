const { Pool } = require("pg");
const { buildCollectionCatalogue } = require("./achievementEmitter");

const pool = new Pool({
	connectionString: process.env.DATABASE_URL
});

let initialized = false;

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
	return {
		generationId:     row.generation_id,
		manufacturerName: row.manufacturer_name,
		modelName:        row.model_name,
		generationCode:   row.generation_code,
		scanPhoto:        row.scan_photo || null,
		engine: row.engine_name ? {
			name:       row.engine_name,
			fuelType:   row.engine_fuel_type,
			horsepower: row.engine_horsepower,
			torqueNm:   row.engine_torque_nm,
			weightKg:   row.engine_weight_kg,
		} : null,
		discoveredAt: row.discovered_at,
	};
}

async function listCollection(userId) {
	const result = await pool.query(
		`SELECT generation_id, manufacturer_name, model_name, generation_code,
		        engine_name, engine_fuel_type, engine_horsepower, engine_torque_nm, engine_weight_kg,
		        scan_photo, discovered_at
		 FROM user_collections
		 WHERE user_id = $1
		 ORDER BY discovered_at DESC`,
		[Number(userId)]
	);
	return result.rows.map(mapCollectionRow);
}

async function addCollectionItem(userId, item) {
	const existing = await pool.query(
		`SELECT generation_id, manufacturer_name, model_name, generation_code,
		        engine_name, engine_fuel_type, engine_horsepower, engine_torque_nm, engine_weight_kg,
		        discovered_at
		 FROM user_collections
		 WHERE user_id = $1 AND generation_id = $2
		 LIMIT 1`,
		[Number(userId), Number(item.generationId)]
	);

	if (existing.rowCount > 0) {
		if (item.scanPhoto && !existing.rows[0].scan_photo) {
			const updated = await pool.query(
				`UPDATE user_collections SET scan_photo = $1
				 WHERE user_id = $2 AND generation_id = $3
				 RETURNING generation_id, manufacturer_name, model_name, generation_code,
				           engine_name, engine_fuel_type, engine_horsepower, engine_torque_nm, engine_weight_kg,
				           scan_photo, discovered_at`,
				[item.scanPhoto, Number(userId), Number(item.generationId)]
			);
			return { created: false, item: mapCollectionRow(updated.rows[0]) };
		}
		return { created: false, item: mapCollectionRow(existing.rows[0]) };
	}

	const engine = item.engine || {};
	const inserted = await pool.query(
		`INSERT INTO user_collections
		   (user_id, generation_id, manufacturer_name, model_name, generation_code,
		    engine_name, engine_fuel_type, engine_horsepower, engine_torque_nm, engine_weight_kg,
		    scan_photo)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		 RETURNING generation_id, manufacturer_name, model_name, generation_code,
		           engine_name, engine_fuel_type, engine_horsepower, engine_torque_nm, engine_weight_kg,
		           scan_photo, discovered_at`,
		[
			Number(userId), Number(item.generationId),
			item.manufacturerName, item.modelName, item.generationCode,
			engine.name       || null,
			engine.fuelType   || null,
			engine.horsepower || null,
			engine.torqueNm   || null,
			engine.weightKg   || null,
			item.scanPhoto    || null,
		]
	);

	return { created: true, item: mapCollectionRow(inserted.rows[0]) };
}

async function removeCollectionItem(userId, generationId) {
	const result = await pool.query(
		`DELETE FROM user_collections WHERE user_id = $1 AND generation_id = $2`,
		[Number(userId), Number(generationId)]
	);

	return result.rowCount > 0;
}

const LEGENDARY_MAKES = new Set([
	"Ferrari","Lamborghini","McLaren","Bugatti","Koenigsegg","Pagani","Rimac",
]);
const EPIC_MAKES = new Set([
	"Porsche","Aston Martin","Maserati","Lotus","De Tomaso","Bentley","Rolls-Royce",
]);
const RARE_MAKES = new Set([
	"BMW","Mercedes-Benz","Audi","Cadillac","Lexus","Genesis",
	"Dodge","Chevrolet","Volvo","Jaguar","Land Rover","Alfa Romeo",
	"Infiniti","Acura","Lincoln","Tesla",
]);

async function getProgressStats(userId) {
	const result = await pool.query(
		`SELECT manufacturer_name, model_name FROM user_collections WHERE user_id = $1`,
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
		if      (LEGENDARY_MAKES.has(make)) legendary++;
		else if (EPIC_MAKES.has(make))      epic++;
		else if (RARE_MAKES.has(make))      rare++;
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
	for (const a of achievements) {
		await pool.query(
			`INSERT INTO collection_achievements (user_id, code, title)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (user_id, code) DO NOTHING`,
			[Number(userId), a.code, a.title]
		);
	}

	const justUnlocked = await pool.query(
		`SELECT code, title, unlocked_at
		 FROM collection_achievements
		 WHERE user_id = $1 AND unlocked_at >= NOW() - INTERVAL '2 seconds'
		 ORDER BY unlocked_at DESC`,
		[Number(userId)]
	);

	return justUnlocked.rows.map((r) => r.code);
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
