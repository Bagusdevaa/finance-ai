"use client";

import { useEffect } from "react";
import axios from "axios";
import { useAuthStore } from "@/lib/auth-store";

const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function AuthHydrate() {
	const setAuth = useAuthStore((s) => s.setAuth);
	const setHydrated = useAuthStore((s) => s.setHydrated);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const r = await axios.post(`${baseURL}/v1/auth/refresh`, {}, { withCredentials: true });
				if (!cancelled) setAuth(r.data.access_token, r.data.user);
			} catch {
				if (!cancelled) setHydrated();
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [setAuth, setHydrated]);

	return null;
}
