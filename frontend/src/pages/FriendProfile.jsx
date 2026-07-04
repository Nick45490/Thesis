import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getUserById } from "../api/auth.api";
import { getFriendCollection } from "../api/collection.api";
import { getCatalogueStats } from "../api/catalogue.api";
import CarCard from "../components/CarCard";
import ProgressBar from "../components/ProgressBar";
import { S } from "../theme";

export default function FriendProfilePage() {
	const { id } = useParams();
	const navigate = useNavigate();

	const [friend, setFriend]           = useState(null);
	const [items, setItems]             = useState([]);
	const [progress, setProgress]       = useState(null);
	const [catalogueStats, setCatalogueStats] = useState(null);
	const [error, setError]             = useState(null);

	useEffect(() => {
		Promise.all([getUserById(id), getFriendCollection(id), getCatalogueStats()])
			.then(([userRes, collRes, statsRes]) => {
				setFriend(userRes.user);
				setItems(collRes.items || []);
				setProgress(collRes.progress || null);
				setCatalogueStats(statsRes);
			})
			.catch(() => setError("Could not load this profile."));
	}, [id]);

	if (error) {
		return (
			<main className="page">
				<p style={{ color: "#f87171" }}>{error}</p>
				<button className="primary-btn" onClick={() => navigate("/friends")}>Back to Friends</button>
			</main>
		);
	}

	if (!friend) {
		return <main className="page"><p className="muted">Loading…</p></main>;
	}

	const initials = (friend.username || friend.email || "?")
		.split(/[\s.@]+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("");

	return (
		<main className="page">
			<section className="card" style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
				<button
					onClick={() => navigate("/friends")}
					style={{
						background: "transparent", border: `1px solid ${S.borderStrong}`,
						color: S.muted, borderRadius: "6px", padding: "0.35rem 0.75rem",
						cursor: "pointer", fontSize: "0.85rem", flexShrink: 0,
					}}
				>
					&#8592; Friends
				</button>
				{friend.profilePhoto ? (
					<img
						src={friend.profilePhoto}
						alt={friend.username}
						style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
					/>
				) : (
					<div style={{
						width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
						background: "#1e3a8a", display: "flex", alignItems: "center", justifyContent: "center",
						fontSize: "1.2rem", fontWeight: 700, color: "#93c5fd",
					}}>
						{initials}
					</div>
				)}
				<div>
					<h1 style={{ margin: 0 }}>{friend.username || friend.email}</h1>
					<p className="muted" style={{ margin: "0.2rem 0 0" }}>
						Member since {new Date(friend.createdAt).toLocaleDateString()}
					</p>
				</div>
			</section>

			<section className="card">
				<h2 style={{ marginTop: 0 }}>Progress</h2>
				<ProgressBar label="Generations"   current={progress?.discoveredGenerations   || 0} target={catalogueStats?.generations   || "—"} />
				<ProgressBar label="Models"        current={progress?.discoveredModels        || 0} target={catalogueStats?.models        || "—"} />
				<ProgressBar label="Manufacturers" current={progress?.discoveredManufacturers || 0} target={catalogueStats?.manufacturers || "—"} />
			</section>

			<section>
				<h2>{friend.username || friend.email}'s Collection ({items.length})</h2>
				{items.length === 0 ? (
					<p className="muted">No cars in collection yet.</p>
				) : (
					<div className="grid three-col">
						{items.map((item) => (
							<CarCard key={`${item.generationId}-${item.discoveredAt}`} item={item} hideStats />
						))}
					</div>
				)}
			</section>
		</main>
	);
}
