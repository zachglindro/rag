"""
check_synthetic.py
==================
Sanity-check a synthetic XLSX dataset against the original.

Usage
-----
    python check_synthetic.py <original.xlsx> <synthetic.xlsx> [options]

Options
-------
    --orig-sheet  NAME   Sheet name in the original file (default: first sheet)
    --syn-sheet   NAME   Sheet name in the synthetic file (default: first sheet)
    --cat-thresh  INT    Max unique values for a column to be treated as
                         categorical (default: 40)
    --cat-frac    FLOAT  Max (unique / non-null) ratio for a column to be
                         treated as categorical (default: 0.10)
    --prop-tol    FLOAT  Allowed absolute difference in category proportions
                         (default: 0.10, i.e. ±10 pp)
    --stat-rtol   FLOAT  Relative tolerance for mean & IQR comparisons
                         (default: 0.20, i.e. ±20 %)
    --skew-atol   FLOAT  Absolute tolerance for skewness comparison
                         (default: 1.0)
    --kurt-atol   FLOAT  Absolute tolerance for kurtosis comparison
                         (default: 2.0)
"""

import argparse
import sys
import warnings
from textwrap import indent

import numpy as np
import pandas as pd
from scipy import stats as sp_stats

warnings.filterwarnings("ignore")

# ── ANSI colour helpers ───────────────────────────────────────────────────────
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
BOLD = "\033[1m"
RESET = "\033[0m"


def ok(msg):
    return f"{GREEN}✔  {msg}{RESET}"


def warn(msg):
    return f"{YELLOW}⚠  {msg}{RESET}"


def fail(msg):
    return f"{RED}✘  {msg}{RESET}"


def header(msg):
    return f"\n{BOLD}{msg}{RESET}"


# ── Column-type classifier ────────────────────────────────────────────────────


def classify_columns(
    df: pd.DataFrame, cat_thresh: int, cat_frac: float
) -> dict[str, str]:
    """
    Returns a dict mapping column name → 'categorical' | 'numerical' | 'freetext'.

    Rules (applied in order):
      1. Fully-null columns → 'freetext' (skip).
      2. Numeric dtype       → 'numerical'.
      3. Object/string dtype with few unique values → 'categorical'.
      4. Everything else     → 'freetext'.
    """
    types = {}
    for col in df.columns:
        series = df[col].dropna()
        if series.empty:
            types[col] = "freetext"
            continue

        # Try to coerce to numeric even if stored as object
        if pd.api.types.is_numeric_dtype(series):
            types[col] = "numerical"
        else:
            n_unique = series.nunique()
            n_non_null = len(series)
            if n_unique <= cat_thresh or (
                n_non_null > 0 and n_unique / n_non_null <= cat_frac
            ):
                types[col] = "categorical"
            else:
                types[col] = "freetext"
    return types


# ── Individual checks ─────────────────────────────────────────────────────────


def check_columns(orig: pd.DataFrame, syn: pd.DataFrame) -> bool:
    """Check 1: same column names in same order."""
    print(header("CHECK 1 — Column names"))
    passed = True

    orig_cols = list(orig.columns)
    syn_cols = list(syn.columns)

    missing_in_syn = [c for c in orig_cols if c not in syn_cols]
    extra_in_syn = [c for c in syn_cols if c not in orig_cols]

    if not missing_in_syn and not extra_in_syn and orig_cols == syn_cols:
        print(ok(f"All {len(orig_cols)} columns present and in the same order."))
    else:
        if missing_in_syn:
            print(
                fail(f"Missing in synthetic ({len(missing_in_syn)}): {missing_in_syn}")
            )
            passed = False
        if extra_in_syn:
            print(
                warn(
                    f"Extra columns in synthetic ({len(extra_in_syn)}): {extra_in_syn}"
                )
            )
            # Extra columns are a warning, not a hard failure
        if orig_cols == syn_cols and not missing_in_syn and not extra_in_syn:
            print(ok("Column order matches."))
        elif not missing_in_syn and not extra_in_syn:
            print(warn("Columns match but order differs."))

    return passed


