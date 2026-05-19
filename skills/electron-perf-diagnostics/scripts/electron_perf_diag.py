#!/usr/bin/env python3
"""macOS Electron process, memory, and CPU diagnostics helper."""

from __future__ import annotations

import argparse
import json
import os
import platform
import re
import shlex
import shutil
import subprocess
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


TOOL_NAMES = [
    "ps",
    "top",
    "vm_stat",
    "vmmap",
    "leaks",
    "heap",
    "sample",
    "spindump",
    "xcrun",
    "node",
]

INSTALL_HINTS: dict[str, dict[str, Any]] = {
    "node": {
        "purpose": "Runs CDP helpers and heap snapshot summarizers.",
        "check": "node --version",
        "install": [
            "nvm install --lts",
            "brew install node",
        ],
        "notes": "Use the project's bundled Node if available; Homebrew or nvm are both fine.",
    },
    "xcrun": {
        "purpose": "Finds and launches Apple developer tools such as xctrace.",
        "check": "xcrun --version",
        "install": [
            "xcode-select --install",
        ],
        "repair": [
            "sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer",
            "sudo xcodebuild -license accept",
        ],
        "notes": "If Command Line Tools are already installed but broken, switch to a valid Xcode developer directory.",
    },
    "xctrace": {
        "purpose": "Runs Instruments Allocations, Leaks, and Time Profiler traces from CLI.",
        "check": "xcrun --find xctrace",
        "install": [
            "Install full Xcode from the App Store or https://developer.apple.com/download/all/",
            "sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer",
            "xcrun --find xctrace",
        ],
        "notes": "Command Line Tools alone may not provide xctrace. The rest of this skill works without it.",
    },
    "spindump": {
        "purpose": "Captures heavier process/system hang and CPU stack diagnostics.",
        "check": "which spindump",
        "install": [
            "Usually built into macOS at /usr/sbin/spindump.",
        ],
        "usage": [
            "sudo spindump <pid> <seconds> -file /tmp/process.spindump.txt",
        ],
        "notes": "On many macOS versions, live-system spindump requires root. Use sample first.",
    },
    "vmmap": {
        "purpose": "Classifies per-process virtual memory regions.",
        "check": "which vmmap",
        "install": ["xcode-select --install"],
    },
    "leaks": {
        "purpose": "Detects unreachable malloc allocations.",
        "check": "which leaks",
        "install": ["xcode-select --install"],
    },
    "heap": {
        "purpose": "Summarizes malloc heap allocations in a process.",
        "check": "which heap",
        "install": ["xcode-select --install"],
    },
    "sample": {
        "purpose": "Lightweight CPU stack sampler.",
        "check": "which sample",
        "install": ["xcode-select --install"],
    },
}


@dataclass
class ProcInfo:
    pid: int
    ppid: int
    cpuPercent: float | None
    rssKb: int | None
    vszKb: int | None
    name: str
    args: str
    electronProcessType: str


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="milliseconds")


def slug(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_.-]+", "-", value).strip("-")
    return cleaned[:80] or "target"


def default_run_dir(label: str) -> Path:
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = Path.home() / ".codex" / "diagnostics" / f"{ts}-{slug(label)}"
    path.mkdir(parents=True, exist_ok=True)
    (path / "memory").mkdir(exist_ok=True)
    (path / "cpu").mkdir(exist_ok=True)
    (path / "cdp").mkdir(exist_ok=True)
    return path


def ensure_run_dir(path: str | None, label: str) -> Path:
    run_dir = Path(path).expanduser() if path else default_run_dir(label)
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "memory").mkdir(exist_ok=True)
    (run_dir / "cpu").mkdir(exist_ok=True)
    (run_dir / "cdp").mkdir(exist_ok=True)
    return run_dir


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def append_jsonl(path: Path, row: Any) -> None:
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def run_command(
    cmd: list[str],
    timeout: int = 30,
    cwd: Path | None = None,
    env: dict[str, str] | None = None,
) -> dict[str, Any]:
    started = time.time()
    result: dict[str, Any] = {
        "cmd": cmd,
        "cmdText": shlex.join(cmd),
        "startedAt": now_iso(),
        "timeoutSec": timeout,
    }
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(cwd) if cwd else None,
            env=env,
            text=True,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
        result.update({
            "ok": proc.returncode == 0,
            "returncode": proc.returncode,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
        })
    except FileNotFoundError as exc:
        result.update({"ok": False, "returncode": None, "stdout": "", "stderr": str(exc)})
    except subprocess.TimeoutExpired as exc:
        result.update({
            "ok": False,
            "returncode": None,
            "stdout": exc.stdout or "",
            "stderr": (exc.stderr or "") + f"\nTimed out after {timeout}s",
        })
    result["durationSec"] = round(time.time() - started, 3)
    return result


