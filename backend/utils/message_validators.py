"""
Content validation utilities
"""
import re
from typing import Tuple, List


def validate_message_content(text: str, link: str = None) -> Tuple[bool, List[str]]:
    """
    Validate message content and return errors
    
    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    errors = []
    
    # Check text length (Telegram limit is 4096)
    if not text or len(text.strip()) == 0:
        errors.append("Message text cannot be empty")
    elif len(text) > 4096:
        errors.append(f"Message too long ({len(text)} chars, max 4096)")
    
    # Validate URL if provided
    if link:
        if not is_valid_url(link):
            errors.append("Invalid URL format")
    
    # Check for spam patterns
    spam_warnings = check_spam_patterns(text)
    if spam_warnings:
        errors.extend(spam_warnings)
    
    return (len(errors) == 0, errors)


def is_valid_url(url: str) -> bool:
    """Check if URL is valid"""
    url_pattern = re.compile(
        r'^https?://'  # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain
        r'localhost|'  # localhost
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # or IP
        r'(?::\d+)?'  # optional port
        r'(?:/?|[/?]\S+)$', re.IGNORECASE)
    return url_pattern.match(url) is not None


def check_spam_patterns(text: str) -> List[str]:
    """
    Check for common spam patterns
    
    Returns:
        List of warnings
    """
    warnings = []
    
    # Excessive caps
    caps_count = sum(1 for c in text if c.isupper())
    if caps_count > len(text) * 0.5 and len(text) > 20:
        warnings.append("Warning: Excessive capital letters may be flagged as spam")
    
    # Excessive exclamation marks
    exclamation_count = text.count('!')
    if exclamation_count > 5:
        warnings.append("Warning: Too many exclamation marks may look spammy")
    
    # Excessive emojis (simple check)
    emoji_pattern = re.compile(r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF]')
    emoji_count = len(emoji_pattern.findall(text))
    if emoji_count > 10:
        warnings.append("Warning: Too many emojis may reduce readability")
    
    return warnings


def estimate_send_time(group_count: int, min_delay: int = 10, max_delay: int = 30) -> int:
    """
    Estimate total send time in seconds
    
    Args:
        group_count: Number of groups to send to
        min_delay: Minimum delay between messages
        max_delay: Maximum delay between messages
    
    Returns:
        Estimated time in seconds
    """
    avg_delay = (min_delay + max_delay) / 2
    total_time = group_count * avg_delay
    return int(total_time)


def format_time_estimate(seconds: int) -> str:
    """Format seconds into human-readable time"""
    if seconds < 60:
        return f"{seconds} seconds"
    elif seconds < 3600:
        minutes = seconds // 60
        return f"{minutes} minute{'s' if minutes > 1 else ''}"
    else:
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        return f"{hours}h {minutes}m"
