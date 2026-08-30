import re
from ai_service.app.models.schemas import GuardResult

DESTRUCTIVE_KEYWORDS = {"DROP", "DELETE", "UPDATE", "ALTER", "INSERT", "ATTACH", "TRUNCATE"}

def check(sql: str) -> GuardResult:
    if not sql or not isinstance(sql, str):
        return GuardResult(passed=False, reason="Empty or invalid SQL.")

    # Strip and uppercase for basic keyword checking
    normalized = sql.strip().upper()
    
    # Simple check for multi-statement
    # A proper AST parser would be robust, but per specs we check semicolon chaining outside string literals.
    # For this simple prototype safety guard, we'll check for any semicolon that isn't the last character.
    if ";" in sql.strip().rstrip(";"):
        return GuardResult(passed=False, reason="Multi-statement queries are not allowed.")
    
    # Check for destructive keywords
    tokens = re.split(r'\s+', normalized)
    for token in tokens:
        # Strip punctuation from token for cleaner matching
        clean_token = re.sub(r'[^A-Z]', '', token)
        if clean_token in DESTRUCTIVE_KEYWORDS:
            return GuardResult(passed=False, reason=f"Statement type '{clean_token}' is not permitted.")
            
    return GuardResult(passed=True)
