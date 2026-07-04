import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { acceptFriendRequest, generateInviteCode, listFriends, redeemInviteCode } from "../api/auth.api";
import { S } from "../theme";

function FriendRow({ friend }) {
	const navigate = useNavigate();
	const initials = (friend.username || friend.email || "?")
		.split(/[\s.@]+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("");
	return (
		<li style={{
			display: "flex", alignItems: "center", gap: "0.75rem",
			padding: "0.6rem 0.85rem", borderRadius: "8px",
			border: `3px solid ${S.borderStrong}`,
		}}>
			{friend.profilePhoto ? (
				<img
					src={friend.profilePhoto}
					alt={friend.username}
					style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
				/>
			) : (
				<div style={{
					width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
					background: "#1e3a8a", display: "flex", alignItems: "center", justifyContent: "center",
					fontSize: "0.9rem", fontWeight: 700, color: "#93c5fd",
				}}>
					{initials}
				</div>
			)}
			<span style={{ flex: 1, fontWeight: 500, color: S.text }}>
				{friend.username || friend.email}
			</span>
			<button
				className="primary-btn"
				style={{ padding: "0.3rem 0.85rem", fontSize: "0.82rem" }}
				onClick={() => navigate(`/friends/${friend.id}`)}
			>
				View profile
			</button>
		</li>
	);
}

export default function FriendsPage() {
	const [friends, setFriends]               = useState([]);
	const [pendingRequests, setPendingRequests] = useState([]);

	const [code, setCode]       = useState("");
	const [codeMsg, setCodeMsg] = useState(null);
	const [busy, setBusy]       = useState(false);

	const [myCode, setMyCode]         = useState(null);
	const [myCodeExpiry, setMyCodeExpiry] = useState(null);
	const [myCodeBusy, setMyCodeBusy] = useState(false);
	const [myCodeError, setMyCodeError] = useState(null);
	const [copied, setCopied]         = useState(false);

	async function refresh() {
		const res = await listFriends();
		setFriends(res.friends || []);
		setPendingRequests(res.pendingRequests || []);
	}

	useEffect(() => {
		refresh().catch((err) => {
			console.error("Failed to load friends:", err);
			setFriends([]);
			setPendingRequests([]);
		});
	}, []);

	async function handleGenerateCode() {
		setMyCodeBusy(true);
		setMyCodeError(null);
		try {
			const res = await generateInviteCode();
			setMyCode(res.code);
			setMyCodeExpiry(new Date(res.expiresAt));
			setCopied(false);
		} catch (err) {
			setMyCodeError(err.message || "Failed to generate code.");
		} finally {
			setMyCodeBusy(false);
		}
	}

	function handleCopy() {
		if (!myCode) return;
		navigator.clipboard.writeText(myCode);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	async function handleRedeem(e) {
		e.preventDefault();
		if (!code.trim()) return;
		setBusy(true);
		setCodeMsg(null);
		try {
			const res = await redeemInviteCode(code.trim());
			const name = res.to?.username || "them";
			setCodeMsg({ text: `Friend request sent to ${name}! They need to accept it.`, ok: true });
			setCode("");
			await refresh();
		} catch (err) {
			setCodeMsg({ text: err.message || "Invalid or expired code.", ok: false });
		} finally {
			setBusy(false);
		}
	}

	return (
		<main className="page">
			{/* Step 1 — share your code */}
			<section className="card">
				<h2 style={{ marginTop: 0 }}>Step 1 — Share your code</h2>
				<p style={{ margin: "0 0 0.85rem", fontSize: "0.85rem", color: S.muted }}>
					Generate a code and send it to the friend you want to add. They will enter it below on their Friends page.
				</p>
				{myCode ? (
					<div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
						<span style={{
							fontFamily: "IBM Plex Mono, monospace", fontSize: "1.5rem",
							letterSpacing: "0.25em", fontWeight: 700, color: S.text,
							background: S.cardAlt, border: `1px solid ${S.borderStrong}`,
							borderRadius: "8px", padding: "0.4rem 1rem",
						}}>
							{myCode}
						</span>
						<button className="primary-btn" onClick={handleCopy} style={{ padding: "0.45rem 1rem" }}>
							{copied ? "Copied!" : "Copy"}
						</button>
						<button
							onClick={handleGenerateCode}
							disabled={myCodeBusy}
							style={{
								padding: "0.45rem 1rem", borderRadius: "6px", border: `1px solid ${S.borderStrong}`,
								background: "transparent", color: S.muted, cursor: "pointer", fontSize: "0.85rem",
							}}
						>
							New code
						</button>
						{myCodeExpiry && (
							<span style={{ fontSize: "0.78rem", color: S.faint }}>
								Expires {myCodeExpiry.toLocaleTimeString()}
							</span>
						)}
					</div>
				) : (
					<button className="primary-btn" onClick={handleGenerateCode} disabled={myCodeBusy}>
						{myCodeBusy ? "Generating…" : "Generate my code"}
					</button>
				)}
				{myCodeError && (
					<p style={{ marginTop: "0.6rem", fontSize: "0.85rem", color: "#f87171" }}>{myCodeError}</p>
				)}
			</section>

			{/* Step 2 — enter a friend's code */}
			<section className="card">
				<h2 style={{ marginTop: 0 }}>Step 2 — Enter a friend's code</h2>
				<p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: S.muted }}>
					Ask your friend to generate their code (Step 1 on their Friends page), then enter it here.
				</p>
				<form onSubmit={handleRedeem} style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
					<input
						value={code}
						onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeMsg(null); }}
						placeholder="Enter friend's 6-character code"
						maxLength={6}
						style={{
							flex: 1, minWidth: "180px", fontFamily: "IBM Plex Mono, monospace",
							fontSize: "1.1rem", letterSpacing: "0.2em", textTransform: "uppercase",
							padding: "0.55rem 0.85rem", borderRadius: "8px",
							border: `1px solid ${S.borderStrong}`, background: S.input, color: S.text,
						}}
					/>
					<button
						className="primary-btn"
						type="submit"
						disabled={code.length < 6 || busy}
					>
						{busy ? "Sending…" : "Send request"}
					</button>
				</form>
				{codeMsg && (
					<p style={{
						marginTop: "0.6rem", fontSize: "0.85rem",
						color: codeMsg.ok ? S.discText : "#f87171",
					}}>
						{codeMsg.text}
					</p>
				)}
			</section>

			{/* Pending requests */}
			<section className="card">
				<h2 style={{ marginTop: 0 }}>Pending requests</h2>
				<ul className="list-clean">
					{pendingRequests.map((req) => (
						<li key={`${req.requesterId}-${req.createdAt}`}>
							<span style={{ color: S.text }}>{req.requester?.username || req.requester?.email}</span>
							<button
								type="button"
								className="primary-btn"
								style={{ padding: "0.3rem 0.85rem", fontSize: "0.82rem" }}
								onClick={async () => {
									await acceptFriendRequest(req.requesterId);
									await refresh();
								}}
							>
								Accept
							</button>
						</li>
					))}
					{!pendingRequests.length && (
						<li style={{ color: S.faint }}>No pending requests.</li>
					)}
				</ul>
			</section>

			{/* Friends list */}
			<section className="card">
				<h2 style={{ marginTop: 0 }}>Your friends</h2>
				<ul className="list-clean">
					{friends.map((friend) => (
						<FriendRow key={friend.id} friend={friend} />
					))}
					{!friends.length && (
						<li style={{ color: S.faint }}>No friends yet — share your code above to get started.</li>
					)}
				</ul>
			</section>
		</main>
	);
}
