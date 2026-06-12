import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { AuthUser, TokenResponse } from "./types";

export async function login(email: string, password: string): Promise<TokenResponse> {
	const r = await api.post<TokenResponse>("/v1/auth/login", { email, password });
	useAuthStore.getState().setAuth(r.data.access_token, r.data.user);
	return r.data;
}

export interface RegisterData {
	email: string;
	password: string;
	name: string;
}

export async function register(data: RegisterData): Promise<AuthUser> {
	const r = await api.post<AuthUser>("/v1/auth/register", data);
	return r.data;
}

export async function logout(): Promise<void> {
	await api.post("/v1/auth/logout");
}

export async function me(): Promise<AuthUser> {
	const r = await api.get<AuthUser>("/v1/auth/me");
	return r.data;
}
