"""Pure canonical representation shared by saves and read-only diary validation."""
import hashlib
import json

CHAIN_GENESIS = 'DEMSTAV-GENESIS'


def canonical(obj) -> bytes:
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(',', ':'), default=str).encode()


def chain_hash(prev_hash: str, snapshot: dict) -> str:
    return hashlib.sha256(prev_hash.encode() + b'|' + canonical(snapshot)).hexdigest()
