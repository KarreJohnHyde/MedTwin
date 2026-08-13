import os
import re
import warnings

# Suppress some verbose warnings from huggingface/transformers
warnings.filterwarnings("ignore")

try:
    from bert_score import score
except ImportError:
    print("bert_score is not installed. Please run: pip install bert-score torch transformers")
    exit(1)

def evaluate_risk_confidentiality(text):
    """
    Checks for potential risk of confidentiality breaches (e.g. unredacted PHI/PII).
    This is a basic regex-based check for demonstration purposes.
    """
    findings = []
    
    # 1. Look for phone numbers (basic pattern)
    phone_pattern = r'\+?\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}'
    phones = re.findall(phone_pattern, text)
    if phones:
        # Filter out obvious false positives if needed
        valid_phones = [p for p in phones if len(re.sub(r'\D', '', p)) >= 7]
        if valid_phones:
            findings.append(f"Potential Phone Numbers found: {len(valid_phones)}")

    # 2. Look for MR No (Medical Record Number)
    if re.search(r'MR No:\s*\d+', text, re.IGNORECASE):
        findings.append("Medical Record Number (MR No) exposed in text.")
        
    return findings

def calculate_exact_match_metrics(ground_truth, prediction):
    """
    Calculates basic unigram overlap (bag of words) Precision, Recall, and F1.
    """
    gt_tokens = set(ground_truth.lower().split())
    pred_tokens = set(prediction.lower().split())
    
    intersection = gt_tokens.intersection(pred_tokens)
    
    if len(pred_tokens) == 0:
        precision = 0.0
    else:
        precision = len(intersection) / len(pred_tokens)
        
    if len(gt_tokens) == 0:
        recall = 0.0
    else:
        recall = len(intersection) / len(gt_tokens)
        
    if precision + recall == 0:
        f1 = 0.0
    else:
        f1 = 2 * (precision * recall) / (precision + recall)
        
    return precision, recall, f1

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    gt_path = os.path.join(base_dir, 'ground_truth_report.txt')
    live_path = os.path.join(base_dir, 'live_results.txt')

    if not os.path.exists(gt_path):
        print(f"Ground truth file not found: {gt_path}")
        return
    if not os.path.exists(live_path):
        print(f"Live results file not found: {live_path}")
        return

    with open(gt_path, 'r', encoding='utf-8') as f:
        ground_truth_text = f.read()

    with open(live_path, 'r', encoding='utf-8') as f:
        live_results_text = f.read()

    print("=" * 60)
    print("MEDICAL REPORT EXTRACTION EVALUATION".center(60))
    print("=" * 60)

    print("\n--- 1. Traditional Token Overlap Metrics ---")
    p_exact, r_exact, f1_exact = calculate_exact_match_metrics(ground_truth_text, live_results_text)
    print(f"Precision (Exact): {p_exact:.4f}")
    print(f"Recall (Exact):    {r_exact:.4f}")
    print(f"F1-Score (Exact):  {f1_exact:.4f}")

    print("\n--- 2. BERTScore Semantic Evaluation ---")
    print("Calculating BERTScore... (This might take a moment to download the model if first run)")
    # Using a small and fast model for demonstration. Usually roberta-large is used.
    P, R, F1 = score([live_results_text], [ground_truth_text], lang="en", verbose=False)
    
    print(f"BERT Precision: {P.mean().item():.4f}")
    print(f"BERT Recall:    {R.mean().item():.4f}")
    print(f"BERT F1-Score:  {F1.mean().item():.4f}")

    print("\n--- 3. Risk Confidentiality Analysis ---")
    risks = evaluate_risk_confidentiality(live_results_text)
    if not risks:
        print("Status: SECURE - No obvious unredacted PHI found.")
    else:
        print("Status: RISK DETECTED - Potential PHI exposed:")
        for r in risks:
            print(f"  - {r}")

    print("\n" + "=" * 60)

if __name__ == "__main__":
    main()
