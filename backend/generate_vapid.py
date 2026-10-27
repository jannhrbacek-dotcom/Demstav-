"""Run once on the deployment server; keep the private file outside source control."""
import argparse
import base64
import os
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization


def main():
    parser = argparse.ArgumentParser(description="Vytvoření VAPID klíčů pro DEMSTAV")
    parser.add_argument("--private-file", required=True)
    args = parser.parse_args()
    key = ec.generate_private_key(ec.SECP256R1())
    # Never overwrite an existing key: subscriptions depend on that key pair.
    fd = os.open(Path(args.private_file), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as out:
        out.write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    public = key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    print("VAPID_PUBLIC_KEY=" + base64.urlsafe_b64encode(public).decode().rstrip("="))


if __name__ == "__main__":
    main()
