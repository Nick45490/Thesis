import { useState, useRef } from "react";
import AchievementToast from "../components/AchievementToast";
import AuthImage from "../components/AuthImage";
import { recognizeFromFile } from "../api/recognize.api";
import { getGenerationById } from "../api/catalogue.api";
import { useCollection } from "../context/CollectionContext";

// Two independent triggers for the confirm step, both calibrated against the
// held-out eval set's real correct-vs-incorrect confidence distributions
// (ai-service/evaluate.py's confidenceStats/threshold sweep) rather than
// guessed:
//
// 1. Close second place — top-2 within 60% of top-1's confidence. A ratio,
//    not an absolute gap, since confidence isn't 0-1 "typical" softmax-like
//    given 813 classes. Catches hesitant misses (model torn between two
//    similar cars).
// 2. Low absolute top-1 confidence (< 0.30) — catches confidently-wrong
//    misses with no close second place at all (e.g. a BMW M3 G80 called an
//    M4 G82 with the real answer ranked #4). At this floor the eval sweep
//    showed ~68% of wrong answers caught at the cost of flagging ~17% of
//    otherwise-correct scans for confirmation — the point where the
//    catch-rate/friction tradeoff starts to degrade quickly past it. Won't
//    catch a *genuinely* high-confidence wrong answer — that's a different
//    problem (out-of-catalogue detection), not fixable by a confidence floor.
const AMBIGUOUS_RATIO = 0.6;
const LOW_CONFIDENCE_FLOOR = 0.30;

function isAmbiguous(candidates) {
	if (!Array.isArray(candidates) || candidates.length === 0) return false;
	if (candidates[0].confidence < LOW_CONFIDENCE_FLOOR) return true;
	return candidates.length > 1
		&& candidates[1].confidence >= candidates[0].confidence * AMBIGUOUS_RATIO;
}

