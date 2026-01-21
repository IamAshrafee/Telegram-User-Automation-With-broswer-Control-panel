// API Configuration
// Support hosting under a subpath (e.g. /sys-admin-panel/)
export const API_BASE = (() => {
  const path = window.location.pathname;
  // If we are at /path/index.html, we want /path
  if (path.includes(".html")) {
    return window.location.origin + path.substring(0, path.lastIndexOf("/"));
  }
  // Remove trailing slash for consistency
  return window.location.origin + path.replace(/\/$/, "");
})();

// API Client
class APIClient {
  async handleResponse(response, options = {}) {
    let errorData = {};
    const isJson = response.headers
      .get("content-type")
      ?.includes("application/json");

    if (!response.ok) {
      if (isJson) {
        try {
          errorData = await response.json();
        } catch (e) {}
      }

      const errorMessage = errorData.detail || response.statusText;
      const error = new Error(
        typeof errorMessage === "string"
          ? errorMessage
          : JSON.stringify(errorMessage),
      );
      error.status = response.status;
      error.data = errorData;

      if (!options.silent) {
        console.error("API Error:", error);
      }
      throw error;
    }

    return isJson ? await response.json() : await response.text();
  }

  async request(endpoint, options = {}) {
    try {
      // Ensure endpoint starts with /
      const url = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

      const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      return await this.handleResponse(response, options);
    } catch (error) {
      if (!options.silent) {
        console.error("Request failed:", error);
      }
      throw error;
    }
  }

  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: "GET" });
  }

  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async patch(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: "DELETE" });
  }

  async uploadMultipleFiles(endpoint, files, options = {}) {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    const url = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const response = await fetch(`${API_BASE}${url}`, {
      method: "POST",
      body: formData,
    });

    return await this.handleResponse(response, options);
  }

  async uploadFile(endpoint, file, options = {}) {
    const formData = new FormData();
    formData.append("file", file);

    const url = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const response = await fetch(`${API_BASE}${url}`, {
      method: "POST",
      body: formData,
    });

    return await this.handleResponse(response, options);
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
