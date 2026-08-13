# MedTwin Atlas production readiness

MedTwin Atlas is an anonymous research simulation workspace. It is not a
medical device, does not diagnose disease, and must not be used for patient
care without a separate regulated validation and quality program.

## Implemented foundation

- React workspace with lazy-loaded Three.js anatomy and Recharts validation modules.
- Local-memory NIfTI-1 and uncompressed little-endian DICOM loading. Raw voxels and filenames do not leave the browser.
- Thresholded 3D voxel overlay, axial slice inspection, ROI anchors, and uncertainty forecasts.
- Node BFF with strict anonymous schemas, origin allowlist, optional bearer authentication, roles, rate limiting, request IDs, and security headers.
- Persistent FastAPI inference service with bounded concurrency and versioned model interface contracts.
- HMAC hash-chained append-only audit events. Set `MEDTWIN_AUDIT_SECRET` to a managed production secret.
- Synthetic calibration, PR, ROC, decision-curve, subgroup, drift, OOD, and model approval views.

## Evidence still required

- Curated, licensed, representative datasets with documented train/validation/test separation.
- Ground-truth labeling protocol, independent external validation, calibration, subgroup analysis, and prospective monitoring.
- Real model artifacts with reproducible training manifests and signed checksums. Registry entries currently say `simulation-contract`.
- Valid Blender exports. Run `python scripts/anatomy_asset_pipeline.py`; any `lfs-pointer` result means the binary must be fetched first.
- Clinical safety case, human factors evaluation, cybersecurity review, privacy impact assessment, and applicable regulatory clearance.
- Production TLS, managed identity provider, encrypted object storage, managed secrets, log retention policy, backups, and disaster recovery.

## Production environment

Set `MEDTWIN_API_KEY`, `MEDTWIN_AUDIT_SECRET`, `MEDTWIN_ALLOWED_ORIGINS`,
`MEDTWIN_INFERENCE_URL`, and an absolute `MEDTWIN_AUDIT_PATH`. Terminate TLS at
the deployment edge and keep the Python service on a private network.
