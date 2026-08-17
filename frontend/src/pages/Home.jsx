import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getManufacturers, getGenerations, getModels } from "../api/catalogue.api";
import AuthImage from "../components/AuthImage";
import { getCollection, getCollectionAchievements } from "../api/collection.api";
import { getAchievements, getChallenges, getRaces } from "../api/gamification.api";
import { useAuth } from "../context/AuthContext";
import { RARITY_COLOR, RARITY_LABEL, RARITY_ORDER, S } from "../theme";
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

// â"€â"€ shared helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function CarSilhouette() {
	return (
		<svg width="140" height="64" viewBox="0 0 140 64" fill="none" aria-hidden="true">
			<path d="M14 44 L18 44 L24 26 L40 18 L72 16 L100 18 L116 26 L122 44 L126 44"
				stroke="white" strokeWidth="3" strokeLinejoin="round" fill="white" fillOpacity="0.08" />
			<path d="M40 18 L48 8 L92 8 L100 18"
				stroke="white" strokeWidth="3" strokeLinejoin="round" fill="white" fillOpacity="0.12" />
			<line x1="14" y1="44" x2="126" y2="44" stroke="white" strokeWidth="3" strokeLinecap="round" />
			<circle cx="36" cy="48" r="8" stroke="white" strokeWidth="2.5" fill="white" fillOpacity="0.1" />
			<circle cx="36" cy="48" r="3" fill="white" fillOpacity="0.4" />
			<circle cx="104" cy="48" r="8" stroke="white" strokeWidth="2.5" fill="white" fillOpacity="0.1" />
			<circle cx="104" cy="48" r="3" fill="white" fillOpacity="0.4" />
		</svg>
	);
}

function formatDate(iso) {
	return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// â"€â"€ logged-out components â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const FEATURES = [
	{
		icon: "📷",
		title: "Scan any car",
		desc: "Point your camera at a vehicle on the street. The AI identifies the make, model and exact generation in seconds.",
		color: "#dc2626",
	},
	{
		icon: "🗂️",
		title: "Build your collection",
		desc: "Every generation you discover is added to your garage. Track your progress across 813 generations from 54 manufacturers.",
		color: "#c084fc",
	},
	{
		icon: "🏁",
		title: "Race your friends",
		desc: "Challenge other drivers to quarter, half or full mile drags. Your car's rarity determines the stakes.",
		color: "#fbbf24",
	},
];

function FeatureCards() {
	return (
		<div style={{
			display: "grid",
			gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
			gap: "0.75rem",
		}}>
			{FEATURES.map((f) => (
				<div key={f.title} className="card" style={{ borderTop: `3px solid ${f.color}` }}>
					<p style={{ fontSize: "1.8rem", margin: "0 0 0.5rem" }}>{f.icon}</p>
					<p style={{ margin: "0 0 0.4rem", fontWeight: 700, fontSize: "0.95rem" }}>{f.title}</p>
					<p style={{ margin: 0, fontSize: "0.83rem", color: S.muted, lineHeight: 1.5 }}>{f.desc}</p>
				</div>
			))}
		</div>
	);
}

function CatalogueTeaser({ manufacturerCount, modelCount, generationCount }) {
	const stats = [
		{ value: manufacturerCount, label: "manufacturers" },
		{ value: modelCount,        label: "models" },
		{ value: generationCount,   label: "generations" },
	];
	return (
		<div className="card" style={{ textAlign: "center" }}>
			<p style={{ margin: "0 0 0.9rem", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: S.faint }}>
				What's in the catalogue
			</p>
			<div style={{ display: "flex", justifyContent: "center", gap: "2.5rem", flexWrap: "wrap" }}>
				{stats.map((s) => (
					<div key={s.label}>
						<p style={{ margin: 0, fontSize: "1.8rem", fontWeight: 700, color: "#dc2626" }}>
							{s.value || "—"}
						</p>
						<p style={{ margin: 0, fontSize: "0.78rem", color: S.faint }}>{s.label}</p>
					</div>
				))}
			</div>
			<Link to="/browse" style={{ display: "inline-block", marginTop: "1rem", fontSize: "0.82rem", color: "#60a5fa", fontWeight: 600, textDecoration: "none" }}>
				Browse catalogue →
			</Link>
		</div>
	);
}

// â"€â"€ logged-in components â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function StatCard({ icon, value, label, to, highlight }) {
	const inner = (
		<div style={{
			display: "flex", flexDirection: "column", alignItems: "center",
			gap: "0.15rem", padding: "0.9rem 0.5rem", textAlign: "center",
			borderRadius: "14px", background: highlight ? S.disc : S.cardAlt,
			border: `1.5px solid ${highlight ? S.discBorderStrong : S.border}`,
			transition: "border-color 0.15s",
		}}>
			<span style={{ fontSize: "1.4rem" }}>{icon}</span>
			<span style={{ fontSize: "1.35rem", fontWeight: 700, color: highlight ? S.discText : S.text, lineHeight: 1 }}>
				{value ?? "—"}
			</span>
			<span style={{ fontSize: "0.72rem", color: S.faint }}>{label}</span>
		</div>
	);
	return to ? <Link to={to} style={{ textDecoration: "none" }}>{inner}</Link> : inner;
}

