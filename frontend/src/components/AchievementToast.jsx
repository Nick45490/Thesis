import { useEffect, useState } from "react";
import { RARITY_COLOR, S } from "../theme";

const DISMISS_MS = 4000;

function Toast({ achievement, onDismiss }) {
	const color = RARITY_COLOR[achievement.rarity] || RARITY_COLOR.common;
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const frame = requestAnimationFrame(() => setVisible(true));
		const hide = setTimeout(() => {
			setVisible(false);
			setTimeout(onDismiss, 300);
		}, DISMISS_MS);
		return () => { cancelAnimationFrame(frame); clearTimeout(hide); };
	}, [onDismiss]);

	return (
		<div
			role="status"
			onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
			style={{
				display: "flex", alignItems: "flex-start", gap: "0.75rem",
				padding: "0.85rem 1rem", borderRadius: "12px",
				background: S.card,
				border: `1px solid ${color}44`,
				boxShadow: `0 8px 24px rgba(0,0,0,0.55), 0 0 0 1px ${color}22`,
				borderLeft: `4px solid ${color}`,
				cursor: "pointer",
				transform: visible ? "translateX(0)" : "translateX(110%)",
				opacity: visible ? 1 : 0,
				transition: "transform 0.3s ease, opacity 0.3s ease",
				maxWidth: "320px", width: "100%",
			}}
		>
			<span style={{ fontSize: "1.4rem", lineHeight: 1 }}>🏆</span>
			<div style={{ flex: 1, minWidth: 0 }}>
				<p style={{ margin: 0, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color }}>
					Achievement Unlocked
				</p>
				<p style={{ margin: "0.1rem 0 0", fontWeight: 600, fontSize: "0.95rem", color: S.text }}>
					{achievement.title}
				</p>
				{achievement.description && (
					<p style={{ margin: "0.1rem 0 0", fontSize: "0.8rem", color: S.muted }}>
						{achievement.description}
					</p>
				)}
			</div>
		</div>
	);
}

export default function AchievementToast({ achievements = [] }) {
	const [queue, setQueue] = useState([]);

	useEffect(() => {
		if (!achievements.length) return;
		setQueue((prev) => [
			...prev,
			...achievements.map((a) => ({ ...a, id: `${a.code}-${Date.now()}` })),
		]);
	}, [achievements]);

	function dismiss(id) {
		setQueue((prev) => prev.filter((a) => a.id !== id));
	}

	if (!queue.length) return null;

	return (
		<div
			aria-live="polite"
			style={{
				position: "fixed", bottom: "1.5rem", right: "1.5rem",
				display: "flex", flexDirection: "column", gap: "0.6rem",
				zIndex: 1000, pointerEvents: "none",
			}}
		>
			{queue.map((a) => (
				<div key={a.id} style={{ pointerEvents: "auto" }}>
					<Toast achievement={a} onDismiss={() => dismiss(a.id)} />
				</div>
			))}
		</div>
	);
}
