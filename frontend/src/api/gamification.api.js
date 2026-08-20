import { apiFetch } from "./http";

export function getRaces() {
	return apiFetch("/gamification/races");
}

export function createRace(payload) {
	return apiFetch("/gamification/races", {
		method: "POST",
		body: JSON.stringify(payload)
	});
}

export function getAchievements() {
	return apiFetch("/gamification/achievements");
}

export function getLeaderboard(period = "all", limit = 20) {
	return apiFetch(`/gamification/leaderboard?period=${period}&limit=${limit}`);
}

export function getChallenges() {
	return apiFetch("/gamification/challenges");
}

export function createChallenge(payload) {
	return apiFetch("/gamification/challenges", {
		method: "POST",
		body: JSON.stringify(payload)
	});
}

export function acceptChallenge(id, payload) {
	return apiFetch(`/gamification/challenges/${id}/accept`, {
		method: "PATCH",
		body: JSON.stringify(payload)
	});
}

export function declineChallenge(id) {
	return apiFetch(`/gamification/challenges/${id}/decline`, {
		method: "PATCH",
		body: JSON.stringify({})
	});
}
