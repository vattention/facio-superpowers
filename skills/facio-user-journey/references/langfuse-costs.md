# Langfuse Cost Attribution (Tier 2)

Adds model/provider cost to the user journey report. This is a report appendix, not the activation
source of truth. If Langfuse is unavailable, keep the Mixpanel + DB report complete and set
`costs` to null.

## Projects

Pick the Langfuse project by environment:

| Environment | Langfuse project | Project ID |
|---|---|---|
| prod / production | Vattention / facio-production | `cmq7ptnou000hzh0764sabeeq` |
| staging / dev / preview | Vattention / facio | `cmn1818yk0009zd072v0l6y3n` |

Reference dashboard for the staging-style cost mouthfeel:

`https://facio-langfuse.vatten.ai/project/cmn1818yk0009zd072v0l6y3n/dashboards/cmrnms2qs0016za072nshtkqp`

## User filter

Use the Facio `account_id` resolved earlier as the Langfuse `userId` / user filter. Bound the
Langfuse time range to the same signup-to-last-seen window used by Mixpanel/DB, with a small
padding if needed because traces can finish after the client event.

## Business buckets

Group by trace name. Use these buckets:

| Bucket | trace_name values |
|---|---|
| remotion | `remotion_coordinator`, `pace_planner`, `effect_generator`, `pack_brief_planner` |
| 素材分析 | `emotion_refine`, `asset_asr`, `audio_emotion`, `asset_shot_desc`, `asset_shot_embed` |
| chat | `server_agent`, `hook_recognize`, `next_action_v3`, `ark-generation`, `title_generation`, `search` |

Unknown trace names are not errors. Keep them in `other` so the total still reconciles.

## Required output

Compute:

1. Total user cost in USD.
2. Cost share for `remotion`, `素材分析`, and `chat`.
3. Remotion-only cost share for:
   - `remotion_coordinator`
   - `pace_planner`
   - `effect_generator`
   - `pack_brief_planner`
4. Full trace-name cost distribution for every observed trace name, sorted by cost descending.
5. Trace/call count when available.
6. `GENERATION` observation count for the chat bucket and Remotion bucket. Keep these separate from
   trace count and from Mixpanel business actions.

For Remotion, also count complete workflows using `usage-statistics.md`. A coordinator-only retry
can add generation observations without adding a complete workflow.

Use Langfuse's recorded cost fields. Do not recompute model pricing unless the recorded cost is
missing and the user explicitly asks for an estimate.

## Report JSON

Add this block near the end of the rendered report:

```jsonc
"costs": {
  "summary": "$1.00 total · remotion 60% · 素材分析 25% · chat 15%",
  "note": "Langfuse facio-production · 2026-07-15..2026-07-17 UTC · userId=<account_id>",
  "categories": [
    { "name": "remotion", "cost": "$0.60", "share": "60%", "traces": 4, "value": 0.60 },
    { "name": "素材分析", "cost": "$0.25", "share": "25%", "traces": 1, "value": 0.25 },
    { "name": "chat", "cost": "$0.15", "share": "15%", "traces": 3, "value": 0.15 }
  ],
  "remotion_trace_names": [
    { "name": "effect_generator", "cost": "$0.30", "share": "50%", "traces": 2, "value": 0.30 },
    { "name": "remotion_coordinator", "cost": "$0.18", "share": "30%", "traces": 1, "value": 0.18 },
    { "name": "pace_planner", "cost": "$0.12", "share": "20%", "traces": 1, "value": 0.12 }
  ],
  "trace_names": [
    { "name": "server_agent", "cost": "$0.32", "share": "32%", "traces": 5, "value": 0.32 },
    { "name": "effect_generator", "cost": "$0.30", "share": "30%", "traces": 2, "value": 0.30 },
    { "name": "title_generation", "cost": "$0.01", "share": "1%", "traces": 1, "value": 0.01 }
  ]
}
```

`value` is numeric USD and exists only to let the renderer scale bars. The renderer calculates
`pct`; never write `pct` yourself.

When no cost data is available:

```json
"costs": {
  "summary": "未观察到 Langfuse 成本",
  "note": "Langfuse returned no traces for this user/time window.",
  "categories": [],
  "remotion_trace_names": [],
  "trace_names": []
}
```

If auth or API access fails, set `costs` to null and mention the omission in `sources.list`.
