const { Pool } = require("pg");
const { RACING_CATALOGUE, buildRacingCatalogue } = require("./engine/achievementChecker");
const { estimateDragTime, estimateCircuitTime, computePointsAwarded, getCarRarity, RARITY_TIER } = require("./engine/performanceEngine");
const { getUsernamesByIds } = require("./clients/authClient");
const { periodStart } = require("./leaderboardPeriod");

const pool = new Pool({
	connectionString: process.env.DATABASE_URL
});

let initialized = false;

async function initDb() {
	if (initialized) {
		return;
	}

	await pool.query(`
		CREATE TABLE IF NOT EXISTS races (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL,
			points INTEGER NOT NULL,
			distance_m INTEGER NOT NULL,
			duration_s INTEGER NOT NULL,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`);

	await pool.query(`
		CREATE TABLE IF NOT EXISTS achievements (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL,
			code VARCHAR(80) NOT NULL,
			title VARCHAR(120) NOT NULL,
			unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			UNIQUE (user_id, code)
		)
	`);

	await pool.query(`
		CREATE TABLE IF NOT EXISTS race_challenges (
			id SERIAL PRIMARY KEY,
			challenger_user_id INTEGER NOT NULL,
			opponent_user_id INTEGER NOT NULL,
			distance VARCHAR(20) NOT NULL,
			challenger_generation_id INTEGER NOT NULL,
			challenger_make VARCHAR(120) NOT NULL,
			challenger_model VARCHAR(120) NOT NULL,
			challenger_gen_code VARCHAR(120) NOT NULL DEFAULT '',
			challenger_horsepower INTEGER,
			challenger_weight_kg INTEGER,
			opponent_generation_id INTEGER,
			opponent_make VARCHAR(120),
			opponent_model VARCHAR(120),
			opponent_gen_code VARCHAR(120),
			opponent_horsepower INTEGER,
			opponent_weight_kg INTEGER,
			status VARCHAR(20) NOT NULL DEFAULT 'pending',
			winner_user_id INTEGER,
			challenger_time NUMERIC(8,3),
			opponent_time NUMERIC(8,3),
			points_awarded INTEGER,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			resolved_at TIMESTAMP
		)
	`);

	await pool.query(`
		ALTER TABLE race_challenges
			ADD COLUMN IF NOT EXISTS challenger_horsepower INTEGER,
			ADD COLUMN IF NOT EXISTS challenger_weight_kg INTEGER,
			ADD COLUMN IF NOT EXISTS opponent_horsepower INTEGER,
			ADD COLUMN IF NOT EXISTS opponent_weight_kg INTEGER,
			ADD COLUMN IF NOT EXISTS challenger_torque_nm INTEGER,
			ADD COLUMN IF NOT EXISTS challenger_drivetrain VARCHAR(20),
			ADD COLUMN IF NOT EXISTS opponent_torque_nm INTEGER,
			ADD COLUMN IF NOT EXISTS opponent_drivetrain VARCHAR(20)
	`);

	await pool.query(`
		ALTER TABLE races
			ADD COLUMN IF NOT EXISTS won BOOLEAN NOT NULL DEFAULT TRUE,
			ADD COLUMN IF NOT EXISTS was_underdog BOOLEAN NOT NULL DEFAULT FALSE
	`);

	initialized = true;
}

function mapRaceRow(row) {
	return {
		id: row.id,
		points: row.points,
		distanceM: row.distance_m,
		durationS: row.duration_s,
		createdAt: row.created_at
	};
}

function mapAchievementRow(row) {
	return {
		code: row.code,
		title: row.title,
		unlockedAt: row.unlocked_at
	};
}

async function addRace(userId, raceInput, client = pool) {
	const won         = raceInput.won         !== false;
	const wasUnderdog = raceInput.wasUnderdog  === true;
	const result = await client.query(
		`INSERT INTO races (user_id, points, distance_m, duration_s, won, was_underdog)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, points, distance_m, duration_s, created_at`,
		[Number(userId), Number(raceInput.points), Number(raceInput.distanceM), Number(raceInput.durationS), won, wasUnderdog]
	);

	return mapRaceRow(result.rows[0]);
}

async function listRaces(userId) {
	const result = await pool.query(
		`SELECT id, points, distance_m, duration_s, created_at
		 FROM races
		 WHERE user_id = $1
		 ORDER BY created_at DESC`,
		[Number(userId)]
	);

	return result.rows.map(mapRaceRow);
}

