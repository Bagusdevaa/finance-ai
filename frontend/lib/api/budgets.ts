import { api } from "@/lib/api";
import type {
	BudgetCreate,
	BudgetResponse,
	BudgetSummaryResponse,
	BudgetUpdate,
} from "./types";

export async function listBudgets(month: string): Promise<BudgetResponse[]> {
	const r = await api.get<BudgetResponse[]>("/v1/budgets/", { params: { month } });
	return r.data;
}

export async function getBudgetSummary(month: string): Promise<BudgetSummaryResponse> {
	const r = await api.get<BudgetSummaryResponse>("/v1/budgets/summary", {
		params: { month },
	});
	return r.data;
}

export async function getBudget(id: string): Promise<BudgetResponse> {
	const r = await api.get<BudgetResponse>(`/v1/budgets/${id}`);
	return r.data;
}

export async function createBudget(data: BudgetCreate): Promise<BudgetResponse> {
	const r = await api.post<BudgetResponse>("/v1/budgets/", data);
	return r.data;
}

export async function updateBudget(id: string, data: BudgetUpdate): Promise<BudgetResponse> {
	const r = await api.patch<BudgetResponse>(`/v1/budgets/${id}`, data);
	return r.data;
}

export async function deleteBudget(id: string): Promise<void> {
	await api.delete(`/v1/budgets/${id}`);
}