def check_categorical(
    col: str, orig_series: pd.Series, syn_series: pd.Series, prop_tol: float
) -> tuple[bool, list[str]]:
    messages = []
    passed = True

    orig_vals = set(orig_series.dropna().unique())
    syn_vals = set(syn_series.dropna().unique())

    unseen = syn_vals - orig_vals
    if unseen:
        messages.append(fail(f"Values not in original: {sorted(unseen)[:10]}"))
        passed = False
    else:
        messages.append(ok("All values appear in the original."))

    # Proportion check
    orig_props = orig_series.value_counts(normalize=True, dropna=True)
    syn_props = syn_series.value_counts(normalize=True, dropna=True)
    all_cats = orig_props.index.union(syn_props.index)

    bad_cats = []
    for cat in all_cats:
        o = orig_props.get(cat, 0.0)
        s = syn_props.get(cat, 0.0)
        if abs(o - s) > prop_tol:
            bad_cats.append(f"'{cat}': orig={o:.1%}, syn={s:.1%}")

    if bad_cats:
        messages.append(
            warn(
                f"Proportion drift > {prop_tol:.0%} in {len(bad_cats)} categories: "
                + "; ".join(bad_cats[:5])
                + (" ..." if len(bad_cats) > 5 else "")
            )
        )
    else:
        messages.append(ok(f"Category proportions within ±{prop_tol:.0%} tolerance."))

    return passed, messages


def _to_numeric(series: pd.Series) -> pd.Series:
    """Coerce a series to numeric, dropping non-convertible values."""
    return pd.to_numeric(series, errors="coerce").dropna()


def check_numerical(
    col: str,
    orig_series: pd.Series,
    syn_series: pd.Series,
    stat_rtol: float,
    skew_atol: float,
    kurt_atol: float,
) -> tuple[bool, list[str]]:
    messages = []
    passed = True

    o = _to_numeric(orig_series)
    s = _to_numeric(syn_series)

    if s.empty:
        messages.append(warn("No numeric values in synthetic — skipping."))
        return passed, messages

    # 1. Range check (strict)
    o_min, o_max = o.min(), o.max()
    s_min, s_max = s.min(), s.max()

    if s_min < o_min or s_max > o_max:
        messages.append(
            fail(
                f"Out-of-range values. "
                f"Original [{o_min}, {o_max}] | Synthetic [{s_min}, {s_max}]"
            )
        )
        passed = False
    else:
        messages.append(ok(f"All values within original range [{o_min}, {o_max}]."))

    # 2. Mean
    o_mean, s_mean = o.mean(), s.mean()
    if o_mean != 0:
        rel_diff = abs(o_mean - s_mean) / abs(o_mean)
        if rel_diff > stat_rtol:
            messages.append(
                warn(
                    f"Mean drift: orig={o_mean:.4g}, syn={s_mean:.4g} "
                    f"(Δ={rel_diff:.1%}, tol=±{stat_rtol:.0%})"
                )
            )
        else:
            messages.append(
                ok(f"Mean OK: orig={o_mean:.4g}, syn={s_mean:.4g} (Δ={rel_diff:.1%}).")
            )
    else:
        messages.append(ok(f"Mean: orig≈0, syn={s_mean:.4g}."))

    # 3. IQR
    o_iqr = float(np.subtract(*np.percentile(o, [75, 25])))
    s_iqr = float(np.subtract(*np.percentile(s, [75, 25])))
    if o_iqr != 0:
        rel_diff = abs(o_iqr - s_iqr) / abs(o_iqr)
        if rel_diff > stat_rtol:
            messages.append(
                warn(
                    f"IQR drift: orig={o_iqr:.4g}, syn={s_iqr:.4g} "
                    f"(Δ={rel_diff:.1%}, tol=±{stat_rtol:.0%})"
                )
            )
        else:
            messages.append(
                ok(f"IQR OK: orig={o_iqr:.4g}, syn={s_iqr:.4g} (Δ={rel_diff:.1%}).")
            )
    else:
        messages.append(ok(f"IQR: orig≈0, syn={s_iqr:.4g}."))

    # 4. Skewness
    o_skew = float(sp_stats.skew(o, nan_policy="omit"))
    s_skew = float(sp_stats.skew(s, nan_policy="omit"))
    diff = abs(o_skew - s_skew)
    if diff > skew_atol:
        messages.append(
            warn(
                f"Skewness drift: orig={o_skew:.3f}, syn={s_skew:.3f} "
                f"(|Δ|={diff:.3f}, tol={skew_atol})"
            )
        )
    else:
        messages.append(
            ok(f"Skewness OK: orig={o_skew:.3f}, syn={s_skew:.3f} (|Δ|={diff:.3f}).")
        )

    # 5. Kurtosis (excess)
    o_kurt = float(sp_stats.kurtosis(o, nan_policy="omit"))
    s_kurt = float(sp_stats.kurtosis(s, nan_policy="omit"))
    diff = abs(o_kurt - s_kurt)
    if diff > kurt_atol:
        messages.append(
            warn(
                f"Kurtosis drift: orig={o_kurt:.3f}, syn={s_kurt:.3f} "
                f"(|Δ|={diff:.3f}, tol={kurt_atol})"
            )
        )
    else:
        messages.append(
            ok(f"Kurtosis OK: orig={o_kurt:.3f}, syn={s_kurt:.3f} (|Δ|={diff:.3f}).")
        )

    return passed, messages


