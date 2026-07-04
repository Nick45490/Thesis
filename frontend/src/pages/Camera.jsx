import { useState, useRef } from "react";
import AchievementToast from "../components/AchievementToast";
import AuthImage from "../components/AuthImage";
import { recognizeFromFile } from "../api/recognize.api";
import { getGenerationById } from "../api/catalogue.api";
import { useCollection } from "../context/CollectionContext";

export default function CameraPage() {
	const { addItem } = useCollection();
	const [selectedFile, setSelectedFile] = useState(null);
	const [preview, setPreview] = useState(null);
	const [isDragging, setIsDragging] = useState(false);
	const [prediction, setPrediction] = useState(null);
	const [notRecognised, setNotRecognised] = useState(false);
	const [scanPhoto, setScanPhoto] = useState(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [unlocked, setUnlocked] = useState([]);
	const inputRef       = useRef(null);
	const cameraInputRef = useRef(null);

	function handleFile(file) {
		if (!file) return;
		setSelectedFile(file);
		setPreview(URL.createObjectURL(file));
		setPrediction(null);
		setNotRecognised(false);
		setScanPhoto(null);
		setError("");
	}

	function handleDragOver(e) {
		e.preventDefault();
		setIsDragging(true);
	}

	function handleDragLeave() {
		setIsDragging(false);
	}

	function handleDrop(e) {
		e.preventDefault();
		setIsDragging(false);
		handleFile(e.dataTransfer.files?.[0]);
	}

	function handleReset() {
		setSelectedFile(null);
		setPreview(null);
		setPrediction(null);
		setNotRecognised(false);
		setScanPhoto(null);
		setError("");
		if (inputRef.current)       inputRef.current.value = "";
		if (cameraInputRef.current) cameraInputRef.current.value = "";
	}

	async function handleRecognize() {
		if (!selectedFile) return;
		setBusy(true);
		setError("");
		try {
			const response = await recognizeFromFile(selectedFile);
			const nextPrediction = response.prediction || null;
			const photo = response.censoredPhoto || preview;
			setScanPhoto(photo);

			if (!nextPrediction) {
				setNotRecognised(true);
				return;
			}

			setPrediction(nextPrediction);
			setNotRecognised(false);

			if (nextPrediction) {
				let engine = null;
				try {
					const genRes = await getGenerationById(nextPrediction.generationId);
					const engines = genRes?.generation?.engines;
					if (Array.isArray(engines) && engines.length > 0) {
						engine = engines[Math.floor(Math.random() * engines.length)];
					}
				} catch { /* engine stays null */ }

				const addResponse = await addItem({
					generationId:     nextPrediction.generationId,
					manufacturerName: nextPrediction.manufacturerName,
					modelName:        nextPrediction.modelName,
					generationCode:   nextPrediction.generationCode,
					engine,
					scanPhoto:        photo,
				});
				setUnlocked(addResponse.unlockedAchievements || []);
			}
		} catch (err) {
			setError(err.message);
		} finally {
			setBusy(false);
		}
	}

	const confidencePct = ((prediction?.confidence || 0) * 100).toFixed(1);
	const barWidth = Math.min((prediction?.confidence || 0) * 250, 100);

	return (
		<main className="page narrow">

			<div className="card">
				<h1 style={{ margin: "0 0 0.2rem", fontSize: "1.5rem" }}>Camera Recognition</h1>
				<p className="muted" style={{ margin: "0 0 1.25rem", fontSize: "0.88rem" }}>
					Upload a car photo — the AI identifies the make, model and generation.
				</p>

				{/* Upload zone */}
				<div
					className={`upload-zone${isDragging ? " upload-zone-drag" : ""}${preview ? " upload-zone-preview" : ""}`}
					onClick={() => !preview && inputRef.current?.click()}
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
				>
					{preview ? (
						<img
							src={preview}
							alt="Selected car"
							style={{ width: "100%", maxHeight: 300, objectFit: "cover", display: "block" }}
						/>
					) : (
						<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", pointerEvents: "none" }}>
							<svg width="52" height="52" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "rgba(220,38,38,0.5)" }}>
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
							<div style={{ textAlign: "center" }}>
								<p style={{ margin: 0, fontWeight: 600, color: "#f1f1f3" }}>Drop a photo here</p>
								<p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>or use the buttons below</p>
							</div>
							<span className="muted" style={{ fontSize: "0.75rem" }}>JPG · PNG · WEBP</span>
						</div>
					)}
				</div>

				<input
					ref={inputRef}
					type="file"
					accept="image/*"
					onChange={(e) => handleFile(e.target.files?.[0])}
					style={{ display: "none" }}
				/>
				<input
					ref={cameraInputRef}
					type="file"
					accept="image/*"
					capture="environment"
					onChange={(e) => handleFile(e.target.files?.[0])}
					style={{ display: "none" }}
				/>

				{!preview && (
					<div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem" }}>
						<button
							className="primary-btn"
							style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
							onClick={() => cameraInputRef.current?.click()}
						>
							<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
							Take Photo
						</button>
						<button
							className="ghost-btn"
							style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
							onClick={() => inputRef.current?.click()}
						>
							<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
							</svg>
							From Gallery
						</button>
					</div>
				)}

				{preview && (
					<div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem" }}>
						<button className="primary-btn" style={{ flex: 1 }} onClick={handleRecognize} disabled={busy}>
							{busy ? "Scanning…" : "Scan Car"}
						</button>
						<button className="ghost-btn" onClick={handleReset} disabled={busy}>
							Change Photo
						</button>
					</div>
				)}

				{error && <p className="error-text" style={{ margin: "0.75rem 0 0" }}>{error}</p>}
			</div>

			{/* Not recognised card */}
			{notRecognised && !prediction && (
				<div className="card" style={{ padding: 0, overflow: "hidden" }}>
					{scanPhoto && (
						<img
							src={scanPhoto}
							alt="Scanned car"
							style={{ width: "100%", maxHeight: 260, objectFit: "cover", display: "block", filter: "grayscale(60%)" }}
						/>
					)}
					<div style={{ padding: "1.1rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", textAlign: "center" }}>
						<svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "rgba(248,113,113,0.7)" }}>
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 14.828a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<p style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem", color: "#f1f1f3" }}>Car not recognised</p>
						<p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
							This vehicle isn't in the catalogue, or the confidence was too low to make a match.
							Try a clearer photo from the front or side.
						</p>
					</div>
				</div>
			)}

			{/* Result card */}
			{prediction && (
				<div className="card" style={{ padding: 0, overflow: "hidden" }}>
					<AuthImage
						src={`/recognize/images/${prediction.generationId}`}
						alt={`${prediction.manufacturerName} ${prediction.modelName}`}
						style={{ width: "100%", maxHeight: 260, objectFit: "cover", display: "block" }}
					/>
					<div style={{ padding: "1.1rem" }}>
						<p className="muted" style={{ margin: "0 0 0.2rem", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>
							Identified as
						</p>
						<h2 style={{ margin: "0 0 0.15rem", fontSize: "1.4rem" }}>
							{prediction.manufacturerName} {prediction.modelName}
						</h2>
						<p style={{ margin: "0 0 1rem", fontFamily: "IBM Plex Mono, monospace", fontSize: "0.85rem", color: "rgba(255,255,255,0.4)" }}>
							{prediction.generationCode}
							{" · "}
							<span style={{ fontSize: "0.8em" }}>
								{prediction.generationSource === "detected" ? "visually detected" : "latest in catalogue"}
							</span>
						</p>

						<div style={{ marginBottom: "1rem" }}>
							<div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem", fontSize: "0.82rem" }}>
								<span className="muted">Confidence</span>
								<span style={{ fontWeight: 600 }}>{confidencePct}%</span>
							</div>
							<div className="progress-track">
								<div className="progress-value" style={{ width: `${barWidth}%` }} />
							</div>
						</div>

						{prediction.candidates?.length > 1 && (
							<details>
								<summary className="muted" style={{ cursor: "pointer", fontSize: "0.85rem", userSelect: "none" }}>
									All candidates ({prediction.candidates.length})
								</summary>
								<ol style={{ margin: "0.6rem 0 0 1.1rem", padding: 0, display: "grid", gap: "0.35rem" }}>
									{prediction.candidates.map((c) => (
										<li key={c.key} style={{ fontSize: "0.87rem" }}>
											<strong>{c.manufacturerName} {c.modelName}</strong>
											{" · "}{c.generationCode}
											<span className="muted"> — {(c.confidence * 100).toFixed(1)}%</span>
										</li>
									))}
								</ol>
							</details>
						)}
					</div>
				</div>
			)}

			<AchievementToast achievements={unlocked} />
		</main>
	);
}