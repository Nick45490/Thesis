import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./src/components/Navbar";
import { useAuth } from "./src/context/AuthContext";
import AchievementsPage from "./src/pages/Achievements";
import BrowsePage from "./src/pages/Browse";
import CameraPage from "./src/pages/Camera";
import CarDetailPage from "./src/pages/CarDetail";
import FriendsPage from "./src/pages/Friends";
import FriendProfilePage from "./src/pages/FriendProfile";
import HomePage from "./src/pages/Home";
import LoginPage from "./src/pages/Login";
import ProfilePage from "./src/pages/Profile";
import RacePage from "./src/pages/Race";
import RegisterPage from "./src/pages/Register";

function ProtectedRoute({ children }) {
	const { isAuthenticated, loading } = useAuth();

	if (loading) {
		return <main className="page"><p>Loading session...</p></main>;
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" replace />;
	}

	return children;
}

export default function App() {
	return (
		<div className="app-shell">
			<Navbar />
			<Routes>
				<Route path="/" element={<HomePage />} />
				<Route path="/login" element={<LoginPage />} />
				<Route path="/register" element={<RegisterPage />} />
				<Route
					path="/camera"
					element={
						<ProtectedRoute>
							<CameraPage />
						</ProtectedRoute>
					}
				/>
				<Route path="/browse" element={<BrowsePage />} />
				<Route path="/browse/:makeId" element={<BrowsePage />} />
				<Route
					path="/car/:modelId"
					element={
						<ProtectedRoute>
							<CarDetailPage />
						</ProtectedRoute>
					}
				/>
				<Route
					path="/friends"
					element={
						<ProtectedRoute>
							<FriendsPage />
						</ProtectedRoute>
					}
				/>
				<Route
					path="/friends/:id"
					element={
						<ProtectedRoute>
							<FriendProfilePage />
						</ProtectedRoute>
					}
				/>
				<Route
					path="/profile"
					element={
						<ProtectedRoute>
							<ProfilePage />
						</ProtectedRoute>
					}
				/>
				<Route
					path="/race"
					element={
						<ProtectedRoute>
							<RacePage />
						</ProtectedRoute>
					}
				/>
				<Route
					path="/achievements"
					element={
						<ProtectedRoute>
							<AchievementsPage />
						</ProtectedRoute>
					}
				/>
			</Routes>
		</div>
	);
}
