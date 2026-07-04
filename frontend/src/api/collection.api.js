import { apiFetch } from "./http";

export function getCollection() {
	return apiFetch("/collection");
}

export function addCollectionItem(payload) {
	return apiFetch("/collection", {
		method: "POST",
		body: JSON.stringify(payload)
	});
}

export function removeCollectionItem(generationId) {
	return apiFetch(`/collection/${generationId}`, {
		method: "DELETE"
	});
}

export function getCollectionProgress() {
	return apiFetch("/collection/progress");
}

export function getCollectionAchievements() {
	return apiFetch("/collection/achievements");
}

export function getFriendCollection(userId) {
	return apiFetch(`/collection/user/${userId}`);
}
