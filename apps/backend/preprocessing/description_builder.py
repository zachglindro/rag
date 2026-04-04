from typing import Any


EMPTY_STRINGS = {"", "na", "n/a", "null", "none", "nan"}


def _is_empty_value(value: Any) -> bool:
    if value is None:
        return True

    if isinstance(value, str):
        return value.strip().lower() in EMPTY_STRINGS

    return False


def _format_value(value: Any) -> str:
    if isinstance(value, bool):
        return "yes" if value else "no"

    if isinstance(value, int):
        return str(value)

    if isinstance(value, float):
        return f"{value:.3f}".rstrip("0").rstrip(".")

    if isinstance(value, list):
        normalized = [str(item).strip() for item in value if str(item).strip()]
        if not normalized:
            return ""
        if len(normalized) == 1:
            return normalized[0]
        return ", ".join(normalized[:-1]) + f" and {normalized[-1]}"

    if isinstance(value, dict):
        parts = []
        for k in sorted(value.keys()):
            parts.append(f"{k}: {value[k]}")
        return "; ".join(parts)

    return str(value).strip()


def _ordered_keys(
    row: dict[str, Any],
    column_order: list[str] | None = None,
) -> list[str]:
    if column_order:
        preferred = [k for k in column_order if k in row]
        remaining = sorted(k for k in row.keys() if k not in preferred)
        return preferred + remaining

    return sorted(row.keys())


def _display_name(column_name: str) -> str:
    return column_name.replace("_", " ").strip()


def build_natural_language_description(
    row: dict[str, Any],
    column_order: list[str] | None = None,
) -> str:
    usable_items: list[tuple[str, str]] = []

    for key in _ordered_keys(row, column_order=column_order):
        value = row.get(key)
        if _is_empty_value(value):
            continue

        formatted = _format_value(value)
        if not formatted:
            continue

        usable_items.append((key, formatted))

    if not usable_items:
        return "No trait information provided for this record."

    first_key, first_value = usable_items[0]
    first_label = _display_name(first_key)
    sentence_parts = [f"Record with {first_label} {first_value}"]

    for key, value in usable_items[1:]:
        label = _display_name(key)
        sentence_parts.append(f"{label} {value}")

    return "; ".join(sentence_parts) + "."
