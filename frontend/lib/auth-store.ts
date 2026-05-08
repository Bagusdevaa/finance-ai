import { create } from "zustand";

export interface AuthUser {
	id: string;
	email: string;
	name: string;
	created_at: string;
}

interface AuthState {
	accessToken: string | null;
	user: AuthUser | null;
	hydrated: boolean;
	setAuth: (token: string, user: AuthUser) => void;
	clearAuth: () => void;
	setHydrated: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
	accessToken: null,
	user: null,
	hydrated: false,
	setAuth: (token, user) => set({ accessToken: token, user, hydrated: true }),
	clearAuth: () => set({ accessToken: null, user: null, hydrated: true }),
	setHydrated: () => set({ hydrated: true }),
}));