def classify_electron_process(proc: dict[str, Any], root_pids: set[int] | None = None) -> str:
    args = (proc.get("args") or "").lower()
    name = (proc.get("name") or "").lower()
    pid = int(proc.get("pid") or 0)

    if "--type=renderer" in args:
        return "renderer"
    if "--type=gpu-process" in args:
        return "gpu"
    if "--type=utility" in args or " utility" in args:
        return "utility"
    if "--type=crashpad" in args or "crashpad" in name or "crashpad" in args:
        return "crashpad"
    if "electron helper" in name or "electron helper" in args:
        return "helper"
    if root_pids and pid in root_pids:
        return "browser"
    return "unknown"


def parse_ps() -> list[ProcInfo]:
    cmd = ["ps", "-axo", "pid=,ppid=,pcpu=,rss=,vsz=,comm=,args="]
    result = run_command(cmd, timeout=15)
    if not result["ok"]:
        raise RuntimeError(result["stderr"] or "ps failed")

    processes: list[ProcInfo] = []
    for raw in result["stdout"].splitlines():
        line = raw.strip()
        if not line:
            continue
        parts = line.split(None, 6)
        if len(parts) < 6:
            continue
        try:
            pid = int(parts[0])
            ppid = int(parts[1])
            cpu = float(parts[2])
            rss = int(parts[3])
            vsz = int(parts[4])
        except ValueError:
            continue
        name = parts[5]
        args = parts[6] if len(parts) > 6 else name
        proc = {
            "pid": pid,
            "ppid": ppid,
            "cpuPercent": cpu,
            "rssKb": rss,
            "vszKb": vsz,
            "name": name,
            "args": args,
        }
        processes.append(ProcInfo(
            pid=pid,
            ppid=ppid,
            cpuPercent=cpu,
            rssKb=rss,
            vszKb=vsz,
            name=name,
            args=args,
            electronProcessType=classify_electron_process(proc),
        ))
    return processes


def include_descendants(processes: list[ProcInfo], roots: set[int]) -> set[int]:
    by_parent: dict[int, list[int]] = {}
    for proc in processes:
        by_parent.setdefault(proc.ppid, []).append(proc.pid)
    seen = set(roots)
    frontier = list(roots)
    while frontier:
        pid = frontier.pop()
        for child in by_parent.get(pid, []):
            if child not in seen:
                seen.add(child)
                frontier.append(child)
    return seen


def discover_processes(app: str | None, pid: int | None) -> list[ProcInfo]:
    processes = parse_ps()
    if pid is not None:
        roots = {pid}
    elif app:
        needle = app.lower()
        roots = {
            proc.pid
            for proc in processes
            if needle in proc.name.lower() or needle in proc.args.lower()
        }
    else:
        roots = {
            proc.pid
            for proc in processes
            if "electron" in proc.name.lower() or "electron" in proc.args.lower()
        }
    selected = include_descendants(processes, roots)
    root_pids = roots
    output: list[ProcInfo] = []
    for proc in processes:
        if proc.pid in selected:
            data = asdict(proc)
            data["electronProcessType"] = classify_electron_process(data, root_pids)
            output.append(ProcInfo(**data))
    return sorted(output, key=lambda p: (p.ppid, p.pid))


def proc_to_sample(proc: ProcInfo) -> dict[str, Any]:
    return {
        "ts": now_iso(),
        "pid": proc.pid,
        "ppid": proc.ppid,
        "name": proc.name,
        "electronProcessType": proc.electronProcessType,
        "rssKb": proc.rssKb,
        "vszKb": proc.vszKb,
        "cpuPercent": proc.cpuPercent,
        "threads": None,
        "privateKb": None,
        "compressedKb": None,
        "vmmapTopRegions": None,
        "v8UsedHeapKb": None,
        "blinkAllocatedKb": None,
        "domNodes": None,
        "jsEventListeners": None,
    }


