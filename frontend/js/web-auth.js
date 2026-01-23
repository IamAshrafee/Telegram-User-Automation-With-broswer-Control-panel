/**
 * Web authentication utilities for handling login, registration, and token management
 */

const API_BASE_URL = window.location.origin;

/**
 * Register a new user
 * @param {string} name - User's full name
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<{success: boolean, message?: string}>}
 */
async function register(name, email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/users/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
        const errorMsg = typeof data.detail === 'object' 
            ? JSON.stringify(data.detail) 
            : (data.detail || 'Registration failed');
        throw new Error(errorMsg);
    }

    // Store token and user data
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));

    return { success: true };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Login user
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<{success: boolean, message?: string}>}
 */
async function login(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
        const errorMsg = typeof data.detail === 'object' 
            ? JSON.stringify(data.detail) 
            : (data.detail || 'Login failed');
        throw new Error(errorMsg);
    }

    // Store token and user data
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));

    return { success: true };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Logout user
 */
function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

/**
 * Get the stored access token
 * @returns {string|null}
 */
function getToken() {
  return localStorage.getItem('access_token');
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
function isAuthenticated() {
  return !!getToken();
}

/**
 * Get current user from storage
 * @returns {Object|null}
 */
function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * Make an authenticated API request
 * @param {string} url - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>}
 */
async function authenticatedFetch(url, options = {}) {
  const token = getToken();

  if (!token) {
    window.location.href = '/login.html';
    throw new Error('Not authenticated');
  }

  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
  };

  if (options.body && typeof options.body !== 'string') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized - redirect to login
  if (response.status === 401) {
    logout();
    throw new Error('Session expired');
  }

  return response;
}

/**
 * Global error handler for fetch requests
 */
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message === 'Session expired') {
    event.preventDefault();
  }
});
