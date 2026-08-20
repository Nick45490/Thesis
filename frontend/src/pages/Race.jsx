import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AuthImage from "../components/AuthImage";
import { useAuth } from "../context/AuthContext";
import { listFriends } from "../api/auth.api";
import { getGenerationById } from "../api/catalogue.api";
import { getCollection } from "../api/collection.api";
import {
	getChallenges,
	createChallenge,
	acceptChallenge,
	declineChallenge,
} from "../api/gamification.api";
import { RARITY_COLOR, RARITY_LABEL, S } from "../theme";
import { getCarRarity } from "../utils/rarity";

const DISTANCE_LABELS = { quarter: "Quarter mile (¼)", half: "Half mile (½)", full: "Full mile", circuit: "Circuit" };

// Circuit isn't a drag race — "Circuit drag" would read wrong.
function raceModeLabel(distance) {
	const label = DISTANCE_LABELS[distance] || distance;
	return distance === "circuit" ? label : `${label} drag`;
}
const DISTANCE_METERS = { quarter: 402, half: 805, full: 1609 };

// Real Silverstone Grand Prix Circuit centerline, pixel-extracted from a reference
// track map (color-thresholded on the track line, skeletonized, simplified to 71
// points) rather than hand-traced. viewBox matches the source image's pixel space.
// Point 0 sits on Hamilton Straight (start/finish); order matches the real driving
// direction: Abbey, Farm Curve, Village, The Loop, Aintree, Wellington Straight,
// Brooklands, Luffield, Woodcote, Copse, Maggotts, Becketts, Chapel Curve, Hangar
// Straight, Stowe, Vale, Club, back to start.
const CIRCUIT_VIEWBOX = "0 0 938 555";
const SILVERSTONE_TRACK_POINTS = [
	[522.0,398.0], [497.0,381.0], [488.0,370.0], [485.0,360.0], [487.0,300.0], [483.0,285.0],
	[426.0,217.0], [427.0,210.0], [431.0,206.0], [467.0,193.0], [471.0,189.0], [471.0,180.0],
	[467.0,176.0], [426.0,165.0], [408.0,165.0], [390.0,170.0], [244.0,357.0], [238.0,370.0],
	[237.0,381.0], [241.0,392.0], [245.0,396.0], [260.0,399.0], [283.0,399.0], [296.0,408.0],
	[299.0,420.0], [298.0,428.0], [294.0,434.0], [287.0,438.0], [271.0,438.0], [236.0,423.0],
	[209.0,405.0], [190.0,387.0], [183.0,377.0], [176.0,359.0], [174.0,333.0], [155.0,211.0],
	[157.0,190.0], [167.0,179.0], [188.0,165.0], [234.0,150.0], [272.0,142.0], [346.0,135.0],
	[359.0,131.0], [385.0,116.0], [424.0,127.0], [446.0,127.0], [456.0,122.0], [476.0,106.0],
	[495.0,104.0], [506.0,109.0], [515.0,118.0], [527.0,139.0], [544.0,154.0], [741.0,244.0],
	[785.0,267.0], [802.0,277.0], [812.0,288.0], [816.0,308.0], [814.0,320.0], [801.0,334.0],
	[776.0,347.0], [760.0,359.0], [696.0,423.0], [694.0,430.0], [708.0,444.0], [708.0,455.0],
	[693.0,472.0], [678.0,481.0], [659.0,485.0], [645.0,481.0],
];

function closedPathFromPoints(points) {
	let d = `M ${points[0][0]},${points[0][1]} `;
	for (let i = 1; i < points.length; i++) d += `L ${points[i][0]},${points[i][1]} `;
	return d + "Z";
}

const CIRCUIT_PATH_D = closedPathFromPoints(SILVERSTONE_TRACK_POINTS);
const CIRCUIT_START  = SILVERSTONE_TRACK_POINTS[0];

// Ordered segments around one lap (matches the real driving order documented
// above), each tagged with its share of the 5,891m real Silverstone GP lap.
// The three straights use the exact metres already established for the lap
// time formula (CIRCUIT_STRAIGHTS_M in performanceEngine.js: 800 + 700 + 900).
// The 15 corners don't have individually-sourced lengths anywhere in this
// project, so the remaining 3,491m is split evenly across them — an honest
// approximation for a "which bit of the lap is this" landmark, not a claim
// of corner-by-corner telemetry precision.
const SILVERSTONE_LAP_M = 5891;
const CORNER_M = (SILVERSTONE_LAP_M - 800 - 700 - 900) / 15;
const SILVERSTONE_SEGMENTS = [
	{ name: "Start/Finish Straight", m: 800 },
	{ name: "Abbey",       m: CORNER_M },
	{ name: "Farm Curve",  m: CORNER_M },
	{ name: "Village",     m: CORNER_M },
	{ name: "The Loop",    m: CORNER_M },
	{ name: "Aintree",     m: CORNER_M },
	{ name: "Wellington Straight", m: 700 },
	{ name: "Brooklands",  m: CORNER_M },
	{ name: "Luffield",    m: CORNER_M },
	{ name: "Woodcote",    m: CORNER_M },
	{ name: "Copse",       m: CORNER_M },
	{ name: "Maggotts",    m: CORNER_M },
	{ name: "Becketts",    m: CORNER_M },
	{ name: "Chapel Curve", m: CORNER_M },
	{ name: "Hangar Straight", m: 900 },
	{ name: "Stowe",       m: CORNER_M },
	{ name: "Vale",        m: CORNER_M },
	{ name: "Club",        m: CORNER_M },
];
// Cumulative fraction of the lap at which each segment starts, for a quick
// progress -> segment lookup.
let _cum = 0;
const SILVERSTONE_SEGMENT_STARTS = SILVERSTONE_SEGMENTS.map((seg) => {
	const start = _cum;
	_cum += seg.m / SILVERSTONE_LAP_M;
	return { name: seg.name, start };
});

function trackPositionLabel(progress) {
	const frac = Math.max(0, Math.min(1, progress));
	let current = SILVERSTONE_SEGMENT_STARTS[0];
	for (const seg of SILVERSTONE_SEGMENT_STARTS) {
		if (seg.start > frac) break;
		current = seg;
	}
	return current.name;
}

function RarityBadge({ rarity }) {
	const color = RARITY_COLOR[rarity] || RARITY_COLOR.common;
	return (
		<span style={{
			fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.05em",
			textTransform: "uppercase", color,
			background: `${color}18`, border: `1px solid ${color}44`,
			borderRadius: "4px", padding: "1px 6px",
		}}>
			{RARITY_LABEL[rarity] || rarity}
		</span>
	);
}

function CarThumb({ genId, make, model, time, timeColor, username }) {
	return (
		<div style={{ textAlign: "center" }}>
			<div style={{ width: "100%", aspectRatio: "4 / 3", borderRadius: "10px", overflow: "hidden", background: S.cardAlt }}>
				<AuthImage
					src={`/recognize/images/${genId}`}
					alt={`${make} ${model}`}
					style={{ width: "100%", height: "100%", objectFit: "cover" }}
				/>
			</div>
			{username && (
				<div style={{ fontSize: "0.8rem", fontWeight: 600, color: S.muted, marginTop: "0.4rem" }}>{username}</div>
			)}
			<div style={{ fontSize: "1.05rem", fontWeight: 700, color: timeColor, marginTop: "0.2rem", letterSpacing: "0.02em" }}>{time}s</div>
		</div>
	);
}

