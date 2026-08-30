import json
import subprocess
import sys

def verify_queries(file_path, key_sql):
    print(f"Verifying {file_path}...")
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    passed = 0
    for item in data:
        query = item[key_sql]
        # Run query via docker exec. We use psql's robust query execution.
        cmd = ['docker', 'exec', 'insightsql_postgres', 'psql', '-U', 'postgres', '-d', 'insightsql', '-c', query]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            passed += 1
        else:
            print(f"FAILED query in {file_path}: {query}")
            print(f"Error: {result.stderr}")
    
    print(f"{passed}/{len(data)} passed in {file_path}")
    return passed == len(data)

def main():
    print("Starting verification against PostgreSQL container...")
    t1 = verify_queries('benchmark/train_bank.json', 'gold_sql')
    t2 = verify_queries('benchmark/test_benchmark.json', 'gold_sql')
    if t1 and t2:
        print("All 60 queries verified successfully.")
        sys.exit(0)
    else:
        print("Verification failed.")
        sys.exit(1)

if __name__ == '__main__':
    main()
