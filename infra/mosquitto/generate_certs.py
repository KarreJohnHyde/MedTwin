from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
import datetime
import os

def generate_cert(is_ca=False, ca_key=None, ca_cert=None, common_name="localhost"):
    key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )

    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"MedTwin"),
        x509.NameAttribute(NameOID.COMMON_NAME, common_name),
    ])

    if not is_ca:
        issuer = ca_cert.subject

    cert_builder = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.datetime.utcnow()
    ).not_valid_after(
        datetime.datetime.utcnow() + datetime.timedelta(days=365)
    )

    if is_ca:
        cert_builder = cert_builder.add_extension(
            x509.BasicConstraints(ca=True, path_length=None), critical=True,
        )
    else:
        cert_builder = cert_builder.add_extension(
            x509.SubjectAlternativeName([x509.DNSName(common_name)]), critical=False,
        )

    signer_key = ca_key if ca_key else key
    cert = cert_builder.sign(signer_key, hashes.SHA256())

    return key, cert

def save_key_and_cert(key, cert, key_path, cert_path):
    with open(key_path, "wb") as f:
        f.write(key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ))
    
    with open(cert_path, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))

if __name__ == "__main__":
    certs_dir = os.path.join(os.path.dirname(__file__), "certs")
    os.makedirs(certs_dir, exist_ok=True)

    # 1. Generate CA
    print("Generating CA certificate...")
    ca_key, ca_cert = generate_cert(is_ca=True, common_name="MedTwin CA")
    save_key_and_cert(ca_key, ca_cert, os.path.join(certs_dir, "ca.key"), os.path.join(certs_dir, "ca.crt"))

    # 2. Generate Server Cert
    print("Generating Server certificate...")
    server_key, server_cert = generate_cert(is_ca=False, ca_key=ca_key, ca_cert=ca_cert, common_name="localhost")
    save_key_and_cert(server_key, server_cert, os.path.join(certs_dir, "server.key"), os.path.join(certs_dir, "server.crt"))
    
    print(f"Certificates generated successfully in {certs_dir}")
