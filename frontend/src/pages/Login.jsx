import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
	const navigate = useNavigate();
	const { login } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(event) {
		event.preventDefault();
		setLoading(true);
		setError("");
		try {
			await login({ email, password });
			navigate("/profile");
		} catch (submitError) {
			setError(submitError.message);
		} finally {
			setLoading(false);
		}
	}

	return (
		<main className="page narrow">
			<section className="card">
				<h1>Welcome back</h1>
				<form onSubmit={handleSubmit} className="form-stack">
					<label>
						Email
						<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
					</label>
					<label>
						Password
						<input
							type="password"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							required
						/>
					</label>
					{error && <p className="error-text">{error}</p>}
					<button className="primary-btn" type="submit" disabled={loading}>
						{loading ? "Logging in..." : "Login"}
					</button>
				</form>
				<p className="muted">
					No account yet? <Link to="/register">Register</Link>
				</p>
			</section>
		</main>
	);
}