async function getRaceStats(userId) {
	const result = await pool.query(
		`SELECT
			COUNT(*)::int                                                           AS races_completed,
			COALESCE(SUM(points), 0)::int                                          AS total_points,
			COALESCE(SUM(distance_m), 0)::int                                      AS total_distance_m,
			COALESCE(SUM(duration_s), 0)::int                                      AS total_duration_s,
			COUNT(*) FILTER (WHERE won = TRUE)::int                                AS wins,
			COUNT(*) FILTER (WHERE won = TRUE AND was_underdog = TRUE)::int        AS underdog_wins,
			COUNT(*) FILTER (WHERE distance_m >= 800 AND distance_m < 1500)::int   AS half_mile_races,
			COUNT(*) FILTER (WHERE distance_m >= 1500)::int                        AS full_mile_races
		 FROM races
		 WHERE user_id = $1`,
		[Number(userId)]
	);

	const row = result.rows[0];
	return {
		racesCompleted: row.races_completed,
		totalPoints:    row.total_points,
		totalDistanceM: row.total_distance_m,
		totalDurationS: row.total_duration_s,
		wins:           row.wins,
		underdogWins:   row.underdog_wins,
		halfMileRaces:  row.half_mile_races,
		fullMileRaces:  row.full_mile_races,
		averagePoints:  row.races_completed ? Math.round(row.total_points / row.races_completed) : 0,
	};
}

async function listLeaderboard(limit = 20, period = "all") {
	const start = periodStart(period);
	const result = await pool.query(
		start
			? `SELECT user_id, SUM(points)::int AS points, COUNT(*)::int AS races_completed
			   FROM races
			   WHERE created_at >= $2
			   GROUP BY user_id
			   ORDER BY points DESC
			   LIMIT $1`
			: `SELECT user_id, SUM(points)::int AS points, COUNT(*)::int AS races_completed
			   FROM races
			   GROUP BY user_id
			   ORDER BY points DESC
			   LIMIT $1`,
		start ? [Number(limit), start] : [Number(limit)]
	);

	const rows = result.rows.map((row) => ({
		userId: row.user_id,
		points: row.points,
		racesCompleted: row.races_completed
	}));

	const usernamesById = await getUsernamesByIds(rows.map((r) => r.userId));
	return rows.map((r) => ({ ...r, username: usernamesById[r.userId]?.username || null }));
}

async function unlockAchievementsForUser(userId, stats) {
	for (const a of RACING_CATALOGUE) {
		if ((stats[a.stat] || 0) >= a.target) {
			await pool.query(
				`INSERT INTO achievements (user_id, code, title)
				 VALUES ($1, $2, $3)
				 ON CONFLICT (user_id, code) DO NOTHING`,
				[Number(userId), a.code, a.title]
			);
		}
	}

	const justUnlockedResult = await pool.query(
		`SELECT code, title, unlocked_at
		 FROM achievements
		 WHERE user_id = $1 AND unlocked_at >= NOW() - INTERVAL '2 seconds'
		 ORDER BY unlocked_at DESC`,
		[Number(userId)]
	);

	// Enrich just-unlocked with full metadata from catalogue
	const catalogueMap = Object.fromEntries(RACING_CATALOGUE.map((a) => [a.code, a]));
	const unlockedNow = justUnlockedResult.rows.map((row) => {
		const meta = catalogueMap[row.code] || {};
		return {
			code: row.code,
			title: row.title,
			description: meta.description || "",
			rarity: meta.rarity || "common",
			unlockedAt: row.unlocked_at,
		};
	});

	return { unlockedNow };
}

async function getAchievementCatalogue(userId, stats) {
	const result = await pool.query(
		`SELECT code, unlocked_at FROM achievements WHERE user_id = $1`,
		[Number(userId)]
	);
	const unlockedMap = Object.fromEntries(result.rows.map((r) => [r.code, r.unlocked_at]));
	return buildRacingCatalogue(stats, unlockedMap);
}

// Usernames are never on race_challenges rows themselves — see attachUsernames()
// below, which fills them in from auth-service after this mapping runs.
function mapChallengeRow(row) {
	return {
		id:                     row.id,
		challengerUserId:       row.challenger_user_id,
		challengerUsername:     null,
		opponentUserId:         row.opponent_user_id,
		opponentUsername:       null,
		distance:               row.distance,
		challengerGenerationId: row.challenger_generation_id,
		challengerMake:         row.challenger_make,
		challengerModel:        row.challenger_model,
		challengerGenCode:      row.challenger_gen_code,
		challengerHorsepower:   row.challenger_horsepower,
		challengerWeightKg:     row.challenger_weight_kg,
		challengerTorqueNm:     row.challenger_torque_nm,
		challengerDrivetrain:   row.challenger_drivetrain,
		opponentGenerationId:   row.opponent_generation_id,
		opponentMake:           row.opponent_make,
		opponentModel:          row.opponent_model,
		opponentGenCode:        row.opponent_gen_code,
		opponentHorsepower:     row.opponent_horsepower,
		opponentWeightKg:       row.opponent_weight_kg,
		opponentTorqueNm:       row.opponent_torque_nm,
		opponentDrivetrain:     row.opponent_drivetrain,
		status:                 row.status,
		winnerUserId:           row.winner_user_id,
		challengerTime:         row.challenger_time !== null ? Number(row.challenger_time) : null,
		opponentTime:           row.opponent_time   !== null ? Number(row.opponent_time)   : null,
		pointsAwarded:          row.points_awarded,
		createdAt:              row.created_at,
		resolvedAt:             row.resolved_at,
	};
}

