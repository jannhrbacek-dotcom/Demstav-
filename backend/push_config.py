"""Keep the VAPID identity on the persistent disk across cloud deployments."""
import base64
import os
from pathlib import Path
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def configure_cloud_push():
    target = Path(os.environ.get('VAPID_PRIVATE_KEY_FILE', '/var/data/vapid_private.pem'))
    if os.environ.get('VAPID_PUBLIC_KEY') and not target.exists():
        # Explicit external configuration must never be silently replaced.
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        pass
    else:
        key = ec.generate_private_key(ec.SECP256R1())
        with os.fdopen(fd, 'wb') as stream:
            stream.write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
            stream.flush()
            os.fsync(stream.fileno())
    key = serialization.load_pem_private_key(target.read_bytes(), password=None)
    if not isinstance(key, ec.EllipticCurvePrivateKey) or not isinstance(key.curve, ec.SECP256R1):
        raise RuntimeError('VAPID key must use P-256')
    public = key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    encoded = base64.urlsafe_b64encode(public).decode().rstrip('=')
    if os.environ.get('VAPID_PUBLIC_KEY') not in (None, '', encoded):
        raise RuntimeError('VAPID public and private keys do not match')
    os.environ['VAPID_PRIVATE_KEY_FILE'] = str(target)
    os.environ['VAPID_PUBLIC_KEY'] = encoded
