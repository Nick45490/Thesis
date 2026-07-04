import { apiFetch } from "./http";

export function getManufacturers(search = "") {
	const query = search ? `?q=${encodeURIComponent(search)}` : "";
	return apiFetch(`/catalogue/manufacturers${query}`);
}

export function getModels({ manufacturerId, search = "" } = {}) {
	const params = new URLSearchParams();
	if (manufacturerId) {
		params.set("manufacturerId", String(manufacturerId));
	}
	if (search) {
		params.set("q", search);
	}

	const query = params.toString() ? `?${params.toString()}` : "";
	return apiFetch(`/catalogue/models${query}`);
}

export function getModelById(modelId) {
	return apiFetch(`/catalogue/models/${modelId}`);
}

export function getModelGenerations(modelId) {
	return apiFetch(`/catalogue/models/${modelId}/generations`);
}

export function getGenerations(modelId) {
	const query = modelId ? `?modelId=${encodeURIComponent(modelId)}` : "";
	return apiFetch(`/catalogue/generations${query}`);
}

export function getManufacturerById(id) {
	return apiFetch(`/catalogue/manufacturers/${id}`);
}

export function getManufacturerModels(id) {
	return apiFetch(`/catalogue/manufacturers/${id}/models`);
}

export function getGenerationById(id) {
	return apiFetch(`/catalogue/generations/${id}`);
}

export function getCatalogueStats() {
	return apiFetch("/catalogue/stats");
}
