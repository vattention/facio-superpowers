---
name: electron-perf-diagnostics
description: Use when investigating macOS Electron performance problems: memory leaks, memory growth, high CPU, slow or stuck UI, renderer jank, freezes, hangs, GPU/video memory growth, main-process blocking, utility-process issues, or C++/Node native addon leaks.
---

# Electron Performance Diagnostics

## Overview

Use this skill to investigate Electron memory or CPU problems on macOS. Your job is to gather evidence yourself, identify the suspicious process/layer, and give the user an actionable diagnosis.

Default to the bundled scripts. Do not ask the user to open Instruments, Chrome DevTools, or heap snapshots as the primary workflow.

## Quick Start

Skill directory:

```bash
SKILL_DIR="/Users/boye/.facio-superpowers/skills/electron-perf-diagnostics"
```

Run checks first:

```bash
python3 "$SKILL_DIR/scripts/electron_perf_diag.py" doctor
```

Show setup and install instructions:

```bash
python3 "$SKILL_DIR/scripts/electron_perf_diag.py" install-info
python3 "$SKILL_DIR/scripts/electron_perf_diag.py" install-info --format json
```

`doctor` includes per-tool hints for missing tools. Typical setup:

```bash
# Apple Command Line Tools: vmmap, leaks, heap, sample, xcrun, compiler tools
xcode-select --install

# Full Xcode / Instruments CLI for xctrace when deeper native traces are needed
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
xcrun --find xctrace

# Node for CDP helpers, if not already available
nvm install --lts
```

`spindump` is usually built into macOS; live-system capture may require `sudo`. Use `sample` first.

If the target app is known:

```bash
python3 "$SKILL_DIR/scripts/electron_perf_diag.py" discover --app "Facio"
python3 "$SKILL_DIR/scripts/electron_perf_diag.py" watch --app "Facio" --duration 120 --interval 2
python3 "$SKILL_DIR/scripts/electron_perf_diag.py" report --run-dir <run-dir>
```

If the target PID is known:

```bash
python3 "$SKILL_DIR/scripts/electron_perf_diag.py" watch --pid <pid> --duration 120 --interval 2
```

If Electron remote debugging is available:

```bash
node "$SKILL_DIR/scripts/cdp_capture.mjs" list-targets --port 9222
node "$SKILL_DIR/scripts/cdp_capture.mjs" renderer-memory --port 9222 --target <target-id> --duration 60
node "$SKILL_DIR/scripts/cdp_capture.mjs" renderer-cpu --port 9222 --target <target-id> --duration 30
```

## Required Workflow

1. **Identify target**: app name, PID, app bundle path, or remote debugging port.
2. **Run `doctor`**: record missing tools and degrade gracefully.
3. **Discover process topology**: main/browser, renderer, utility, GPU, helper processes.
4. **Watch before deep probes**: sample process CPU and memory over time.
5. **Classify the layer** using `references/decision-tree.md`.
6. **Run the least invasive confirming probe**:
   - JS heap: CDP heap snapshots or Node inspector.
   - DOM/Blink: CDP Memory counters and heap snapshots. Use `--prepare-leak-detection` only when the target is launched with the required GC/testing support; otherwise it can destabilize some Electron renderers.
   - Native malloc/addon: `vmmap`, `heap`, `leaks`, optional `xctrace Allocations`.
   - JS CPU: CDP/Node `.cpuprofile`.
   - Native CPU: `sample`, `spindump`, optional `xctrace Time Profiler`.
   - GPU/video: process deltas plus `vmmap` IOSurface/VM region evidence.
7. **Report evidence**: suspect PID, deltas, likely layer, confidence, artifacts, and next code investigation points.

Ask the user for reproduction only when automation cannot drive the scenario. Keep questions to one at a time.

## Interpretation Rules

- Process attribution comes first. Never jump directly into heap snapshots.
- Treat RSS alone as weak evidence on macOS; prefer private memory, `vmmap`, Electron process metrics, and trend deltas.
- JS heap growth plus process-private growth points to V8 retention.
- Flat JS heap plus growing private/MALLOC points to native malloc, Buffer backing store, or addon/native resources.
- DOM node or listener growth across repeated operations points to renderer/DOM lifecycle leaks.
- `IOSurface` or GPU-related VM growth points to video/canvas/WebGL/Metal surface retention.
- Main-process CPU means event-loop blocking, sync IPC, sync filesystem, or native work in main are primary suspects.
- Renderer CPU should be profiled through CDP before native tools unless OS sampling already shows native stacks.
- Utility-process CPU or memory growth often means isolated addon/service work; inspect that PID directly.

## References

- `references/decision-tree.md`: layer classification and next probes.
- `references/tool-matrix.md`: CLI/CDP tool capabilities and caveats.
- `references/report-template.md`: final answer shape.

## Output Discipline

Read compact artifacts first:

- `summary.md`
- `process-tree.json`
- `samples.jsonl`
- `memory/*summary*.json`
- `cdp/*summary*.json`

Avoid loading large raw `.trace`, `.heapsnapshot`, `.cpuprofile`, or long text logs unless needed to answer a precise question.
