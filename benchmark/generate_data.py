import json
import random
import uuid
from datetime import datetime, timedelta

random.seed(42)

def generate_seed_data():
    users = []
    events = []
    subscriptions = []
    payments = []

    countries = ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'IN']
    plans = ['Basic', 'Pro', 'Enterprise']
    event_types = ['login', 'view_item', 'add_to_cart', 'purchase', 'logout', 'upgrade']

    # Generate users
    for i in range(55):
        uid = str(uuid.uuid4())
        created_at = datetime.now() - timedelta(days=random.randint(30, 365))
        users.append({
            'id': uid,
            'full_name': f"User {i}",
            'email': f"user{i}@example.com",
            'country': random.choice(countries),
            'created_at': created_at.strftime('%Y-%m-%d %H:%M:%S')
        })

        for _ in range(random.randint(1, 5)):
            eid = str(uuid.uuid4())
            events.append({
                'id': eid,
                'user_id': uid,
                'event_type': random.choice(event_types),
                'event_time': (created_at + timedelta(days=random.randint(1, 30))).strftime('%Y-%m-%d %H:%M:%S'),
                'metadata': json.dumps({"browser": random.choice(['Chrome', 'Safari', 'Firefox'])})
            })
            
        if random.random() > 0.3:
            sub_id = str(uuid.uuid4())
            sub_start = created_at + timedelta(days=random.randint(1, 10))
            is_active = random.random() > 0.2
            subscriptions.append({
                'id': sub_id,
                'user_id': uid,
                'plan': random.choice(plans),
                'status': 'active' if is_active else 'canceled',
                'started_at': sub_start.strftime('%Y-%m-%d %H:%M:%S'),
                'ended_at': "NULL" if is_active else f"'{ (sub_start + timedelta(days=30)).strftime('%Y-%m-%d %H:%M:%S') }'"
            })
            
            for _ in range(random.randint(1, 3)):
                pid = str(uuid.uuid4())
                amount = {'Basic': 9.99, 'Pro': 29.99, 'Enterprise': 99.99}[subscriptions[-1]['plan']]
                payments.append({
                    'id': pid,
                    'user_id': uid,
                    'subscription_id': sub_id,
                    'amount': amount,
                    'currency': 'USD',
                    'payment_status': 'success' if random.random() > 0.1 else 'failed',
                    'paid_at': (sub_start + timedelta(days=random.randint(0, 30))).strftime('%Y-%m-%d %H:%M:%S')
                })

    with open('benchmark/schema/seed.sql', 'w') as f:
        for u in users:
            f.write(f"INSERT INTO users (id, full_name, email, country, created_at) VALUES ('{u['id']}', '{u['full_name']}', '{u['email']}', '{u['country']}', '{u['created_at']}');\n")
        f.write("\n")
        for e in events:
            f.write(f"INSERT INTO events (id, user_id, event_type, event_time, metadata) VALUES ('{e['id']}', '{e['user_id']}', '{e['event_type']}', '{e['event_time']}', '{e['metadata']}');\n")
        f.write("\n")
        for s in subscriptions:
            f.write(f"INSERT INTO subscriptions (id, user_id, plan, status, started_at, ended_at) VALUES ('{s['id']}', '{s['user_id']}', '{s['plan']}', '{s['status']}', '{s['started_at']}', {s['ended_at']});\n")
        f.write("\n")
        for p in payments:
            f.write(f"INSERT INTO payments (id, user_id, subscription_id, amount, currency, payment_status, paid_at) VALUES ('{p['id']}', '{p['user_id']}', '{p['subscription_id']}', {p['amount']}, '{p['currency']}', '{p['payment_status']}', '{p['paid_at']}');\n")

