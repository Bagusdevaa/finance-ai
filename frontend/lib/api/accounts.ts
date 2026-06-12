import { api } from "@/lib/api";
import type { AccountCreate, AccountResponse, AccountUpdate } from "./types";

export async function listAccounts(): Promise<AccountResponse[]> {
	const r = await api.get<AccountResponse[]>("/v1/accounts/");
	return r.data;
}

export async function getAccount(id: string): Promise<AccountResponse> {
	const r = await api.get<AccountResponse>(`/v1/accounts/${id}`);
	return r.data;
}

export async function createAccount(data: AccountCreate): Promise<AccountResponse> {
	const r = await api.post<AccountResponse>("/v1/accounts/", data);
	return r.data;
}

export async function updateAccount(id: string, data: AccountUpdate): Promise<AccountResponse> {
	const r = await api.patch<AccountResponse>(`/v1/accounts/${id}`, data);
	return r.data;
}

export async function deleteAccount(id: string): Promise<void> {
	await api.delete(`/v1/accounts/${id}`);
}
