import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getManufacturers, getManufacturerModels, getGenerations, getModels } from "../api/catalogue.api";
import { getCollection } from "../api/collection.api";
import { useAuth } from "../context/AuthContext";
import { RARITY_COLOR, RARITY_LABEL, RARITY_ORDER, S } from "../theme";
import { getLogoUrl, getLogoUrlFallbacks, getInitials, getHeroUrl } from "../logos";
import AuthImage from "../components/AuthImage";
import { getCarRarity } from "../utils/rarity";

// â"€â"€ rarity helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

// Rarity here previews the BEST engine available across a make/model's
// generations (derived from data already fetched for the progress bars below —
// no extra request needed), since there's no single "owned" engine to read at
// this browsing level, unlike Profile.jsx/Race.jsx which show a specific scanned car.

const COUNTRY_CODE = {
	"Italy": "it", "Germany": "de", "United Kingdom": "gb", "France": "fr",
	"Japan": "jp", "USA": "us", "United States": "us", "Sweden": "se",
	"South Korea": "kr", "Korea": "kr", "Czech Republic": "cz", "Romania": "ro",
	"Slovakia": "sk", "Spain": "es", "Netherlands": "nl", "Austria": "at",
	"Switzerland": "ch", "Malaysia": "my", "China": "cn", "Australia": "au",
	"Canada": "ca", "Poland": "pl", "Serbia": "rs", "Turkey": "tr",
};
function FlagImage({ country }) {
	const code = COUNTRY_CODE[country];
	if (!code) return null;
	return (
		<img
			src={`https://flagcdn.com/16x12/${code}.png`}
			alt={country}
			width={16}
			height={12}
			style={{ display: "inline-block", borderRadius: "1px", flexShrink: 0 }}
		/>
	);
}

function LogoBadge({ name, complete }) {
	const [stage, setStage] = useState(0);
	const urls = [getLogoUrl(name), ...getLogoUrlFallbacks(name)].filter(Boolean);

	if (stage >= urls.length) return null;

	return (
		<div style={{
			position: "absolute", top: "0.5rem", right: "0.55rem", zIndex: 2,
			width: 36, height: 36, borderRadius: "8px",
			background: "#fff", border: "1px solid rgba(255,255,255,0.15)",
			overflow: "hidden", flexShrink: 0,
			boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
		}}>
			<img
				key={stage}
				src={urls[stage]}
				alt={name}
				onError={() => setStage((s) => s + 1)}
				style={{ width: "100%", height: "100%", objectFit: "contain", padding: "3px" }}
			/>
			{complete && (
				<div style={{
					position: "absolute", top: -1, right: -1,
					width: 10, height: 10, borderRadius: "50%",
					background: "#22c55e", border: "1.5px solid #000",
				}} />
			)}
		</div>
	);
}

function ManufacturerLogo({ name, color }) {
	const [errored, setErrored] = useState(false);
	const url = getLogoUrl(name);

	if (!url || errored) {
		return (
			<div style={{
				width: 68, height: 68, borderRadius: "14px", flexShrink: 0,
				background: `${color}18`, border: `1px solid ${color}33`,
				display: "flex", alignItems: "center", justifyContent: "center",
				fontSize: "1.1rem", fontWeight: 800, color, letterSpacing: "-0.02em",
			}}>
				{getInitials(name)}
			</div>
		);
	}

	return (
		<div style={{
			width: 68, height: 68, borderRadius: "14px", flexShrink: 0,
			background: "#ffffff", padding: "8px",
			display: "flex", alignItems: "center", justifyContent: "center",
			overflow: "hidden",
		}}>
			<img
				src={url}
				alt={name}
				onError={() => setErrored(true)}
				style={{ width: "100%", height: "100%", objectFit: "contain" }}
			/>
		</div>
	);
}

function ManufacturerHero({ name, color }) {
	const [src, setSrc] = useState(() => getHeroUrl(name));
	const [errored, setErrored] = useState(false);

	function handleError() {
		if (src.endsWith(".jpg")) {
			setSrc(src.replace(".jpg", ".jpeg"));
		} else {
			setErrored(true);
		}
	}

	if (errored) {
		return (
			<div style={{
				position: "absolute", inset: 0,
				display: "flex", alignItems: "center", justifyContent: "center",
				background: `${color}18`,
			}}>
				<ManufacturerLogo name={name} color={color} />
			</div>
		);
	}

	return (
		<>
			<img
				src={src}
				alt={name}
				onError={handleError}
				style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
			/>
			<div style={{
				position: "absolute", bottom: 0, left: 0, right: 0, height: "50%",
				background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)",
			}} />
		</>
	);
}

