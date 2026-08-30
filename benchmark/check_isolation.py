import json
import sys

def check_isolation():
    print("Checking Train/Test Isolation...")
    with open('benchmark/train_bank.json') as f:
        train = json.load(f)
    with open('benchmark/test_benchmark.json') as f:
        test = json.load(f)
        
    train_ids = {x['example_id'] for x in train}
    test_ids = {x['question_id'] for x in test}
    
    if len(train_ids) != 30 or len(test_ids) != 30:
        print("FAIL: Expected exactly 30 distinct questions per bank.")
        sys.exit(1)
        
    train_texts = {x['question'].lower().strip() for x in train}
    test_texts = {x['question'].lower().strip() for x in test}
    
    overlap_text = train_texts.intersection(test_texts)
    if overlap_text:
        print(f"FAIL: Data leakage detected! Overlapping questions: {overlap_text}")
        sys.exit(1)
        
    train_sqls = {x['gold_sql'].lower().strip() for x in train}
    test_sqls = {x['gold_sql'].lower().strip() for x in test}
    
    overlap_sql = train_sqls.intersection(test_sqls)
    if overlap_sql:
        print(f"FAIL: Data leakage detected! Overlapping SQLs: {overlap_sql}")
        sys.exit(1)
        
    print("Isolation checks passed: 0 overlaps.")
    sys.exit(0)

if __name__ == "__main__":
    check_isolation()
