"""Record every data request in data/manifest.json (url, date, file, sha256)."""
import datetime as dt
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "data" / "manifest.json"


def record(url, out_path, licence="", note=""):
    data = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {"requests": []}
    out_path = Path(out_path)
    sha = hashlib.sha256(out_path.read_bytes()).hexdigest() if out_path.exists() else ""
    data["requests"].append({
        "url": url,
        "retrieved": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "file": str(out_path.relative_to(ROOT)) if out_path.is_absolute() else str(out_path),
        "sha256": sha,
        "licence": licence,
        "note": note,
    })
    MANIFEST.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
