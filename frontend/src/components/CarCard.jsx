import AuthImage from "./AuthImage";

const FUEL_ICON = { petrol: "⛽", diesel: "🛢", electric: "⚡", hybrid: "🔋" };

export default function CarCard({ item, onRemove, hideStats = false }) {
	const eng = item.engine;
	return (
		<article className="card car-card" style={{ padding: 0, overflow: "hidden" }}>
			<div style={{ width: "100%", aspectRatio: "16/9", background: "#0a0a14", overflow: "hidden" }}>
				{item.scanPhoto ? (
					<img
						src={item.scanPhoto}
						alt={`${item.manufacturerName} ${item.modelName}`}
						style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
					/>
				) : (
					<AuthImage
						src={`/recognize/images/${item.generationId}`}
						alt={`${item.manufacturerName} ${item.modelName}`}
						style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
					/>
				)}
			</div>
			<div style={{ padding: "0.75rem 1rem" }}>
				<h3 style={{ margin: "0 0 0.15rem" }}>
					{item.manufacturerName} {item.modelName}
				</h3>
				<p className="muted" style={{ margin: 0 }}>Generation {item.generationCode}</p>
				{!hideStats && (
					<>
						{eng ? (
							<p className="muted" style={{ margin: "0.25rem 0 0" }}>
								{FUEL_ICON[eng.fuelType] || ""} {eng.name} &nbsp;·&nbsp; {eng.horsepower} hp &nbsp;·&nbsp; {eng.weightKg} kg
							</p>
						) : (
							<p className="muted" style={{ margin: "0.25rem 0 0" }}>Engine unknown</p>
						)}
						{item.discoveredAt && (
							<p className="muted" style={{ margin: "0.25rem 0 0" }}>
								Discovered: {new Date(item.discoveredAt).toLocaleString()}
							</p>
						)}
					</>
				)}
				{onRemove && (
					<button type="button" className="danger-btn" style={{ marginTop: "0.6rem" }} onClick={() => onRemove(item.generationId)}>
						Remove
					</button>
				)}
			</div>
		</article>
	);
}
