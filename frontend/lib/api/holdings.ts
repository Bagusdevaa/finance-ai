import { api } from "@/lib/api";
import type {
	HoldingCreate,
	HoldingResponse,
	HoldingsListResponse,
	HoldingUpdate,
} from "./types";

export async function listHoldings(
	view: "aggregate" | "per_account" = "aggregate",
): Promise<HoldingsListResponse> {
	const r = await api.get<HoldingsListResponse>("/v1/holdings/", { params: { view } });
	return r.data;
}

export async function getHolding(id: string): Promise<HoldingResponse> {
	const r = await api.get<HoldingResponse>(`/v1/holdings/${id}`);
	return r.data;
}

export async function createHolding(data: HoldingCreate): Promise<HoldingResponse> {
	const r = await api.post<HoldingResponse>("/v1/holdings/", data);
	return r.data;
}

export async function updateHolding(id: string, data: HoldingUpdate): Promise<HoldingResponse> {
	const r = await api.patch<HoldingResponse>(`/v1/holdings/${id}`, data);
	return r.data;
}

export async function deleteHolding(id: string): Promise<void> {
	await api.delete(`/v1/holdings/${id}`);
}
