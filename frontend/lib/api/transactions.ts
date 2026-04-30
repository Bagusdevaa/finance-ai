import { api } from "@/lib/api";
import type {
	TransactionCreate,
	TransactionListResponse,
	TransactionResponse,
	TransactionUpdate,
} from "./types";

export interface ListTransactionsParams {
	cursor?: string;
	limit?: number;
	account_id?: string;
	category?: string;
	type?: "in" | "out" | "all";
	date_from?: string;
	date_to?: string;
	search?: string;
}

export async function listTransactions(
	params: ListTransactionsParams = {},
): Promise<TransactionListResponse> {
	const r = await api.get<TransactionListResponse>("/v1/transactions/", { params });
	return r.data;
}

export async function getTransaction(id: string): Promise<TransactionResponse> {
	const r = await api.get<TransactionResponse>(`/v1/transactions/${id}`);
	return r.data;
}

export async function createTransaction(data: TransactionCreate): Promise<TransactionResponse> {
	const r = await api.post<TransactionResponse>("/v1/transactions/", data);
	return r.data;
}

export async function updateTransaction(
	id: string,
	data: TransactionUpdate,
): Promise<TransactionResponse> {
	const r = await api.patch<TransactionResponse>(`/v1/transactions/${id}`, data);
	return r.data;
}

export async function deleteTransaction(id: string): Promise<void> {
	await api.delete(`/v1/transactions/${id}`);
}
