#!/usr/bin/env python3
"""
Deterministic WCAG 2.1 AA Contrast Checker for Gasly Design Presets (tools/check_contrast.py)
Verifies every preset in src/design/presets/*.tokens.json across both 'light' and 'dark' modes.
Fails with exit code 1 if any required foreground/background pair falls below its minimum WCAG ratio.
"""

import json
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
PRESETS_DIR = ROOT_DIR / "src" / "design" / "presets"
SCHEMA_PATH = ROOT_DIR / "src" / "design" / "tokens.schema.json"

REQUIRED_MODE_KEYS = {
    "bgBase",
    "bgSurface",
    "bgInteractive",
    "textPrimary",
    "textSecondary",
    "textHelper",
    "textDisabled",
    "borderSubtle",
    "borderFocus",
    "accentSolid",
    "accentTextOnSolid",
    "successSolid",
    "successTextOnSolid",
    "warningSolid",
    "warningTextOnSolid",
    "dangerSolid",
    "dangerTextOnSolid",
}

MANDATORY_SURFACE_TEXT_PAIRS = [
    ("textPrimary", "bgBase", 4.5),
    ("textPrimary", "bgSurface", 4.5),
    ("textPrimary", "bgInteractive", 4.5),
    ("textSecondary", "bgBase", 4.5),
    ("textSecondary", "bgSurface", 4.5),
    ("textSecondary", "bgInteractive", 4.5),
    ("textHelper", "bgBase", 4.5),
    ("textHelper", "bgSurface", 4.5),
    ("textHelper", "bgInteractive", 4.5),
    ("accentTextOnSolid", "accentSolid", 4.5),
    ("successTextOnSolid", "successSolid", 4.5),
    ("warningTextOnSolid", "warningSolid", 4.5),
    ("dangerTextOnSolid", "dangerSolid", 4.5),
]


def hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    cleaned = hex_str.strip().lstrip("#")
    if len(cleaned) != 6:
        raise ValueError(f"Invalid 6-digit hex color: {hex_str}")
    return int(cleaned[0:2], 16), int(cleaned[2:4], 16), int(cleaned[4:6], 16)


def relative_luminance(hex_str: str) -> float:
    r, g, b = hex_to_rgb(hex_str)
    channels = []
    for val in (r, g, b):
        c = val / 255.0
        if c <= 0.04045:
            channels.append(c / 12.92)
        else:
            channels.append(((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def contrast_ratio(hex_fg: str, hex_bg: str) -> float:
    lum_fg = relative_luminance(hex_fg)
    lum_bg = relative_luminance(hex_bg)
    lighter = max(lum_fg, lum_bg)
    darker = min(lum_fg, lum_bg)
    return (lighter + 0.05) / (darker + 0.05)


def check_preset_file(filepath: Path) -> list[str]:
    errors: list[str] = []
    data = json.loads(filepath.read_text(encoding="utf-8"))
    preset_id = data.get("id", filepath.stem)

    modes = data.get("modes", {})
    for mode_name in ("light", "dark"):
        if mode_name not in modes:
            errors.append(f"[{preset_id}] Missing mode '{mode_name}'")
            continue

        palette = modes[mode_name]
        missing_keys = REQUIRED_MODE_KEYS - set(palette.keys())
        if missing_keys:
            errors.append(f"[{preset_id}:{mode_name}] Missing token keys: {sorted(missing_keys)}")
            continue

        # Combine mandatory structural pairs with any custom pairs declared in the preset JSON
        pairs_to_test: dict[tuple[str, str], float] = {}
        for fg_key, bg_key, min_r in MANDATORY_SURFACE_TEXT_PAIRS:
            pairs_to_test[(fg_key, bg_key)] = min_r

        for item in data.get("contrastPairs", []):
            fg_key = item["fg"]
            bg_key = item["bg"]
            min_r = float(item["minRatio"])
            pairs_to_test[(fg_key, bg_key)] = max(pairs_to_test.get((fg_key, bg_key), 0.0), min_r)

        for (fg_key, bg_key), min_ratio in sorted(pairs_to_test.items()):
            fg_hex = palette.get(fg_key)
            bg_hex = palette.get(bg_key)
            if not fg_hex or not bg_hex:
                errors.append(f"[{preset_id}:{mode_name}] Undefined token in pair ({fg_key}, {bg_key})")
                continue

            ratio = contrast_ratio(fg_hex, bg_hex)
            if ratio < min_ratio:
                errors.append(
                    f"[FAIL] {preset_id} ({mode_name}): {fg_key} ({fg_hex}) on {bg_key} ({bg_hex}) "
                    f"= {ratio:.2f}:1 (required >= {min_ratio:.2f}:1)"
                )
            else:
                print(
                    f"[PASS] {preset_id:16s} | {mode_name:5s} | {fg_key:18s} ({fg_hex}) on "
                    f"{bg_key:13s} ({bg_hex}) -> {ratio:5.2f}:1 (min {min_ratio:.1f}:1)"
                )

    return errors


def main() -> int:
    if not SCHEMA_PATH.exists():
        print(f"[ERROR] Token schema file not found: {SCHEMA_PATH}", file=sys.stderr)
        return 1

    preset_files = sorted(PRESETS_DIR.glob("*.tokens.json"))
    if not preset_files:
        print(f"[ERROR] No preset token files found in {PRESETS_DIR}", file=sys.stderr)
        return 1

    all_errors: list[str] = []
    for pf in preset_files:
        all_errors.extend(check_preset_file(pf))

    if all_errors:
        print("\n=== WCAG AA CONTRAST VERIFICATION FAILED ===", file=sys.stderr)
        for err in all_errors:
            print(err, file=sys.stderr)
        return 1

    print(f"\n[OK] All {len(preset_files)} presets passed WCAG AA contrast verification across light and dark modes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())