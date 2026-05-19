# Decision Tree

## Intake

If the target is missing, ask for one of:

- app name
- PID
- `.app` bundle path
- remote debugging port

If the symptom is missing, infer from the user's wording:

- memory leak / memory grows / app memory -> memory
- CPU high / fan / hot / slow export -> CPU
- jank / stuck / freeze / page slow -> mixed CPU + renderer
- native addon / C++ / malloc -> native memory + native CPU

## Process First

Run discovery and baseline watch before deep captures.

Primary questions:

1. Which PID changes the most?
2. Is it main/browser, renderer, utility, GPU, or unknown helper?
3. Does the problem grow with time, with repeated operations, or immediately after one workflow?

## Memory Classification

Use deltas, not single samples.

### JS heap likely

Signals:

- V8 `usedHeapSize` grows with process private memory.
- Heap snapshots show retained objects growing after repeated operation.
- Renderer or main process growth correlates with JS-level actions.

Next probes:

- CDP `HeapProfiler.takeHeapSnapshot` before and after.
- CDP `HeapProfiler.startSampling` / `stopSampling`.
- Node inspector heap snapshot for main process if exposed.

### DOM/Blink likely

Signals:

- DOM `nodes`, `documents`, or `jsEventListeners` increase repeatedly.
- Renderer private memory grows with page interactions.
- V8 heap may also grow, but retained nodes/listeners dominate.

Next probes:

- CDP `Memory.getDOMCounters`.
- CDP `Memory.prepareForLeakDetection`, then counters again.
- Heap snapshot comparison focused on detached DOM, listeners, React roots, retained closures.

### Native malloc / addon likely

Signals:

- JS heap is flat but private memory grows.
- `vmmap` shows growing `MALLOC`, `VM_ALLOCATE`, or addon-related regions.
- Growth occurs in process loading `.node` or in utility process running native work.

Next probes:

- `vmmap --summary <pid>`
- `heap <pid>`
- `leaks -nocontext <pid>`
- Relaunch with `MallocStackLogging=1 MallocStackLoggingNoCompact=1` if allocation stacks are needed.
- `xcrun xctrace record --template "Allocations" --attach <pid>`

### GPU / video / surface likely

Signals:

- Renderer or GPU process private memory grows.
- `vmmap` shows `IOSurface`, `IOKit`, large `VM_ALLOCATE`, or mapped video buffers.
- Growth happens during preview playback, canvas drawing, WebGL, video decode, export preview, or texture lifecycle.

Next probes:

- `vmmap --summary` for renderer and GPU process.
- Capture app workflow evidence around video/canvas lifecycle.
- Inspect renderer code for unreleased video/canvas/WebGL/Metal-backed resources.

## CPU Classification

### Main/browser CPU hot

Signals:

- Main process PID has high CPU.
- App interactions freeze globally.

Next probes:

- `sample <pid> <duration>`
- Node inspector CPU profile if available.
- Look for sync IPC, sync filesystem, blocking child process, native addon call, heavy serialization.

### Renderer CPU hot

Signals:

- One renderer PID hot.
- UI janks, scrolling/preview stalls, but app shell still responds.

Next probes:

- CDP `Profiler.start` / `Profiler.stop`.
- CDP `Performance.getMetrics`.
- Look for render loops, expensive React updates, layout thrash, media frame loops.

### Native/utility CPU hot

Signals:

- Utility/helper process hot.
- `sample` stacks show native symbols, libsystem, addon, codec, MLT, FFmpeg, Metal, or worker threads.

Next probes:

- `sample <pid> <duration>`
- `spindump <pid> <duration>`
- `xcrun xctrace record --template "Time Profiler" --attach <pid>`

## Confidence

High confidence:

- One PID clearly dominates and a layer-specific metric agrees with the symptom.

Medium confidence:

- Process attribution is clear but layer-specific metric is incomplete.

Low confidence:

- Multiple PIDs move together, CDP unavailable, or only RSS evidence exists.
