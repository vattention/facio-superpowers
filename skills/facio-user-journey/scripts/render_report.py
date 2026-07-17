#!/usr/bin/env python3
"""Render a user-journey JSON into the HTML report. Python stdlib only.

Template contract:
  {{dotted.key}}                                  -> HTML-escaped scalar ("—" if missing)
  <!--SECTION:key-->...<!--/SECTION:key-->        -> kept only if journey[key] is truthy
  <!--ROWS:dotted.key-->...<!--/ROWS:dotted.key--> -> repeated per list item; fields via {{row.x}}

Tier 1 journeys leave "ai" and "credits" null, so those sections strip themselves.
No second template is needed.

Usage:
  render_report.py --journey j.json --out ~/report.html
  render_report.py --journey j.json --out ~/share.html --redact
"""

from __future__ import annotations

import argparse
import copy
import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

# Mixpanel reports in PROJECT-LOCAL time; the facio DB is UTC. Mixing them
# misdates events by 7-8h and can cross a day boundary.
MIXPANEL_TZ = ZoneInfo("America/Los_Angeles")

_SECTION = re.compile(r"<!--SECTION:([\w.]+)-->(.*?)<!--/SECTION:\1-->", re.S)
_ROWS = re.compile(r"<!--ROWS:([\w.]+)-->(.*?)<!--/ROWS:\1-->", re.S)
_VAR = re.compile(r"\{\{([\w.]+)\}\}")
MISSING = "—"


def mixpanel_local_to_utc(bucket: str, tz: ZoneInfo = MIXPANEL_TZ) -> str:
    """Convert a Mixpanel bucket label ("2026-07-09T14:00" or "2026-07-09") to ISO UTC."""
    fmt = "%Y-%m-%dT%H:%M" if "T" in bucket else "%Y-%m-%d"
    local = datetime.strptime(bucket, fmt).replace(tzinfo=tz)
    return local.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")


def new_journey(tier: int, email: str, account_id: str | None = None) -> dict[str, Any]:
    """Seed the data contract. Tier 1 nulls the sections it cannot fill."""
    return {
        "meta": {"tier": tier, "generated_at": None, "redacted": False,
                 "verdict": "", "privacy_note": "", "title": "用户行为动线报告"},
        "identity": {"email": email, "account_id": account_id},
        "engagement": {},
        "timeline": [],
        "credits": {} if tier == 2 else None,
        "costs": {} if tier == 2 else None,
        "ai": {} if tier == 2 else None,
        "sources": {},
    }


def _mask_email(addr: str) -> str:
    if "@" not in addr:
        return "***"
    local, _, domain = addr.partition("@")
    return f"{local[:1]}***@{domain}"


def _mask_ip(ip: str) -> str:
    parts = ip.split(".")
    return f"{parts[0]}.{parts[1]}.x.x" if len(parts) == 4 else "x.x.x.x"


def redact(journey: dict[str, Any]) -> dict[str, Any]:
    """Return a copy safe to share. Masks direct identifiers; keeps behavioral aggregates."""
    out = copy.deepcopy(journey)
    ident = out.get("identity") or {}
    if ident.get("email"):
        ident["email"] = _mask_email(ident["email"])
    if ident.get("account_id"):
        ident["account_id"] = f"{ident['account_id'][:8]}…"
    if ident.get("ips"):
        ident["ips"] = [_mask_ip(i) for i in ident["ips"]]
    if ident.get("display_name"):
        ident["display_name"] = "***"
    # User prompts are quoted verbatim in the AI section and can identify a person.
    ai = out.get("ai")
    if isinstance(ai, dict) and ai.get("prompts"):
        ai["prompts"] = ["<redacted>" for _ in ai["prompts"]]
    out["meta"]["redacted"] = True
    return out


def _dig(data: Any, dotted: str) -> Any:
    cur = data
    for part in dotted.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return None
        cur = cur[part]
    return cur


def _fill(text: str, lookup) -> str:
    def repl(m: re.Match[str]) -> str:
        val = lookup(m.group(1))
        return MISSING if val is None else html.escape(str(val), quote=True)

    return _VAR.sub(repl, text)


_PCT_SOURCES = ("count", "tasks", "value")


def _with_pct(items: list[Any]) -> list[Any]:
    """Auto-scale bar widths so nobody has to invent a baseline.

    Analysts were picking their own denominator, which made bars look
    authoritative while being arbitrary. pct is always value/max within the
    same list. An explicit pct on the item wins.
    """
    rows = [i for i in items if isinstance(i, dict)]
    if not rows or any("pct" in r for r in rows):
        return items
    field = next(
        (f for f in _PCT_SOURCES
         if all(isinstance(r.get(f), (int, float)) for r in rows)), None
    )
    if not field:
        return items
    top = max(r[field] for r in rows) or 1
    return [{**r, "pct": round(r[field] / top * 100)} for r in rows]


def render(journey: dict[str, Any], template: str) -> str:
    """journey + template -> HTML. Absent sections strip; all values escaped."""
    out = _SECTION.sub(
        lambda m: m.group(2) if _dig(journey, m.group(1)) else "", template
    )

    def rows_repl(m: re.Match[str]) -> str:
        items = _with_pct(_dig(journey, m.group(1)) or [])
        body = m.group(2)
        return "".join(
            _fill(body, lambda k, it=item: _dig({"row": it}, k)) for item in items
        )

    out = _ROWS.sub(rows_repl, out)
    return _fill(out, lambda k: _dig(journey, k))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--journey", required=True, help="path to journey JSON")
    ap.add_argument("--out", required=True, help="output .html path (LOCAL only — never publish)")
    ap.add_argument("--redact", action="store_true", help="mask PII for sharing")
    args = ap.parse_args()

    journey = json.loads(Path(args.journey).read_text())
    if args.redact:
        journey = redact(journey)
    journey.setdefault("meta", {}).setdefault(
        "generated_at", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%MZ")
    )

    tpl = (Path(__file__).parent.parent / "assets" / "report-template.html").read_text()
    Path(args.out).write_text(render(journey, tpl))
    meta = journey["meta"]
    print(f"wrote {args.out} (tier={meta.get('tier')}, redacted={meta.get('redacted')})")
    if not meta.get("redacted"):
        print("contains PII — local only. use --redact before sharing.")


if __name__ == "__main__":
    main()
