"""Import semua parser modules supaya @register decorator dieksekusi."""

from app.import_data.parsers import (  # noqa: F401
	csv_bibit,
	csv_ipot,
	image_vision,
	manual_csv,
	pdf_bca,
	pdf_bri,
	pdf_mandiri,
)
from app.import_data.parsers.base import (  # noqa: F401
	Parser,
	ParsedRow,
	ParserError,
	get_parser,
)
