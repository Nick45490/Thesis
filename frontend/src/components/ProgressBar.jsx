export default function ProgressBar({ label, current, target }) {
	const safeTarget = typeof target === "number" ? Math.max(1, target) : 1;
	const progress = typeof target === "number" ? Math.min(100, Math.round((current / safeTarget) * 100)) : 0;

	return (
		<div className="progress-wrap">
			<div className="progress-header">
				<span>{label}</span>
				<span>
					{current}/{target}
				</span>
			</div>
			<div className="progress-track">
				<div className="progress-value" style={{ width: `${progress}%` }} />
			</div>
		</div>
	);
}
