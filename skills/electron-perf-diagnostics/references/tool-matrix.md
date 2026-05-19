# Tool Matrix

## Process and OS

| Tool | Use | Notes |
| --- | --- | --- |
| `ps` | Process tree, PID, PPID, RSS, VSZ, CPU | Good baseline, weak for macOS memory truth. |
| `top` | Live CPU and memory | Use non-interactive snapshots for scripts. |
| `vm_stat` | System memory pressure | Context only, not per-process root cause. |
| `vmmap --summary <pid>` | Per-process VM region categories | Best first native memory classifier. |
| `leaks -nocontext <pid>` | Unreachable malloc blocks | Finds true malloc leaks, not retained-but-growing caches. |
| `heap <pid>` | malloc heap snapshot | Useful native/object allocation summary. |
| `sample <pid> <seconds>` | CPU stack sampling | Fast first native/Node/main/renderer CPU probe. |
| `spindump <pid> <seconds>` | Heavier CPU/hang stack capture | Use after `sample` if needed. |
| `xcrun xctrace record` | Instruments traces from CLI | Heavy; use when baseline points to native memory/CPU. |

## Tool Setup

Run:

```bash
python3 "$SKILL_DIR/scripts/electron_perf_diag.py" doctor
python3 "$SKILL_DIR/scripts/electron_perf_diag.py" install-info
```

Common setup:

```bash
# Apple Command Line Tools; usually covers vmmap/leaks/heap/sample/xcrun.
xcode-select --install

# Full Xcode path; needed when xcrun cannot find xctrace.
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
xcrun --find xctrace

# Node for CDP helper scripts.
nvm install --lts
# or:
brew install node
```

`spindump` is usually already present at `/usr/sbin/spindump`; live system captures may require:

```bash
sudo spindump <pid> <seconds> -file /tmp/process.spindump.txt
```

Do not block the normal workflow on `xctrace` or `spindump`. They are second-layer tools after `watch`, `vmmap`, `leaks`, `heap`, `sample`, and CDP evidence.

## Chrome DevTools Protocol

| Domain | Use | Output |
| --- | --- | --- |
| `Target` | List renderer/page targets | `targets.json` |
| `Performance.getMetrics` | Runtime renderer metrics | metrics JSONL |
| `Memory.getDOMCounters` | DOM nodes/documents/listeners | DOM counters JSONL |
| `Memory.prepareForLeakDetection` | Stabilize renderer leak checks | Opt-in only; some Electron targets require GC/testing flags and may crash without them. |
| `HeapProfiler.takeHeapSnapshot` | JS heap snapshot | `.heapsnapshot` |
| `HeapProfiler.startSampling` | Allocation sampling | JSON profile |
| `Profiler.start/stop` | JS CPU profile | `.cpuprofile` |

## Electron App Hooks

Prefer zero-code probes first. If the app supports diagnostic hooks, collect:

- `app.getAppMetrics()`
- `process.getProcessMemoryInfo()`
- `process.getHeapStatistics()`
- `process.getBlinkMemoryInfo()`
- `process.getCPUUsage()`
- `app.getGPUFeatureStatus()`
- `app.getGPUInfo('basic'|'complete')`

These are optional; never fabricate them if unavailable.

## Heavy Probe Rules

- Do not run `xctrace` before baseline attribution.
- Heap snapshots can pause execution and temporarily increase memory.
- `MallocStackLogging` requires relaunch to be useful.
- `spindump` and Time Profiler are heavier than `sample`; explain why before using them.
