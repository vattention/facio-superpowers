# Usage Statistics and Per-Project Evidence

Use this contract for every user-journey report. It separates business actions from LLM calls and
direct attribution from inference.

## Evidence levels

| Label | Meaning |
|---|---|
| `已确认` | Direct event/property or exact unique ID supports the value. |
| `可观测` | Lower bound from observed telemetry; older/offline activity may be absent. |
| `高置信推断` | No direct join key, but non-overlapping time/session evidence supports attribution. |
| `无法归属` | User total is known, but no defensible `project_id` mapping exists. |

Never turn `高置信推断` into `已确认`. Put the label in the displayed value or project evidence.

## Summary definitions

| Field | Definition |
|---|---|
| 统计跨度 | First observed relevant event to last observed relevant event. Show elapsed wall time and calendar-day count. Do not use signup-to-today. |
| 工程数 | Distinct non-empty `project_id` across project, editor, media, Copilot, agent, timeline, and export events. Label `可观测`. |
| 素材数 | Distinct `asset_id` from `AssetAnalysis.*`, grouped by project when directly attributable. `Client.Media.Imported.file_count` is a batch count and only a fallback/lower bound. |
| 素材时长 | Sum one non-null `asset_duration_ms` per unique asset. Never sum stage events. Show seconds and `HH:MM:SS.xx` or `MM:SS.xx`. |
| Chat 次数 | Business side: `Client.Copilot.Message.Sent`. Generation side: Langfuse observations whose type is `GENERATION` inside the chat trace-name bucket. |
| Remotion 次数 | Business side: complete Remotion workflows. Generation side: `GENERATION` observations inside Remotion trace names. |

For a repeated import, prefer unique `asset_id`. If only import batches exist, report for example
`4（导入批次合计，可能含重复）`, not `4（已确认）`.

## AssetAnalysis rules

Relevant fields are `asset_id`, `asset_trace_id`, `asset_size_bytes`, `asset_duration_ms`, and
`asset_type`. Relevant event families:

- `AssetAnalysis.Client.Import`
- `AssetAnalysis.Client.VideoDesc.Completed`
- `AssetAnalysis.Client.EmotionAnalysis.Completed`
- `AssetAnalysis.Asset.Completed`
- `AssetAnalysis.SDK.*`

One asset can emit many client/task/stage events. Deduplicate by `asset_id`; if it is absent, use
`asset_trace_id` and label the result `可观测`. For conflicting duration values, choose the latest
non-null value for that asset and mention the conflict instead of summing both.

`AssetAnalysis.*` currently does not guarantee `project_id`. Attribute an asset to a project only
when a direct property/link exists, or when one active project and a non-overlapping import/analysis
window makes the inference high-confidence. Otherwise keep the asset in the user total and write
`无法归属` in the project row.

## Complete Remotion workflow

Remotion trace names are:

- `remotion_coordinator`
- `pace_planner`
- `effect_generator`
- `pack_brief_planner`

Count one complete workflow per successful coordinator run/session that contains its planning and
effect-generation work. `pack_brief_planner` is optional because not every valid path emits it.
Coordinator-only retries after a complete run are attempts, not additional complete workflows.

Prefer an explicit Langfuse session/root correlation key. If traces contain no `project_id`, do not
invent one. A non-overlapping client project window may support `高置信推断`; overlapping windows
must remain `无法归属`.

Generation count means the number of Langfuse observations with `type=GENERATION`, not trace count,
message count, tool-call count, or coordinator count.

## Per-project row

Build the project list from every event carrying `project_id`, not only `Client.Project.Created`.
A reopened project is real even when no create event exists in the analysis window.

| Column | Rule |
|---|---|
| `project_id` | Exact observed ID. |
| 工程证据 | Counts of `Client.Project.Created`, `Client.Project.Reopened`, and `Client.Editor.Entered`; add attribution labels when needed. |
| 素材数量 | Unique directly attributed assets; otherwise a clearly labelled import-batch fallback or `无法归属`. |
| 素材总时长 | Deduplicated asset duration attributed to this project; never copy the user total into every row. |
| 成片时长 | `duration_sec` from the matching export event. Do not add multiple export durations together; list distinct outputs or use the latest successful export. |
| 导出结果 | Per-project counts of `Client.Export.Started`, `.Completed`, `.Failed`. Missing events mean `未观察到`, not success or failure. |

When a completed export has no duration, use the nearest matching `Export.Started` for the same
`project_id`; state that fallback in evidence. If there was no export start, render
`未观察到导出开始，无法获取`.

## Source priority

1. Mixpanel event property with direct `project_id` / `asset_id`.
2. Exact ID linkage in a Tier-2 source.
3. Non-overlapping time/session attribution, labelled `高置信推断`.
4. User-level total with project attribution left unknown.

The final `sources.list` must name Mixpanel and Langfuse when generation counts are present. If
Langfuse is unavailable, keep the business counts and render generation as `未查询（Tier 2）`.
