import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
	const navigate = useNavigate();
	const { register } = useAuth();
	const [form, setForm] = useState({ email: "", username: "", password: "" });
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(event) {
		event.preventDefault();
		setLoading(true);
		setError("");
		try {
			await register(form);
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
				<h1>Create your account</h1>
				<form onSubmit={handleSubmit} className="form-stack">
					<label>
						Username
						<input
							value={form.username}
							onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
							required
						/>
					</label>
					<label>
						Email
						<input
							type="email"
							value={form.email}
							onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
							required
						/>
					</label>
					<label>
						Password
						<input
							type="password"
							value={form.password}
							onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
							required
						/>
					</label>
					{error && <p className="error-text">{error}</p>}
					<button className="primary-btn" type="submit" disabled={loading}>
						{loading ? "Creating..." : "Register"}
					</button>
				</form>
				<p className="muted">
					Already have an account? <Link to="/login">Login</Link>
				</p>
			</section>
		</main>
	);
}
