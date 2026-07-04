import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getMe, login as loginApi, register as registerApi } from "../api/auth.api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
	const [user, setUser] = useState(null);
	const [token, setToken] = useState(sessionStorage.getItem("thesis_token"));
	const [loading, setLoading] = useState(Boolean(token));

	useEffect(() => {
		if (!token) {
			setLoading(false);
			setUser(null);
			return;
		}

		getMe()
			.then((response) => {
				setUser(response.user || null);
			})
			.catch(() => {
				sessionStorage.removeItem("thesis_token");
				setToken(null);
				setUser(null);
			})
			.finally(() => {
				setLoading(false);
			});
	}, [token]);

	const value = useMemo(
		() => ({
			user,
			token,
			loading,
			isAuthenticated: Boolean(user && token),
			async login(credentials) {
				const response = await loginApi(credentials);
				sessionStorage.setItem("thesis_token", response.token);
				setToken(response.token);
				setUser(response.user);
				return response;
			},
			async register(payload) {
				const response = await registerApi(payload);
				sessionStorage.setItem("thesis_token", response.token);
				setToken(response.token);
				setUser(response.user);
				return response;
			},
			logout() {
				sessionStorage.removeItem("thesis_token");
				setToken(null);
				setUser(null);
			},
			updateUser(partial) {
				setUser((prev) => prev ? { ...prev, ...partial } : prev);
			},
		}),
		[loading, token, user]
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}

	return context;
}
