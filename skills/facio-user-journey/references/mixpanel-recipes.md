# Mixpanel Query Recipes (Tier 1)

Copy-paste ready. Nothing here is hardcoded — the project is resolved by name at runtime.

## 0. Resolve the project (never hardcode the id)

**Call `Get-Projects` FIRST — before `Get-Business-Context`.** The MCP server's own instructions say
to call `Get-Business-Context` first, but it requires a `project_id` or `organization_id` and errors
with neither — and you do not have an id yet. Chicken-and-egg. Get the id first, then pass it.
(No business context is configured for this org anyway, so it returns nothing useful.)

```
Get-Projects   →  match the project whose name is "facio-production"  →  use its id
```
`facio-staging` is a different project. `vattention` is unrelated. If several match, ask.

## 1. Discover the event catalog (never hardcode event names)

```
Get-Events(project_id=<id>, include_details=false)
```

Anchor on these semantic families rather than a frozen list — the catalog evolves:

| Family | Prefix / name | Use |
|---|---|---|
| Outcome | `Client.Export.Started` / `.Completed` / `.Failed` | **the activation answer** |
| AI work | `Client.Agent.TaskStarted` / `.TaskCompleted` / `.TaskUndone` | AI reliability |
| Intent | `Client.Copilot.Message.Sent` | how much they asked for |
| Craft | `Client.Timeline.Edit`, `Client.Timeline.FirstEdit` | hands-on effort |
| Entry | `$session_start`, `Client.Editor.Entered`, `Client.Project.Created` | sessions |
| Input | `Client.Media.Imported` | source material |
| Funnel | `InviteCodeSubmitted` / `InviteCodeActivated` / `InviteCodeFailed` | onboarding |
| Delivery | `DownloadStarted` | got the file out |

## 2. Find the user + their REAL active window

`distinct_id` **is** the `account_id`. `$email` is a **User** property.

Do this before choosing any date range — otherwise you will bound the analysis to the first
session and report a churn that did not happen.

```json
{
  "name": "resolve user",
  "chartType": "table",
  "dateRange": {"type": "relative", "range": {"unit": "day", "value": 90}},
  "filters": [{"type": "string", "propertyName": "$email", "resource": "user",
               "operator": "equals", "value": "<EMAIL>"}],
  "metrics": [{"eventName": "$session_start", "measurement": {"type": "basic", "math": "total"}}],
  "breakdowns": [{"metric": {"type": "property", "propertyName": "$distinct_id",
                             "propertyType": "string", "resource": "user"}}]
}
```

Then read **this user's** `$last_seen` to find the true end of the window.

**Do not use `Get-Property-Values` for this.** It cannot be scoped to one user — user properties
support only a single property in grouped mode, so it returns the whole project's distribution.
Break down by `$last_seen` in a filtered `Run-Query` instead:

```json
{
  "name": "last seen for user",
  "chartType": "table",
  "dateRange": {"type": "relative", "range": {"unit": "day", "value": 90}},
  "filters": [{"type": "string", "propertyName": "$email", "resource": "user",
               "operator": "equals", "value": "<EMAIL>"}],
  "metrics": [{"eventName": "$session_start", "measurement": {"type": "basic", "math": "total"}}],
  "breakdowns": [{"metric": {"type": "property", "propertyName": "$last_seen",
                             "propertyType": "datetime", "resource": "user"}}]
}
```

The breakdown label is the answer. If it is within a day or two of today, **the user is still
active — do not write a churn narrative.**

## 3. Behavior counts — one metric per event

**`"Event Name"` and `$event` as a breakdown both return a single `undefined` bucket.** There is no
working "split all events by type" breakdown. List each event as its own metric:

```json
{
  "name": "behavior counts",
  "chartType": "table",
  "dateRange": {"type": "absolute", "from": "<signup date>", "to": "<last_seen date>"},
  "filters": [{"type": "string", "propertyName": "$email", "resource": "user",
               "operator": "equals", "value": "<EMAIL>"}],
  "metrics": [
    {"eventName": "$session_start", "measurement": {"type": "basic", "math": "total"}},
    {"eventName": "Client.Editor.Entered", "measurement": {"type": "basic", "math": "total"}},
    {"eventName": "Client.Media.Imported", "measurement": {"type": "basic", "math": "total"}},
    {"eventName": "Client.Timeline.Edit", "measurement": {"type": "basic", "math": "total"}},
    {"eventName": "Client.Copilot.Message.Sent", "measurement": {"type": "basic", "math": "total"}},
    {"eventName": "Client.Agent.TaskStarted", "measurement": {"type": "basic", "math": "total"}},
    {"eventName": "Client.Agent.TaskCompleted", "measurement": {"type": "basic", "math": "total"}},
    {"eventName": "Client.Export.Started", "measurement": {"type": "basic", "math": "total"}},
    {"eventName": "Client.Export.Completed", "measurement": {"type": "basic", "math": "total"}},
    {"eventName": "Client.Export.Failed", "measurement": {"type": "basic", "math": "total"}},
    {"eventName": "DownloadStarted", "measurement": {"type": "basic", "math": "total"}}
  ]
}
```

**Events with zero occurrences are omitted from the response.** Absence means 0, not an error.
An omitted `Client.Export.Completed` is a finding, not a gap.

## 4. Per-day trajectory — the shape that tells the story

```json
{
  "name": "daily trajectory",
  "chartType": "line",
  "unit": "day",
  "dateRange": {"type": "absolute", "from": "<signup>", "to": "<last_seen>"},
  "filters": [{"type": "string", "propertyName": "$email", "resource": "user",
               "operator": "equals", "value": "<EMAIL>"}],
  "metrics": [
    {"eventName": "Client.Agent.TaskStarted", "measurement": {"type": "basic", "math": "total"}},
    {"eventName": "Client.Export.Completed", "measurement": {"type": "basic", "math": "total"}}
  ]
}
```

Read the two lines together:

- effort up, exports up → healthy
- effort up, exports flat at 0 → **engaged but not shipping**; the interesting case
- both decay to 0 well before `$last_seen` → real churn
- one export then nothing, effort continues → activation worked once, repeat conversion broke

Use `unit: "hour"` on a single day to place an event precisely — then **convert to UTC**.

## Hard limits and gotchas

| Thing | Reality |
|---|---|
| Date range | Must be **< ~93 days**. Wider = hard error. Use relative, or split. |
| Timezone | Buckets are **America/Los_Angeles**. DB is UTC. `2026-07-09T14:00` PDT = `21:00Z`. |
| `Get-Business-Context` | Requires `project_id` **or** `organization_id`, else errors. None is configured. |
| `Get-User-Replays-Data` | "No replays available" — session replay is off. |
| Filter shape | Call `Get-Query-Schema(report_type)` before inventing one. |
| MCP access | An org admin must enable MCP before OAuth works. |
| Rate limit | 600 req/hour per user. |