function HistoryCard({ challenge, currentUserId, onOpen }) {
	const iWon         = challenge.winnerUserId === currentUserId;
	const iAmChallenger = challenge.challengerUserId === currentUserId;

	const my = {
		genId:    iAmChallenger ? challenge.challengerGenerationId : challenge.opponentGenerationId,
		make:     iAmChallenger ? challenge.challengerMake         : challenge.opponentMake,
		model:    iAmChallenger ? challenge.challengerModel        : challenge.opponentModel,
		time:     iAmChallenger ? challenge.challengerTime         : challenge.opponentTime,
		username: iAmChallenger ? challenge.challengerUsername     : challenge.opponentUsername,
	};
	const opp = {
		genId:    iAmChallenger ? challenge.opponentGenerationId   : challenge.challengerGenerationId,
		make:     iAmChallenger ? challenge.opponentMake           : challenge.challengerMake,
		model:    iAmChallenger ? challenge.opponentModel          : challenge.challengerModel,
		time:     iAmChallenger ? challenge.opponentTime           : challenge.challengerTime,
		username: iAmChallenger ? challenge.opponentUsername       : challenge.challengerUsername,
	};

	const accent = iWon ? S.discText : "#dc2626";

	return (
		<div
			onClick={(e) => onOpen(challenge, e.clientY)}
			style={{
				cursor: "pointer", borderRadius: "8px", border: `1.5px solid ${accent}`,
				background: iWon ? S.disc : "rgba(248,113,113,0.10)", padding: "0.75rem 1rem",
			}}
		>
			<div style={{ fontSize: "0.8rem", fontWeight: 600, color: S.textSub, marginBottom: "0.6rem" }}>
				{raceModeLabel(challenge.distance)} · {new Date(challenge.createdAt).toLocaleString()}
			</div>
			<div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "0.75rem" }}>
				<CarThumb genId={my.genId} make={my.make} model={my.model} time={my.time} timeColor={iWon ? "#22c55e" : "#ef4444"} username={my.username} />
				<div style={{ textAlign: "center", minWidth: "64px" }}>
					<div style={{ fontSize: "0.85rem", fontWeight: 700, color: S.text }}>{iWon ? "WIN" : "LOSE"}</div>
					<div style={{ fontSize: "0.85rem", color: S.faint, margin: "0.15rem 0" }}>VS</div>
					<div style={{ color: S.muted, fontWeight: 600, fontSize: "0.8rem" }}>
						{iWon ? `+${challenge.pointsAwarded} pts` : "+0 pts"}
					</div>
				</div>
				<CarThumb genId={opp.genId} make={opp.make} model={opp.model} time={opp.time} timeColor={!iWon ? "#22c55e" : "#ef4444"} username={opp.username} />
			</div>
		</div>
	);
}

function calc0to100(hp, weightKg) {
	if (!hp || !weightKg) return null;
	return (1.85 * Math.pow(weightKg / hp, 0.6)).toFixed(1);
}

