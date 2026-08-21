import { useEffect, useRef, useState } from "react";
import AuthImage from "../components/AuthImage";
import ProgressBar from "../components/ProgressBar";
import { getCatalogueStats } from "../api/catalogue.api";
import { uploadProfilePhoto } from "../api/auth.api";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../context/CollectionContext";
import { RARITY_COLOR, RARITY_LABEL, S } from "../theme";

const RARITY_STRIP_BG = {
	legendary: "#1a1100",
	epic:      "#15092a",
	rare:      "#081428",
	common:    "#101012",
};

const RARITY_NOTICE_KEY = "streetscout_rarity_notice_dismissed";

function RarityChangeNotice() {
	const [dismissed, setDismissed] = useState(() => {
		try {
			return localStorage.getItem(RARITY_NOTICE_KEY) === "true";
		} catch {
			return false;
		}
	});

	if (dismissed) return null;

	function handleDismiss() {
		setDismissed(true);
		try {
			localStorage.setItem(RARITY_NOTICE_KEY, "true");
		} catch { /* ignore — worst case it shows again next visit */ }
	}

	return (
		<div style={{
			display: "flex", alignItems: "flex-start", gap: "0.75rem",
			padding: "0.75rem 1rem", borderRadius: "8px", marginBottom: "0.85rem",
			background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.25)",
		}}>
			<span style={{ fontSize: "1.1rem", flexShrink: 0 }}>ℹ️</span>
			<div style={{ flex: 1, fontSize: "0.85rem", color: S.textSub, lineHeight: 1.5 }}>
				<strong style={{ color: S.text }}>Rarity is based on real performance,</strong> not badge
				prestige — a car's power-to-weight ratio decides its tier, so a genuinely fast car can
				outrank a heavy luxury SUV regardless of manufacturer. If a car below looks like it
				changed tier, that's why.
			</div>
			<button
				type="button"
				onClick={handleDismiss}
				aria-label="Dismiss"
				style={{
					background: "transparent", border: "none", color: S.faint,
					cursor: "pointer", fontSize: "1rem", padding: "0 0.25rem", flexShrink: 0, lineHeight: 1,
				}}
			>
				×
			</button>
		</div>
	);
}

function StatRow({ label, value }) {
	return (
		<div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "0.4rem" }}>
			<div style={{ fontSize: "1rem", fontWeight: 800, color: "#f1f1f3", lineHeight: 1 }}>
				{value ?? "—"}
			</div>
			<div style={{ fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.32)", marginTop: "0.12rem" }}>
				{label}
			</div>
		</div>
	);
}

export default function ProfilePage() {
	const { user, updateUser } = useAuth();
	const { items, progress, removeItem } = useCollection();
	const [catalogueStats, setCatalogueStats] = useState(null);
	const [uploading, setUploading] = useState(false);
	const fileInputRef       = useRef(null);
	const cameraFileInputRef = useRef(null);

	useEffect(() => {
		getCatalogueStats()
			.then((data) => setCatalogueStats(data))
			.catch(() => {});
	}, []);

	function handlePhotoClick() {
		fileInputRef.current?.click();
	}

	function handleCameraClick() {
		cameraFileInputRef.current?.click();
	}

	async function handleFileChange(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		setUploading(true);
		const reader = new FileReader();
		reader.onload = async (ev) => {
			try {
				const result = await uploadProfilePhoto(ev.target.result);
				updateUser({ profilePhoto: result.user.profilePhoto });
			} catch {
				/* swallow */
			} finally {
				setUploading(false);
			}
		};
		reader.readAsDataURL(file);
		e.target.value = "";
	}

	return (
		<main className="page">
			{/* Header */}
			<section className="card" style={{ display: "flex", alignItems: "center", gap: "2rem", padding: "2rem" }}>
				<div
					onClick={handlePhotoClick}
					style={{
						width: 120, height: 120, borderRadius: "50%", flexShrink: 0,
						background: S.cardAlt, border: `3px solid ${S.borderStrong}`,
						overflow: "hidden", cursor: "pointer", position: "relative",
						display: "flex", alignItems: "center", justifyContent: "center",
					}}
					title="Click to change photo"
				>
					{user?.profilePhoto
						? <img src={user.profilePhoto} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
						: <span style={{ fontSize: "3rem", color: S.faint }}>👤</span>
					}
					{uploading && (
						<div style={{
							position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)",
							display: "flex", alignItems: "center", justifyContent: "center",
							fontSize: "0.75rem", color: "#fff",
						}}>...</div>
					)}
				</div>
				<input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
				<input ref={cameraFileInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFileChange} />
				<div>
					<h1 style={{ margin: "0 0 0.5rem", fontSize: "2rem" }}>{user?.username || user?.email}</h1>
					<div style={{ display: "flex", gap: "0.5rem" }}>
						<button
							className="primary-btn"
							style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}
							onClick={handleCameraClick}
							disabled={uploading}
						>
							<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
							Take Photo
						</button>
						<button
							className="ghost-btn"
							style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}
							onClick={handlePhotoClick}
							disabled={uploading}
						>
							<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
							</svg>
							From Gallery
						</button>
					</div>
				</div>
			</section>

			{/* Progress */}
			<section className="card">
				<h2>Progress</h2>
				<ProgressBar label="Generations" current={progress?.discoveredGenerations || 0} target={catalogueStats?.generations || "—"} />
				<ProgressBar label="Models" current={progress?.discoveredModels || 0} target={catalogueStats?.models || "—"} />
				<ProgressBar label="Manufacturers" current={progress?.discoveredManufacturers || 0} target={catalogueStats?.manufacturers || "—"} />
			</section>

			{/* Collection */}
			<section>
				<h2>Your Collection</h2>
				<RarityChangeNotice />
				<div className="grid two-col">
					{items.map((item) => (
						<CollectionCard key={`${item.generationId}-${item.discoveredAt}`} item={item} onRemove={removeItem} />
					))}
				</div>
			</section>
		</main>
	);
}

