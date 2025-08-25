from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
import base64

# Generate EC private key
private_key = ec.generate_private_key(ec.SECP256R1())

# Export as PEM
private_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)
public_key = private_key.public_key()
public_pem = public_key.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo
)

# Base64 encode for .env
print('VAPID_PRIVATE_KEY=' + base64.b64encode(private_pem).decode())
print('VAPID_PUBLIC_KEY=' + base64.b64encode(public_pem).decode())