async function createChallenge(input) {
	const result = await pool.query(
		`INSERT INTO race_challenges
		   (challenger_user_id, opponent_user_id, distance,
		    challenger_generation_id, challenger_make, challenger_model, challenger_gen_code,
		    challenger_horsepower, challenger_weight_kg, challenger_torque_nm, challenger_drivetrain)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		 RETURNING *`,
		[
			Number(input.challengerUserId),
			Number(input.opponentUserId),
			input.distance,
			Number(input.challengerGenerationId),
			input.challengerMake,
			input.challengerModel,
			input.challengerGenCode    || "",
			input.challengerHorsepower || null,
			input.challengerWeightKg   || null,
			input.challengerTorqueNm   || null,
			input.challengerDrivetrain || null,
		]
	);
	return mapChallengeRow(result.rows[0]);
}

// Pure merge step, kept separate from the DB query and the HTTP call so it's
// unit-testable on its own — usernamesById is the {id: {username}} map
// authClient.getUsernamesByIds() resolves to.
function attachUsernames(challenge, usernamesById) {
	return {
		...challenge,
		challengerUsername: usernamesById[challenge.challengerUserId]?.username || null,
		opponentUsername:   usernamesById[challenge.opponentUserId]?.username   || null,
	};
}

async function getChallengeById(id) {
	const result = await pool.query(
		`SELECT * FROM race_challenges WHERE id = $1 LIMIT 1`,
		[Number(id)]
	);
	if (!result.rowCount) return null;

	const challenge = mapChallengeRow(result.rows[0]);
	const usernamesById = await getUsernamesByIds([challenge.challengerUserId, challenge.opponentUserId]);
	return attachUsernames(challenge, usernamesById);
}

async function listChallenges(userId) {
	const result = await pool.query(
		`SELECT * FROM race_challenges
		 WHERE challenger_user_id = $1 OR opponent_user_id = $1
		 ORDER BY created_at DESC`,
		[Number(userId)]
	);
	const challenges = result.rows.map(mapChallengeRow);

	const allIds = challenges.flatMap((c) => [c.challengerUserId, c.opponentUserId]);
	const usernamesById = await getUsernamesByIds(allIds);
	return challenges.map((c) => attachUsernames(c, usernamesById));
}