function RaceDetailModal({ challenge, currentUserId, cardRect, onClose }) {
	const iAmChallenger = challenge.challengerUserId === currentUserId;
	const iWon          = challenge.winnerUserId === currentUserId;

	const myGenId  = iAmChallenger ? challenge.challengerGenerationId : challenge.opponentGenerationId;
	const oppGenId = iAmChallenger ? challenge.opponentGenerationId   : challenge.challengerGenerationId;

	const my = {
		genId:   myGenId,
		make:    iAmChallenger ? challenge.challengerMake    : challenge.opponentMake,
		model:   iAmChallenger ? challenge.challengerModel   : challenge.opponentModel,
		genCode: iAmChallenger ? challenge.challengerGenCode : challenge.opponentGenCode,
		time:    iAmChallenger ? challenge.challengerTime    : challenge.opponentTime,
		hpHint:  iAmChallenger ? challenge.challengerHorsepower : challenge.opponentHorsepower,
	};
	const opp = {
		genId:   oppGenId,
		make:    iAmChallenger ? challenge.opponentMake    : challenge.challengerMake,
		model:   iAmChallenger ? challenge.opponentModel   : challenge.challengerModel,
		genCode: iAmChallenger ? challenge.opponentGenCode : challenge.challengerGenCode,
		time:    iAmChallenger ? challenge.opponentTime    : challenge.challengerTime,
		hpHint:  iAmChallenger ? challenge.opponentHorsepower : challenge.challengerHorsepower,
	};

	const [myEng,  setMyEng]  = useState(null);
	const [oppEng, setOppEng] = useState(null);

	useEffect(() => {
		function pickEngine(engines, hpHint) {
			if (!engines?.length) return null;
			if (hpHint) {
				const match = engines.find((e) => e.horsepower === hpHint);
				if (match) return match;
			}
			return engines[0];
		}
		if (myGenId) {
			getGenerationById(myGenId)
				.then((r) => setMyEng(pickEngine(r?.generation?.engines, my.hpHint)))
				.catch(() => {});
		}
		if (oppGenId) {
			getGenerationById(oppGenId)
				.then((r) => setOppEng(pickEngine(r?.generation?.engines, opp.hpHint)))
				.catch(() => {});
		}
	}, [myGenId, oppGenId]);

	const GREEN = "#22c55e";
	const RED   = "#ef4444";

	const myTimeWins   = my.time != null && opp.time != null && my.time < opp.time;
	const margin       = (my.time != null && opp.time != null)
		? Math.abs(my.time - opp.time).toFixed(3)
		: null;

	const myHp     = myEng?.horsepower  || null;
	const oppHp    = oppEng?.horsepower || null;
	const myNm     = myEng?.torqueNm    || null;
	const oppNm    = oppEng?.torqueNm   || null;
	const myKg     = myEng?.weightKg    || null;
	const oppKg    = oppEng?.weightKg   || null;
	const my0to100  = calc0to100(myHp,  myKg);
	const opp0to100 = calc0to100(oppHp, oppKg);

	const myHpWins      = (myHp  || 0) > (oppHp  || 0);
	const myNmWins      = (myNm  || 0) > (oppNm  || 0);
	const myKgWins      = myKg && oppKg ? myKg < oppKg : null;
	const my0to100Wins  = my0to100 && opp0to100 ? parseFloat(my0to100) < parseFloat(opp0to100) : null;

	const imgStyle = { width: "100%", aspectRatio: "4 / 3", borderRadius: "10px", background: S.cardAlt, overflow: "hidden" };



	const panelTop = (() => {
		if (cardRect == null) return "10vh";
		const maxH = window.innerHeight * 0.85;
		const raw  = cardRect - 20;
		return Math.max(8, raw + maxH > window.innerHeight ? window.innerHeight - maxH - 8 : raw);
	})();

	return createPortal(
		<>
			<div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.6)" }} />
			<div
				onClick={(e) => e.stopPropagation()}
				style={{
					position: "fixed", zIndex: 1000,
					left: "50%", top: panelTop,
					transform: "translateX(-50%)",
					width: "min(760px, calc(100vw - 32px))",
					maxHeight: "85vh", overflowY: "auto",
					background: S.card, borderRadius: "12px", padding: "1.5rem",
					border: `1px solid ${S.borderStrong}`,
					boxShadow: "0 8px 48px rgba(0,0,0,0.7)",
				}}
			>
				<button
					onClick={onClose}
					style={{ position: "absolute", top: "0.75rem", right: "0.75rem", background: "none", border: "none", color: S.faint, fontSize: "1.1rem", cursor: "pointer" }}
				>✕</button>

				<div style={{ fontSize: "0.78rem", color: S.faint, marginBottom: "1rem" }}>
					{raceModeLabel(challenge.distance)} · {new Date(challenge.resolvedAt || challenge.createdAt).toLocaleString()}
				</div>

				{/* Main layout: photo + stats under each side */}
				<div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "1rem", alignItems: "start" }}>

					{/* My side */}
					<div>
						<div style={{ fontSize: "0.73rem", color: S.faint, marginBottom: "0.3rem", textAlign: "center" }}>You</div>
						<div style={imgStyle}>
							<AuthImage src={`/recognize/images/${my.genId}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
						</div>
						<div style={{ marginTop: "0.6rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
							{my0to100Wins !== null && (
								<div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
									<span style={{ color: S.faint }}>0–100 kph</span>
									<span style={{ fontWeight: 700, color: my0to100Wins ? GREEN : RED }}>{my0to100}s</span>
								</div>
							)}
							{myHp && (
								<div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
									<span style={{ color: S.faint }}>Power</span>
									<span style={{ fontWeight: 600, color: myHpWins ? GREEN : RED }}>{myHp} hp</span>
								</div>
							)}
							{myNm && (
								<div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
									<span style={{ color: S.faint }}>Torque</span>
									<span style={{ fontWeight: 600, color: myNmWins ? GREEN : RED }}>{myNm} Nm</span>
								</div>
							)}
							{myKgWins !== null && (
								<div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
									<span style={{ color: S.faint }}>Weight</span>
									<span style={{ fontWeight: 600, color: myKgWins ? GREEN : RED }}>{myKg} kg</span>
								</div>
							)}
						</div>
					</div>

					{/* Center — VS + race margin */}
					<div style={{ textAlign: "center", minWidth: "72px", paddingTop: "1.5rem" }}>
						<div style={{ color: S.faint, fontWeight: 700, fontSize: "1rem" }}>VS</div>
						{margin && (
							<div style={{ fontSize: "0.72rem", color: S.muted, marginTop: "0.5rem", lineHeight: 1.5 }}>
								{iWon ? "Won" : "Lost"}<br />by {margin}s
							</div>
						)}
					</div>

					{/* Opponent side */}
					<div>
						<div style={{ fontSize: "0.73rem", color: S.faint, marginBottom: "0.3rem", textAlign: "center" }}>Opponent</div>
						<div style={imgStyle}>
							<AuthImage src={`/recognize/images/${opp.genId}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
						</div>
						<div style={{ marginTop: "0.6rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
							{my0to100Wins !== null && (
								<div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
									<span style={{ color: S.faint }}>0–100 kph</span>
									<span style={{ fontWeight: 700, color: !my0to100Wins ? GREEN : RED }}>{opp0to100}s</span>
								</div>
							)}
							{oppHp && (
								<div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
									<span style={{ color: S.faint }}>Power</span>
									<span style={{ fontWeight: 600, color: !myHpWins ? GREEN : RED }}>{oppHp} hp</span>
								</div>
							)}
							{oppNm && (
								<div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
									<span style={{ color: S.faint }}>Torque</span>
									<span style={{ fontWeight: 600, color: !myNmWins ? GREEN : RED }}>{oppNm} Nm</span>
								</div>
							)}
							{myKgWins !== null && (
								<div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
									<span style={{ color: S.faint }}>Weight</span>
									<span style={{ fontWeight: 600, color: !myKgWins ? GREEN : RED }}>{oppKg} kg</span>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</>,
		document.body
	);
}

function CarSelector({ cars, value, onChange, placeholder = "Select your car" }) {
	const [open, setOpen] = useState(false);
	const selected = cars.find((c) => String(c.generationId) === String(value));

	return (
		<div style={{ position: "relative" }}>
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				style={{
					width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px",
					border: `1px solid ${S.borderStrong}`, background: S.card, textAlign: "left",
					cursor: "pointer", fontSize: "0.9rem", display: "flex",
					alignItems: "center", justifyContent: "space-between", gap: "0.5rem",
				}}
			>
				{selected ? (
					<span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
						<RarityBadge rarity={selected.rarity || "common"} />
						{selected.manufacturerName} {selected.modelName} {selected.generationCode}
					</span>
				) : (
					<span style={{ color: S.faint }}>{placeholder}</span>
				)}
				<span style={{ fontSize: "0.7rem", color: S.faint }}>{open ? "▲" : "▼"}</span>
			</button>

			{open && (
				<div style={{
					position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
					background: S.card, border: `1px solid ${S.borderStrong}`, borderRadius: "8px",
					boxShadow: "0 8px 24px rgba(0,0,0,0.5)", zIndex: 50,
					maxHeight: "260px", overflowY: "auto",
				}}>
					{cars.map((c) => {
						const rarity  = c.rarity || "common";
						const isChosen = String(c.generationId) === String(value);
						return (
							<div
								key={c.generationId}
								onClick={() => { onChange(String(c.generationId)); setOpen(false); }}
								style={{
									padding: "0.55rem 0.85rem", cursor: "pointer", display: "flex",
									alignItems: "center", gap: "0.6rem",
									background: isChosen ? S.disc : "transparent",
									borderBottom: "1px solid #f3f4f6",
								}}
								onMouseEnter={(e) => { if (!isChosen) e.currentTarget.style.background = S.cardAlt; }}
								onMouseLeave={(e) => { if (!isChosen) e.currentTarget.style.background = "transparent"; }}
							>
								<RarityBadge rarity={rarity} />
								<span style={{ fontSize: "0.88rem" }}>
									{c.manufacturerName} {c.modelName}
									{c.generationCode && (
										<span style={{ color: S.muted, fontSize: "0.8rem" }}> {c.generationCode}</span>
									)}
								</span>
							</div>
						);
					})}
					{cars.length === 0 && (
						<p style={{ padding: "0.75rem", color: S.faint, fontSize: "0.85rem", margin: 0 }}>
							No cars in collection
						</p>
					)}
				</div>
			)}
		</div>
	);
}

function RaceLane({ car, progress, won, label, done }) {
	return (
		<div style={{ marginBottom: "1.1rem" }}>
			<div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
				<div style={{ width: 100, height: 70, borderRadius: "8px", overflow: "hidden", background: S.cardAlt, flexShrink: 0 }}>
					<AuthImage src={`/recognize/images/${car.genId}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
				</div>
				<div style={{ flex: 1 }}>
					<div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#e2e8f0", marginBottom: "0.15rem" }}>{label}</div>
					<div style={{ fontSize: "0.78rem", color: S.faint }}>{car.make} {car.model}</div>
					<div style={{ fontSize: "0.75rem", color: won ? "#22c55e" : "#60a5fa", fontWeight: 600, marginTop: "0.1rem" }}>{car.time}s</div>
				</div>
				{done && won && (
					<span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#22c55e", letterSpacing: "0.06em" }}>WINNER &#x2713;</span>
				)}
			</div>
			<div style={{
				height: 36, borderRadius: "8px",
				background: "#0a0a14", border: "1px solid rgba(255,255,255,0.07)",
				position: "relative", overflow: "hidden",
			}}>
				<div style={{
					height: "100%",
					width: `${progress * 100}%`,
					background: won
						? "linear-gradient(90deg, #14532d, #16a34a, #22c55e)"
						: "linear-gradient(90deg, #1e3a8a, #2563eb, #3b82f6)",
					borderRadius: "8px",
					boxShadow: won ? "0 0 14px #22c55e66" : "0 0 12px #3b82f666",
				}} />
				<div style={{
					position: "absolute", right: 0, top: 0, bottom: 0, width: 5,
					background: "repeating-linear-gradient(to bottom, #fff 0px, #fff 5px, #111 5px, #111 10px)",
					opacity: 0.6,
				}} />
			</div>
		</div>
	);
}

function CircuitCarInfo({ car, won, label, done, progress }) {
	const pct = Math.round(Math.min(1, progress) * 100);
	return (
		<div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "0.6rem" }}>
			<div style={{ width: 52, height: 40, borderRadius: "6px", overflow: "hidden", background: S.cardAlt, flexShrink: 0 }}>
				<AuthImage src={`/recognize/images/${car.genId}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
			</div>
			<div style={{ minWidth: 0 }}>
				<div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
					{label}{done && won && <span style={{ color: "#22c55e" }}> &#x2713;</span>}
				</div>
				<div style={{ fontSize: "0.72rem", color: S.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{car.make} {car.model}</div>
				<div style={{ fontSize: "0.72rem", color: won ? "#22c55e" : "#60a5fa", fontWeight: 600 }}>{car.time}s</div>
				{!done && (
					<div style={{ fontSize: "0.7rem", color: S.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
						{pct}% &middot; {trackPositionLabel(progress)}
					</div>
				)}
			</div>
		</div>
	);
}

function CircuitTrackView({ my, opp, markers, iWon, done, progress }) {
	return (
		<div style={{ marginBottom: "1.1rem" }}>
			<svg viewBox={CIRCUIT_VIEWBOX} style={{ width: "100%", height: "auto", display: "block" }}>
				<path d={CIRCUIT_PATH_D} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
				<path d={CIRCUIT_PATH_D} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
				<line
					x1={CIRCUIT_START[0] - 9} y1={CIRCUIT_START[1] + 9}
					x2={CIRCUIT_START[0] + 9} y2={CIRCUIT_START[1] - 9}
					stroke="#fbbf24" strokeWidth="4"
				/>
				{markers.opp && (
					<circle cx={markers.opp.x} cy={markers.opp.y} r="9" fill={!iWon ? "#22c55e" : "#3b82f6"} stroke="#0a0a14" strokeWidth="2" />
				)}
				{markers.my && (
					<circle cx={markers.my.x} cy={markers.my.y} r="9" fill={iWon ? "#22c55e" : "#3b82f6"} stroke="#0a0a14" strokeWidth="2" />
				)}
			</svg>
			<div style={{ display: "flex", gap: "1rem", marginTop: "0.85rem" }}>
				<CircuitCarInfo car={my}  won={iWon}  label="You"          done={done} progress={progress.my} />
				<CircuitCarInfo car={opp} won={!iWon} label={opp.username} done={done} progress={progress.opp} />
			</div>
		</div>
	);
}

function RaceAnimationModal({ result, currentUserId, onClose }) {
	const [progress, setProgress] = useState({ my: 0, opp: 0 });
	const [markers,  setMarkers]  = useState({ my: null, opp: null });
	const [done,     setDone]     = useState(false);
	const [speed,    setSpeed]    = useState(1);

	const speedRef     = useRef(speed);
	const raceClockRef = useRef(0);
	const finishedRef  = useRef(false);
	useEffect(() => { speedRef.current = speed; }, [speed]);

	const isCircuit = result.distance === "circuit";
	// Detached (never mounted) SVG path used purely for getPointAtLength math —
	// doesn't need to be in the DOM, path geometry methods work off the `d` alone.
	const trackGeom = useMemo(() => {
		if (!isCircuit) return null;
		const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
		el.setAttribute("d", CIRCUIT_PATH_D);
		return { el, len: el.getTotalLength() };
	}, [isCircuit]);

	const iAmChallenger = result.challengerUserId === currentUserId;
	const iWon          = result.winnerUserId     === currentUserId;

	const my = {
		genId:   iAmChallenger ? result.challengerGenerationId : result.opponentGenerationId,
		make:    iAmChallenger ? result.challengerMake         : result.opponentMake,
		model:   iAmChallenger ? result.challengerModel        : result.opponentModel,
		time:    iAmChallenger ? result.challengerTime         : result.opponentTime,
	};
	const opp = {
		genId:    iAmChallenger ? result.opponentGenerationId : result.challengerGenerationId,
		make:     iAmChallenger ? result.opponentMake         : result.challengerMake,
		model:    iAmChallenger ? result.opponentModel        : result.challengerModel,
		time:     iAmChallenger ? result.opponentTime         : result.challengerTime,
		username: iAmChallenger
			? (result.opponentUsername  || `User #${result.opponentUserId}`)
			: (result.challengerUsername || `User #${result.challengerUserId}`),
	};

	const margin = Math.abs(my.time - opp.time).toFixed(3);

	// Each lane's 1x-baseline duration — same pacing as before the speed toggle existed.
	// Winner arrives first; loser bar is still moving when result shows.
	const myDuration     = my.time  / 2;
	const oppDuration    = opp.time / 2;
	const winnerDuration = Math.min(myDuration, oppDuration);

	useEffect(() => {
		let rafId;
		let doneTimer;
		let lastFrame = performance.now();

		function tick(now) {
			const dt = (now - lastFrame) / 1000;
			lastFrame = now;
			raceClockRef.current += dt * speedRef.current;

			const myProgress  = Math.min(1, raceClockRef.current / myDuration);
			const oppProgress = Math.min(1, raceClockRef.current / oppDuration);
			setProgress({ my: myProgress, opp: oppProgress });

			if (trackGeom) {
				const myPt  = trackGeom.el.getPointAtLength(myProgress  * trackGeom.len);
				const oppPt = trackGeom.el.getPointAtLength(oppProgress * trackGeom.len);
				setMarkers({ my: { x: myPt.x, y: myPt.y }, opp: { x: oppPt.x, y: oppPt.y } });
			}

			// Show result 0.8s (fixed, not speed-scaled) after the winner crosses the finish
			if (!finishedRef.current && raceClockRef.current >= winnerDuration) {
				finishedRef.current = true;
				doneTimer = setTimeout(() => setDone(true), 800);
			}

			if (myProgress < 1 || oppProgress < 1) {
				rafId = requestAnimationFrame(tick);
			}
		}
		rafId = requestAnimationFrame(tick);

		return () => {
			cancelAnimationFrame(rafId);
			clearTimeout(doneTimer);
		};
	}, [myDuration, oppDuration, winnerDuration, trackGeom]);

	return createPortal(
		<>
			<div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.88)" }} />
			<div
				onClick={(e) => e.stopPropagation()}
				style={{
					position: "fixed", zIndex: 1000,
					left: "50%", top: "50%", transform: "translate(-50%, -50%)",
					width: "min(560px, calc(100vw - 32px))",
					background: S.card, borderRadius: "16px", padding: "1.75rem",
					border: "1px solid rgba(96,165,250,0.2)",
					boxShadow: "0 8px 48px rgba(0,0,0,0.8)",
				}}
			>
				<h3 style={{ margin: "0 0 1rem", color: "#e2e8f0", textAlign: "center", letterSpacing: "0.04em" }}>
					{DISTANCE_LABELS[result.distance]} Race
				</h3>

				{!done && (
					<div style={{ display: "flex", justifyContent: "center", gap: "0.4rem", marginBottom: "1.25rem" }}>
						{[1, 2, 4, 8].map((s) => (
							<button
								key={s}
								onClick={() => setSpeed(s)}
								style={{
									padding: "0.3rem 0.7rem", borderRadius: "8px", fontSize: "0.78rem", fontWeight: 700,
									border: `1px solid ${speed === s ? "#60a5fa" : "rgba(255,255,255,0.12)"}`,
									background: speed === s ? "rgba(96,165,250,0.18)" : "transparent",
									color: speed === s ? "#60a5fa" : S.faint,
									cursor: "pointer",
								}}
							>
								{s}x
							</button>
						))}
					</div>
				)}

				{isCircuit ? (
					<CircuitTrackView my={my} opp={opp} markers={markers} iWon={iWon} done={done} progress={progress} />
				) : (
					<>
						<RaceLane car={my}  progress={progress.my}  won={iWon}  label="You"          done={done} />
						<RaceLane car={opp} progress={progress.opp} won={!iWon} label={opp.username} done={done} />
					</>
				)}

				{done && (
					<div style={{
						marginTop: "1rem", textAlign: "center", padding: "1.1rem",
						borderRadius: "12px",
						background: iWon ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
						border: `1px solid ${iWon ? "#22c55e44" : "#ef444444"}`,
					}}>
						<div style={{ fontSize: "1.8rem", fontWeight: 900, color: iWon ? "#22c55e" : "#ef4444", letterSpacing: "0.06em" }}>
							{iWon ? "VICTORY!" : "DEFEAT"}
						</div>
						<div style={{ fontSize: "0.82rem", color: S.faint, marginTop: "0.25rem" }}>
							by {margin}s
						</div>
						{iWon && result.pointsAwarded != null && (
							<div style={{ fontSize: "1.1rem", color: "#fbbf24", fontWeight: 800, marginTop: "0.3rem" }}>
								+{result.pointsAwarded} pts
							</div>
						)}
						<button
							onClick={onClose}
							style={{
								marginTop: "1rem", padding: "0.55rem 2rem",
								borderRadius: "10px", fontWeight: 700, fontSize: "0.95rem",
								border: "none", cursor: "pointer",
								background: iWon
									? "linear-gradient(135deg, #16a34a, #15803d)"
									: "linear-gradient(135deg, #dc2626, #b91c1c)",
								color: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
							}}
						>
							Continue
						</button>
					</div>
				)}
			</div>
		</>,
		document.body
	);
}

function CarPickerModal({ cars, value, onSelect, onClose }) {
	return createPortal(
		<>
			<div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.75)" }} />
			<div
				onClick={(e) => e.stopPropagation()}
				style={{
					position: "fixed", zIndex: 1000,
					left: "50%", top: "50%", transform: "translate(-50%, -50%)",
					width: "min(800px, calc(100vw - 32px))",
					maxHeight: "80vh", overflowY: "auto",
					background: S.card, borderRadius: "16px", padding: "1.5rem",
					border: "1px solid rgba(96,165,250,0.2)",
					boxShadow: "0 8px 48px rgba(0,0,0,0.7)",
				}}
			>
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
					<h3 style={{ margin: 0, color: "#e2e8f0" }}>Choose Your Car</h3>
					<button onClick={onClose} style={{ background: "none", border: "none", color: S.faint, fontSize: "1.2rem", cursor: "pointer" }}>&#x2715;</button>
				</div>
				{cars.length === 0 && (
					<p style={{ color: S.faint, textAlign: "center", padding: "2rem 0" }}>No cars in your collection yet.</p>
				)}
				<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
					{cars.map((car) => {
						const rarity = car.rarity || "common";
						const color = RARITY_COLOR[rarity];
						const isSelected = String(car.generationId) === String(value);
						return (
							<div
								key={car.generationId}
								onClick={() => { onSelect(String(car.generationId)); onClose(); }}
								style={{
									borderRadius: "12px", overflow: "hidden", cursor: "pointer",
									border: `2px solid ${isSelected ? color : "rgba(255,255,255,0.08)"}`,
									background: isSelected ? `${color}18` : S.cardAlt,
									transition: "border-color 0.15s",
								}}
							>
								<div style={{ width: "100%", aspectRatio: "4/3", background: S.card, position: "relative" }}>
									<div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: color, zIndex: 1 }} />
									{car.scanPhoto
										? <img src={car.scanPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
										: <AuthImage src={`/recognize/images/${car.generationId}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
									}
								</div>
								<div style={{ padding: "0.6rem 0.75rem" }}>
									<div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem", flexWrap: "wrap" }}>
										<span style={{ fontWeight: 700, fontSize: "0.82rem", color: S.text, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
											{car.manufacturerName} {car.modelName}
										</span>
										<RarityBadge rarity={rarity} />
									</div>
									{car.generationCode && (
										<p style={{ margin: 0, fontSize: "0.72rem", color: S.faint }}>{car.generationCode}</p>
									)}
									{car.engine && (
										<p style={{ margin: "0.2rem 0 0", fontSize: "0.72rem", color: S.muted }}>
											{car.engine.horsepower} hp &middot; {car.engine.weightKg} kg
										</p>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</>,
		document.body
	);
}

function FriendPickerModal({ friends, value, onSelect, onClose }) {
	return createPortal(
		<>
			<div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.75)" }} />
			<div
				onClick={(e) => e.stopPropagation()}
				style={{
					position: "fixed", zIndex: 1000,
					left: "50%", top: "50%", transform: "translate(-50%, -50%)",
					width: "min(420px, calc(100vw - 32px))",
					maxHeight: "70vh", overflowY: "auto",
					background: S.card, borderRadius: "16px", padding: "1.5rem",
					border: "1px solid rgba(96,165,250,0.2)",
					boxShadow: "0 8px 48px rgba(0,0,0,0.7)",
				}}
			>
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
					<h3 style={{ margin: 0, color: "#e2e8f0" }}>Choose Opponent</h3>
					<button onClick={onClose} style={{ background: "none", border: "none", color: S.faint, fontSize: "1.2rem", cursor: "pointer" }}>&#x2715;</button>
				</div>
				{friends.length === 0 && (
					<p style={{ color: S.faint, textAlign: "center", padding: "1rem 0" }}>No friends yet. Add some from the Friends page!</p>
				)}
				<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
					{friends.map((friend) => {
						const isSelected = String(friend.id) === String(value);
						const initials = (friend.username || "?").slice(0, 2).toUpperCase();
						return (
							<div
								key={friend.id}
								onClick={() => { onSelect(String(friend.id)); onClose(); }}
								style={{
									display: "flex", alignItems: "center", gap: "0.85rem",
									padding: "0.65rem 0.85rem", borderRadius: "10px", cursor: "pointer",
									border: `1.5px solid ${isSelected ? "#60a5fa" : "rgba(255,255,255,0.07)"}`,
									background: isSelected ? "rgba(96,165,250,0.12)" : "transparent",
									transition: "background 0.15s",
								}}
							>
								<div style={{
									width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
									overflow: "hidden", background: "#1f2937",
									display: "flex", alignItems: "center", justifyContent: "center",
									border: "2px solid rgba(255,255,255,0.1)",
								}}>
									{friend.profilePhoto
										? <img src={friend.profilePhoto} alt={friend.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
										: <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#93c5fd" }}>{initials}</span>
									}
								</div>
								<span style={{ fontWeight: 600, fontSize: "0.95rem", color: S.text, flex: 1 }}>{friend.username}</span>
								{isSelected && <span style={{ fontSize: "0.75rem", color: "#60a5fa", fontWeight: 700 }}>&#x2713;</span>}
							</div>
						);
					})}
				</div>
			</div>
		</>,
		document.body
	);
}

function CarPreview({ car, onClick }) {
	const rarity = car.rarity || "common";
	const color = RARITY_COLOR[rarity];
	return (
		<div
			onClick={onClick}
			style={{
				display: "flex", alignItems: "center", gap: "0.75rem",
				padding: "0.6rem 0.85rem", borderRadius: "10px", cursor: "pointer",
				border: `1.5px solid ${color}55`, background: `${color}0d`,
				transition: "background 0.15s",
			}}
		>
			<div style={{ width: 100, height: 72, borderRadius: "8px", overflow: "hidden", background: S.cardAlt, flexShrink: 0 }}>
				{car.scanPhoto
					? <img src={car.scanPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
					: <AuthImage src={`/recognize/images/${car.generationId}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
				}
			</div>
			<div style={{ flex: 1, minWidth: 0 }}>
				<div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
					<span style={{ fontWeight: 700, fontSize: "0.88rem", color: S.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
						{car.manufacturerName} {car.modelName}
					</span>
					<RarityBadge rarity={rarity} />
				</div>
				{car.generationCode && <p style={{ margin: 0, fontSize: "0.72rem", color: S.faint }}>{car.generationCode}</p>}
			</div>
			<span style={{ fontSize: "0.75rem", color: "#60a5fa", fontWeight: 600, flexShrink: 0 }}>Change</span>
		</div>
	);
}

function FriendPreview({ friend, onClick }) {
	const initials = (friend.username || "?").slice(0, 2).toUpperCase();
	return (
		<div
			onClick={onClick}
			style={{
				display: "flex", alignItems: "center", gap: "0.75rem",
				padding: "0.6rem 0.85rem", borderRadius: "10px", cursor: "pointer",
				border: "1.5px solid rgba(96,165,250,0.4)", background: "rgba(96,165,250,0.08)",
				transition: "background 0.15s",
			}}
		>
			<div style={{
				width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
				overflow: "hidden", background: "#1f2937",
				display: "flex", alignItems: "center", justifyContent: "center",
				border: "2px solid rgba(96,165,250,0.3)",
			}}>
				{friend.profilePhoto
					? <img src={friend.profilePhoto} alt={friend.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
					: <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#93c5fd" }}>{initials}</span>
				}
			</div>
			<span style={{ fontWeight: 600, fontSize: "0.95rem", color: S.text, flex: 1 }}>{friend.username}</span>
			<span style={{ fontSize: "0.75rem", color: "#60a5fa", fontWeight: 600 }}>Change</span>
		</div>
	);
}

function ChallengeCard({ challenge, currentUserId, myCars, friends, onAccept, onDecline }) {
	const isIncoming  = challenge.opponentUserId === currentUserId;
	const isCompleted = challenge.status === "completed";
	const isDeclined  = challenge.status === "declined";
	const isPending   = challenge.status === "pending";

	const [selectedCar, setSelectedCar] = useState("");
	const [carPickerOpen, setCarPickerOpen] = useState(false);
	const [busy, setBusy] = useState(false);

	const challenger = (friends || []).find((f) => String(f.id) === String(challenge.challengerUserId));
	const challengerInitials = (challenge.challengerUsername || "?").slice(0, 2).toUpperCase();

	const iWon = isCompleted && challenge.winnerUserId === currentUserId;

	async function handleAccept() {
		if (!selectedCar) return;
		const car = myCars.find((c) => String(c.generationId) === selectedCar);
		if (!car) return;
		setBusy(true);
		try {
			await onAccept(challenge.id, {
				opponentGenerationId: car.generationId,
				opponentMake:         car.manufacturerName,
				opponentModel:        car.modelName,
				opponentGenCode:      car.generationCode,
				opponentHorsepower:   car.engine?.horsepower || null,
				opponentWeightKg:     car.engine?.weightKg   || null,
				opponentTorqueNm:     car.engine?.torqueNm   || null,
				opponentDrivetrain:   car.drivetrain          || null,
			});
		} finally {
			setBusy(false);
		}
	}

	async function handleDecline() {
		setBusy(true);
		try { await onDecline(challenge.id); }
		finally { setBusy(false); }
	}

	const borderColor = isCompleted
		? (iWon ? S.discText : "#dc2626")
		: isDeclined ? S.faint
		: "#fbbf24";

	return (
		<div style={{
			padding: "0.9rem 1rem", borderRadius: "8px", border: `1.5px solid ${borderColor}`,
			background: isCompleted ? (iWon ? S.disc : "rgba(248,113,113,0.10)") : S.cardAlt,
		}}>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.5rem" }}>
				<span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
					{raceModeLabel(challenge.distance)}
				</span>
				<span style={{
					fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase",
					letterSpacing: "0.05em", padding: "1px 8px", borderRadius: "4px",
					background: borderColor + "22", color: borderColor, border: `1px solid ${borderColor}55`,
				}}>
					{isCompleted ? (iWon ? "Won" : "Lost") : challenge.status}
				</span>
			</div>

			<p style={{ margin: "0.15rem 0", fontSize: "0.85rem", color: S.textSub, display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
				<strong>Challenger:</strong>
				<RarityBadge rarity={getCarRarity(challenge.challengerHorsepower, challenge.challengerWeightKg)} />
				{challenge.challengerMake} {challenge.challengerModel} {challenge.challengerGenCode}
				<span style={{ color: S.faint }}>(#{challenge.challengerUserId})</span>
			</p>

			{challenge.opponentMake && (
				<p style={{ margin: "0.15rem 0", fontSize: "0.85rem", color: S.textSub, display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
					<strong>Opponent:</strong>
					<RarityBadge rarity={getCarRarity(challenge.opponentHorsepower, challenge.opponentWeightKg)} />
					{challenge.opponentMake} {challenge.opponentModel} {challenge.opponentGenCode}
					<span style={{ color: S.faint }}>(#{challenge.opponentUserId})</span>
				</p>
			)}

			{isCompleted && (
				<div style={{ marginTop: "0.4rem", fontSize: "0.82rem", color: S.muted }}>
					<span>
						Challenger: {challenge.challengerTime}s &nbsp;|&nbsp; Opponent: {challenge.opponentTime}s
					</span>
					{challenge.pointsAwarded != null && iWon && (
						<span style={{ marginLeft: "0.75rem", color: "#fbbf24", fontWeight: 600 }}>
							+{challenge.pointsAwarded} pts
						</span>
					)}
					{challenge.pointsAwarded != null && !iWon && (
						<span style={{ marginLeft: "0.75rem", color: S.faint }}>
							+0 pts
						</span>
					)}
				</div>
			)}

			{isPending && isIncoming && (
				<div style={{ marginTop: "0.85rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
					{/* Challenger's car — hero photo with overlaid profile */}
					<div style={{ borderRadius: "10px", overflow: "hidden", position: "relative", background: S.cardAlt }}>
						<AuthImage
							src={`/recognize/images/${challenge.challengerGenerationId}`}
							alt=""
							style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
						/>
						<div style={{
							position: "absolute", bottom: 0, left: 0, right: 0, height: "65%",
							background: "linear-gradient(to top, rgba(0,0,0,0.82), transparent)",
						}} />
						<div style={{
							position: "absolute", bottom: 0, left: 0, right: 0,
							padding: "0.65rem 0.75rem",
							display: "flex", alignItems: "center", gap: "0.6rem",
						}}>
							<div style={{
								width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
								overflow: "hidden", background: "#1f2937",
								display: "flex", alignItems: "center", justifyContent: "center",
								border: "2px solid rgba(255,255,255,0.25)",
							}}>
								{challenger?.profilePhoto
									? <img src={challenger.profilePhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
									: <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#93c5fd" }}>{challengerInitials}</span>
								}
							</div>
							<div style={{ flex: 1, minWidth: 0 }}>
								<div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff", marginBottom: "0.15rem" }}>
									{challenge.challengerUsername || `User #${challenge.challengerUserId}`}
								</div>
								<div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
									<RarityBadge rarity={getCarRarity(challenge.challengerHorsepower, challenge.challengerWeightKg)} />
									<span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>
										{challenge.challengerMake} {challenge.challengerModel}
										{challenge.challengerGenCode && (
											<span style={{ opacity: 0.6, fontWeight: 400 }}> {challenge.challengerGenCode}</span>
										)}
									</span>
								</div>
							</div>
						</div>
					</div>

					{/* Your car picker */}
					<div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
						<span style={{ fontSize: "0.75rem", color: S.faint, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Your car</span>
						{selectedCar
							? <CarPreview
								car={myCars.find((c) => String(c.generationId) === selectedCar)}
								onClick={() => setCarPickerOpen(true)}
							/>
							: <button
								type="button"
								onClick={() => setCarPickerOpen(true)}
								style={{
									width: "100%", padding: "0.6rem 0.9rem", borderRadius: "10px",
									border: "1.5px dashed rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.03)",
									color: "#64748b", cursor: "pointer", textAlign: "left",
									fontSize: "0.88rem", fontFamily: "inherit",
								}}
							>
								+ Pick your car
							</button>
						}
					</div>

					<div style={{ display: "flex", gap: "0.5rem" }}>
						<button
							className="primary-btn"
							style={{ flex: 1 }}
							disabled={!selectedCar || busy}
							onClick={handleAccept}
						>
							{busy ? "Resolving..." : "Accept & Race"}
						</button>
						<button
							style={{
								flex: 1, padding: "0.45rem 0.75rem", borderRadius: "6px",
								border: "1px solid rgba(248,113,113,0.35)", background: S.card,
								color: "#dc2626", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem",
							}}
							disabled={busy}
							onClick={handleDecline}
						>
							Decline
						</button>
					</div>

					{carPickerOpen && (
						<CarPickerModal
							cars={myCars}
							value={selectedCar}
							onSelect={setSelectedCar}
							onClose={() => setCarPickerOpen(false)}
						/>
					)}
				</div>
			)}

			{isPending && !isIncoming && (
				<p style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: S.faint, fontStyle: "italic" }}>
					Waiting for User #{challenge.opponentUserId} to respond...
				</p>
			)}

			<p style={{ margin: "0.4rem 0 0", fontSize: "0.75rem", color: S.faint }}>
				{new Date(challenge.createdAt).toLocaleString()}
			</p>
		</div>
	);
}

export default function RacePage() {
	const { user } = useAuth();
	const [tab, setTab] = useState("new");

	const [myCars, setMyCars] = useState([]);
	const [users, setUsers] = useState([]);
	const [challenges, setChallenges] = useState([]);

	const [form, setForm] = useState({ opponentUserId: "", distance: "quarter", challengerGenerationId: "" });
	const [submitError, setSubmitError] = useState("");
	const [submitOk, setSubmitOk] = useState(false);
	const [selectedRace, setSelectedRace] = useState(null);
	const [raceCardRect, setRaceCardRect] = useState(null);
	const [carPickerOpen, setCarPickerOpen] = useState(false);
	const [friendPickerOpen, setFriendPickerOpen] = useState(false);
	const [raceResult, setRaceResult] = useState(null);

	async function refresh() {
		try {
			const [collRes, challengeRes] = await Promise.all([
				getCollection(),
				getChallenges(),
			]);
			setMyCars(collRes.items || []);
			setChallenges(challengeRes.challenges || []);
		} catch {
			/* swallow, keep stale data */
		}
	}

	useEffect(() => {
		refresh();
		listFriends()
			.then((res) => setUsers(res.friends || []))
			.catch(() => {});
	}, []);

	const incomingChallenges = challenges.filter(
		(c) => c.opponentUserId === user?.id && c.status === "pending"
	);
	const historyChallenges = challenges.filter(
		(c) => c.status === "completed" || c.status === "declined"
	);

	async function handleCreate(e) {
		e.preventDefault();
		setSubmitError("");
		setSubmitOk(false);
		const car = myCars.find((c) => String(c.generationId) === form.challengerGenerationId);
		if (!car) { setSubmitError("Select a car from your collection."); return; }
		try {
			await createChallenge({
				opponentUserId:        Number(form.opponentUserId),
				distance:              form.distance,
				challengerGenerationId: car.generationId,
				challengerMake:        car.manufacturerName,
				challengerModel:       car.modelName,
				challengerGenCode:     car.generationCode,
				challengerHorsepower:  car.engine?.horsepower || null,
				challengerWeightKg:    car.engine?.weightKg   || null,
				challengerTorqueNm:    car.engine?.torqueNm   || null,
				challengerDrivetrain:  car.drivetrain          || null,
			});
			setSubmitOk(true);
			setForm((prev) => ({ ...prev, opponentUserId: "", challengerGenerationId: "" }));
			await refresh();
		} catch (err) {
			setSubmitError(err.message || "Failed to send challenge.");
		}
	}

	async function handleAccept(id, opponentCarData) {
		const res = await acceptChallenge(id, {
			...opponentCarData,
			opponentHorsepower: opponentCarData.opponentHorsepower || null,
			opponentWeightKg:   opponentCarData.opponentWeightKg   || null,
		});
		await refresh();
		if (res?.challenge) setRaceResult(res.challenge);
	}

	async function handleDecline(id) {
		await declineChallenge(id);
		await refresh();
	}

	const otherUsers = users;

	const TAB_STYLE = (active) => ({
		padding: "0.45rem 1.1rem", borderRadius: "6px", border: "none",
		fontWeight: active ? 700 : 500, fontSize: "0.9rem", cursor: "pointer",
		background: active ? "#60a5fa" : "transparent",
		color: active ? S.card : S.muted,
		transition: "background 0.15s",
	});

	return (
		<main className="page">
			<h1 style={{ padding: "0 0.25rem" }}>Drag Racing</h1>

			{(() => {
				const completed = challenges.filter((c) => c.status === "completed");
				const wins   = completed.filter((c) => c.winnerUserId === user?.id).length;
				const losses = completed.length - wins;
				const rate   = completed.length > 0 ? Math.round((wins / completed.length) * 100) : null;
				if (completed.length === 0) return null;
				return (
					<div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.25rem" }}>
						{[
							{ label: "Wins",     value: wins,   color: "#22c55e" },
							{ label: "Losses",   value: losses, color: "#ef4444" },
							{ label: "Win rate", value: rate != null ? `${rate}%` : "—", color: rate >= 50 ? "#22c55e" : "#f59e0b" },
						].map(({ label, value, color }) => (
							<div key={label} style={{
								flex: 1, padding: "0.75rem 1rem", borderRadius: "12px",
								background: S.cardAlt, border: `1px solid ${color}22`,
								textAlign: "center",
							}}>
								<div style={{ fontSize: "1.45rem", fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
								<div style={{ fontSize: "0.72rem", color: S.faint, marginTop: "0.3rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
							</div>
						))}
					</div>
				);
			})()}

			<div style={{
				display: "flex", gap: "0.25rem", background: S.cardAlt,
				padding: "0.3rem", borderRadius: "8px", marginBottom: "1.25rem", width: "fit-content",
			}}>
				<button style={TAB_STYLE(tab === "new")} onClick={() => setTab("new")}>New Challenge</button>
				<button style={TAB_STYLE(tab === "incoming")} onClick={() => setTab("incoming")}>
					Incoming
					{incomingChallenges.length > 0 && (
						<span style={{
							marginLeft: "0.4rem", background: "#ef4444", color: S.card,
							borderRadius: "999px", fontSize: "0.7rem", fontWeight: 700,
							padding: "0 5px", lineHeight: "1.4",
						}}>
							{incomingChallenges.length}
						</span>
					)}
				</button>
				<button style={TAB_STYLE(tab === "history")} onClick={() => setTab("history")}>History</button>
			</div>

			{tab === "new" && (
				<section style={{
					borderRadius: "16px", padding: "1.75rem",
					background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
					border: "1px solid rgba(96,165,250,0.2)",
					boxShadow: "0 4px 32px rgba(96,165,250,0.08)",
				}}>
					<h2 style={{ marginTop: 0, color: "#e2e8f0", letterSpacing: "0.02em" }}>Challenge a driver</h2>
					{myCars.length === 0 && (
						<p className="muted">You need at least one car in your collection to race.</p>
					)}
					{myCars.length > 0 && (
						<form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
							<div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
								<span style={{ fontSize: "0.8rem", color: "#93c5fd", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Your car</span>
								{form.challengerGenerationId
									? <CarPreview
										car={myCars.find((c) => String(c.generationId) === form.challengerGenerationId)}
										onClick={() => setCarPickerOpen(true)}
									/>
									: <button
										type="button"
										onClick={() => setCarPickerOpen(true)}
										style={{
											width: "100%", padding: "0.7rem 1rem", borderRadius: "10px",
											border: "1.5px dashed rgba(96,165,250,0.35)", background: "rgba(255,255,255,0.03)",
											color: "#64748b", cursor: "pointer", textAlign: "left",
											fontSize: "0.9rem", fontFamily: "inherit",
										}}
									>
										+ Pick your car
									</button>
								}
							</div>

							<div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
								<span style={{ fontSize: "0.8rem", color: "#93c5fd", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Opponent</span>
								{form.opponentUserId
									? <FriendPreview
										friend={otherUsers.find((u) => String(u.id) === form.opponentUserId)}
										onClick={() => setFriendPickerOpen(true)}
									/>
									: <button
										type="button"
										onClick={() => setFriendPickerOpen(true)}
										style={{
											width: "100%", padding: "0.7rem 1rem", borderRadius: "10px",
											border: "1.5px dashed rgba(96,165,250,0.35)", background: "rgba(255,255,255,0.03)",
											color: "#64748b", cursor: "pointer", textAlign: "left",
											fontSize: "0.9rem", fontFamily: "inherit",
										}}
									>
										+ Choose opponent
									</button>
								}
							</div>

							<div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
								<span style={{ fontSize: "0.8rem", color: "#93c5fd", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Distance</span>
								<div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
									{Object.entries(DISTANCE_LABELS).map(([key, label]) => (
										<label
											key={key}
											style={{
												display: "flex", alignItems: "center", gap: "0.4rem",
												padding: "0.5rem 1rem", borderRadius: "8px", cursor: "pointer",
												border: `1.5px solid ${form.distance === key ? "#60a5fa" : "rgba(96,165,250,0.2)"}`,
												background: form.distance === key ? "rgba(96,165,250,0.18)" : "rgba(255,255,255,0.04)",
												color: form.distance === key ? "#93c5fd" : "#94a3b8",
												fontWeight: form.distance === key ? 700 : 400, fontSize: "0.88rem",
												transition: "all 0.15s",
											}}
										>
											<input
												type="radio"
												name="distance"
												value={key}
												checked={form.distance === key}
												onChange={() => setForm((p) => ({ ...p, distance: key }))}
												style={{ display: "none" }}
											/>
											{label}
											{DISTANCE_METERS[key] != null && (
												<span style={{ fontSize: "0.75rem", color: form.distance === key ? "#60a5fa" : "rgba(148,163,184,0.6)" }}>{DISTANCE_METERS[key]}m</span>
											)}
										</label>
									))}
								</div>
							</div>

							<div style={{ display: "flex", justifyContent: "flex-end" }}>
								<button
									type="submit"
									disabled={!form.opponentUserId || !form.challengerGenerationId}
									style={{
										padding: "0.6rem 1.5rem", borderRadius: "10px", fontWeight: 700,
										fontSize: "0.95rem", border: "none", cursor: "pointer",
										background: (!form.opponentUserId || !form.challengerGenerationId)
											? "rgba(96,165,250,0.2)"
											: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
										color: (!form.opponentUserId || !form.challengerGenerationId) ? "#64748b" : "#fff",
										boxShadow: (!form.opponentUserId || !form.challengerGenerationId)
											? "none" : "0 4px 16px rgba(59,130,246,0.4)",
										transition: "all 0.15s",
									}}
								>
									Send Challenge →
								</button>
							</div>
						</form>
					)}
					{submitError && <p className="error-text">{submitError}</p>}
					{submitOk && (
						<p style={{ color: S.discText, fontWeight: 600, marginTop: "0.5rem" }}>
							Challenge sent! Waiting for the opponent to pick their car.
						</p>
					)}
				</section>
			)}

			{tab === "incoming" && (
				<section className="card">
					<h2 style={{ marginTop: 0 }}>Incoming challenges</h2>
					{incomingChallenges.length === 0 && (
						<p className="muted">No pending challenges for you.</p>
					)}
					<div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
						{incomingChallenges.map((c) => (
							<ChallengeCard
								key={c.id}
								challenge={c}
								currentUserId={user?.id}
								myCars={myCars}
								friends={users}
								onAccept={handleAccept}
								onDecline={handleDecline}
							/>
						))}
					</div>
				</section>
			)}

			{tab === "history" && (
				<section className="card">
					<h2 style={{ marginTop: 0 }}>Race history</h2>
					{historyChallenges.length === 0 && (
						<p className="muted">No completed races yet.</p>
					)}
					<div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
						{historyChallenges.map((c) => c.status === "completed" ? (
							<HistoryCard
								key={c.id}
								challenge={c}
								currentUserId={user?.id}
								onOpen={(ch, clientY) => { setSelectedRace(ch); setRaceCardRect(clientY); }}
							/>
						) : (
							<div
								key={c.id}
								style={{
									padding: "0.75rem 1rem", borderRadius: "8px",
									border: `1px solid ${S.faint}`, background: S.cardAlt,
									fontSize: "0.85rem", color: S.muted,
								}}
							>
								<span style={{ fontWeight: 600 }}>{raceModeLabel(c.distance)}</span>
								{" — Declined · "}
								<span style={{ color: S.faint, fontSize: "0.75rem" }}>
									{new Date(c.createdAt).toLocaleString()}
								</span>
							</div>
						))}
					</div>
				</section>
			)}

			{selectedRace && (
				<RaceDetailModal
					challenge={selectedRace}
					currentUserId={user?.id}
					cardRect={raceCardRect}
					onClose={() => { setSelectedRace(null); setRaceCardRect(null); }}
				/>
			)}

			{raceResult && (
				<RaceAnimationModal
					result={raceResult}
					currentUserId={user?.id}
					onClose={() => setRaceResult(null)}
				/>
			)}

			{carPickerOpen && (
				<CarPickerModal
					cars={myCars}
					value={form.challengerGenerationId}
					onSelect={(v) => setForm((p) => ({ ...p, challengerGenerationId: v }))}
					onClose={() => setCarPickerOpen(false)}
				/>
			)}

			{friendPickerOpen && (
				<FriendPickerModal
					friends={otherUsers}
					value={form.opponentUserId}
					onSelect={(v) => setForm((p) => ({ ...p, opponentUserId: v }))}
					onClose={() => setFriendPickerOpen(false)}
				/>
			)}
		</main>
	);
}



