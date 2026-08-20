import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getLeaderboard } from "../api/gamification.api";
import { S } from "../theme";

const PERIODS = [
	{ value: "weekly",  label: "This Week" },
	{ value: "monthly", label: "This Month" },
	{ value: "all",     label: "All-Time" },
];

const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };

function LeaderboardRow({ entry, rank, isMe }) {
	return (
		<li style={{
			display: "flex", alignItems: "center", gap: "0.85rem",
			padding: "0.6rem 0.85rem", borderRadius: "8px",
			border: `3px solid ${isMe ? "#60a5fa" : S.borderStrong}`,
			background: isMe ? "rgba(96,165,250,0.08)" : "transparent",
		}}>
			<span style={{ width: 28, textAlign: "center", fontSize: MEDAL[rank] ? "1.3rem" : "0.95rem", fontWeight: 700, color: MEDAL[rank] ? undefined : S.faint, flexShrink: 0 }}>
				{MEDAL[rank] || rank}
			</span>
			<span style={{ flex: 1, fontWeight: isMe ? 700 : 500, color: S.text }}>
				{entry.username || `User #${entry.userId}`}{isMe && " (you)"}
			</span>
			<span style={{ fontSize: "0.78rem", color: S.faint, flexShrink: 0 }}>
				{entry.racesCompleted} race{entry.racesCompleted === 1 ? "" : "s"}
			</span>
			<span style={{ fontWeight: 700, color: S.discText, minWidth: "4.5rem", textAlign: "right", flexShrink: 0 }}>
				{entry.points.toLocaleString()} pts
			</span>
		</li>
	);
}

export default function LeaderboardPage() {
	const { user } = useAuth();
	const [period, setPeriod]         = useState("weekly");
	const [entries, setEntries]       = useState([]);
	const [loading, setLoading]       = useState(true);
	const [error, setError]           = useState(null);

	useEffect(() => {
		setLoading(true);
		setError(null);
		getLeaderboard(period)
			.then((res) => setEntries(res.leaderboard || []))
			.catch(() => setError("Could not load the leaderboard."))
			.finally(() => setLoading(false));
	}, [period]);

	return (
		<main className="page">
			<h1 style={{ padding: "0 0.25rem" }}>Leaderboard</h1>

			<section className="card">
				<div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.1rem", flexWrap: "wrap" }}>
					{PERIODS.map((p) => (
						<button
							key={p.value}
							type="button"
							onClick={() => setPeriod(p.value)}
							style={{
								padding: "0.4rem 0.9rem", borderRadius: "8px", fontSize: "0.85rem", fontWeight: 700,
								border: `1px solid ${period === p.value ? "#60a5fa" : "rgba(255,255,255,0.12)"}`,
								background: period === p.value ? "rgba(96,165,250,0.18)" : "transparent",
								color: period === p.value ? "#60a5fa" : S.faint,
								cursor: "pointer",
							}}
						>
							{p.label}
						</button>
					))}
				</div>

				{loading ? (
					<p className="muted">Loading…</p>
				) : error ? (
					<p style={{ color: "#f87171" }}>{error}</p>
				) : (
					<ul className="list-clean">
						{entries.map((entry, i) => (
							<LeaderboardRow key={entry.userId} entry={entry} rank={i + 1} isMe={entry.userId === user?.id} />
						))}
						{!entries.length && (
							<li style={{ color: S.faint }}>
								No races {period === "all" ? "" : `${PERIODS.find((p) => p.value === period)?.label.toLowerCase()} `}yet — be the first to race!
							</li>
						)}
					</ul>
				)}
			</section>
		</main>
	);
}