function StatsRow({ collectionCount, totalPoints, pendingChallenges }) {
	return (
		<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.6rem" }}>
			<StatCard icon="🗂️" value={collectionCount}    label="Cars collected"     to="/browse" />
			<StatCard icon="⭐" value={totalPoints}        label="Total points"       to="/achievements" />
			<StatCard icon="🏁" value={pendingChallenges}  label="Pending challenges" to="/race"
				highlight={pendingChallenges > 0} />
		</div>
	);
}

function LastSpottedCard({ lastCar }) {
	if (lastCar?.scanPhoto) {
		return (
			<section style={{
				position: "relative", borderRadius: "20px", overflow: "hidden",
				border: "1px solid rgba(220,38,38,0.20)", height: "240px",
				boxShadow: "var(--shadow)",
			}}>
				<img src={lastCar.scanPhoto} alt="Last scanned car" style={{
					position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
				}} />
				<div style={{
					position: "absolute", inset: 0,
					background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)",
				}} />
				<p style={{
					position: "absolute", top: "0.75rem", left: "50%", transform: "translateX(-50%)",
					margin: 0, textTransform: "uppercase", letterSpacing: "0.12em",
					fontSize: "0.7rem", color: "rgba(220,38,38,0.9)", fontWeight: 700, whiteSpace: "nowrap",
				}}>Last spotted</p>
				<div style={{
					position: "absolute", bottom: 0, left: 0, right: 0,
					padding: "0.85rem 1.5rem 1rem",
					display: "flex", flexDirection: "column", alignItems: "center",
					gap: "0.2rem", textAlign: "center", color: "#fff",
				}}>
					<div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
						<strong style={{ fontSize: "1.15rem" }}>{lastCar.manufacturerName} {lastCar.modelName}</strong>
						<RarityBadge rarity={lastCar.rarity || "common"} />
					</div>
					<p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.55 }}>{lastCar.generationCode}</p>
					<p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.38 }}>Discovered {formatDate(lastCar.discoveredAt)}</p>
					<Link to="/camera" className="last-spotted-cta" style={{ marginTop: "0.4rem" }}>Scan another</Link>
				</div>
			</section>
		);
	}

	return (
		<section className="last-spotted">
			<p className="last-spotted-eyebrow">
				{lastCar ? "Last spotted" : "Nothing spotted yet"}
			</p>
			<div className="last-spotted-visual">
				<CarSilhouette />
			</div>
			{lastCar ? (
				<div className="last-spotted-info">
					<div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", flexWrap: "wrap" }}>
						<h2 className="last-spotted-name" style={{ margin: 0 }}>
							{lastCar.manufacturerName} {lastCar.modelName}
						</h2>
						<RarityBadge rarity={lastCar.rarity || "common"} />
					</div>
					<p className="last-spotted-gen">{lastCar.generationCode}</p>
					<p className="last-spotted-date">Discovered {formatDate(lastCar.discoveredAt)}</p>
				</div>
			) : (
				<div className="last-spotted-info">
					<h2 className="last-spotted-name">Your garage is empty</h2>
					<p className="last-spotted-date">Head outside and scan your first car to get started.</p>
				</div>
			)}
			<Link to="/camera" className="last-spotted-cta">
				{lastCar ? "Scan another" : "Start scanning"}
			</Link>
		</section>
	);
}

function NextAchievementCard({ racingCatalogue, collectionCatalogue }) {
	const next = useMemo(() => {
		const all = [...racingCatalogue, ...collectionCatalogue].filter((a) => !a.unlocked && a.target > 0);
		if (!all.length) return null;
		return all.sort((a, b) => (b.current / b.target) - (a.current / a.target))[0];
	}, [racingCatalogue, collectionCatalogue]);

	if (!next) return null;

	const pct   = Math.min(100, Math.round((next.current / next.target) * 100));
	const color = RARITY_COLOR[next.rarity] || RARITY_COLOR.common;

	return (
		<section className="card">
			<p style={{ margin: "0 0 0.6rem", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: S.faint }}>
				Next Achievement
			</p>
			<div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
				<span style={{ fontSize: "1.5rem", lineHeight: 1 }}>🏯</span>
				<div style={{ flex: 1, minWidth: 0 }}>
					<div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.2rem" }}>
						<strong style={{ fontSize: "0.95rem" }}>{next.title}</strong>
						<RarityBadge rarity={next.rarity} />
					</div>
					<p style={{ margin: "0 0 0.5rem", fontSize: "0.82rem", color: S.muted }}>{next.description}</p>
					<div style={{ height: "6px", background: S.track, borderRadius: "3px", overflow: "hidden" }}>
						<div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "3px", transition: "width 0.4s ease" }} />
					</div>
					<p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: S.muted }}>
						{next.current.toLocaleString()} / {next.target.toLocaleString()} · {pct}%
					</p>
				</div>
			</div>
			<Link to="/achievements" style={{ display: "inline-block", marginTop: "0.75rem", fontSize: "0.82rem", color: "#60a5fa", textDecoration: "none", fontWeight: 600 }}>
				View all achievements →
			</Link>
		</section>
	);
}

