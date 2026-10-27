import os
import logging
import requests
import hashlib
import json
import tempfile
from pathlib import Path

logger = logging.getLogger("demstav.storage")
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_PREFIX = os.environ.get("APP_STORAGE_PREFIX", "demstav-operations")
_storage_key = None


def _local_root():
    root = Path(os.environ.get("STORAGE_LOCAL_ROOT", "/var/data/objects"))
    root.mkdir(parents=True, exist_ok=True)
    return root


def _local_file(path):
    # Object keys never become filesystem paths supplied by a client.
    return _local_root() / hashlib.sha256(path.encode("utf-8")).hexdigest()


def _atomic_write(destination, data):
    fd, temporary = tempfile.mkstemp(dir=destination.parent)
    try:
        with os.fdopen(fd, "wb") as out:
            out.write(data)
            out.flush()
            os.fsync(out.fileno())
        os.replace(temporary, destination)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _is_local():
    backend = os.environ.get("STORAGE_BACKEND", "emergent")
    if backend not in ("local", "emergent"):
        raise RuntimeError("Neznámý STORAGE_BACKEND")
    return backend == "local"


def init_storage(force: bool = False):
    if _is_local():
        _local_root()
        return "local"
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": os.environ.get("EMERGENT_LLM_KEY")}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    if _is_local():
        target = _local_file(path)
        # One atomic object includes metadata and payload, avoiding mismatched writes.
        header = json.dumps({"type": content_type}).encode("utf-8") + b"\n"
        _atomic_write(target, header + data)
        return {"path": path, "size": len(data)}
    for attempt in range(2):
        key = init_storage(force=attempt == 1)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type},
                            data=data, timeout=120)
        if resp.status_code == 404 and attempt == 0:
            continue
        resp.raise_for_status()
        return resp.json()


def get_object(path: str):
    if _is_local():
        with _local_file(path).open("rb") as source:
            metadata = json.loads(source.readline())
            return source.read(), metadata["type"]
    for attempt in range(2):
        key = init_storage(force=attempt == 1)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
        if resp.status_code == 404 and attempt == 0:
            continue
        resp.raise_for_status()
        return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


def delete_object(path: str) -> bool:
    """Smaže objekt v úložišti. Vrátí True při úspěchu nebo pokud objekt už neexistuje."""
    if _is_local():
        _local_file(path).unlink(missing_ok=True)
        return True
    for attempt in range(2):
        key = init_storage(force=attempt == 1)
        resp = requests.delete(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=30)
        if resp.status_code == 404:
            return True
        if resp.status_code == 404 and attempt == 0:
            continue
        if resp.ok:
            return True
    return False

