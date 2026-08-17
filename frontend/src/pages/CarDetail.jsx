import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getModelById, getModelGenerations } from "../api/catalogue.api";
import { getCollection } from "../api/collection.api";
import { useAuth } from "../context/AuthContext";
import { RARITY_COLOR, RARITY_LABEL, S, DRIVETRAIN_COLOR } from "../theme";
import AuthImage from "../components/AuthImage";
import { getCarRarity } from "../utils/rarity";

// â"€â"€ rarity helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function RarityBadge({ rarity }) {
	const color = RARITY_COLOR[rarity] || RARITY_COLOR.common;
	return (
		<span style={{
			fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.05em",
			textTransform: "uppercase", color,
			background: `${color}18`, border: `1px solid ${color}44`,
			borderRadius: "4px", padding: "1px 6px", whiteSpace: "nowrap",
		}}>
			{RARITY_LABEL[rarity] || rarity}
		</span>
	);
}

function DrivetrainBadge({ drivetrain }) {
	if (!drivetrain) return null;
	const color = DRIVETRAIN_COLOR[drivetrain] || "#6b7280";
	return (
		<span style={{
			fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.04em",
			color, background: `${color}15`, border: `1px solid ${color}44`,
			borderRadius: "4px", padding: "1px 6px", whiteSpace: "nowrap",
		}}>
			{drivetrain}
		</span>
	);
}

// â"€â"€ page â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function GenPhoto({ genId, genCode, discovered }) {
	const [errored, setErrored] = useState(false);

	if (errored) {
		return (
			<div style={{
				position: "absolute", inset: 0, display: "flex",
				alignItems: "center", justifyContent: "center",
				color: S.faint, fontSize: "0.78rem", fontWeight: 600,
				textAlign: "center", padding: "0.5rem",
			}}>
				{genCode}
			</div>
		);
	}

	return (
		<>
			<AuthImage
				src={`/recognize/images/${genId}`}
				alt={genCode}
				onError={() => setErrored(true)}
				style={{
					position: "absolute", inset: 0,
					width: "100%", height: "100%", objectFit: "cover",
					filter: discovered ? "none" : "blur(7px) saturate(0.3)",
					transform: discovered ? "none" : "scale(1.15)",
					transition: "filter 0.35s ease, transform 0.35s ease",
				}}
			/>
			{!discovered && (
				<div style={{
					position: "absolute", inset: 0, display: "flex",
					alignItems: "center", justifyContent: "center", zIndex: 1,
				}}>
					<span style={{ fontSize: "1.3rem" }}>{"🔒"}</span>
				</div>
			)}
		</>
	);
}

