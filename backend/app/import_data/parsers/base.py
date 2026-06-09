"""Parser protocol + registry.

Setiap parser di-register dengan @register(<source_type>); registry diisi
saat module parsers/__init__.py mengimpor semua parser implementations.
Service layer tinggal panggil get_parser(source_type).parse(bytes).
"""

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Literal, Protocol


@dataclass
class ParsedRow:
	line_no: int
	transaction_date: date
	amount: Decimal  # signed: positif = income, negatif = expense
	currency: str = "IDR"
	merchant_name: str | None = None
	description: str | None = None
	category: str | None = None
	confidence_score: Decimal = field(default_factory=lambda: Decimal("1.00"))
	raw_text: str = ""


@dataclass
class ParsedHolding:
	line_no: int
	ticker: str
	qty: Decimal
	avg_price: Decimal | None = None
	market_value: Decimal | None = None
	currency: str = "IDR"
	asset_type: Literal["stock", "crypto", "gold", "cash", "unknown"] = "unknown"
	confidence_score: Decimal = field(default_factory=lambda: Decimal("1.00"))
	raw_text: str = ""


@dataclass
class BalanceCheck:
	saldo_awal: Decimal
	saldo_akhir: Decimal
	sum_transactions: Decimal
	expected_delta: Decimal
	actual_delta: Decimal
	matches: bool
	diff_pct: Decimal


@dataclass
class ParseResult:
	rows: list[ParsedRow] = field(default_factory=list)
	holdings: list[ParsedHolding] = field(default_factory=list)
	content_type: Literal["statement", "receipt", "holding", "unknown"] = "unknown"
	balance_check: BalanceCheck | None = None


class ParserError(Exception):
	pass


class Parser(Protocol):
	def parse(self, file_bytes: bytes) -> "ParseResult": ...


# Registry diisi via @register decorator di tiap parser module.
_REGISTRY: dict[str, type[Parser]] = {}


def register(source_type: str):
	def deco(cls):
		_REGISTRY[source_type] = cls
		return cls

	return deco


def get_parser(source_type: str) -> Parser:
	if source_type not in _REGISTRY:
		raise ParserError(f"No parser registered for {source_type}")
	return _REGISTRY[source_type]()
