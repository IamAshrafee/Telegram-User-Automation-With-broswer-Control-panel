from backend.models.group import PermissionType
from typing import Optional


def validate_content_for_group(
    permission_type: PermissionType,
    has_link: bool,
    has_media: bool
) -> tuple[bool, str]:
    """
    Validate if content is allowed for a group based on its permission type.
    
    Returns:
        tuple[bool, str]: (is_valid, reason_if_invalid)
    """
    if permission_type == PermissionType.ALL:
        return True, ""
    
    if permission_type == PermissionType.TEXT_ONLY:
        if has_link:
            return False, "Group does not allow links"
        if has_media:
            return False, "Group does not allow media"
        return True, ""
    
    if permission_type == PermissionType.TEXT_LINK:
        if has_media:
            return False, "Group does not allow media"
        return True, ""
    
    if permission_type == PermissionType.TEXT_IMAGE:
        if has_link:
            return False, "Group does not allow links"
        return True, ""
    
    if permission_type == PermissionType.TEXT_LINK_IMAGE:
        return True, ""
    
    return False, "Unknown permission type"
