// API Configuration
// Support hosting under a subpath (e.g. /sys-admin-panel/)
const API_BASE =
  window.location.origin + window.location.pathname.replace(/\/$/, "");

// API Client
class APIClient {
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        let errorMessage = "Request failed";
        if (errorData.detail) {
          if (typeof errorData.detail === "string") {
            errorMessage = errorData.detail;
          } else {
            errorMessage = JSON.stringify(errorData.detail);
          }
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  }

  async get(endpoint) {
    return this.request(endpoint);
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async patch(endpoint, data) {
    return this.request(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, {
      method: "DELETE",
    });
  }

  async uploadMultipleFiles(endpoint, files) {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      let errorMessage = "Upload failed";
      if (errorData.detail) {
        if (typeof errorData.detail === "string") {
          errorMessage = errorData.detail;
        } else {
          errorMessage = JSON.stringify(errorData.detail);
        }
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  }

  async uploadFile(endpoint, file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Upload failed");
    }

    return await response.json();
  }
}

export const api = new APIClient();

// Navigation
export function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const sections = document.querySelectorAll(".content-section");

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const targetSection = item.dataset.section;

      // Update active nav item
      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");

      // Show target section
      sections.forEach((section) => section.classList.remove("active"));
      document.getElementById(targetSection).classList.add("active");
    });
  });
}

// Format file size
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

// Format date
export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

// Import modules
import { checkAuthStatus, setupAuth } from "./auth.js";
import { setupGroups, loadGroups, renderGroupSelectors } from "./groups.js";
import { setupMedia, loadMedia } from "./media.js";
import { setupMessages, loadScheduledJobs } from "./messages.js";
import { setupSettings, loadSettings } from "./settings.js";
import { setupTemplates } from "./templates.js";
import { setupTabs } from "./ui-components.js";
import { progressWidget } from "./progress-widget.js";

// Initialize app
document.addEventListener("DOMContentLoaded", async () => {
  // Setup modules
  setupNavigation();
  setupAuth();
  setupGroups();
  setupMedia();
  setupMessages();
  setupSettings();
  setupTemplates();
  setupTabs();

  // Init progress widget (checks for active jobs)
  progressWidget.init();

  // Start rate limit monitoring
  import("./rate-limit.js").then((module) => {
    module.startRateLimitMonitoring();
  });

  // Check authentication status
  await checkAuthStatus();

  // Load data when authenticated
  window.addEventListener("authenticated", async () => {
    await loadGroups();
    await loadMedia();
    await loadScheduledJobs();
    await loadSettings();
    renderGroupSelectors();
  });
});