export default function CarDetailPage() {
	const { modelId } = useParams();
	const { isAuthenticated } = useAuth();

	const [model, setModel]             = useState(null);
	const [manufacturer, setManufacturer] = useState(null);
	const [generations, setGenerations] = useState([]);
	const [discoveredIds, setDiscoveredIds] = useState(new Set());
	const [loading, setLoading]         = useState(true);

	useEffect(() => {
		Promise.all([getModelById(modelId), getModelGenerations(modelId)])
			.then(([modelRes, genRes]) => {
				setModel(modelRes.model || null);
				setManufacturer(modelRes.manufacturer || null);
				setGenerations(genRes.generations || []);
			})
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [modelId]);

	useEffect(() => {
		if (!isAuthenticated) return;
		getCollection()
			.then((res) => {
				const items = res.collection || res.items || [];
				setDiscoveredIds(new Set(items.map((i) => i.generationId)));
			})
			.catch(() => {});
	}, [isAuthenticated]);

	if (loading) {
		return (
			<main className="page">
				<section className="card"><p className="muted">Loadingâ€¦</p></section>
			</main>
		);
	}

	if (!model) {
		return (
			<main className="page">
				<section className="card"><p className="muted">Model not found.</p></section>
			</main>
		);
	}

	// Preview rarity from the best (highest-hp) engine across this model's
	// generations — no owned/scanned item to read from at this browsing level.
	const bestEngine = generations.reduce((best, gen) => {
		for (const e of (gen.engines || [])) {
			if (!best || (e.horsepower || 0) > (best.horsepower || 0)) best = e;
		}
		return best;
	}, null);
	const rarity = getCarRarity(bestEngine?.horsepower, bestEngine?.weightKg);
	const color  = RARITY_COLOR[rarity];
	const discoveredCount = generations.filter((g) => discoveredIds.has(g.id)).length;

	return (
		<main className="page">
			{/* Breadcrumb */}
			<div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0 0.25rem", marginBottom: "0.75rem", fontSize: "0.85rem", flexWrap: "wrap" }}>
				<Link to="/browse" style={{ color: S.muted, textDecoration: "none" }}>Catalogue</Link>
				<span style={{ color: S.faint }}>â€ş</span>
				{manufacturer && (
					<>
						<Link to={`/browse/${manufacturer.id}`} style={{ color: S.muted, textDecoration: "none" }}>
							{manufacturer.name}
						</Link>
						<span style={{ color: S.faint }}>â€ş</span>
					</>
				)}
				<span style={{ color: S.textSub, fontWeight: 600 }}>{model.name}</span>
			</div>

			{/* Model header */}
			<section className="card" style={{ borderLeft: `4px solid ${color}` }}>
				<div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
					<div>
						<h1 style={{ margin: "0 0 0.4rem" }}>
							{manufacturer?.name} {model.name}
						</h1>
						<div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
							<RarityBadge rarity={rarity} />
							{model.segment && (
								<span style={{
									fontSize: "0.72rem", color: S.muted, background: S.cardAlt,
									border: `1px solid ${S.border}`, borderRadius: "4px", padding: "1px 6px",
								}}>
									{model.segment}
								</span>
							)}
							{manufacturer?.country && (
								<span style={{ fontSize: "0.8rem", color: S.faint }}>
									{manufacturer.country}
								</span>
							)}
						</div>
					</div>
					{isAuthenticated && generations.length > 0 && (
						<div style={{ textAlign: "right" }}>
							<p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: discoveredCount > 0 ? S.discText : S.faint }}>
								{discoveredCount} / {generations.length}
							</p>
							<p style={{ margin: 0, fontSize: "0.72rem", color: S.faint }}>generations found</p>
						</div>
					)}
				</div>
			</section>

			{/* Generations */}
			<section className="card">
				<h2 style={{ marginTop: 0 }}>Generations</h2>
				<div style={{
					display: "grid",
					gridTemplateColumns: "repeat(3, 1fr)",
					gap: "0.75rem",
				}}>
					{generations.map((gen) => {
						const found = discoveredIds.has(gen.id);
						return (
							<div
								key={gen.id}
								style={{
									display: "flex", flexDirection: "column",
									borderRadius: "14px", overflow: "hidden",
									border: `1.5px solid ${found ? S.discBorderStrong : S.border}`,
									background: S.cardAlt, aspectRatio: "1 / 1",
								}}
							>
								{/* top — photo */}
								<div style={{ flex: 1, position: "relative", overflow: "hidden", background: S.card, minHeight: 0 }}>
									<div style={{
										position: "absolute", top: 0, left: 0, right: 0,
										height: "3px", background: color, zIndex: 1,
									}} />
									<GenPhoto genId={gen.id} genCode={gen.code} discovered={found} />
									{found && (
										<span style={{
											position: "absolute", top: "0.5rem", right: "0.5rem", zIndex: 2,
											fontSize: "0.65rem", color: S.discText, fontWeight: 700,
											background: "rgba(34,197,94,0.18)", borderRadius: "999px",
											padding: "1px 7px", border: `1px solid ${S.discBorder}`,
										}}>
											{"✓"}
										</span>
									)}
								</div>

								{/* divider */}
								<div style={{ height: "1px", background: S.border, flexShrink: 0 }} />

								{/* bottom — info */}
								<div style={{ padding: "0.6rem 0.75rem 0.7rem", flexShrink: 0 }}>
									<div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.2rem" }}>
										<strong style={{ fontSize: "0.88rem", color: S.text }}>{gen.code}</strong>
										<DrivetrainBadge drivetrain={gen.drivetrain} />
									</div>
									<p style={{ margin: 0, fontSize: "0.72rem", color: S.muted }}>
										{gen.startYear}{gen.endYear ? ` – ${gen.endYear}` : " – present"}
									</p>
								</div>
							</div>
						);
					})}
				</div>
			</section>
		</main>
	);
}



