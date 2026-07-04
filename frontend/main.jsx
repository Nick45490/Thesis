import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./src/context/AuthContext";
import { CollectionProvider } from "./src/context/CollectionContext";
import "./src/styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
	<React.StrictMode>
		<BrowserRouter>
			<AuthProvider>
				<CollectionProvider>
					<App />
				</CollectionProvider>
			</AuthProvider>
		</BrowserRouter>
	</React.StrictMode>
);
