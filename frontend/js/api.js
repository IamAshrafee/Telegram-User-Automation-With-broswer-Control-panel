import { getApiBase } from "./utils.js";

// Initialize API_BASE once
export const API_BASE = getApiBase();

/**
 * API Client for Telegram Automation System
 * Handles communication with the FastAPI backend
 */
class APIClient {
  constructor() {
    this.API_BASE = API_BASE;
  }

  async handleResponse(response, options = {}) {
    let errorData = {};
    const isJson = response.headers
      .get("content-type")
      ?.includes("application/json");

    if (!response.ok) {
      if (isJson) {
        try {
          errorData = await response.json();
        } catch (e) { }
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
    const url = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    try {
      const token = localStorage.getItem('access_token');
      const headers = {
        "Content-Type": "application/json",
        ...options.headers,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.API_BASE}${url}`, {
        ...options,
        headers: headers,
      });

      if (response.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.location.href = '/sys-admin-panel/login.html';
        return; // Stop processing
      }

      return await this.handleResponse(response, options);
    } catch (error) {
      if (!options.silent) {
        console.error(
          `[API Request Failed] URL: ${this.API_BASE}${url}`,
          error,
        );
      }
      const enhancedError = new Error(
        `${error.message} (Target: ${this.API_BASE}${url})`,
      );
      enhancedError.status = error.status;
      enhancedError.data = error.data;
      throw enhancedError;
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

    // Prepare headers
    const headers = {};
    const token = localStorage.getItem('access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.API_BASE}${url}`, {
      method: "POST",
      headers: headers,
      body: formData,
    });

    return await this.handleResponse(response, options);
  }

  async uploadFile(endpoint, file, options = {}) {
    const formData = new FormData();
    formData.append("file", file);

    const url = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

    // Prepare headers
    const headers = {};
    const token = localStorage.getItem('access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.API_BASE}${url}`, {
      method: "POST",
      headers: headers,
      body: formData,
    });

    return await this.handleResponse(response, options);
  }
}

// Single instance for the whole app
export const api = new APIClient();