# ── Main ──────────────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(
        description="Sanity-check a synthetic XLSX dataset against the original."
    )
    parser.add_argument("original", help="Path to the original XLSX file.")
    parser.add_argument("synthetic", help="Path to the synthetic XLSX file.")
    parser.add_argument(
        "--orig-sheet",
        default=None,
        help="Sheet name in the original (default: first sheet).",
    )
    parser.add_argument(
        "--syn-sheet",
        default=None,
        help="Sheet name in the synthetic (default: first sheet).",
    )
    parser.add_argument(
        "--cat-thresh",
        type=int,
        default=40,
        help="Max unique values for a categorical column (default: 40).",
    )
    parser.add_argument(
        "--cat-frac",
        type=float,
        default=0.10,
        help="Max unique/non-null ratio for categorical (default: 0.10).",
    )
    parser.add_argument(
        "--prop-tol",
        type=float,
        default=0.10,
        help="Allowed abs. diff in category proportions (default: 0.10).",
    )
    parser.add_argument(
        "--stat-rtol",
        type=float,
        default=0.20,
        help="Relative tolerance for mean/IQR (default: 0.20).",
    )
    parser.add_argument(
        "--skew-atol",
        type=float,
        default=1.0,
        help="Absolute tolerance for skewness (default: 1.0).",
    )
    parser.add_argument(
        "--kurt-atol",
        type=float,
        default=2.0,
        help="Absolute tolerance for kurtosis (default: 2.0).",
    )
    args = parser.parse_args()

    # ── Load data ──────────────────────────────────────────────────────────
    print(f"\nLoading original:  {args.original}")
    orig_all = pd.read_excel(args.original, sheet_name=None)
    orig_sheet = args.orig_sheet or list(orig_all.keys())[0]
    orig = orig_all[orig_sheet]
    print(f"  → Sheet '{orig_sheet}', shape {orig.shape}")

    print(f"Loading synthetic: {args.synthetic}")
    syn_all = pd.read_excel(args.synthetic, sheet_name=None)
    syn_sheet = args.syn_sheet or list(syn_all.keys())[0]
    syn = syn_all[syn_sheet]
    print(f"  → Sheet '{syn_sheet}', shape {syn.shape}")

    # ── Check 1: Columns ───────────────────────────────────────────────────
    check_columns(orig, syn)

    # Work on the intersection so per-column checks can still run
    common_cols = [c for c in orig.columns if c in syn.columns]

    # ── Classify columns (based on original) ──────────────────────────────
    col_types = classify_columns(orig[common_cols], args.cat_thresh, args.cat_frac)

    n_cat = sum(v == "categorical" for v in col_types.values())
    n_num = sum(v == "numerical" for v in col_types.values())
    n_free = sum(v == "freetext" for v in col_types.values())

    print(header("Column classification (based on original data)"))
    print(f"  Categorical : {n_cat}")
    print(f"  Numerical   : {n_num}")
    print(f"  Free-text   : {n_free} (skipped)")

    # ── Check 2: Per-column checks ─────────────────────────────────────────
    print(header("CHECK 2 — Per-column validation"))

    total_failures = 0
    total_warnings = 0

    for col, ctype in col_types.items():
        if ctype == "freetext":
            continue

        print(f"\n  [{ctype.upper()}] {col}")
        orig_s = orig[col]
        syn_s = syn[col]

        if ctype == "categorical":
            passed, msgs = check_categorical(col, orig_s, syn_s, args.prop_tol)
        else:  # numerical
            passed, msgs = check_numerical(
                col, orig_s, syn_s, args.stat_rtol, args.skew_atol, args.kurt_atol
            )

        for msg in msgs:
            print(indent(msg, "    "))

        if not passed:
            total_failures += 1
        total_warnings += sum(1 for m in msgs if m.startswith(YELLOW))

    # ── Summary ────────────────────────────────────────────────────────────
    print(header("═" * 60))
    print(header("SUMMARY"))
    print(
        f"  Columns checked   : {n_cat + n_num}  "
        f"(categorical={n_cat}, numerical={n_num}, skipped={n_free})"
    )
    print(f"  Hard failures     : {total_failures}")
    print(f"  Warnings          : {total_warnings}")
    if total_failures == 0:
        print(ok("Synthetic dataset passed all hard checks."))
    else:
        print(
            fail(
                f"Synthetic dataset has {total_failures} hard failure(s). See details above."
            )
        )

    sys.exit(0 if total_failures == 0 else 1)


if __name__ == "__main__":
    main()