function CollectionCard({ item, onRemove }) {
	const eng    = item.engine;
	const rarity = item.rarity || "common";
	const color  = RARITY_COLOR[rarity];

	return (
		<article style={{
			display: "flex", height: 210, borderRadius: "10px", overflow: "hidden",
			background: S.card, border: `1px solid ${color}40`,
			boxShadow: `0 2px 20px ${color}14`,
		}}>
			{/* Left rarity strip */}
			<div style={{
				width: 30, flexShrink: 0,
				background: RARITY_STRIP_BG[rarity],
				borderRight: `2px solid ${color}55`,
				display: "flex", alignItems: "center", justifyContent: "center",
			}}>
				<span style={{
					writingMode: "vertical-rl", textOrientation: "mixed",
					transform: "rotate(180deg)",
					fontSize: "0.6rem", fontWeight: 900, color,
					letterSpacing: "0.18em", textTransform: "uppercase",
				}}>
					{RARITY_LABEL[rarity]}
				</span>
			</div>

			{/* Center: photo + make/model gradient overlay */}
			<div style={{ flex: 1, position: "relative", overflow: "hidden", minWidth: 0 }}>
				{item.scanPhoto
					? <img src={item.scanPhoto} alt={`${item.manufacturerName} ${item.modelName}`}
					       style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
					: <AuthImage src={`/recognize/images/${item.generationId}`} alt={`${item.manufacturerName} ${item.modelName}`}
					             style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
				}
				<div style={{
					position: "absolute", inset: 0,
					background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 55%)",
					display: "flex", flexDirection: "column", justifyContent: "flex-end",
					padding: "0 0.7rem 0.55rem",
				}}>
					<div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#f1f1f3", lineHeight: 1.25 }}>
						{item.manufacturerName} {item.modelName}
					</div>
					<div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", marginTop: "0.1rem" }}>
						Gen {item.generationCode}
					</div>
				</div>
				{onRemove && (
					<button
						type="button"
						onClick={() => onRemove(item.generationId)}
						title="Remove from collection"
						style={{
							position: "absolute", top: 6, right: 6,
							width: 22, height: 22, borderRadius: "50%", padding: 0,
							background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.18)",
							color: "rgba(255,255,255,0.65)", cursor: "pointer",
							fontSize: "0.75rem", lineHeight: "22px", textAlign: "center",
						}}
					>
						×
					</button>
				)}
			</div>

			{/* Right stats panel */}
			<div style={{
				width: 88, flexShrink: 0,
				background: "#09090f",
				borderLeft: "1px solid rgba(255,255,255,0.06)",
				display: "flex", flexDirection: "column", justifyContent: "space-evenly",
				padding: "0.55rem 0.6rem",
				gap: "0.35rem",
			}}>
				{eng ? (
					<>
						<div style={{
							fontSize: "0.62rem", fontWeight: 700,
							color: "rgba(255,255,255,0.38)", textTransform: "uppercase",
							letterSpacing: "0.06em", lineHeight: 1.3,
						}}>
							{eng.name}
						</div>
						<StatRow label="HP" value={eng.horsepower} />
						<StatRow label="Nm" value={eng.torqueNm} />
						<StatRow label="KG" value={eng.weightKg} />
					</>
				) : (
					<div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
						Engine<br />unknown
					</div>
				)}
			</div>
		</article>
	);
}