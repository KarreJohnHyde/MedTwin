import hashlib
import random

class BMDPredictor:
    def __init__(self):
        # Reference young adult mean (g/cm²) for normalization
        self.young_adult_mean = 1.050
        self.sd = 0.110

    def predict(self, patient_id: str, image_base64: str = "") -> dict:
        """
        Simulates the 4-step AI pipeline for BMD:
        1. Segmentation
        2. Feature Extraction
        3. Regression
        4. T-Score Derivation
        """
        
        # Stable per synthetic patient so repeated calls do not contradict each other.
        seed = int(hashlib.sha256(patient_id.encode("utf-8")).hexdigest()[:16], 16)
        rng = random.Random(seed)

        # Step 1 & 2: Simulate feature extraction
        cortical_thickness = rng.uniform(1.5, 4.0) # mm
        trabecular_density = rng.uniform(0.1, 0.4) # arbitrary units
        
        # Step 3: Regression for Absolute BMD
        # Base it loosely on the simulated features
        absolute_bmd = (cortical_thickness * 0.15) + (trabecular_density * 1.5) + rng.uniform(-0.1, 0.1)
        absolute_bmd = round(absolute_bmd, 3)

        # Step 4: T-Score Derivation
        t_score = (absolute_bmd - self.young_adult_mean) / self.sd
        t_score = round(t_score, 1)

        # Classification
        if t_score >= -1.0:
            classification = "Normal"
        elif -2.5 < t_score < -1.0:
            classification = "Osteopenia"
        else:
            classification = "Osteoporosis"

        return {
            "status": "success",
            "absolute_bmd": absolute_bmd,
            "t_score": t_score,
            "classification": classification,
            "features": {
                "cortical_thickness": round(cortical_thickness, 2),
                "trabecular_density": round(trabecular_density, 3)
            },
            "synthetic": True
        }

def get_bmd_model():
    return BMDPredictor()
