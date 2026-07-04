export default function RaceResult({ race }) {
	return (
		<article className="card race-card">
			<h4>{race.points} pts</h4>
			<p className="muted">Distance: {race.distanceM} m</p>
			<p className="muted">Duration: {race.durationS} s</p>
			<p className="muted">{new Date(race.createdAt).toLocaleString()}</p>
		</article>
	);
}
