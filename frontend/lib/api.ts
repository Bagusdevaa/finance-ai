import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/lib/auth-store";

const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
	baseURL,
	withCredentials: true,
});

api.interceptors.request.use((config) => {
	const token = useAuthStore.getState().accessToken;
	if (token) {
		config.headers.Authorization = `Bearer ${token}`;
	}
	return config;
});

let refreshPromise: Promise<string> | null = null;

async function performRefresh(): Promise<string> {
	const r = await axios.post(
		`${baseURL}/v1/auth/refresh`,
		{},
		{ withCredentials: true },
	);
	const { access_token, user } = r.data;
	useAuthStore.getState().setAuth(access_token, user);
	return access_token;
}

api.interceptors.response.use(
	(r) => r,
	async (error: AxiosError) => {
		const original = error.config as
			| (InternalAxiosRequestConfig & { _retry?: boolean })
			| undefined;
		if (
			error.response?.status === 401 &&
			original &&
			!original._retry &&
			!original.url?.includes("/v1/auth/refresh") &&
			!original.url?.includes("/v1/auth/login")
		) {
			original._retry = true;
			try {
				if (!refreshPromise) {
					refreshPromise = performRefresh().finally(() => {
						refreshPromise = null;
					});
				}
				const newToken = await refreshPromise;
				original.headers.Authorization = `Bearer ${newToken}`;
				return api(original);
			} catch (refreshErr) {
				useAuthStore.getState().clearAuth();
				if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
					window.location.href = "/login";
				}
				return Promise.reject(refreshErr);
			}
		}
		return Promise.reject(error);
	},
);

export interface ApiError {
	code: string;
	message: string;
	details?: Record<string, unknown>;
}

export function getApiError(error: unknown): ApiError | null {
	if (error instanceof AxiosError && error.response?.data && typeof error.response.data === "object") {
		const e = (error.response.data as { error?: ApiError }).error;
		if (e) return e;
	}
	return null;
}

export function getErrorMessage(error: unknown, fallback = "Terjadi kesalahan"): string {
	const apiErr = getApiError(error);
	if (apiErr) return apiErr.message;
	if (error instanceof Error) return error.message;
	return fallback;
}