def write_environment(run_dir: Path) -> None:
    env = {
        "ts": now_iso(),
        "platform": platform.platform(),
        "system": platform.system(),
        "machine": platform.machine(),
        "python": sys.version,
        "tools": {name: shutil.which(name) for name in TOOL_NAMES},
    }
    xctrace = run_command(["xcrun", "--find", "xctrace"], timeout=10) if shutil.which("xcrun") else None
    if xctrace:
        env["xctrace"] = {
            "ok": xctrace["ok"],
            "path": xctrace["stdout"].strip() if xctrace["ok"] else None,
            "stderr": xctrace["stderr"].strip(),
        }
    write_json(run_dir / "environment.json", env)


def command_doctor(_: argparse.Namespace) -> int:
    data = {
        "ts": now_iso(),
        "platform": platform.platform(),
        "isMacOS": platform.system() == "Darwin",
        "tools": {},
        "warnings": [],
    }
    for name in TOOL_NAMES:
        path = shutil.which(name)
        data["tools"][name] = {
            "available": path is not None,
            "path": path,
            "hint": INSTALL_HINTS.get(name),
        }
        if path is None:
            data["warnings"].append(f"Missing tool: {name}")
    if shutil.which("xcrun"):
        res = run_command(["xcrun", "--find", "xctrace"], timeout=10)
        data["tools"]["xctrace"] = {
            "available": res["ok"],
            "path": res["stdout"].strip() if res["ok"] else None,
            "stderr": res["stderr"].strip(),
            "hint": INSTALL_HINTS["xctrace"],
        }
        if not res["ok"]:
            data["warnings"].append("Missing tool: xctrace")
    else:
        data["tools"]["xctrace"] = {
            "available": False,
            "path": None,
            "stderr": "xcrun unavailable",
            "hint": INSTALL_HINTS["xctrace"],
        }
    print(json.dumps(data, indent=2, ensure_ascii=False))
    return 0 if data["isMacOS"] else 2


def command_install_info(args: argparse.Namespace) -> int:
    payload = {
        "ts": now_iso(),
        "commonSetup": [
            {
                "title": "Install Apple Command Line Tools",
                "commands": ["xcode-select --install"],
                "covers": ["vmmap", "leaks", "heap", "sample", "xcrun", "compiler toolchain"],
            },
            {
                "title": "Use full Xcode for Instruments CLI",
                "commands": [
                    "Install full Xcode from the App Store or https://developer.apple.com/download/all/",
                    "sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer",
                    "sudo xcodebuild -license accept",
                    "xcrun --find xctrace",
                ],
                "covers": ["xctrace", "Instruments templates"],
            },
            {
                "title": "Install Node for CDP helpers",
                "commands": ["nvm install --lts", "brew install node"],
                "covers": ["cdp_capture.mjs", "summarize_heapsnapshot.mjs"],
            },
        ],
        "tools": INSTALL_HINTS,
    }
    if args.format == "json":
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return 0

    def emit_setup_step(lines: list[str], item: str) -> None:
        if item.startswith("Install "):
            lines.append(f"- {item}")
        else:
            lines.append(f"```bash\n{item}\n```")

    lines = [
        "# Electron Performance Diagnostics Tool Setup",
        "",
        "## Common Setup",
        "",
    ]
    for item in payload["commonSetup"]:
        lines.append(f"### {item['title']}")
        lines.append("")
        lines.append("Covers: " + ", ".join(item["covers"]))
        lines.append("")
        for command in item["commands"]:
            emit_setup_step(lines, command)
        lines.append("")
    lines.append("## Per-tool Checks")
    lines.append("")
    for name, hint in INSTALL_HINTS.items():
        lines.append(f"### {name}")
        lines.append("")
        lines.append(hint["purpose"])
        lines.append("")
        lines.append(f"Check: `{hint['check']}`")
        lines.append("")
        if hint.get("install"):
            lines.append("Install/fix:")
            for command in hint["install"]:
                if command.startswith("Install "):
                    lines.append(f"- {command}")
                else:
                    lines.append(f"- `{command}`")
            lines.append("")
        if hint.get("repair"):
            lines.append("Repair:")
            for command in hint["repair"]:
                lines.append(f"- `{command}`")
            lines.append("")
        if hint.get("usage"):
            lines.append("Usage note:")
            for command in hint["usage"]:
                lines.append(f"- `{command}`")
            lines.append("")
        if hint.get("notes"):
            lines.append(f"Notes: {hint['notes']}")
            lines.append("")
    print("\n".join(lines))
    return 0


