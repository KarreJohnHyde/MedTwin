import os
import wfdb
import json
import urllib.request
import tarfile

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

def download_mit_bih():
    """Downloads a small subset of the MIT-BIH Arrhythmia Database for the Edge Simulator."""
    db_name = 'mitdb'
    out_dir = os.path.join(DATA_DIR, "mit_bih")
    os.makedirs(out_dir, exist_ok=True)
    
    print(f"Downloading {db_name} samples...")
    # Download 2 records for simulation (100 is normal-ish, 106 has PVCs)
    records = ['100', '106']
    
    for record in records:
        try:
            wfdb.dl_database(db_name, dl_dir=out_dir, records=[record])
            print(f"Successfully downloaded record {record}")
        except Exception as e:
            print(f"Failed to download {record}: {e}")

def create_mock_imaging_metadata():
    """
    Since MURA/RSNA require auth/DUA, we create a mock metadata file
    to simulate the presence of a fracture image for the pipeline.
    """
    img_dir = os.path.join(DATA_DIR, "imaging")
    os.makedirs(img_dir, exist_ok=True)
    
    mock_samples = [
        {"patient_id": "sample_01", "has_fracture": True, "image_path": "mock_fracture_01.png"},
        {"patient_id": "sample_02", "has_fracture": False, "image_path": "mock_normal_02.png"}
    ]
    
    with open(os.path.join(img_dir, "mock_metadata.json"), "w") as f:
        json.dump(mock_samples, f, indent=4)
    print("Created mock imaging metadata.")

if __name__ == "__main__":
    os.makedirs(DATA_DIR, exist_ok=True)
    print("Preparing Datasets for MedTwin...")
    download_mit_bih()
    create_mock_imaging_metadata()
    print("Dataset preparation complete.")
