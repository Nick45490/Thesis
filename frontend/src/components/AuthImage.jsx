import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../api/http";

/**
 * Fetches an image that sits behind the authenticated gateway,
 * then renders it via a temporary blob URL so the Authorization
 * header can be included in the request.
 *
 * Props mirror a regular <img> except `src` is a gateway-relative path.
 * `onError` is called if the fetch fails so parents can show a fallback.
 */
export default function AuthImage({ src, alt, style, onError }) {
	const [blobUrl, setBlobUrl] = useState(null);
	const urlRef = useRef(null);

	useEffect(() => {
		if (!src) return;

		let cancelled = false;
		const token = sessionStorage.getItem("thesis_token");

		fetch(`${API_BASE_URL}${src}`, {
			headers: token ? { Authorization: `Bearer ${token}` } : {},
		})
			.then((res) => {
				if (!res.ok) throw new Error(`${res.status}`);
				return res.blob();
			})
			.then((blob) => {
				if (cancelled) return;
				const url = URL.createObjectURL(blob);
				urlRef.current = url;
				setBlobUrl(url);
			})
			.catch(() => {
				if (!cancelled) onError?.();
			});

		return () => {
			cancelled = true;
			if (urlRef.current) {
				URL.revokeObjectURL(urlRef.current);
				urlRef.current = null;
			}
		};
	// onError intentionally omitted — it's an arrow function that changes every render
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [src]);

	if (!blobUrl) return null;
	return <img src={blobUrl} alt={alt} style={style} />;
}