function RarityBadge({ rarity }) {
	const color = RARITY_COLOR[rarity] || RARITY_COLOR.common;
	return (
		<span style={{
			fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.05em",
			textTransform: "uppercase", color,
			background: `${color}22`, border: `1px solid ${color}55`,
			borderRadius: "4px", padding: "1px 6px", whiteSpace: "nowrap",
		}}>
			{RARITY_LABEL[rarity] || rarity}
		</span>
	);
}

// â"€â"€ makes grid â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function MakesView({ discoveredMakes, modelCountByMakeId, completeModelCountByMakeName, isAuthenticated, bestEngineByMakeId }) {
	const [manufacturers, setManufacturers] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		getManufacturers()
			.then((res) => setManufacturers(res.manufacturers || []))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	const sorted = useMemo(() => {
		return [...manufacturers].sort((a, b) => a.name.localeCompare(b.name));
	}, [manufacturers]);

	if (loading) {
		return <p className="muted">Loading...</p>;
	}

	return (
		<>
			<div style={{
				display: "grid",
				gridTemplateColumns: "repeat(3, 1fr)",
				gap: "0.75rem",
			}}>
				{sorted.map((m) => {
					const bestEngine = bestEngineByMakeId[m.id];
					const rarity     = getCarRarity(bestEngine?.horsepower, bestEngine?.weightKg);
					const color      = RARITY_COLOR[rarity];
					const totalMdls  = modelCountByMakeId[m.id] || 0;
					const discMdls   = isAuthenticated ? (completeModelCountByMakeName[m.name] || 0) : 0;
					const pct        = totalMdls > 0 ? Math.round((discMdls / totalMdls) * 100) : 0;
					const complete   = totalMdls > 0 && discMdls >= totalMdls;

					return (
						<Link
							key={m.id}
							to={`/browse/${m.id}`}
							style={{
								display: "flex", flexDirection: "column",
								borderRadius: "14px", textDecoration: "none",
								border: `1.5px solid ${complete ? S.discBorderStrong : S.border}`,
								background: S.cardAlt,
								overflow: "hidden",
								transition: "border-color 0.15s",
								aspectRatio: "1 / 1",
							}}
						>
							{/* top section — hero photo */}
							<div style={{
								flex: 1, position: "relative", overflow: "hidden", minHeight: "130px",
							}}>
								<ManufacturerHero name={m.name} color={color} />
								<div style={{
									position: "absolute", top: 0, left: 0, right: 0,
									height: "3px", background: color, borderRadius: "14px 14px 0 0", zIndex: 2,
								}} />
								{m.country && (
									<span style={{
										position: "absolute", top: "0.55rem", left: "0.65rem", zIndex: 2,
										display: "flex", alignItems: "center", gap: "0.3rem",
										fontSize: "0.62rem", fontWeight: 600, color: "#fff",
										textTransform: "uppercase", letterSpacing: "0.06em",
										textShadow: "0 1px 3px rgba(0,0,0,0.7)",
									}}>
										<FlagImage country={m.country} />
										{m.country}
									</span>
								)}
								<LogoBadge name={m.name} complete={complete} />
							</div>

							{/* divider */}
							<div style={{ height: "1px", background: S.border }} />

							{/* bottom section — name + progress */}
							<div style={{ padding: "0.75rem 0.85rem 0.85rem" }}>
								<p style={{
									margin: "0 0 0.5rem", fontWeight: 700, fontSize: "0.88rem",
									color: S.text, textAlign: "center",
								}}>
									{m.name}
								</p>
								{isAuthenticated && totalMdls > 0 && (
									<>
										<div style={{
											height: "5px", background: S.track,
											borderRadius: "3px", overflow: "hidden",
										}}>
											<div style={{
												height: "100%", width: `${pct}%`,
												background: complete ? S.discText : color,
												borderRadius: "3px", transition: "width 0.4s ease",
											}} />
										</div>
										<p style={{
											margin: "0.3rem 0 0", fontSize: "0.72rem",
											color: complete ? S.discText : S.faint,
											textAlign: "center", fontWeight: complete ? 700 : 400,
										}}>
											{complete ? "Complete" : `${discMdls} / ${totalMdls} models`}
										</p>
									</>
								)}
							</div>
						</Link>
					);
				})}
			</div>
			{sorted.length === 0 && <p className="muted">No manufacturers found.</p>}
		</>
	);
}