def command_discover(args: argparse.Namespace) -> int:
    label = args.app or f"pid-{args.pid}" if args.pid else "electron"
    run_dir = ensure_run_dir(args.run_dir, label)
    write_environment(run_dir)
    procs = discover_processes(args.app, args.pid)
    data = {
        "ts": now_iso(),
        "target": {"app": args.app, "pid": args.pid},
        "runDir": str(run_dir),
        "processes": [asdict(proc) for proc in procs],
    }
    write_json(run_dir / "process-tree.json", data)
    update_summary(run_dir)
    print(json.dumps({"runDir": str(run_dir), "processCount": len(procs), "processes": data["processes"]}, indent=2, ensure_ascii=False))
    return 0


def command_watch(args: argparse.Namespace) -> int:
    label = args.app or f"pid-{args.pid}" if args.pid else "electron-watch"
    run_dir = ensure_run_dir(args.run_dir, label)
    write_environment(run_dir)
    samples_path = run_dir / "samples.jsonl"
    end = time.time() + args.duration
    process_tree_written = False
    while True:
        procs = discover_processes(args.app, args.pid)
        if not process_tree_written:
            write_json(run_dir / "process-tree.json", {
                "ts": now_iso(),
                "target": {"app": args.app, "pid": args.pid},
                "runDir": str(run_dir),
                "processes": [asdict(proc) for proc in procs],
            })
            process_tree_written = True
        for proc in procs:
            append_jsonl(samples_path, proc_to_sample(proc))
        if time.time() >= end:
            break
        time.sleep(max(args.interval, 0.2))
    update_summary(run_dir)
    print(json.dumps({"runDir": str(run_dir), "samples": str(samples_path)}, indent=2, ensure_ascii=False))
    return 0


def parse_vmmap_summary(text: str) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith(("====", "REGION TYPE", "TOTAL")):
            continue
        if re.search(r"\d+[KMG]\b", stripped):
            rows.append({"raw": stripped})
    interesting = []
    for row in rows:
        raw = row["raw"]
        if any(token in raw for token in ["MALLOC", "IOSurface", "VM_ALLOCATE", "STACK", "IOKit", "mapped file", "JS"]):
            interesting.append(raw)
    return {
        "interestingRows": interesting[:30],
        "rowCount": len(rows),
    }


def command_memory(args: argparse.Namespace) -> int:
    run_dir = ensure_run_dir(args.run_dir, f"pid-{args.pid}-memory")
    write_environment(run_dir)
    out_dir = run_dir / "memory"
    records: list[dict[str, Any]] = []

    commands = [
        ("vmmap-summary", ["vmmap", "--summary", str(args.pid)], args.timeout),
    ]
    if args.kind in {"baseline", "deep"}:
        commands.append(("heap", ["heap", str(args.pid)], args.timeout))
        commands.append(("leaks", ["leaks", "--noContent", str(args.pid)], max(args.timeout, 60)))

    for name, cmd, timeout in commands:
        res = run_command(cmd, timeout=timeout)
        base = out_dir / f"{args.pid}-{name}"
        base.with_suffix(".txt").write_text(
            f"$ {res['cmdText']}\n\n# stdout\n{res['stdout']}\n\n# stderr\n{res['stderr']}\n",
            encoding="utf-8",
        )
        records.append({
            "name": name,
            "ok": res["ok"],
            "returncode": res["returncode"],
            "file": str(base.with_suffix(".txt")),
            "stderrPreview": res["stderr"][:500],
        })
        if name == "vmmap-summary":
            write_json(out_dir / f"{args.pid}-vmmap-summary.json", parse_vmmap_summary(res["stdout"]))

    if args.xctrace and args.kind == "deep":
        trace_path = out_dir / f"allocations-{args.pid}.trace"
        res = run_command([
            "xcrun", "xctrace", "record",
            "--template", "Allocations",
            "--attach", str(args.pid),
            "--time-limit", f"{args.xctrace}s",
            "--output", str(trace_path),
        ], timeout=args.xctrace + 45)
        records.append({
            "name": "xctrace-allocations",
            "ok": res["ok"],
            "returncode": res["returncode"],
            "file": str(trace_path),
            "stderrPreview": res["stderr"][:500],
        })
        (out_dir / f"allocations-{args.pid}.xctrace.log").write_text(
            f"$ {res['cmdText']}\n\n# stdout\n{res['stdout']}\n\n# stderr\n{res['stderr']}\n",
            encoding="utf-8",
        )

    write_json(out_dir / f"{args.pid}-memory-capture.json", {
        "ts": now_iso(),
        "pid": args.pid,
        "kind": args.kind,
        "records": records,
    })
    update_summary(run_dir)
    print(json.dumps({"runDir": str(run_dir), "records": records}, indent=2, ensure_ascii=False))
    return 0


