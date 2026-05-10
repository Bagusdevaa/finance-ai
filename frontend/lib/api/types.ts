// Shared types matching backend Pydantic schemas. Money fields are strings
// (Decimal serialization). Dates are ISO strings.

// =============================================================================
// Auth
// =============================================================================

export interface AuthUser {
	id: string;
	email: string;
	name: string;
	created_at: string;
}

export interface TokenResponse {
	access_token: string;
	token_type: "bearer";
	expires_in: number;
	user: AuthUser;
}

// =============================================================================
// Accounts
// =============================================================================

export type AccountType = "bank" | "ewallet" | "broker" | "cash";

export interface AccountResponse {
	id: string;
	user_id: string;
	name: string;
	type: AccountType;
	last4: string | null;
	currency: string;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface AccountCreate {
	name: string;
	type: AccountType;
	last4?: string | null;
	currency?: string;
}

export interface AccountUpdate {
	name?: string;
	type?: AccountType;
	last4?: string | null;
	is_active?: boolean;
}

// =============================================================================
// Transactions
// =============================================================================

export type TransactionSource = "manual" | "import_pdf" | "import_csv" | "import_image";

export interface AccountSummary {
	id: string;
	name: string;
	type: AccountType;
}

export interface TransactionResponse {
	id: string;
	user_id: string;
	account_id: string | null;
	account: AccountSummary | null;
	amount: string;
	currency: string;
	merchant_name: string | null;
	description: string | null;
	category: string | null;
	transaction_date: string;
	source: TransactionSource;
	confidence_score: string | null;
	note: string | null;
	created_at: string;
	updated_at: string;
}

export interface TransactionCreate {
	account_id?: string | null;
	amount: string;
	currency?: string;
	merchant_name?: string | null;
	description?: string | null;
	category?: string | null;
	transaction_date: string;
	note?: string | null;
}

export interface TransactionUpdate {
	account_id?: string | null;
	amount?: string;
	currency?: string;
	merchant_name?: string | null;
	description?: string | null;
	category?: string | null;
	transaction_date?: string;
	note?: string | null;
}

export interface TransactionListResponse {
	items: TransactionResponse[];
	next_cursor: string | null;
	has_more: boolean;
}

// =============================================================================
// Budgets
// =============================================================================

export interface BudgetResponse {
	id: string;
	category: string;
	monthly_amount: string;
	month: string;
	icon: string | null;
	spent: string;
	remaining: string;
	percent_used: number;
}

export interface BudgetSummaryResponse {
	month: string;
	total_budget: string;
	total_spent: string;
	remaining: string;
	items: BudgetResponse[];
}

export interface BudgetCreate {
	category: string;
	monthly_amount: string;
	month: string;
	icon?: string | null;
}

export interface BudgetUpdate {
	monthly_amount?: string;
	icon?: string | null;
}

// =============================================================================
// Holdings
// =============================================================================

export interface HoldingResponse {
	id: string;
	account_id: string;
	account_name: string;
	ticker: string;
	lot: number;
	avg_price: string;
}

export interface AggregateBreakdown {
	account_id: string;
	account_name: string;
	lot: number;
	avg_price: string;
}

export interface AggregateHolding {
	ticker: string;
	total_lot: number;
	weighted_avg_price: string;
	breakdown: AggregateBreakdown[];
}

export interface HoldingsListResponse {
	items: HoldingResponse[] | AggregateHolding[];
}

export interface HoldingCreate {
	account_id: string;
	ticker: string;
	lot: number;
	avg_price: string;
}

export interface HoldingUpdate {
	lot?: number;
	avg_price?: string;
}

// =============================================================================
// Import
// =============================================================================

export type ImportSourceType =
	| "pdf_bca"
	| "pdf_mandiri"
	| "pdf_bri"
	| "pdf_bni"
	| "csv_bibit"
	| "csv_ipot"
	| "image_vision"
	| "manual_csv";

export type ImportJobStatus =
	| "pending"
	| "processing"
	| "review"
	| "confirmed"
	| "failed"
	| "cancelled";

export interface ImportJobResponse {
	id: string;
	source_type: ImportSourceType;
	status: ImportJobStatus;
	file_name: string;
	account_id: string | null;
	rows_total: number;
	rows_ok: number;
	rows_warn: number;
	rows_err: number;
	created_at: string;
	confirmed_at: string | null;
	error_message: string | null;
}

export interface ImportRowResponse {
	id: string;
	line_no: number;
	transaction_date: string;
	amount: string;
	currency: string;
	merchant_name: string | null;
	description: string | null;
	category: string | null;
	confidence_score: string;
	raw_text: string;
	is_duplicate: boolean;
	is_excluded: boolean;
}

export interface ImportJobDetailResponse extends ImportJobResponse {
	items: ImportRowResponse[];
}

export interface ImportRowUpdate {
	merchant_name?: string | null;
	description?: string | null;
	category?: string | null;
	amount?: string;
	transaction_date?: string;
	is_excluded?: boolean;
}

export interface ImportConfirmResponse {
	job_id: string;
	transactions_created: number;
	already_existed: number;
}

// =============================================================================
// Chat
// =============================================================================

export type ChatRole = "user" | "assistant" | "system";

export interface ChatSessionResponse {
	id: string;
	title: string;
	last_message_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface ChatMessageResponse {
	id: string;
	session_id: string;
	role: ChatRole;
	content: string;
	sources: string[] | null;
	created_at: string;
}

export interface ChatSessionDetailResponse {
	id: string;
	title: string;
	last_message_at: string | null;
	created_at: string;
	updated_at: string;
	messages: ChatMessageResponse[];
}