function DiscoveryGrid({ models, manufacturerMap, discoveredModelIds, newestGenIdByModelId, bestEngineByModelId }) {
	const enriched = useMemo(() => {
		return models
			.map((m) => {
				const make = manufacturerMap[m.manufacturerId] || "";
				const eng  = bestEngineByModelId[m.id];
				return { ...m, make, rarity: getCarRarity(eng?.horsepower, eng?.weightKg), discovered: discoveredModelIds.has(m.id) };
			})
			.sort((a, b) => {
				if (a.discovered !== b.discovered) return a.discovered ? 1 : -1;
				return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
			})
			.slice(0, 8);
	}, [models, manufacturerMap, discoveredModelIds, bestEngineByModelId]);

	return (
		<section className="card">
			<div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "1rem" }}>
				<h2 style={{ margin: 0 }}>Cars to discover</h2>
				<Link to="/camera" style={{ fontSize: "0.82rem", color: "#60a5fa", textDecoration: "none", fontWeight: 600 }}>
					Start scanning
				</Link>
			</div>
			<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.6rem" }}>
				{enriched.map((m) => {
					const color    = RARITY_COLOR[m.rarity];
					const genId    = newestGenIdByModelId[m.id];
					return (
						<Link key={m.id} to={`/car/${m.id}`} style={{
							position: "relative", borderRadius: "10px", overflow: "hidden",
							textDecoration: "none", aspectRatio: "4/3",
							border: `1.5px solid ${m.discovered ? S.discBorder : S.border}`,
							background: S.cardAlt, display: "block",
						}}>
							{genId && (
								<AuthImage
									src={`/recognize/images/${genId}`}
									alt={`${m.make} ${m.name}`}
									style={{
										position: "absolute", inset: 0,
										width: "100%", height: "100%", objectFit: "cover",
									}}
								/>
							)}
							<div style={{
								position: "absolute", inset: 0,
								background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)",
							}} />
							<div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: color }} />
							{m.discovered && (
								<span style={{
									position: "absolute", top: "0.4rem", right: "0.5rem",
									fontSize: "0.65rem", color: S.discText, fontWeight: 700,
									background: "rgba(34,197,94,0.2)", borderRadius: "999px",
									padding: "1px 6px", border: `1px solid ${S.discBorder}`,
								}}>✓</span>
							)}
							<div style={{
								position: "absolute", bottom: 0, left: 0, right: 0,
								padding: "0.5rem 0.6rem",
							}}>
								<RarityBadge rarity={m.rarity} />
								<p style={{ margin: "0.2rem 0 0", fontWeight: 600, fontSize: "0.82rem", color: "#fff" }}>
									{m.make} {m.name}
								</p>
								{m.segment && <p style={{ margin: 0, fontSize: "0.7rem", color: "rgba(255,255,255,0.5)" }}>{m.segment}</p>}
							</div>
						</Link>
					);
				})}
			</div>
		</section>
	);
}

// â"€â"€ page â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