def command_cpu(args: argparse.Namespace) -> int:
    run_dir = ensure_run_dir(args.run_dir, f"pid-{args.pid}-cpu")
    write_environment(run_dir)
    out_dir = run_dir / "cpu"
    records: list[dict[str, Any]] = []

    sample_file = out_dir / f"{args.pid}-sample.txt"
    sample_res = run_command(["sample", str(args.pid), str(args.duration), "-file", str(sample_file)], timeout=args.duration + 30)
    if not sample_file.exists():
        sample_file.write_text(
            f"$ {sample_res['cmdText']}\n\n# stdout\n{sample_res['stdout']}\n\n# stderr\n{sample_res['stderr']}\n",
            encoding="utf-8",
        )
    records.append({
        "name": "sample",
        "ok": sample_res["ok"],
        "returncode": sample_res["returncode"],
        "file": str(sample_file),
        "stderrPreview": sample_res["stderr"][:500],
    })

    if args.spindump:
        spin_res = run_command(["spindump", str(args.pid), str(args.duration), "-file", str(out_dir / f"{args.pid}-spindump.txt")], timeout=args.duration + 60)
        records.append({
            "name": "spindump",
            "ok": spin_res["ok"],
            "returncode": spin_res["returncode"],
            "file": str(out_dir / f"{args.pid}-spindump.txt"),
            "stderrPreview": spin_res["stderr"][:500],
        })

    if args.xctrace:
        trace_path = out_dir / f"time-profiler-{args.pid}.trace"
        trace_res = run_command([
            "xcrun", "xctrace", "record",
            "--template", "Time Profiler",
            "--attach", str(args.pid),
            "--time-limit", f"{args.xctrace}s",
            "--output", str(trace_path),
        ], timeout=args.xctrace + 45)
        (out_dir / f"time-profiler-{args.pid}.xctrace.log").write_text(
            f"$ {trace_res['cmdText']}\n\n# stdout\n{trace_res['stdout']}\n\n# stderr\n{trace_res['stderr']}\n",
            encoding="utf-8",
        )
        records.append({
            "name": "xctrace-time-profiler",
            "ok": trace_res["ok"],
            "returncode": trace_res["returncode"],
            "file": str(trace_path),
            "stderrPreview": trace_res["stderr"][:500],
        })

    write_json(out_dir / f"{args.pid}-cpu-capture.json", {
        "ts": now_iso(),
        "pid": args.pid,
        "duration": args.duration,
        "records": records,
    })
    update_summary(run_dir)
    print(json.dumps({"runDir": str(run_dir), "records": records}, indent=2, ensure_ascii=False))
    return 0


def command_launch(args: argparse.Namespace) -> int:
    app_path = Path(args.app).expanduser()
    if app_path.suffix == ".app":
        executable = app_path / "Contents" / "MacOS" / app_path.stem
    else:
        executable = app_path
    if not executable.exists():
        print(json.dumps({"ok": False, "error": f"Executable not found: {executable}"}, indent=2), file=sys.stderr)
        return 2
    env = os.environ.copy()
    if args.malloc_stack_logging:
        env["MallocStackLogging"] = "1"
        env["MallocStackLoggingNoCompact"] = "1"
    cmd = [str(executable)]
    if args.remote_debugging_port:
        cmd.append(f"--remote-debugging-port={args.remote_debugging_port}")
    proc = subprocess.Popen(
        cmd,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
        start_new_session=True,
    )
    print(json.dumps({"ok": True, "pid": proc.pid, "cmd": cmd}, indent=2))
    return 0