// â"€â"€ models list for one make â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function ModelCard({ m, color, rarity, complete, discGens, totalGens, pct, newestGenId, isAuthenticated }) {
	const [imgErrored, setImgErrored] = useState(false);
	const showImg = isAuthenticated && newestGenId && !imgErrored;

	return (
		<Link
			to={`/car/${m.id}`}
			style={{
				display: "flex", flexDirection: "column",
				borderRadius: "14px", textDecoration: "none",
				border: `1.5px solid ${complete ? S.discBorderStrong : S.border}`,
				background: S.cardAlt, overflow: "hidden",
				aspectRatio: "1 / 1", transition: "border-color 0.15s",
			}}
		>
			{/* top — photo */}
			<div style={{ flex: 1, position: "relative", overflow: "hidden", background: S.card, minHeight: 0 }}>
				<div style={{
					position: "absolute", top: 0, left: 0, right: 0,
					height: "3px", background: color, zIndex: 1,
				}} />
				{showImg ? (
					<>
						<AuthImage
							src={`/recognize/images/${newestGenId}`}
							alt={m.name}
							onError={() => setImgErrored(true)}
							style={{
								position: "absolute", inset: 0,
								width: "100%", height: "100%", objectFit: "cover",
								filter: complete ? "none" : "blur(7px) saturate(0.25)",
								transform: complete ? "none" : "scale(1.15)",
								transition: "filter 0.35s ease, transform 0.35s ease",
							}}
						/>
						{!complete && (
							<div style={{
								position: "absolute", inset: 0, display: "flex",
								alignItems: "center", justifyContent: "center", zIndex: 1,
							}}>
								<span style={{ fontSize: "1.4rem" }}>{"🔒"}</span>
							</div>
						)}
					</>
				) : (
					<div style={{
						position: "absolute", inset: 0, display: "flex",
						alignItems: "center", justifyContent: "center",
						color: S.faint, fontSize: "0.75rem", fontWeight: 600, textAlign: "center",
						padding: "0.5rem",
					}}>
						{m.name}
					</div>
				)}
				{complete && (
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

			{/* bottom — name + progress */}
			<div style={{ padding: "0.6rem 0.75rem 0.7rem", flexShrink: 0 }}>
				<div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
					<span style={{ fontWeight: 700, fontSize: "0.82rem", color: S.text, flex: 1, minWidth: 0 }}>
						{m.name}
					</span>
					<RarityBadge rarity={rarity} />
				</div>
				{isAuthenticated && totalGens > 0 && (
					<>
						<div style={{ height: "4px", background: S.track, borderRadius: "2px", overflow: "hidden" }}>
							<div style={{
								height: "100%", width: `${pct}%`,
								background: complete ? S.discText : color,
								borderRadius: "2px", transition: "width 0.4s ease",
							}} />
						</div>
						<p style={{ margin: "0.25rem 0 0", fontSize: "0.68rem", color: complete ? S.discText : S.faint, fontWeight: complete ? 700 : 400 }}>
							{complete ? "Complete" : `${discGens} / ${totalGens} gen${totalGens !== 1 ? "s" : ""}`}
						</p>
					</>
				)}
			</div>
		</Link>
	);
}

function ModelProgressBar({ discovered, total, color }) {
	if (total === 0) return null;
	const pct      = Math.round((discovered / total) * 100);
	const complete = discovered === total;
	return (
		<div style={{ marginTop: "0.35rem" }}>
			<div style={{ height: "4px", background: S.track, borderRadius: "2px", overflow: "hidden" }}>
				<div style={{
					height: "100%",
					width: `${pct}%`,
					background: complete ? S.discText : color,
					borderRadius: "2px",
					transition: "width 0.3s ease",
				}} />
			</div>
			<p style={{ margin: "0.2rem 0 0", fontSize: "0.72rem", color: complete ? S.discText : S.muted, fontWeight: complete ? 700 : 400 }}>
				{complete ? `Complete - all ${total} generation${total !== 1 ? "s" : ""} found` : `${discovered} / ${total} generation${total !== 1 ? "s" : ""}`}
			</p>
		</div>
	);
}

function ModelPhoto({ genId, modelName, complete }) {
	const [errored, setErrored] = useState(false);
	if (!genId || errored) {
		return (
			<div style={{
				width: 72, height: 52, flexShrink: 0, borderRadius: "6px",
				background: S.cardAlt, display: "flex", alignItems: "center",
				justifyContent: "center", color: S.faint, fontSize: "1.1rem",
			}}>
				đźš—
			</div>
		);
	}
	return (
		<div style={{ width: 72, height: 52, flexShrink: 0, borderRadius: "6px", overflow: "hidden", background: S.cardAlt, position: "relative" }}>
			<img
				src={`/recognize/images/${genId}`}
				alt={modelName}
				onError={() => setErrored(true)}
				style={{
					width: "100%", height: "100%", objectFit: "cover",
					filter: complete ? "none" : "blur(6px) saturate(0.25)",
					transform: complete ? "none" : "scale(1.15)",
					transition: "filter 0.35s ease, transform 0.35s ease",
				}}
			/>
			{!complete && (
				<div style={{
					position: "absolute", inset: 0, display: "flex",
					alignItems: "center", justifyContent: "center",
				}}>
					<span style={{ fontSize: "0.95rem" }}>đź"'</span>
				</div>
			)}
		</div>
	);
}

function ModelsView({ makeId, discoveredModels, genCountByModelId, newestGenIdByModelId, isAuthenticated, bestEngineByModelId }) {
	const [manufacturer, setManufacturer] = useState(null);
	const [models, setModels]             = useState([]);
	const [loading, setLoading]           = useState(true);

	useEffect(() => {
		getManufacturerModels(makeId)
			.then((res) => {
				setManufacturer(res.manufacturer || null);
				setModels(res.models || []);
			})
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [makeId]);

	const filtered = useMemo(() => {
		return [...models].sort((a, b) => {
			const engA = bestEngineByModelId[a.id];
			const engB = bestEngineByModelId[b.id];
			const ra = RARITY_ORDER[getCarRarity(engA?.horsepower, engA?.weightKg)];
			const rb = RARITY_ORDER[getCarRarity(engB?.horsepower, engB?.weightKg)];
			return ra !== rb ? ra - rb : a.name.localeCompare(b.name);
		});
	}, [models, bestEngineByModelId]);

	// Make-level completion stats
	const makeStats = useMemo(() => {
		if (!isAuthenticated || !manufacturer) return null;
		let completeCount = 0;
		for (const m of models) {
			const total = genCountByModelId[m.id] || 0;
			const disc  = discoveredModels.get(`${manufacturer.name}::${m.name}`) || 0;
			if (total > 0 && disc >= total) completeCount++;
		}
		return { completeCount, totalModels: models.length };
	}, [models, manufacturer, discoveredModels, genCountByModelId, isAuthenticated]);

	if (loading) return <p className="muted">Loading...</p>;
	if (!manufacturer) return <p className="muted">Manufacturer not found.</p>;

	const makeBestEngine = models.reduce((best, m) => {
		const eng = bestEngineByModelId[m.id];
		return eng && (eng.horsepower || 0) > (best?.horsepower || 0) ? eng : best;
	}, null);
	const makeRarity = getCarRarity(makeBestEngine?.horsepower, makeBestEngine?.weightKg);
	const makeColor  = RARITY_COLOR[makeRarity];
	const makeComplete = makeStats && makeStats.completeCount === makeStats.totalModels && makeStats.totalModels > 0;

	return (
		<>
			{/* Breadcrumb + make header */}
			<div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
				<Link to="/browse" style={{ fontSize: "0.85rem", color: S.muted, textDecoration: "none" }}>
					&larr; All makes
				</Link>
				<span style={{ color: S.faint }}>·</span>
				<span style={{ fontWeight: 700, fontSize: "1rem", color: S.text }}>{manufacturer.name}</span>
				<RarityBadge rarity={makeRarity} />
				{manufacturer.country && (
					<span style={{ fontSize: "0.8rem", color: S.faint }}>{manufacturer.country}</span>
				)}
			</div>

			{/* Make-level completion banner */}
			{makeStats && (
				<div style={{
					padding: "0.85rem 1rem", borderRadius: "8px", marginBottom: "1.1rem",
					background: makeComplete ? S.disc : S.cardAlt,
					border: `1.5px solid ${makeComplete ? S.discBorderStrong : S.border}`,
				}}>
					<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.45rem" }}>
						<span style={{ fontWeight: 600, fontSize: "0.9rem", color: makeComplete ? S.discText : S.textSub }}>
							{makeComplete
								? `${manufacturer.name} - fully completed!`
								: `${manufacturer.name} collection`}
						</span>
						<span style={{ fontSize: "0.82rem", fontWeight: 700, color: makeComplete ? S.discText : S.muted }}>
							{makeStats.completeCount} / {makeStats.totalModels} models complete
						</span>
					</div>
					<div style={{ height: "6px", background: S.track, borderRadius: "3px", overflow: "hidden" }}>
						<div style={{
							height: "100%",
							width: `${Math.round((makeStats.completeCount / makeStats.totalModels) * 100)}%`,
							background: makeComplete ? S.discText : makeColor,
							borderRadius: "3px", transition: "width 0.4s ease",
						}} />
					</div>
				</div>
			)}

			<div style={{
				display: "grid",
				gridTemplateColumns: "repeat(3, 1fr)",
				gap: "0.75rem",
			}}>
				{filtered.map((m) => {
					const modelEngine = bestEngineByModelId[m.id];
					const rarity      = getCarRarity(modelEngine?.horsepower, modelEngine?.weightKg);
					const color       = RARITY_COLOR[rarity];
					const totalGens   = genCountByModelId[m.id] || 0;
					const discGens    = isAuthenticated
						? (discoveredModels.get(`${manufacturer.name}::${m.name}`) || 0)
						: 0;
					const complete    = totalGens > 0 && discGens >= totalGens;
					const newestGenId = newestGenIdByModelId[m.id] || null;
					const pct         = totalGens > 0 ? Math.round((discGens / totalGens) * 100) : 0;

					return (
						<ModelCard
							key={m.id}
							m={m}
							color={color}
							rarity={rarity}
							complete={complete}
							discGens={discGens}
							totalGens={totalGens}
							pct={pct}
							newestGenId={newestGenId}
							isAuthenticated={isAuthenticated}
						/>
					);
				})}
				{filtered.length === 0 && (
					<p className="muted" style={{ gridColumn: "1 / -1" }}>No models found.</p>
				)}
			</div>
		</>
	);
}

// â"€â"€ page â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

export default function BrowsePage() {
	const { makeId } = useParams();
	const { isAuthenticated } = useAuth();

	const [discoveredMakes, setDiscoveredMakes]   = useState(new Set());
	const [discoveredModels, setDiscoveredModels] = useState(new Map());
	const [genCountByModelId, setGenCountByModelId] = useState({});
	const [modelCountByMakeId, setModelCountByMakeId] = useState({});
	const [allModels, setAllModels]               = useState([]);
	const [allMakers, setAllMakers]               = useState([]);
	const [allGenCountByModelId, setAllGenCountByModelId] = useState({});
	const [bestEngineByMakeId, setBestEngineByMakeId]   = useState({});
	const [bestEngineByModelId, setBestEngineByModelId] = useState({});

	// Fetch models + manufacturers + generations for the makes-grid progress bars
	useEffect(() => {
		if (makeId) return;
		Promise.all([getManufacturers(), getModels(), getGenerations()])
			.then(([makesRes, modelsRes, gensRes]) => {
				const makers = makesRes.manufacturers || [];
				const models = modelsRes.models || [];
				const gens   = gensRes.generations || [];

				const modelCounts = {};
				for (const m of models) {
					modelCounts[m.manufacturerId] = (modelCounts[m.manufacturerId] || 0) + 1;
				}
				setModelCountByMakeId(modelCounts);
				setAllModels(models);
				setAllMakers(makers);

				const genCounts = {};
				for (const g of gens) {
					genCounts[g.modelId] = (genCounts[g.modelId] || 0) + 1;
				}
				setAllGenCountByModelId(genCounts);

				// Best (highest-hp) engine per model, then rolled up per make — used to
				// preview rarity before any specific car is owned/scanned.
				const modelEngine = {};
				for (const g of gens) {
					for (const e of (g.engines || [])) {
						const cur = modelEngine[g.modelId];
						if (!cur || (e.horsepower || 0) > (cur.horsepower || 0)) modelEngine[g.modelId] = e;
					}
				}
				setBestEngineByModelId(modelEngine);

				const makeEngine = {};
				for (const m of models) {
					const eng = modelEngine[m.id];
					if (!eng) continue;
					const cur = makeEngine[m.manufacturerId];
					if (!cur || (eng.horsepower || 0) > (cur.horsepower || 0)) makeEngine[m.manufacturerId] = eng;
				}
				setBestEngineByMakeId(makeEngine);
			})
			.catch(() => {});
	}, [makeId]);

	// Fetch user collection
	useEffect(() => {
		if (!isAuthenticated) return;
		getCollection()
			.then((res) => {
				const items = res.collection || res.items || [];
				const makes  = new Set();
				const models = new Map();
				for (const item of items) {
					makes.add(item.manufacturerName);
					const key = `${item.manufacturerName}::${item.modelName}`;
					models.set(key, (models.get(key) || 0) + 1);
				}
				setDiscoveredMakes(makes);
				setDiscoveredModels(models);
			})
			.catch(() => {});
	}, [isAuthenticated]);

	// Count models where ALL generations are discovered (fully complete)
	const completeModelCountByMakeName = useMemo(() => {
		if (!allModels.length || !allMakers.length) return {};
		const makeById = Object.fromEntries(allMakers.map((m) => [m.id, m.name]));
		const result = {};
		for (const model of allModels) {
			const makeName = makeById[model.manufacturerId];
			if (!makeName) continue;
			const discovered = discoveredModels.get(`${makeName}::${model.name}`) || 0;
			const total      = allGenCountByModelId[model.id] || 0;
			if (total > 0 && discovered >= total) {
				result[makeName] = (result[makeName] || 0) + 1;
			}
		}
		return result;
	}, [allModels, allMakers, allGenCountByModelId, discoveredModels]);

	const [newestGenIdByModelId, setNewestGenIdByModelId] = useState({});

	// Fetch generation counts + newest gen per model when viewing a specific make
	useEffect(() => {
		if (!makeId) return;
		getGenerations()
			.then((res) => {
				const counts  = {};
				const newest  = {};
				const modelEngine = {};
				for (const g of (res.generations || [])) {
					counts[g.modelId] = (counts[g.modelId] || 0) + 1;
					const cur = newest[g.modelId];
					if (!cur || (g.startYear || 0) > (cur.startYear || 0)) {
						newest[g.modelId] = g;
					}
					for (const e of (g.engines || [])) {
						const curEng = modelEngine[g.modelId];
						if (!curEng || (e.horsepower || 0) > (curEng.horsepower || 0)) modelEngine[g.modelId] = e;
					}
				}
				setGenCountByModelId(counts);
				setNewestGenIdByModelId(Object.fromEntries(
					Object.entries(newest).map(([mid, g]) => [mid, g.id])
				));
				setBestEngineByModelId(modelEngine);
			})
			.catch(() => {});
	}, [makeId]);

	return (
		<>
		<main className="page">
			<h1 style={{ padding: "0 0.25rem", marginBottom: "1.25rem" }}>
				{makeId ? "Models" : "Car Catalogue"}
			</h1>
			<section className="card">
				{makeId ? (
					<ModelsView
						makeId={makeId}
						discoveredModels={discoveredModels}
						genCountByModelId={genCountByModelId}
						newestGenIdByModelId={newestGenIdByModelId}
						isAuthenticated={isAuthenticated}
						bestEngineByModelId={bestEngineByModelId}
					/>
				) : (
					<MakesView
						discoveredMakes={discoveredMakes}
						modelCountByMakeId={modelCountByMakeId}
						completeModelCountByMakeName={completeModelCountByMakeName}
						isAuthenticated={isAuthenticated}
						bestEngineByMakeId={bestEngineByMakeId}
					/>
				)}
			</section>
		</main>
		</>
	);
}