// Wrapped in a transaction with a row lock so two near-simultaneous accepts on
// the same challenge can't both resolve it — the second sees status != 'pending'
// (or loses the guarded UPDATE below) and backs off instead of double-awarding
// points and inserting duplicate race rows.
async function acceptChallenge(id, opponentInput) {
	const client = await pool.connect();
	let winnerUserId, alreadyResolved = false;

	try {
		await client.query("BEGIN");

		const lockResult = await client.query(
			`SELECT * FROM race_challenges WHERE id = $1 FOR UPDATE`,
			[id]
		);
		const existing = lockResult.rowCount ? mapChallengeRow(lockResult.rows[0]) : null;

		if (!existing || existing.status !== "pending") {
			await client.query("ROLLBACK");
			alreadyResolved = true;
		} else {
			const isCircuit = existing.distance === "circuit";
			const challengerTime = isCircuit
				? estimateCircuitTime(
					existing.challengerHorsepower, existing.challengerWeightKg,
					existing.challengerTorqueNm, existing.challengerDrivetrain,
					existing.challengerMake, existing.challengerModel
				)
				: estimateDragTime(
					existing.challengerHorsepower, existing.challengerWeightKg,
					existing.challengerMake, existing.challengerModel, existing.distance
				);
			const opponentTime = isCircuit
				? estimateCircuitTime(
					opponentInput.opponentHorsepower, opponentInput.opponentWeightKg,
					opponentInput.opponentTorqueNm, opponentInput.opponentDrivetrain,
					opponentInput.opponentMake, opponentInput.opponentModel
				)
				: estimateDragTime(
					opponentInput.opponentHorsepower, opponentInput.opponentWeightKg,
					opponentInput.opponentMake, opponentInput.opponentModel, existing.distance
				);

			const challengerWon    = challengerTime <= opponentTime;
			const loserUserId      = challengerWon ? existing.opponentUserId    : existing.challengerUserId;
			const winnerMake       = challengerWon ? existing.challengerMake         : opponentInput.opponentMake;
			const winnerModel      = challengerWon ? existing.challengerModel        : opponentInput.opponentModel;
			const winnerHorsepower = challengerWon ? existing.challengerHorsepower   : opponentInput.opponentHorsepower;
			const winnerWeightKg   = challengerWon ? existing.challengerWeightKg     : opponentInput.opponentWeightKg;
			const loserHorsepower  = challengerWon ? opponentInput.opponentHorsepower : existing.challengerHorsepower;
			const loserWeightKg    = challengerWon ? opponentInput.opponentWeightKg   : existing.challengerWeightKg;
			const loserMakeR       = challengerWon ? opponentInput.opponentMake  : existing.challengerMake;
			const loserModelR      = challengerWon ? opponentInput.opponentModel : existing.challengerModel;
			const marginSeconds    = Math.abs(challengerTime - opponentTime);
			const pointsAwarded    = computePointsAwarded(loserHorsepower, loserWeightKg, existing.distance, winnerHorsepower, winnerWeightKg, marginSeconds, winnerMake, winnerModel, loserMakeR, loserModelR);

			winnerUserId = challengerWon ? existing.challengerUserId : existing.opponentUserId;

			const distanceMap = { quarter: 402, half: 805, full: 1609, circuit: 5891 };
			const distanceM   = distanceMap[existing.distance] || 402;

			const updateResult = await client.query(
				`UPDATE race_challenges
				 SET opponent_generation_id = $1,
				     opponent_make           = $2,
				     opponent_model          = $3,
				     opponent_gen_code       = $4,
				     opponent_horsepower     = $5,
				     opponent_weight_kg      = $6,
				     opponent_torque_nm      = $7,
				     opponent_drivetrain     = $8,
				     status                  = 'completed',
				     winner_user_id          = $9,
				     challenger_time         = $10,
				     opponent_time           = $11,
				     points_awarded          = $12,
				     resolved_at             = NOW()
				 WHERE id = $13 AND status = 'pending'`,
				[
					Number(opponentInput.opponentGenerationId),
					opponentInput.opponentMake,
					opponentInput.opponentModel,
					opponentInput.opponentGenCode    || "",
					opponentInput.opponentHorsepower || null,
					opponentInput.opponentWeightKg   || null,
					opponentInput.opponentTorqueNm   || null,
					opponentInput.opponentDrivetrain || null,
					winnerUserId,
					challengerTime,
					opponentTime,
					pointsAwarded,
					id,
				]
			);

			if (!updateResult.rowCount) {
				await client.query("ROLLBACK");
				alreadyResolved = true;
			} else {
				const winnerRarity = getCarRarity(winnerHorsepower, winnerWeightKg, winnerMake, winnerModel);
				const loserRarity  = getCarRarity(loserHorsepower,  loserWeightKg,  loserMakeR, loserModelR);
				const wasUnderdog  = RARITY_TIER[winnerRarity] < RARITY_TIER[loserRarity];

				await addRace(winnerUserId, {
					points:      pointsAwarded,
					distanceM:   distanceM,
					durationS:   Math.round(challengerWon ? challengerTime : opponentTime),
					won:         true,
					wasUnderdog: wasUnderdog,
				}, client);

				// Record the loser's row (0 points, won=false) so their race stats are complete
				await addRace(loserUserId, {
					points:      0,
					distanceM:   distanceM,
					durationS:   Math.round(challengerWon ? opponentTime : challengerTime),
					won:         false,
					wasUnderdog: false,
				}, client);

				await client.query("COMMIT");
			}
		}
	} catch (err) {
		await client.query("ROLLBACK");
		throw err;
	} finally {
		client.release();
	}

	if (alreadyResolved) {
		return { alreadyResolved: true };
	}

	const winnerStats = await getRaceStats(winnerUserId);
	const { unlockedNow } = await unlockAchievementsForUser(winnerUserId, winnerStats);

	const updated = await getChallengeById(id);
	return { challenge: updated, unlockedAchievements: unlockedNow };
}

async function declineChallenge(id) {
	const result = await pool.query(
		`UPDATE race_challenges
		 SET status = 'declined', resolved_at = NOW()
		 WHERE id = $1
		 RETURNING *`,
		[Number(id)]
	);
	return mapChallengeRow(result.rows[0]);
}

module.exports = {
	acceptChallenge,
	addRace,
	attachUsernames,
	createChallenge,
	declineChallenge,
	getAchievementCatalogue,
	getChallengeById,
	getRaceStats,
	initDb,
	listChallenges,
	listLeaderboard,
	listRaces,
	unlockAchievementsForUser,
};
