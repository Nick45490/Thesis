import { apiFetch } from "./http";

export function register(payload) {
	return apiFetch("/auth/register", {
		method: "POST",
		body: JSON.stringify(payload)
	});
}

export function login(payload) {
	return apiFetch("/auth/login", {
		method: "POST",
		body: JSON.stringify(payload)
	});
}

export function getMe() {
	return apiFetch("/auth/me");
}

export function listUsers() {
	return apiFetch("/auth/users");
}

export function listFriends() {
	return apiFetch("/auth/friends");
}

export function sendFriendRequest(friendUserId) {
	return apiFetch("/auth/friends/request", {
		method: "POST",
		body: JSON.stringify({ friendUserId })
	});
}

export function acceptFriendRequest(requesterId) {
	return apiFetch("/auth/friends/accept", {
		method: "POST",
		body: JSON.stringify({ requesterId })
	});
}

export function generateInviteCode() {
	return apiFetch("/auth/friends/invite/generate", { method: "POST", body: JSON.stringify({}) });
}

export function getUserById(id) {
	return apiFetch(`/auth/users/${id}`);
}

export function redeemInviteCode(code) {
	return apiFetch("/auth/friends/invite/redeem", {
		method: "POST",
		body: JSON.stringify({ code })
	});
}

export function uploadProfilePhoto(photo) {
	return apiFetch("/auth/profile/photo", {
		method: "PATCH",
		body: JSON.stringify({ photo }),
	});
}
