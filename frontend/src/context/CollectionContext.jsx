import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
	addCollectionItem,
	getCollection,
	getCollectionProgress,
	removeCollectionItem
} from "../api/collection.api";
import { useAuth } from "./AuthContext";

const CollectionContext = createContext(null);

export function CollectionProvider({ children }) {
	const { isAuthenticated } = useAuth();
	const [items, setItems] = useState([]);
	const [progress, setProgress] = useState(null);
	const [loading, setLoading] = useState(false);

	async function refresh() {
		if (!isAuthenticated) {
			setItems([]);
			setProgress(null);
			return;
		}

		setLoading(true);
		try {
			const [collectionResponse, progressResponse] = await Promise.all([
				getCollection(),
				getCollectionProgress()
			]);
			setItems(collectionResponse.items || []);
			setProgress(progressResponse || null);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		refresh().catch(() => {
			setItems([]);
			setProgress(null);
		});
	}, [isAuthenticated]);

	const value = useMemo(
		() => ({
			items,
			progress,
			loading,
			refresh,
			async addItem(payload) {
				const result = await addCollectionItem(payload);
				await refresh();
				return result;
			},

			async removeItem(generationId) {
				await removeCollectionItem(generationId);
				await refresh();
			}
		}),
		[items, loading, progress]
	);

	return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

export function useCollection() {
	const context = useContext(CollectionContext);
	if (!context) {
		throw new Error("useCollection must be used within a CollectionProvider");
	}

	return context;
}
