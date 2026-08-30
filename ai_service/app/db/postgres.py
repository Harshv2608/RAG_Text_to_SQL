import psycopg2
import os
from typing import List, Dict, Any, Tuple

class PostgresExecutor:
    def __init__(self):
        self.host = os.getenv("DB_HOST", "localhost")
        self.port = os.getenv("DB_PORT", "5432")
        self.user = os.getenv("DB_EXEC_USER", "insights_readonly")
        self.password = os.getenv("DB_EXEC_PASSWORD", "readonly_password")
        self.db_name = os.getenv("DB_NAME", "insightsql")
        
    def execute(self, sql: str) -> Tuple[bool, List[Dict[str, Any]], str]:
        """
        Executes a SQL query and returns (success, result_set, error_message)
        """
        try:
            conn = psycopg2.connect(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                dbname=self.db_name
            )
            # Guarantee read-only execution session
            conn.set_session(readonly=True)
            cur = conn.cursor()
            cur.execute(sql)
            
            # Fetch results if any
            if cur.description:
                columns = [desc[0] for desc in cur.description]
                results = []
                for row in cur.fetchall():
                    results.append(dict(zip(columns, row)))
                cur.close()
                conn.close()
                return True, results, ""
            else:
                cur.close()
                conn.close()
                return True, [], ""
                
        except Exception as e:
            return False, [], str(e)
