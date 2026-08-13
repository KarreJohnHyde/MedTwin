"""Validate and stage Blender anatomy exports for the React viewer.

The pipeline never edits source assets. Valid GLB/glTF files are copied to a
content-addressed public directory, while Git LFS pointer stubs are reported as
unavailable instead of being served as broken 3D files.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
from datetime import UTC, datetime
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def inspect_asset(path: Path) -> tuple[str, str]:
    head = path.read_bytes()[:256]
    if head.startswith(b"version https://git-lfs.github.com/spec/v1"):
        return "lfs-pointer", "Fetch the Git LFS object before export"
    if path.suffix.lower() == ".glb":
        if len(head) < 12 or head[:4] != b"glTF":
            return "invalid", "GLB magic header is missing"
        version = int.from_bytes(head[4:8], "little")
        if version != 2:
            return "invalid", f"Only glTF 2.0 is supported; found version {version}"
        return "valid", "glTF 2.0 binary"
    try:
        payload = json.loads(path.read_text(encoding="utf8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return "invalid", "glTF JSON could not be parsed"
    if payload.get("asset", {}).get("version", "").split(".")[0] != "2":
        return "invalid", "Only glTF 2.0 is supported"
    return "valid", "glTF 2.0 JSON"


def optimize(source: Path, target: Path) -> tuple[bool, str]:
    executable = shutil.which("npx")
    if not executable:
        return False, "npx is unavailable; copied without optimization"
    command = [
        executable,
        "--yes",
        "@gltf-transform/cli",
        "optimize",
        str(source),
        str(target),
        "--compress",
        "draco",
        "--texture-compress",
        "webp",
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=180, check=False)
    if result.returncode != 0:
        return False, (result.stderr or result.stdout).strip()[-500:]
    return True, "Draco geometry and WebP texture optimization"


def build_manifest(
    scan_root: Path,
    public_root: Path,
    use_optimizer: bool,
    include_gltf: bool,
) -> dict[str, object]:
    public_root.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, object]] = []
    candidates = sorted(
        path for path in scan_root.rglob("*") if path.is_file() and path.suffix.lower() in {".glb", ".gltf"}
    )
    for source in candidates:
        status, detail = inspect_asset(source)
        record: dict[str, object] = {
            "source": source.as_posix(),
            "status": status,
            "detail": detail,
            "bytes": source.stat().st_size,
        }
        if status == "valid" and source.suffix.lower() == ".gltf" and not include_gltf:
            record["staged"] = False
            record["detail"] = f"{detail}; validated but not staged because a GLB package is preferred"
        elif status == "valid":
            digest = sha256(source)
            target = public_root / f"{source.stem}-{digest[:12]}{source.suffix.lower()}"
            optimized = False
            if use_optimizer:
                optimized, optimization_detail = optimize(source, target)
                record["optimization"] = optimization_detail
            if not optimized:
                shutil.copy2(source, target)
            record.update(
                {
                    "sha256": digest,
                    "optimized": optimized,
                    "public_url": f"/anatomy-optimized/{target.name}",
                    "output_bytes": target.stat().st_size,
                }
            )
        records.append(record)
    return {
        "schema": "medtwin-anatomy-assets/v1",
        "generated_at": datetime.now(UTC).isoformat(),
        "source_policy": "source-preserving-content-addressed-copy",
        "render_contract": {
            "format": "glTF 2.0",
            "recommended_meshes": "named anatomical structures with stable node IDs",
            "recommended_units": "meters with anatomical spacing metadata",
            "recommended_optimization": "Draco geometry and KTX2/WebP textures",
        },
        "assets": records,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scan-root", type=Path, default=Path("blender_anatomy"))
    parser.add_argument("--public-root", type=Path, default=Path("frontend/public/anatomy-optimized"))
    parser.add_argument("--manifest", type=Path, default=Path("frontend/public/anatomy-manifest.json"))
    parser.add_argument("--optimize", action="store_true")
    parser.add_argument("--include-gltf", action="store_true")
    args = parser.parse_args()
    manifest = build_manifest(args.scan_root, args.public_root, args.optimize, args.include_gltf)
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(manifest, indent=2), encoding="utf8")
    summary: dict[str, int] = {}
    for record in manifest["assets"]:
        summary[record["status"]] = summary.get(record["status"], 0) + 1
    print(json.dumps({"manifest": str(args.manifest), "summary": summary}, indent=2))


if __name__ == "__main__":
    main()
