import { useState, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";


function HamburgerIcon({ open }) {
	return (
		<svg width="32" height="32" viewBox="0 0 22 22" fill="none" aria-hidden="true">
			{open ? (
				<>
					<line x1="4" y1="4" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
					<line x1="18" y1="4" x2="4" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
				</>
			) : (
				<>
					<line x1="3" y1="6" x2="19" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
					<line x1="3" y1="11" x2="19" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
					<line x1="3" y1="16" x2="19" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
				</>
			)}
		</svg>
	);
}

export default function Navbar() {
	const { isAuthenticated, logout, user } = useAuth();
	const [open, setOpen] = useState(false);
	const location = useLocation();
	const drawerRef = useRef(null);

	// Close drawer on route change
	useEffect(() => { setOpen(false); }, [location.pathname]);

	// Close on outside click
	useEffect(() => {
		if (!open) return;
		function handle(e) {
			if (drawerRef.current && !drawerRef.current.contains(e.target)) setOpen(false);
		}
		document.addEventListener("mousedown", handle);
		return () => document.removeEventListener("mousedown", handle);
	}, [open]);

	// Lock body scroll when drawer open
	useEffect(() => {
		document.body.style.overflow = open ? "hidden" : "";
		return () => { document.body.style.overflow = ""; };
	}, [open]);

	function linkClass({ isActive }) {
		return "drawer-link" + (isActive ? " drawer-link-active" : "");
	}

	return (
		<>
			<header className="app-header">
				<div className="brand" style={{ letterSpacing: "0.35em", fontSize: "1.15rem", fontWeight: 900, transform: "scaleX(1.25)", transformOrigin: "left center" }}>
					STREET SCOUT
				</div>
				<button
					type="button"
					className="hamburger-btn"
					onClick={() => setOpen((v) => !v)}
					aria-label={open ? "Close menu" : "Open menu"}
				>
					<HamburgerIcon open={open} />
				</button>
			</header>

			{/* Backdrop */}
			<div
				className={"drawer-backdrop" + (open ? " drawer-backdrop-visible" : "")}
				onClick={() => setOpen(false)}
			/>

			{/* Drawer */}
			<nav ref={drawerRef} className={"side-drawer" + (open ? " side-drawer-open" : "")} aria-hidden={!open}>
				<div className="drawer-header">
					<span className="drawer-title">Menu</span>
					<button type="button" className="hamburger-btn" onClick={() => setOpen(false)} aria-label="Close menu">
						<HamburgerIcon open={true} />
					</button>
				</div>

				<div className="drawer-links">
					<NavLink to="/" className={linkClass}>Home</NavLink>
					<NavLink to="/browse" className={linkClass}>Collection</NavLink>
					{isAuthenticated && (
						<>
							<NavLink to="/camera" className={linkClass}>Camera</NavLink>
							<NavLink to="/race" className={linkClass}>Race</NavLink>
							<NavLink to="/leaderboard" className={linkClass}>Leaderboard</NavLink>
							<NavLink to="/achievements" className={linkClass}>Achievements</NavLink>
							<NavLink to="/friends" className={linkClass}>Friends</NavLink>
							<NavLink to="/profile" className={linkClass}>Profile</NavLink>
						</>
					)}
					{!isAuthenticated && (
						<>
							<NavLink to="/login" className={linkClass}>Login</NavLink>
							<NavLink to="/register" className={linkClass}>Register</NavLink>
						</>
					)}
				</div>

				{isAuthenticated && (
					<div className="drawer-footer">
						<span className="drawer-user">{user?.username || user?.email}</span>
						<button type="button" className="ghost-btn" onClick={logout}>Log out</button>
					</div>
				)}
			</nav>
		</>
	);
}