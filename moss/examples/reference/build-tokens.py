#!/usr/bin/env python3
"""Generate the Moss profile token JSON/CSS from one exact-source table."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

SHARED = {
    "font": {"sans": "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", "mono": "'JetBrains Mono', 'SF Mono', Menlo, monospace"},
    "fontSize": {"meta": "12px", "tool": "13px", "body": "14px"},
    "lineHeight": {"meta": "20px", "body": "22px"},
    "fontWeight": {"regular": 400, "medium": 500, "semibold": 600},
    "space": {"1": "4px", "2": "6px", "3": "8px", "4": "10px", "5": "12px", "6": "14px", "7": "16px", "8": "20px", "9": "24px", "10": "32px"},
    "radius": {"sm": "8px", "md": "10px", "lg": "12px", "xl": "16px", "pill": "999px"},
    "motion": {"fast": "150ms", "normal": "200ms", "slow": "300ms", "traceReveal": "180ms", "messageEnter": "300ms", "runningShine": "1400ms", "spinner": "1000ms", "ease": "cubic-bezier(0.4, 0, 0.2, 1)", "easeOut": "ease-out"},
    "layout": {"sidebarExpanded": "260px", "sidebarCollapsed": "48px", "chatMinWidth": "400px", "conversationMaxWidth": "900px", "messagePaddingInline": "24px", "messagePaddingTop": "24px", "messageGap": "24px", "traceMaxHeight": "528px"},
    "component": {
        "assistantHeader": {"avatar": "24px", "gap": "8px", "marginBottom": "6px", "minHeight": "24px"},
        "assistantBody": {"padding": "16px 18px", "streamingPadding": "16px 18px 34px", "radius": "8px", "borderWidth": "1px"},
        "reasoning": {"rowMinHeight": "30px", "thinkingIconSlot": "16px", "thinkingGap": "8px", "thinkingPaddingBlock": "4px", "toolIconSlot": "14px", "toolGap": "7px", "toolIndent": "15.5px", "connectorLeft": "7.5px", "connectorWidth": "1.25px", "previewMaxCharacters": 96, "completedToggleHeight": "34px"},
        "composer": {"minHeight": "116px", "radius": "16px", "borderWidth": "0.5px", "sendButton": "34px", "sendRadius": "17px"}
    }
}

THEMES = {
    "light": {
        "color": {
            "surface": {"canvas": "#FAF9F7", "chat": "#FCFCFB", "primary": "#FAF9F7", "secondary": "#FFFFFF", "tertiary": "#F5F4F2", "elevated": "#FFFFFF"},
            "text": {"primary": "#1A1A1A", "secondary": "#3A3A3A", "tertiary": "#5A5A5A", "muted": "#7A7A7A", "placeholder": "#9A9A9A", "disabled": "#C4C4C7"},
            "border": {"subtle": "rgba(0, 0, 0, 0.06)", "muted": "rgba(0, 0, 0, 0.04)", "default": "#E4E4E7"},
            "bubble": {"user": "#F0EFED", "agent": "#FFFFFF"},
            "interaction": {"hover": "rgba(0, 0, 0, 0.04)", "active": "rgba(0, 0, 0, 0.08)", "selected": "rgba(0, 0, 0, 0.05)"},
            "accent": {"brand": "#D95E3A", "send": "#DE6A43", "link": "#2563EB", "info": "#1D4ED8"},
            "feedback": {"danger": "#DC2626", "warning": "#B45309", "success": "#059669"},
            "running": {"base": "color-mix(in srgb, #7A7A7A 68%, transparent)", "highlight": "#3A3A3A"}
        },
        "shadow": {"composer": "0 0 2px rgba(9, 30, 64, 0.02), 0 1px 4px rgba(9, 30, 64, 0.06)", "popover": "0 4px 16px rgba(9, 30, 64, 0.10), 0 12px 32px rgba(9, 30, 64, 0.06)", "send": "0 6px 14px rgba(222, 106, 67, 0.26)"}
    },
    "dark": {
        "color": {
            "surface": {"canvas": "#0A0A0F", "chat": "#0A0A0F", "primary": "#0A0A0F", "secondary": "#121218", "tertiary": "#16161C", "elevated": "#1A1A20"},
            "text": {"primary": "#FAFAFA", "secondary": "#E4E4E7", "tertiary": "#A1A1AA", "muted": "#71717A", "placeholder": "#52525B", "disabled": "#52525B"},
            "border": {"subtle": "rgba(255, 255, 255, 0.04)", "muted": "rgba(255, 255, 255, 0.03)", "default": "rgba(255, 255, 255, 0.08)"},
            "bubble": {"user": "#1A1A20", "agent": "#16161C"},
            "interaction": {"hover": "rgba(255, 255, 255, 0.05)", "active": "rgba(255, 255, 255, 0.10)", "selected": "rgba(255, 255, 255, 0.06)"},
            "accent": {"brand": "#E86A45", "send": "#DE6A43", "link": "#60A5FA", "info": "#60A5FA"},
            "feedback": {"danger": "#F87171", "warning": "#FBBF24", "success": "#34D399"},
            "running": {"base": "color-mix(in srgb, #71717A 68%, transparent)", "highlight": "#E4E4E7"}
        },
        "shadow": {"composer": "0 0 2px rgba(0, 0, 0, 0.18), 0 1px 4px rgba(0, 0, 0, 0.24)", "popover": "0 8px 24px rgba(0, 0, 0, 0.32)", "send": "0 6px 14px rgba(222, 106, 67, 0.28)"}
    }
}

META = {"profile": "moss", "sourceCommit": "195a663d2323af7c668a1db9e0a1be442a2c2b49", "evidence": ["SRC-001", "SRC-003", "SRC-004", "SRC-005"], "precision": "exact-source"}


def flatten(value, prefix=()):
    for key, child in value.items():
        path = prefix + (key,)
        if isinstance(child, dict):
            yield from flatten(child, path)
        else:
            yield path, child


def css_name(path):
    return "--moss-" + "-".join(path).replace("fontSize", "font-size").replace("lineHeight", "line-height").replace("fontWeight", "font-weight")


def css_block(selector, values):
    lines = [selector + " {"]
    for path, value in flatten(values):
        lines.append(f"  {css_name(path)}: {value};")
    lines.append("}")
    return "\n".join(lines)


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def main():
    system = ROOT / "system"
    themes = system / "themes"
    themes.mkdir(parents=True, exist_ok=True)
    write_json(system / "tokens.json", {"$metadata": META, "shared": SHARED, "themes": THEMES})
    for theme, values in THEMES.items():
        expanded = {"$metadata": {**META, "theme": theme}, **SHARED, **values}
        write_json(themes / f"{theme}.tokens.json", expanded)
        (themes / f"{theme}.css").write_text(css_block(f'[data-theme="{theme}"]', expanded | {"$metadata": {}}).replace("  --moss-$metadata", "  /* metadata") + "\n")
    shared_css = css_block(":root", SHARED)
    mode_css = "\n\n".join(css_block(f'[data-theme="{name}"]', values) for name, values in THEMES.items())
    (system / "tokens.css").write_text(shared_css + "\n\n" + mode_css + "\n")


if __name__ == "__main__":
    main()
