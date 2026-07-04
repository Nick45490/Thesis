import { useEffect, useState } from "react";
import { getCollectionAchievements } from "../api/collection.api";
import { getAchievements } from "../api/gamification.api";
import { RARITY_COLOR, RARITY_LABEL, S } from "../theme";

const RARITY_BG = {
	common:    "rgba(156,163,175,0.12)",
	rare:      "rgba(96,165,250,0.12)",
	epic:      "rgba(192,132,252,0.12)",
	legendary: "rgba(251,191,36,0.12)",
};

const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3 };

function RarityBadge({ rarity }) {
	const color = RARITY_COLOR[rarity] || RARITY_COLOR.common;
	const bg    = RARITY_BG[rarity]    || RARITY_BG.common;
	return (
		<span style={{
			fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.05em",
			textTransform: "uppercase", color,
			background: bg, border: `1px solid ${color}55`,
			borderRadius: "4px", padding: "1px 6px",
		}}>
			{RARITY_LABEL[rarity] || rarity}
		</span>
	);
}

function ProgressBar({ current, target }) {
	const pct = Math.min(100, Math.round((current / target) * 100));
	return (
		<div style={{ marginTop: "0.4rem" }}>
			<div style={{ height: "6px", background: S.track, borderRadius: "3px", overflow: "hidden" }}>
				<div style={{
					height: "100%", width: `${pct}%`,
					background: "#60a5fa", borderRadius: "3px",
					transition: "width 0.4s ease",
				}} />
			</div>
			<p style={{ fontSize: "0.75rem", color: S.muted, margin: "0.2rem 0 0" }}>
				{current.toLocaleString()} / {target.toLocaleString()}
			</p>
		</div>
	);
}

function AchievementCard({ item }) {
	const color = RARITY_COLOR[item.rarity] || RARITY_COLOR.common;
	return (
		<div style={{
			display: "flex", flexDirection: "column", gap: "0.2rem",
			padding: "0.85rem 1rem", borderRadius: "8px",
			border: item.unlocked ? `1px solid ${color}55` : `1px solid ${S.border}`,
			background: item.unlocked ? `${color}12` : S.cardAlt,
			opacity: item.unlocked ? 1 : 0.75,
		}}>
			<div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
				<span style={{ fontSize: "1.1rem" }}>{item.unlocked ? "🏆" : "🔒"}</span>
				<strong style={{ flex: 1, color: S.text }}>{item.title}</strong>
				<RarityBadge rarity={item.rarity} />
			</div>
			<p style={{ margin: 0, fontSize: "0.85rem", color: S.muted }}>{item.description}</p>
			{item.unlocked ? (
				<p style={{ margin: 0, fontSize: "0.75rem", color: S.discText }}>
					Unlocked {new Date(item.unlockedAt).toLocaleDateString()}
				</p>
			) : (
				<ProgressBar current={item.current} target={item.target} />
			)}
		</div>
	);
}

function AchievementSection({ title, catalogue }) {
	const sorted = [...catalogue].sort((a, b) => {
		if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
		return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
	});
	const unlockedCount = catalogue.filter((a) => a.unlocked).length;

	return (
		<section className="card">
			<div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "1rem" }}>
				<h2 style={{ margin: 0 }}>{title}</h2>
				<span style={{ fontSize: "0.85rem", color: S.faint }}>
					{unlockedCount} / {catalogue.length} unlocked
				</span>
			</div>
			<div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
				{sorted.map((item) => <AchievementCard key={item.code} item={item} />)}
			</div>
		</section>
	);
}

export default function AchievementsPage() {
	const [racingCatalogue,        setRacingCatalogue]        = useState([]);
	const [collectionCatalogue,    setCollectionCatalogue]    = useState([]);
	const [completionistCatalogue, setCompletionistCatalogue] = useState([]);
	const [countryCatalogue,       setCountryCatalogue]       = useState([]);
	const [loading, setLoading]                               = useState(true);

	useEffect(() => {
		Promise.all([getAchievements(), getCollectionAchievements()])
			.then(([racingRes, collectionRes]) => {
				setRacingCatalogue(racingRes.catalogue || []);
				setCollectionCatalogue(collectionRes.catalogue || []);
				setCompletionistCatalogue(collectionRes.completionistCatalogue || []);
				setCountryCatalogue(collectionRes.countryCatalogue || []);
			})
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	if (loading) {
		return <main className="page"><section className="card"><p className="muted">Loading…</p></section></main>;
	}

	return (
		<main className="page">
			<h1 style={{ padding: "0 0.25rem" }}>Achievements</h1>
			<AchievementSection title="Collection"         catalogue={collectionCatalogue} />
			<AchievementSection title="Racing"             catalogue={racingCatalogue} />
			{completionistCatalogue.length > 0 && (
				<AchievementSection title="Make Completionist"    catalogue={completionistCatalogue} />
			)}
			{countryCatalogue.length > 0 && (
				<AchievementSection title="Country Completionist" catalogue={countryCatalogue} />
			)}
		</main>
	);
}
