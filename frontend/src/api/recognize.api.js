import { apiFetch } from "./http";

export function recognizeFromBase64(imageBase64) {
	return apiFetch("/recognize/predict", {
		method: "POST",
		body: JSON.stringify({ imageBase64 })
	});
}

export function recognizeFromFile(file) {
	const formData = new FormData();
	formData.append("file", file);

	return apiFetch("/recognize", {
		method: "POST",
		body: formData
	});
}