def load_samples(run_dir: Path) -> list[dict[str, Any]]:
    path = run_dir / "samples.jsonl"
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def summarize_samples(samples: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_pid: dict[int, list[dict[str, Any]]] = {}
    for row in samples:
        by_pid.setdefault(int(row["pid"]), []).append(row)
    summaries = []
    for pid, rows in by_pid.items():
        first = rows[0]
        last = rows[-1]
        max_cpu = max((r.get("cpuPercent") or 0 for r in rows), default=0)
        summaries.append({
            "pid": pid,
            "name": last.get("name"),
            "type": last.get("electronProcessType"),
            "samples": len(rows),
            "rssDeltaKb": (last.get("rssKb") or 0) - (first.get("rssKb") or 0),
            "vszDeltaKb": (last.get("vszKb") or 0) - (first.get("vszKb") or 0),
            "maxCpuPercent": max_cpu,
        })
    return sorted(summaries, key=lambda x: (abs(x["rssDeltaKb"]), x["maxCpuPercent"]), reverse=True)


def update_summary(run_dir: Path) -> None:
    samples = load_samples(run_dir)
    sample_summary = summarize_samples(samples)
    tree_path = run_dir / "process-tree.json"
    process_count = 0
    if tree_path.exists():
        try:
            process_count = len(json.loads(tree_path.read_text(encoding="utf-8")).get("processes", []))
        except Exception:
            process_count = 0
    lines = [
        "# Electron Performance Diagnostics Summary",
        "",
        f"- Run directory: `{run_dir}`",
        f"- Updated: {now_iso()}",
        f"- Process count: {process_count}",
        f"- Sample rows: {len(samples)}",
        "",
    ]
    if sample_summary:
        lines.extend([
            "## Process Deltas",
            "",
            "| PID | Type | Name | Samples | RSS Δ KB | VSZ Δ KB | Max CPU % |",
            "| ---: | --- | --- | ---: | ---: | ---: | ---: |",
        ])
        for item in sample_summary[:20]:
            lines.append(
                f"| {item['pid']} | {item['type']} | {item['name']} | {item['samples']} | "
                f"{item['rssDeltaKb']} | {item['vszDeltaKb']} | {item['maxCpuPercent']:.1f} |"
            )
        lines.append("")
    memory_files = sorted(str(p.relative_to(run_dir)) for p in (run_dir / "memory").glob("*") if p.is_file())
    cpu_files = sorted(str(p.relative_to(run_dir)) for p in (run_dir / "cpu").glob("*") if p.is_file())
    cdp_files = sorted(str(p.relative_to(run_dir)) for p in (run_dir / "cdp").glob("*") if p.is_file())
    if memory_files or cpu_files or cdp_files:
        lines.extend(["## Artifacts", ""])
        for path in memory_files + cpu_files + cdp_files:
            lines.append(f"- `{path}`")
        lines.append("")
    (run_dir / "summary.md").write_text("\n".join(lines), encoding="utf-8")


def command_report(args: argparse.Namespace) -> int:
    run_dir = Path(args.run_dir).expanduser()
    update_summary(run_dir)
    summary = run_dir / "summary.md"
    print(summary.read_text(encoding="utf-8"))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Electron performance diagnostics helper")
    sub = parser.add_subparsers(dest="command", required=True)

    doctor = sub.add_parser("doctor")
    doctor.set_defaults(func=command_doctor)

    install_info = sub.add_parser("install-info")
    install_info.add_argument("--format", choices=["markdown", "json"], default="markdown")
    install_info.set_defaults(func=command_install_info)

    discover = sub.add_parser("discover")
    discover.add_argument("--app")
    discover.add_argument("--pid", type=int)
    discover.add_argument("--run-dir")
    discover.set_defaults(func=command_discover)

    watch = sub.add_parser("watch")
    watch.add_argument("--app")
    watch.add_argument("--pid", type=int)
    watch.add_argument("--duration", type=int, default=120)
    watch.add_argument("--interval", type=float, default=2)
    watch.add_argument("--run-dir")
    watch.set_defaults(func=command_watch)

    memory = sub.add_parser("memory")
    memory.add_argument("--pid", type=int, required=True)
    memory.add_argument("--kind", choices=["baseline", "deep"], default="baseline")
    memory.add_argument("--xctrace", type=int, default=0, help="seconds for Allocations trace")
    memory.add_argument("--timeout", type=int, default=45)
    memory.add_argument("--run-dir")
    memory.set_defaults(func=command_memory)

    cpu = sub.add_parser("cpu")
    cpu.add_argument("--pid", type=int, required=True)
    cpu.add_argument("--duration", type=int, default=30)
    cpu.add_argument("--spindump", action="store_true")
    cpu.add_argument("--xctrace", type=int, default=0, help="seconds for Time Profiler trace")
    cpu.add_argument("--run-dir")
    cpu.set_defaults(func=command_cpu)

    launch = sub.add_parser("launch")
    launch.add_argument("--app", required=True)
    launch.add_argument("--remote-debugging-port", type=int)
    launch.add_argument("--malloc-stack-logging", action="store_true")
    launch.set_defaults(func=command_launch)

    report = sub.add_parser("report")
    report.add_argument("--run-dir", required=True)
    report.set_defaults(func=command_report)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