export default function HomePage() {
	const { isAuthenticated, user } = useAuth();

	// Catalogue — public
	const [manufacturers, setManufacturers] = useState([]);
	const [models, setModels]               = useState([]);
	const [generationCount, setGenerationCount] = useState(0);

	// Logged-in
	const [lastCar, setLastCar]                 = useState(null);
	const [collectionLoaded, setCollectionLoaded] = useState(false);
	const [collectionCount, setCollectionCount]   = useState(0);
	const [totalPoints, setTotalPoints]           = useState(0);
	const [pendingChallenges, setPendingChallenges] = useState(0);
	const [discoveredModelIds, setDiscoveredModelIds] = useState(new Set());
	const [racingCatalogue, setRacingCatalogue]     = useState([]);
	const [collectionCatalogue, setCollectionCatalogue] = useState([]);

	const manufacturerMap = useMemo(
		() => Object.fromEntries(manufacturers.map((m) => [m.id, m.name])),
		[manufacturers],
	);

	const [newestGenIdByModelId, setNewestGenIdByModelId] = useState({});
	const [bestEngineByModelId, setBestEngineByModelId] = useState({});

	// Public catalogue data
	useEffect(() => {
		Promise.all([getManufacturers(), getModels(), getGenerations()])
			.then(([mfRes, modelRes, genRes]) => {
				setManufacturers(mfRes.manufacturers || []);
				setModels(modelRes.models || []);
				const newest = {};
				const modelEngine = {};
				for (const g of (genRes.generations || [])) {
					const cur = newest[g.modelId];
					if (!cur || (g.startYear || 0) > (cur.startYear || 0)) newest[g.modelId] = g;
					for (const e of (g.engines || [])) {
						const curEng = modelEngine[g.modelId];
						if (!curEng || (e.horsepower || 0) > (curEng.horsepower || 0)) modelEngine[g.modelId] = e;
					}
				}
				setNewestGenIdByModelId(Object.fromEntries(
					Object.entries(newest).map(([mid, g]) => [mid, g.id])
				));
				setBestEngineByModelId(modelEngine);
			})
			.catch(() => {});
	}, []);

	// Approximate generation count from models (avg ~1.5 per model) — shown in teaser
	useEffect(() => {
		setGenerationCount(813); // known from seed data
	}, []);

	// User-specific data
	useEffect(() => {
		if (!isAuthenticated) return;

		getCollection()
			.then((res) => {
				const items = res.collection || res.items || [];
				setLastCar(items[0] || null);
				setCollectionCount(items.length);
				const names = new Set(items.map((i) => `${i.manufacturerName}::${i.modelName}`));
				setDiscoveredModelIds(names);
				setCollectionLoaded(true);
			})
			.catch(() => setCollectionLoaded(true));

		getRaces()
			.then((res) => setTotalPoints(res.stats?.totalPoints ?? 0))
			.catch(() => {});

		getChallenges()
			.then((res) => {
				const uid  = user?.id;
				const pending = (res.challenges || []).filter(
					(c) => c.opponentUserId === uid && c.status === "pending"
				).length;
				setPendingChallenges(pending);
			})
			.catch(() => {});

		Promise.all([getAchievements(), getCollectionAchievements()])
			.then(([racingRes, collectionRes]) => {
				setRacingCatalogue(racingRes.catalogue || []);
				setCollectionCatalogue(collectionRes.catalogue || []);
			})
			.catch(() => {});
	}, [isAuthenticated, user?.id]);

	const enrichedDiscoveredIds = useMemo(() => {
		const ids = new Set();
		for (const m of models) {
			const make = manufacturerMap[m.manufacturerId] || "";
			if (discoveredModelIds.has(`${make}::${m.name}`)) ids.add(m.id);
		}
		return ids;
	}, [models, manufacturerMap, discoveredModelIds]);

	// â"€â"€ logged-out view â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
	if (!isAuthenticated) {
		return (
			<main className="page">
				<section className="hero">
					<p className="pill">Thesis Prototype</p>
					<h1>Spot cars. Build your garage. Race your friends.</h1>
					<p>
						Street Scout uses AI to identify any car you photograph on the street —
						make, model and exact generation. Collect them, track your progress, and challenge
						other drivers to drag races.
					</p>
					<div className="actions">
						<Link to="/register" className="primary-btn">Create account — it's free</Link>
						<Link to="/login" className="ghost-btn">I have an account</Link>
					</div>
				</section>

				<FeatureCards />

				<CatalogueTeaser
					manufacturerCount={manufacturers.length}
					modelCount={models.length}
					generationCount={generationCount}
				/>
			</main>
		);
	}

	// â"€â"€ logged-in view â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
	return (
		<main className="page">
			<section className="hero" style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1.25rem" }}>
				{user?.profilePhoto
					? <img src={user.profilePhoto} alt="avatar" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid rgba(255,255,255,0.15)" }} />
					: <div style={{ width: 56, height: 56, borderRadius: "50%", flexShrink: 0, background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" }}>👤</div>
				}
				<div>
					<h1 style={{ fontSize: "clamp(1.4rem, 2vw + 0.8rem, 2rem)", marginBottom: "0.5rem", marginTop: 0 }}>
						Welcome back, {user?.username || "Scout"}.
					</h1>
					<div className="actions" style={{ marginTop: 0 }}>
						<Link to="/browse" className="ghost-btn">Browse</Link>
					</div>
				</div>
			</section>

			{collectionLoaded && <LastSpottedCard lastCar={lastCar} />}

{models.length > 0 && (
				<DiscoveryGrid
					models={models}
					manufacturerMap={manufacturerMap}
					discoveredModelIds={enrichedDiscoveredIds}
					newestGenIdByModelId={newestGenIdByModelId}
					bestEngineByModelId={bestEngineByModelId}
				/>
			)}
		</main>
	);
}