export default function CameraPage() {
	const { addItem } = useCollection();
	const [selectedFile, setSelectedFile] = useState(null);
	const [preview, setPreview] = useState(null);
	const [isDragging, setIsDragging] = useState(false);
	const [prediction, setPrediction] = useState(null);
	const [selectedCandidate, setSelectedCandidate] = useState(null);
	const [added, setAdded] = useState(false);
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
		setSelectedCandidate(null);
		setAdded(false);
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
		setSelectedCandidate(null);
		setAdded(false);
		setNotRecognised(false);
		setScanPhoto(null);
		setError("");
		if (inputRef.current)       inputRef.current.value = "";
		if (cameraInputRef.current) cameraInputRef.current.value = "";
	}

	// Fetches engine/drivetrain for whichever candidate is being committed
	// (the top guess for a confident scan, or whatever the user picked for an
	// ambiguous one) and adds it to the collection.
	async function commitToCollection(candidate, photo) {
		let engine = null;
		let drivetrain = null;
		try {
			const genRes = await getGenerationById(candidate.generationId);
			const engines = genRes?.generation?.engines;
			if (Array.isArray(engines) && engines.length > 0) {
				engine = engines[Math.floor(Math.random() * engines.length)];
			}
			drivetrain = genRes?.generation?.drivetrain || null;
		} catch { /* engine/drivetrain stay null */ }

		const addResponse = await addItem({
			generationId:     candidate.generationId,
			manufacturerName: candidate.manufacturerName,
			modelName:        candidate.modelName,
			generationCode:   candidate.generationCode,
			engine,
			drivetrain,
			scanPhoto:        photo,
		});
		setUnlocked(addResponse.unlockedAchievements || []);
		setAdded(true);
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
			setSelectedCandidate(nextPrediction);
			setNotRecognised(false);

			if (isAmbiguous(nextPrediction.candidates)) {
				// Close call between the top candidates — let the user confirm
				// which one is actually right instead of silently guessing.
				setAdded(false);
			} else {
				await commitToCollection(nextPrediction, photo);
			}
		} catch (err) {
			setError(err.message);
		} finally {
			setBusy(false);
		}
	}

	async function handleConfirm() {
		if (!selectedCandidate) return;
		setBusy(true);
		setError("");
		try {
			await commitToCollection(selectedCandidate, scanPhoto);
		} catch (err) {
			setError(err.message);
		} finally {
			setBusy(false);
		}
	}

	const confidencePct = ((selectedCandidate?.confidence || 0) * 100).toFixed(1);
	const barWidth = Math.min((selectedCandidate?.confidence || 0) * 250, 100);
	const ambiguous = isAmbiguous(prediction?.candidates);

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
			{prediction && selectedCandidate && (
				<div className="card" style={{ padding: 0, overflow: "hidden" }}>
					<AuthImage
						src={`/recognize/images/${selectedCandidate.generationId}`}
						alt={`${selectedCandidate.manufacturerName} ${selectedCandidate.modelName}`}
						style={{ width: "100%", maxHeight: 260, objectFit: "cover", display: "block" }}
					/>
					<div style={{ padding: "1.1rem" }}>
						<p className="muted" style={{ margin: "0 0 0.2rem", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>
							Identified as
						</p>
						<h2 style={{ margin: "0 0 0.15rem", fontSize: "1.4rem" }}>
							{selectedCandidate.manufacturerName} {selectedCandidate.modelName}
						</h2>
						<p style={{ margin: "0 0 1rem", fontFamily: "IBM Plex Mono, monospace", fontSize: "0.85rem", color: "rgba(255,255,255,0.4)" }}>
							{selectedCandidate.generationCode}
							{" · "}
							<span style={{ fontSize: "0.8em" }}>
								{selectedCandidate.generationSource === "detected" ? "visually detected" : "latest in catalogue"}
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

						{ambiguous && !added && (
							<div style={{ marginBottom: "1rem" }}>
								<p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.82rem" }}>
									Not sure? Other close matches:
								</p>
								<div style={{ display: "grid", gap: "0.5rem" }}>
									{prediction.candidates.slice(0, 3).map((c) => {
										const isSelected = selectedCandidate.generationId === c.generationId;
										return (
											<button
												key={c.key}
												type="button"
												onClick={() => setSelectedCandidate(c)}
												style={{
													display: "flex", alignItems: "center", gap: "0.75rem",
													padding: "0.5rem", borderRadius: "10px", textAlign: "left",
													background: isSelected ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.03)",
													border: `1px solid ${isSelected ? "rgba(220,38,38,0.5)" : "rgba(255,255,255,0.08)"}`,
													cursor: "pointer",
												}}
											>
												<div style={{ width: 52, height: 40, borderRadius: "6px", overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.05)" }}>
													<AuthImage
														src={`/recognize/images/${c.generationId}`}
														alt=""
														style={{ width: "100%", height: "100%", objectFit: "cover" }}
													/>
												</div>
												<div style={{ flex: 1, minWidth: 0 }}>
													<div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#f1f1f3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
														{c.manufacturerName} {c.modelName}
													</div>
													<div className="muted" style={{ fontSize: "0.76rem", fontFamily: "IBM Plex Mono, monospace" }}>
														{c.generationCode}
													</div>
												</div>
												<div style={{ fontSize: "0.8rem", fontWeight: 600, color: isSelected ? "#f87171" : "rgba(255,255,255,0.5)" }}>
													{(c.confidence * 100).toFixed(1)}%
												</div>
											</button>
										);
									})}
								</div>
							</div>
						)}

						{!added && (
							<button
								className="primary-btn"
								style={{ width: "100%", marginBottom: "0.75rem" }}
								onClick={handleConfirm}
								disabled={busy}
							>
								{busy ? "Adding…" : "Add to Collection"}
							</button>
						)}

						{prediction.candidates?.length > 1 && (
							<details>
								<summary className="muted" style={{ cursor: "pointer", fontSize: "0.85rem", userSelect: "none" }}>
									All candidates ({prediction.candidates.length})
								</summary>
								<ol style={{ margin: "0.6rem 0 0 1.1rem", padding: 0, display: "grid", gap: "0.35rem" }}>
									{prediction.candidates.map((c) => {
										const isSelected = !added && selectedCandidate?.generationId === c.generationId;
										return (
											<li key={c.key} style={{ fontSize: "0.87rem" }}>
												{added ? (
													<>
														<strong>{c.manufacturerName} {c.modelName}</strong>
														{" · "}{c.generationCode}
														<span className="muted"> — {(c.confidence * 100).toFixed(1)}%</span>
													</>
												) : (
													// Not just the top 3 quick-pick cards above — the right
													// answer isn't always near the top (e.g. a BMW M3 G80
													// ranked #6 behind the M4 G82 it got confused with), so
													// every candidate here needs to be selectable too.
													<button
														type="button"
														onClick={() => setSelectedCandidate(c)}
														style={{
															display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem",
															width: "calc(100% - 0.2rem)", padding: "0.15rem 0.4rem", borderRadius: "6px",
															background: isSelected ? "rgba(220,38,38,0.12)" : "transparent",
															border: `1px solid ${isSelected ? "rgba(220,38,38,0.5)" : "transparent"}`,
															cursor: "pointer", font: "inherit", color: "inherit", textAlign: "left",
														}}
													>
														<span>
															<strong>{c.manufacturerName} {c.modelName}</strong>
															{" · "}{c.generationCode}
														</span>
														<span className="muted" style={{ flexShrink: 0 }}>{(c.confidence * 100).toFixed(1)}%</span>
													</button>
												)}
											</li>
										);
									})}
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