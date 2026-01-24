// Utility Helpers

/**
 * Format bytes to human readable file size
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

/**
 * Format ISO date string to local string
 * @param {string} dateString
 * @returns {string}
 */
export function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleString();
}

/**
 * Dynamic Subpath Detection for API calls
 * @returns {string}
 */
export const getApiBase = () => {
  const origin = window.location.origin;
  const path = window.location.pathname;

  let base = path;
  // If we are on index.html, remove it from the path to get the folder
  if (base.includes(".html")) {
    base = base.substring(0, base.lastIndexOf("/"));
  }

// Ensure it starts with / and ends without /
  const final = (origin + base).replace(/\/+$/, "") + "/api";
  console.log("[Stealth Mode] API Base detected:", final);
  return final;
};

/**
 * Capitalize first letter of string
 */
export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}
