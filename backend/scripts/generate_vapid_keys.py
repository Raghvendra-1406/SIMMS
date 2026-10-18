"""
Generate a VAPID key pair for Web Push (run once per deployment).

    cd backend
    python -m scripts.generate_vapid_keys

Paste the two lines into backend/.env (and the Render environment).
Keep the private key secret. Changing the keys later invalidates every
existing browser subscription: users then re-enable notifications.
"""

import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def generate():
    key = ec.generate_private_key(ec.SECP256R1())

    private = key.private_numbers().private_value.to_bytes(32, "big")

    public = key.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )

    return b64url(public), b64url(private)


if __name__ == "__main__":
    public_key, private_key = generate()

    print(f"VAPID_PUBLIC_KEY={public_key}")
    print(f"VAPID_PRIVATE_KEY={private_key}")
