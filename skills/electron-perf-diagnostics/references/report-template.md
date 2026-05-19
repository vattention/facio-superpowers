# Report Template

Use this shape for final diagnosis.

```markdown
**Diagnosis**
Target: `<app-or-pid>`
Run directory: `<path>`

Primary suspect: `<pid> <process-type> <name>`
Likely layer: `<JS heap | DOM/Blink | native malloc/addon | GPU/video | main CPU | renderer CPU | inconclusive>`
Confidence: `<high | medium | low>`

**Evidence**
| Signal | Before | After | Delta | Notes |
| --- | ---: | ---: | ---: | --- |
| private memory | | | | |
| RSS | | | | weak on macOS |
| CPU | | | | |
| V8 heap | | | | if available |
| DOM nodes/listeners | | | | if available |
| vmmap top regions | | | | if available |

**Artifacts**
- `<file>`
- `<file>`

**Reasoning**
Short explanation tying evidence to the suspected layer.

**Next Code Investigation**
- `<specific subsystem/file/class/function if known>`
- `<what ownership/lifecycle to inspect>`

**Missing Evidence**
- `<what would increase confidence>`
```

Keep it concise. Do not dump raw trace text unless the user asks.
