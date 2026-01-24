
from datetime import datetime

def process_content(text: str, context: dict) -> str:
    """
    Replace variables in text with values from context.
    Supported variables:
    - {group_name}
    - {date}
    - {time}
    - {group_id}
    """
    if not text:
        return ""
        
    processed_text = text
    
    # Standard context variables if not provided
    if "{date}" in processed_text and "{date}" not in context:
        context["{date}"] = datetime.now().strftime("%Y-%m-%d")
        
    if "{time}" in processed_text and "{time}" not in context:
        context["{time}"] = datetime.now().strftime("%H:%M")
    
    # Replace all keys in context
    for key, value in context.items():
        # Ensure key corresponds to a variable format (e.g., wrapped in {})
        # The caller is expected to provide keys like "{group_name}" or just "group_name"
        # We will handle exact string replacement based on the key provided.
        processed_text = processed_text.replace(key, str(value))
        
    return processed_text
