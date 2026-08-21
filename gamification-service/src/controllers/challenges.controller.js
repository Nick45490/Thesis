const {
	acceptChallenge,
	createChallenge,
	declineChallenge,
	getChallengeById,
	listChallenges,
} = require("../db");
const { CIRCUIT_TRACKS, DEFAULT_TRACK } = require("../engine/performanceEngine");

// req.user is never set in this service — requireInternalSecret (index.js)
// verifies every request before it reaches a handler, so x-user-id alone is
// the real (now-trusted) identity.
function resolveUserId(req) {
	return Number(req.headers["x-user-id"]);
}

async function postChallenge(req, res) {
	const userId = resolveUserId(req);
	if (!userId) return res.status(401).json({ message: "Missing user identity" });

	const {
		opponentUserId,
		distance,
		track,
		challengerGenerationId,
		challengerMake,
		challengerModel,
		challengerGenCode,
		challengerHorsepower,
		challengerWeightKg,
		challengerTorqueNm,
		challengerDrivetrain,
	} = req.body;

	if (!opponentUserId || !distance || !challengerGenerationId || !challengerMake || !challengerModel) {
		return res.status(400).json({ message: "Missing required fields" });
	}

	if (!["quarter", "half", "full", "circuit"].includes(distance)) {
		return res.status(400).json({ message: "distance must be quarter, half, full, or circuit" });
	}

	if (distance === "circuit" && track && !CIRCUIT_TRACKS[track]) {
		return res.status(400).json({ message: `track must be one of: ${Object.keys(CIRCUIT_TRACKS).join(", ")}` });
	}

	if (Number(opponentUserId) === userId) {
		return res.status(400).json({ message: "Cannot challenge yourself" });
	}

	try {
		const challenge = await createChallenge({
			challengerUserId:      userId,
			opponentUserId:        Number(opponentUserId),
			distance,
			track:                 distance === "circuit" ? (track || DEFAULT_TRACK) : undefined,
			challengerGenerationId: Number(challengerGenerationId),
			challengerMake,
			challengerModel,
			challengerGenCode:     challengerGenCode     || "",
			challengerHorsepower:  challengerHorsepower  || null,
			challengerWeightKg:    challengerWeightKg    || null,
			challengerTorqueNm:    challengerTorqueNm    || null,
			challengerDrivetrain:  challengerDrivetrain  || null,
		});
		return res.status(201).json({ challenge });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Failed to create challenge" });
	}
}

async function getChallenges(req, res) {
	const userId = resolveUserId(req);
	if (!userId) return res.status(401).json({ message: "Missing user identity" });

	try {
		const challenges = await listChallenges(userId);
		return res.status(200).json({ challenges });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Failed to list challenges" });
	}
}

async function patchAccept(req, res) {
	const userId = resolveUserId(req);
	if (!userId) return res.status(401).json({ message: "Missing user identity" });

	const challengeId = Number(req.params.id);
	const { opponentGenerationId, opponentMake, opponentModel, opponentGenCode, opponentHorsepower, opponentWeightKg, opponentTorqueNm, opponentDrivetrain } = req.body;

	if (!opponentGenerationId || !opponentMake || !opponentModel) {
		return res.status(400).json({ message: "Missing opponent car details" });
	}

	try {
		const existing = await getChallengeById(challengeId);
		if (!existing) return res.status(404).json({ message: "Challenge not found" });
		if (existing.opponentUserId !== userId) return res.status(403).json({ message: "Not your challenge to accept" });
		if (existing.status !== "pending") return res.status(409).json({ message: "Challenge is not pending" });

		const result = await acceptChallenge(challengeId, {
			opponentGenerationId: Number(opponentGenerationId),
			opponentMake,
			opponentModel,
			opponentGenCode:     opponentGenCode     || "",
			opponentHorsepower:  opponentHorsepower  || null,
			opponentWeightKg:    opponentWeightKg    || null,
			opponentTorqueNm:    opponentTorqueNm    || null,
			opponentDrivetrain:  opponentDrivetrain  || null,
		});
		// Lost a race against a concurrent accept on the same challenge (see the
		// transaction + row lock in acceptChallenge) — not a server error.
		if (result.alreadyResolved) return res.status(409).json({ message: "Challenge is not pending" });
		return res.status(200).json(result);
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Failed to accept challenge" });
	}
}

async function patchDecline(req, res) {
	const userId = resolveUserId(req);
	if (!userId) return res.status(401).json({ message: "Missing user identity" });

	const challengeId = Number(req.params.id);

	try {
		const existing = await getChallengeById(challengeId);
		if (!existing) return res.status(404).json({ message: "Challenge not found" });
		if (existing.opponentUserId !== userId) return res.status(403).json({ message: "Not your challenge to decline" });
		if (existing.status !== "pending") return res.status(409).json({ message: "Challenge is not pending" });

		const challenge = await declineChallenge(challengeId);
		return res.status(200).json({ challenge });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Failed to decline challenge" });
	}
}

module.exports = { postChallenge, getChallenges, patchAccept, patchDecline };
