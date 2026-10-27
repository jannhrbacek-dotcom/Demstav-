import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from push_config import configure_cloud_push

class PushConfigurationTests(unittest.TestCase):
    def test_key_survives_restart_and_is_private(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, {}, clear=True):
            path = Path(tmp) / 'vapid.pem'
            os.environ['VAPID_PRIVATE_KEY_FILE'] = str(path)
            configure_cloud_push()
            public = os.environ['VAPID_PUBLIC_KEY']
            private = path.read_bytes()
            self.assertEqual(len(public), 87)
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            configure_cloud_push()
            self.assertEqual(private, path.read_bytes())
            self.assertEqual(public, os.environ['VAPID_PUBLIC_KEY'])
            os.environ['VAPID_PUBLIC_KEY'] = 'wrong'
            with self.assertRaises(RuntimeError):
                configure_cloud_push()
            self.assertEqual(private, path.read_bytes())

    def test_external_key_is_not_replaced(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, {}, clear=True):
            path = Path(tmp) / 'external.pem'
            os.environ.update(VAPID_PUBLIC_KEY='external', VAPID_PRIVATE_KEY_FILE=str(path))
            configure_cloud_push()
            self.assertFalse(path.exists())

if __name__ == '__main__':
    unittest.main()
