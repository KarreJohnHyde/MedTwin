# MedTwin Asset Inventory

This document maps all discovered `.glb`, `.blend`, ML models (`.pt`, `.pkl`), and datasets to their corresponding body systems per Phase 0 of the MedTwin Playbook.

## 1. Cardiovascular System (Heart)
- `human_heart_3d_model.glb` (30MB)
- `Heart_anotomy.glb` (26MB) / `Heart_anotomy.blend` (30MB)
- `interior_heart_-_high_detail.glb` (122MB) / `interior_heart.blend` (181MB)
- `exterior_heart_-_high_detail.glb` (145MB) / `exterior_heart.blend` (131MB)
- **ML Artifacts**: `xgb_heart_model.pkl`
- **Datasets**: `heart.csv`

## 2. Nervous System / Neuro (Brain)
- `Brain.glb` (30MB) / `Brain.blend` (32MB)
- `brain_hologram.glb` (16MB)
- **ML Artifacts**: `brain_tumor_cnn.pt`

## 3. Respiratory System (Lungs)
- `lungs_-_normal_study.glb` (25MB)
- `realistic_human_lungs.glb` (17MB)
- `lungs_inhale_front_view.glb` (3MB)
- `lungs.blend` (17MB)
- `X-ray_lungs.blend` (30MB)

## 4. Skeletal System (Bones)
- `Skeleton.glb` (2.4MB)
- `female_human_skeleton_-_zbrush_-_anatomy_study.glb` (2.4MB)
- `male_human_skeleton_-_zbrush_-_anatomy_study.glb` (2.5MB)
- `the_human_spinal_column.glb` (14.5MB)
- `human_thorax.glb` (61MB)
- `right_foot_-_ct_scan_surface_export.glb` (43MB)
- `tomographic_scan_of_left_hand_bennetts_fracture.glb` (26MB)

## 5. Urinary System (Kidneys)
- `human_kidney.glb` (6.4MB)
- `kidney.glb` (5.3MB)
- `kidney (1).glb` (53MB)
- `kidney (2).glb` (8MB)

## 6. Gastrointestinal System (Intestine)
- `small_and_large_intestine.glb` (15.6MB)

## 7. Digestive/Endocrine (Pancreas)
- `pancreas.glb` (13.4MB)
- `duodenum_pancreas_spleen.glb` (0.7MB)

## 8. Digestive/Hepatic (Liver)
- `liver.glb` (4.1MB)

## Notes
* Assets are properly mapped to their intended sub-components.
* There are multiple large, high-fidelity files for the heart (up to 145MB) and spine/thorax which should only be loaded dynamically on high-LOD settings to avoid crashing the browser.
* We have an XGBoost tabular model and a CNN PyTorch vision model. No segmentation models (U-Net) or local spatial masks exist yet.
