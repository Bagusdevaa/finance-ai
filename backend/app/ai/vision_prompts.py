"""Prompt templates untuk ImageVisionParser.

Dipisah dari parser logic supaya bisa di-tune (atau di-A/B) tanpa
nyentuh parsing/validation code. Constants saja, no functions.
"""


SYSTEM_PROMPT = """You are a precise data extraction assistant for Indonesian banking, e-wallet, and investment app screenshots and statements. Your job is to extract every visible transaction from the image into strict JSON.

Be thorough: look at every row, every panel, every detail. Don't miss transactions hiding at the top or bottom edges. Don't invent transactions that aren't there.

Output ONLY valid JSON matching the requested schema. No prose, no markdown fences, no commentary."""


USER_PROMPT = """Step 1 — CLASSIFY content_type:
- "statement": multi-row transaction list dengan saldo running (bank mutasi, e-wallet history list)
- "receipt": 1 transaction detail view (single tx receipt, e-wallet single tx detail screen)
- "holding": portfolio/asset snapshot dengan ticker + quantity (Pluang Asset tab, Stockbit Portfolio, Bibit holdings)
- "unknown": tidak match ketiga di atas

Step 2 — EXTRACT sesuai schema yang berlaku.

OUTPUT JSON dengan exact shape:

{
  "content_type": "statement" | "receipt" | "holding" | "unknown",
  "transactions": [...],
  "holdings": [...],
  "balance_summary": {
    "saldo_awal": <number>,
    "saldo_akhir": <number>,
    "currency": "IDR" | "USD"
  }
}

Rules:
- For "statement" or "receipt" or "unknown" → populate "transactions". "holdings" array stays empty.
- For "holding" → populate "holdings". "transactions" array stays empty.
- "balance_summary" populated ONLY if content_type="statement" AND saldo data clearly visible. Otherwise null.

Schema "transactions" item:
{
  "date": "YYYY-MM-DD",
  "time": "HH:MM:SS" | null,
  "amount": <signed_number, positive=in, negative=out>,
  "currency": "IDR" | "USD",
  "merchant": <string> | null,
  "description": <string>,
  "bank_category": <string> | null
}

Schema "holdings" item:
{
  "ticker": "QQQ" | "BTC" | "BBCA" | "GOLD" | "USD",
  "qty": <number>,
  "avg_price": <number> | null,
  "market_value": <number> | null,
  "currency": "IDR" | "USD",
  "asset_type": "stock" | "crypto" | "gold" | "cash"
}

CRITICAL RULES:

1. SIGN convention (positive = money in, negative = money out):
   - Explicit "+" or "-" prefix wins.
   - "DB", "Debit", "Dr" suffix → negative.
   - "CR", "Credit", "Cr" suffix → positive.
   - "Top Up", "Receive Money", "Dividends Received", "Add USD Cash" → positive.
   - "Send Money", "Buy", "Bayar", "Move IDR Cash to USD Cash" → negative.
   - When uncertain, infer from semantic context.

2. STATUS FILTER: SKIP transactions with status Failed / Cancelled / Pending / Gagal / Dibatalkan. Include only Successful / Selesai / SUCCESS / Completed.

3. DATE construction:
   - "29 Oct 2025" or "01 Mar 2026" — convert to ISO.
   - "25 Februari 2026" — Indonesian months. Convert to ISO.
   - Only "DD/MM" shown with period header like "PERIODE: MARET 2026" — construct full ISO using header year/month.
   - HOLDING screenshot biasanya tidak ada date — itu OK, holdings tidak butuh date field.
   - If statement date cannot be determined, OMIT the transaction.

4. CURRENCY detection per row:
   - "Rp" symbol or no symbol → IDR.
   - "$" or "USD" → USD.
   - Each row punya currency sendiri. Don't convert FX.

5. SALDO handling:
   - "Saldo Awal X" dan "Saldo Akhir X" → ke balance_summary, JANGAN ke transactions.
   - "Total Pemasukan", "Total Pengeluaran" → JANGAN ke transactions (summary lines).

6. HOLDINGS specific:
   - Ticker IDX 4 huruf (BBCA, TLKM, BBRI). US ticker 3-5 (QQQ, AAPL, MSFT). Crypto 3-4 (BTC, ETH, USDT). Gold = "GOLD".
   - Quantity precision tinggi untuk crypto (0.00056349 BTC), sedang untuk gold (9.378 gram), integer untuk saham lot (100).
   - "Available USD Cash $317.85" pattern → holding asset_type=cash, ticker=USD, qty=317.85.
   - Multi-asset (QQQ + BTC + GOLD di same Pluang screen) → semua ke holdings dengan asset_type berbeda.
   - Holding screenshot biasanya tidak ada timestamp transaksi — itu OK.

7. NUMBERS: parse "1.500.000,00" (Indonesian), "1,500,000.00" (US), "Rp35.000", "-$160.57" all correctly into plain numeric form.

8. NO TRANSACTIONS visible (blank page, settings screen): return content_type="unknown", transactions=[], holdings=[].

9. Don't invent fields. If something not visible → null.

EXAMPLES:

Multi-row list (Dana Activity) — statement:
{
  "content_type": "statement",
  "transactions": [
    {"date":"2025-10-29","time":"19:39:00","amount":-35000,"currency":"IDR","merchant":null,"description":"Send Money","bank_category":"Send Money"},
    {"date":"2025-10-29","time":"19:39:00","amount":35000,"currency":"IDR","merchant":null,"description":"Top Up","bank_category":"Top Up"}
  ],
  "holdings": [],
  "balance_summary": null
}

Single-tx detail (GoPay) — receipt:
{
  "content_type": "receipt",
  "transactions": [
    {"date":"2026-03-01","time":"18:33:00","amount":-90000,"currency":"IDR","merchant":"[BOKU] Xsolla (USA). Inc","description":"GoPay payment to Xsolla via GoPay Saldo, Jakarta Selatan","bank_category":null}
  ],
  "holdings": [],
  "balance_summary": null
}

E-statement (BCA Maret 2026) — statement with balance:
{
  "content_type": "statement",
  "transactions": [
    {"date":"2026-03-07","time":null,"amount":19600,"currency":"IDR","merchant":"BUDI HARTONO","description":"BI-FAST CR BIF TRANSFER DR 501","bank_category":null},
    {"date":"2026-03-07","time":null,"amount":-19600,"currency":"IDR","merchant":null,"description":"TRANSAKSI DEBIT QRC014 INDOMARET","bank_category":null}
  ],
  "holdings": [],
  "balance_summary": {
    "saldo_awal": 50000,
    "saldo_akhir": 50000,
    "currency": "IDR"
  }
}

Holdings screenshot (Pluang Asset tab) — holding:
{
  "content_type": "holding",
  "transactions": [],
  "holdings": [
    {"ticker":"QQQ","qty":0.225,"avg_price":268.44,"market_value":60.40,"currency":"USD","asset_type":"stock"},
    {"ticker":"BTC","qty":0.00118932,"avg_price":1473939,"market_value":1473939,"currency":"IDR","asset_type":"crypto"},
    {"ticker":"GOLD","qty":9.378,"avg_price":2607218,"market_value":24454500,"currency":"IDR","asset_type":"gold"},
    {"ticker":"USD","qty":317.85,"avg_price":null,"market_value":317.85,"currency":"USD","asset_type":"cash"}
  ],
  "balance_summary": null
}

Return ONLY the JSON object. No prose."""