def generate_benchmarks():
    schema_sig = "users(id, full_name, email, country, created_at) events(id, user_id, event_type, event_time, metadata) subscriptions(id, user_id, plan, status, started_at, ended_at) payments(id, user_id, subscription_id, amount, currency, payment_status, paid_at)"

    t1_train = [
        ("Get all users from US.", "SELECT * FROM users WHERE country = 'US';"),
        ("Get all users from UK.", "SELECT * FROM users WHERE country = 'UK';"),
        ("Get all users from CA.", "SELECT * FROM users WHERE country = 'CA';"),
        ("Get all users from AU.", "SELECT * FROM users WHERE country = 'AU';"),
        ("Get all users from DE.", "SELECT * FROM users WHERE country = 'DE';"),
        ("Get all users from FR.", "SELECT * FROM users WHERE country = 'FR';"),
        ("Get all users from JP.", "SELECT * FROM users WHERE country = 'JP';"),
        ("Get all users from IN.", "SELECT * FROM users WHERE country = 'IN';"),
        ("List all Basic plan subscriptions.", "SELECT * FROM subscriptions WHERE plan = 'Basic';"),
        ("List all Pro plan subscriptions.", "SELECT * FROM subscriptions WHERE plan = 'Pro';")
    ]
    t1_test = [
        ("Find all events of type 'login'.", "SELECT * FROM events WHERE event_type = 'login';"),
        ("Find all events of type 'logout'.", "SELECT * FROM events WHERE event_type = 'logout';"),
        ("Find all events of type 'purchase'.", "SELECT * FROM events WHERE event_type = 'purchase';"),
        ("Find all events of type 'view_item'.", "SELECT * FROM events WHERE event_type = 'view_item';"),
        ("Find all events of type 'add_to_cart'.", "SELECT * FROM events WHERE event_type = 'add_to_cart';"),
        ("Find all events of type 'upgrade'.", "SELECT * FROM events WHERE event_type = 'upgrade';"),
        ("List all Enterprise plan subscriptions.", "SELECT * FROM subscriptions WHERE plan = 'Enterprise';"),
        ("List all active subscriptions.", "SELECT * FROM subscriptions WHERE status = 'active';"),
        ("List all canceled subscriptions.", "SELECT * FROM subscriptions WHERE status = 'canceled';"),
        ("List all failed payments.", "SELECT * FROM payments WHERE payment_status = 'failed';")
    ]
    
    t2_train = [
        ("How many successful payments exist per country?", "SELECT u.country, COUNT(p.id) FROM payments p JOIN users u ON p.user_id = u.id WHERE p.payment_status = 'success' GROUP BY u.country;"),
        ("What is the total amount of successful payments for US users?", "SELECT COALESCE(SUM(p.amount), 0) FROM payments p JOIN users u ON p.user_id = u.id WHERE p.payment_status = 'success' AND u.country = 'US';"),
        ("How many active subscriptions are there for each plan?", "SELECT plan, COUNT(*) FROM subscriptions WHERE status = 'active' GROUP BY plan;"),
        ("List the emails of users who have a Pro plan.", "SELECT u.email FROM users u JOIN subscriptions s ON u.id = s.user_id WHERE s.plan = 'Pro';"),
        ("Show the total payment amount for active subscriptions by plan.", "SELECT s.plan, COALESCE(SUM(p.amount), 0) FROM subscriptions s JOIN payments p ON s.id = p.subscription_id WHERE s.status = 'active' AND p.payment_status = 'success' GROUP BY s.plan;"),
        ("Count the number of login events per user.", "SELECT user_id, COUNT(*) FROM events WHERE event_type = 'login' GROUP BY user_id;"),
        ("What is the average payment amount for the Enterprise plan?", "SELECT COALESCE(AVG(p.amount), 0) FROM payments p JOIN subscriptions s ON p.subscription_id = s.id WHERE s.plan = 'Enterprise';"),
        ("List users who created an account in 2025.", "SELECT full_name FROM users WHERE EXTRACT(YEAR FROM created_at) = 2025;"),
        ("How many payments failed per currency?", "SELECT currency, COUNT(*) FROM payments WHERE payment_status = 'failed' GROUP BY currency;"),
        ("Get the names of users from the UK who have an active subscription.", "SELECT u.full_name FROM users u JOIN subscriptions s ON u.id = s.user_id WHERE u.country = 'UK' AND s.status = 'active';")
    ]
    t2_test = [
        ("Count the number of purchase events per country.", "SELECT u.country, COUNT(e.id) FROM events e JOIN users u ON e.user_id = u.id WHERE e.event_type = 'purchase' GROUP BY u.country;"),
        ("What is the total payment amount by canceled subscriptions?", "SELECT COALESCE(SUM(p.amount), 0) FROM payments p JOIN subscriptions s ON p.subscription_id = s.id WHERE s.status = 'canceled';"),
        ("How many users from DE have a Basic plan?", "SELECT COUNT(u.id) FROM users u JOIN subscriptions s ON u.id = s.user_id WHERE u.country = 'DE' AND s.plan = 'Basic';"),
        ("List the countries and the total number of users in each.", "SELECT country, COUNT(*) FROM users GROUP BY country;"),
        ("Show the total amount of successful payments by currency.", "SELECT currency, COALESCE(SUM(amount), 0) FROM payments WHERE payment_status = 'success' GROUP BY currency;"),
        ("Find the average payment amount for the Pro plan.", "SELECT COALESCE(AVG(p.amount), 0) FROM payments p JOIN subscriptions s ON p.subscription_id = s.id WHERE s.plan = 'Pro';"),
        ("List the emails of users who have an Enterprise plan.", "SELECT u.email FROM users u JOIN subscriptions s ON u.id = s.user_id WHERE s.plan = 'Enterprise';"),
        ("How many add_to_cart events occurred?", "SELECT COUNT(*) FROM events WHERE event_type = 'add_to_cart';"),
        ("Get the names of users from FR who have a canceled subscription.", "SELECT u.full_name FROM users u JOIN subscriptions s ON u.id = s.user_id WHERE u.country = 'FR' AND s.status = 'canceled';"),
        ("Count the number of logout events per user.", "SELECT user_id, COUNT(*) FROM events WHERE event_type = 'logout' GROUP BY user_id;")
    ]

    t3_train = [
        ("Which users have both a Pro subscription and an event of type 'upgrade'?", "SELECT u.id, u.full_name FROM users u WHERE u.id IN (SELECT user_id FROM subscriptions WHERE plan = 'Pro') AND u.id IN (SELECT user_id FROM events WHERE event_type = 'upgrade');"),
        ("Find users whose total successful payment amount exceeds 100, and show their latest event type.", "WITH UserPayments AS (SELECT user_id, SUM(amount) as total FROM payments WHERE payment_status = 'success' GROUP BY user_id HAVING SUM(amount) > 100), LatestEvents AS (SELECT user_id, event_type, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY event_time DESC) as rn FROM events) SELECT u.full_name, le.event_type FROM UserPayments up JOIN users u ON up.user_id = u.id JOIN LatestEvents le ON u.id = le.user_id WHERE le.rn = 1;"),
        ("List the top 3 users with the highest total successful payment amounts.", "SELECT u.full_name, SUM(p.amount) as total_amount FROM users u JOIN payments p ON u.id = p.user_id WHERE p.payment_status = 'success' GROUP BY u.id, u.full_name ORDER BY total_amount DESC LIMIT 3;"),
        ("Find countries where the average successful payment amount is above 50.", "SELECT u.country FROM users u JOIN payments p ON u.id = p.user_id WHERE p.payment_status = 'success' GROUP BY u.country HAVING AVG(p.amount) > 50;"),
        ("What is the most common event type for users with an Enterprise plan?", "SELECT e.event_type, COUNT(*) as cnt FROM events e JOIN subscriptions s ON e.user_id = s.user_id WHERE s.plan = 'Enterprise' GROUP BY e.event_type ORDER BY cnt DESC LIMIT 1;"),
        ("List the users who have never made a successful payment.", "SELECT u.full_name FROM users u LEFT JOIN payments p ON u.id = p.user_id AND p.payment_status = 'success' WHERE p.id IS NULL;"),
        ("Find the user with the most events logged.", "SELECT u.full_name, COUNT(e.id) as event_count FROM users u JOIN events e ON u.id = e.user_id GROUP BY u.id, u.full_name ORDER BY event_count DESC LIMIT 1;"),
        ("Show the percentage of active subscriptions by plan.", "WITH TotalActive AS (SELECT COUNT(*) as total FROM subscriptions WHERE status = 'active') SELECT s.plan, COUNT(*)*100.0/COALESCE((SELECT NULLIF(total, 0) FROM TotalActive LIMIT 1), 1) as percentage FROM subscriptions s WHERE s.status = 'active' GROUP BY s.plan;"),
        ("Identify users who upgraded their plan (had a Basic then Pro).", "WITH SubCounts AS (SELECT user_id, COUNT(DISTINCT plan) as p_count FROM subscriptions GROUP BY user_id HAVING COUNT(DISTINCT plan) > 1) SELECT u.full_name FROM users u JOIN SubCounts sc ON u.id = sc.user_id;"),
        ("Find the total revenue generated from US users in the last year.", "SELECT COALESCE(SUM(p.amount), 0) FROM payments p JOIN users u ON p.user_id = u.id WHERE u.country = 'US' AND p.payment_status = 'success' AND p.paid_at >= CURRENT_DATE - INTERVAL '1 year';")
    ]
    t3_test = [
        ("Which users have both an Enterprise subscription and an event of type 'login'?", "SELECT u.id, u.full_name FROM users u WHERE u.id IN (SELECT user_id FROM subscriptions WHERE plan = 'Enterprise') AND u.id IN (SELECT user_id FROM events WHERE event_type = 'login');"),
        ("Find users whose total successful payment amount is exactly 0, and show their latest event type.", "WITH ZeroPayments AS (SELECT u.id as user_id FROM users u LEFT JOIN payments p ON u.id = p.user_id AND p.payment_status = 'success' GROUP BY u.id HAVING COALESCE(SUM(p.amount), 0) = 0), LatestEvents AS (SELECT user_id, event_type, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY event_time DESC) as rn FROM events) SELECT u.full_name, le.event_type FROM ZeroPayments zp JOIN users u ON zp.user_id = u.id JOIN LatestEvents le ON u.id = le.user_id WHERE le.rn = 1;"),
        ("List the top 5 users with the lowest total successful payment amounts (excluding 0).", "SELECT u.full_name, SUM(p.amount) as total_amount FROM users u JOIN payments p ON u.id = p.user_id WHERE p.payment_status = 'success' GROUP BY u.id, u.full_name HAVING SUM(p.amount) > 0 ORDER BY total_amount ASC LIMIT 5;"),
        ("Find countries where the average successful payment amount is below 20.", "SELECT u.country FROM users u JOIN payments p ON u.id = p.user_id WHERE p.payment_status = 'success' GROUP BY u.country HAVING AVG(p.amount) < 20;"),
        ("What is the least common event type for users with a Pro plan?", "SELECT e.event_type, COUNT(*) as cnt FROM events e JOIN subscriptions s ON e.user_id = s.user_id WHERE s.plan = 'Pro' GROUP BY e.event_type ORDER BY cnt ASC LIMIT 1;"),
        ("List the users who have no events logged.", "SELECT u.full_name FROM users u LEFT JOIN events e ON u.id = e.user_id WHERE e.id IS NULL;"),
        ("Find the user with the most failed payments.", "SELECT u.full_name, COUNT(p.id) as fail_count FROM users u JOIN payments p ON u.id = p.user_id WHERE p.payment_status = 'failed' GROUP BY u.id, u.full_name ORDER BY fail_count DESC LIMIT 1;"),
        ("Show the percentage of canceled subscriptions by plan.", "WITH TotalCanceled AS (SELECT COUNT(*) as total FROM subscriptions WHERE status = 'canceled') SELECT s.plan, COUNT(*)*100.0/COALESCE((SELECT NULLIF(total, 0) FROM TotalCanceled LIMIT 1), 1) as percentage FROM subscriptions s WHERE s.status = 'canceled' GROUP BY s.plan;"),
        ("Identify users whose latest subscription is canceled.", "WITH RankedSubs AS (SELECT user_id, status, ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY started_at DESC) as rn FROM subscriptions) SELECT u.full_name FROM users u JOIN RankedSubs rs ON u.id = rs.user_id WHERE rs.rn = 1 AND rs.status = 'canceled';"),
        ("Find the total revenue generated from UK users overall.", "SELECT COALESCE(SUM(p.amount), 0) FROM payments p JOIN users u ON p.user_id = u.id WHERE u.country = 'UK' AND p.payment_status = 'success';")
    ]

    train_bank = []
    test_bench = []

    for i in range(10):
        train_bank.append({"example_id": f"train_t1_{i}", "tier": 1, "question": t1_train[i][0], "gold_sql": t1_train[i][1], "schema_signature": schema_sig})
        test_bench.append({"question_id": f"test_t1_{i}", "tier": 1, "question": t1_test[i][0], "gold_sql": t1_test[i][1], "gold_result": "expected shape"})
        
        train_bank.append({"example_id": f"train_t2_{i}", "tier": 2, "question": t2_train[i][0], "gold_sql": t2_train[i][1], "schema_signature": schema_sig})
        test_bench.append({"question_id": f"test_t2_{i}", "tier": 2, "question": t2_test[i][0], "gold_sql": t2_test[i][1], "gold_result": "expected shape"})
        
        train_bank.append({"example_id": f"train_t3_{i}", "tier": 3, "question": t3_train[i][0], "gold_sql": t3_train[i][1], "schema_signature": schema_sig})
        test_bench.append({"question_id": f"test_t3_{i}", "tier": 3, "question": t3_test[i][0], "gold_sql": t3_test[i][1], "gold_result": "expected shape"})

    with open('benchmark/train_bank.json', 'w') as f:
        json.dump(train_bank, f, indent=2)
    with open('benchmark/test_benchmark.json', 'w') as f:
        json.dump(test_bench, f, indent=2)

if __name__ == '__main__':
    generate_seed_data()
    generate_benchmarks()
