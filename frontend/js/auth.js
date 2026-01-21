import { api } from "./api.js";
import { showToast } from "./ui-components.js";

let isAuthenticated = false;

/**
 * Checks with the backend if the current session is active.
 */
export async function checkAuthStatus() {
  console.log("[Auth] Checking session status...");
  try {
    const status = await api.get("/auth/status");
    isAuthenticated = status.is_active;

    if (isAuthenticated) {
      console.log("[Auth] Active session found for:", status.phone_number);
      showApp(status.phone_number);
      // Trigger data load
      setTimeout(() => {
        window.dispatchEvent(new Event("authenticated"));
      }, 100);
    } else {
      console.log("[Auth] No active session.");
      showAuthModal();
    }
  } catch (error) {
    console.warn(
      "[Auth] Status check failed (likely not logged in):",
      error.message,
    );
    showAuthModal();
  }
}

function showAuthModal() {
  const modal = document.getElementById("authModal");
  const app = document.getElementById("app");
  if (modal) modal.classList.remove("hidden");
  if (app) app.classList.add("hidden");
}

function showApp(phoneNumber) {
  const modal = document.getElementById("authModal");
  const app = document.getElementById("app");
  if (modal) modal.classList.add("hidden");
  if (app) app.classList.remove("hidden");

  const userPhone = document.getElementById("userPhone");
  if (userPhone) userPhone.textContent = phoneNumber;
}

/**
 * Attaches event listeners to the authentication form buttons.
 */
export function setupAuth() {
  const sendCodeBtn = document.getElementById("sendCodeBtn");
  const verifyCodeBtn = document.getElementById("verifyCodeBtn");
  const verifyPasswordBtn = document.getElementById("verifyPasswordBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const phoneInput = document.getElementById("phoneInput");
  const otpInput = document.getElementById("otpInput");
  const passwordInput = document.getElementById("passwordInput");

  const phoneStep = document.getElementById("phoneStep");
  const otpStep = document.getElementById("otpStep");
  const passwordStep = document.getElementById("passwordStep");

  if (!sendCodeBtn) {
    console.error("[Auth Setup] CRITICAL: sendCodeBtn not found in DOM!");
    return;
  }

  console.log("[Auth Setup] Attaching listeners to Send Code button.");

  sendCodeBtn.addEventListener("click", async () => {
    console.log("[Auth] 'Send Code' clicked manually.");
    const phoneNumber = phoneInput.value.trim();

    if (!phoneNumber) {
      showToast("Please enter a phone number", "error");
      return;
    }

    try {
      sendCodeBtn.disabled = true;
      sendCodeBtn.textContent = "Sending...";

      console.log("[Auth] Requesting OTP for:", phoneNumber);
      await api.post("/auth/send-code", { phone_number: phoneNumber });

      showToast("OTP code sent! Check your Telegram app.", "success");
      if (phoneStep) phoneStep.classList.add("hidden");
      if (otpStep) otpStep.classList.remove("hidden");
    } catch (error) {
      console.error("[Auth] Request failed:", error);
      showToast(error.message || "Failed to connect to server", "error");
    } finally {
      sendCodeBtn.disabled = false;
      sendCodeBtn.textContent = "Send Code";
    }
  });

  if (verifyCodeBtn) {
    verifyCodeBtn.addEventListener("click", async () => {
      const phoneNumber = phoneInput.value.trim();
      const code = otpInput.value.trim();
      if (!code) {
        showToast("Please enter the OTP code", "error");
        return;
      }

      try {
        verifyCodeBtn.disabled = true;
        verifyCodeBtn.textContent = "Verifying...";

        const response = await api.post("/auth/verify-code", {
          phone_number: phoneNumber,
          code: code,
        });

        if (response.success) {
          showToast("Authentication successful!", "success");
          setTimeout(() => {
            showApp(response.session_status.phone_number);
            window.dispatchEvent(new Event("authenticated"));
          }, 1000);
        } else if (response.message.includes("2FA password required")) {
          showToast(response.message, "error");
          if (otpStep) otpStep.classList.add("hidden");
          if (passwordStep) passwordStep.classList.remove("hidden");
        }
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        verifyCodeBtn.disabled = false;
        verifyCodeBtn.textContent = "Verify Code";
      }
    });
  }

  if (verifyPasswordBtn) {
    verifyPasswordBtn.addEventListener("click", async () => {
      const phoneNumber = phoneInput.value.trim();
      const code = otpInput.value.trim();
      const password = passwordInput.value.trim();

      if (!password) {
        showToast("Please enter your 2FA password", "error");
        return;
      }

      try {
        verifyPasswordBtn.disabled = true;
        verifyPasswordBtn.textContent = "Verifying...";

        const response = await api.post("/auth/verify-code", {
          phone_number: phoneNumber,
          code: code,
          password: password,
        });

        showToast("Authentication successful!", "success");
        setTimeout(() => {
          showApp(response.session_status.phone_number);
          window.dispatchEvent(new Event("authenticated"));
        }, 1000);
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        verifyPasswordBtn.disabled = false;
        verifyPasswordBtn.textContent = "Verify Password";
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await api.post("/auth/logout", {});
        isAuthenticated = false;
        showAuthModal();
        if (phoneInput) phoneInput.value = "";
        if (otpInput) otpInput.value = "";
        if (passwordInput) passwordInput.value = "";
        if (phoneStep) phoneStep.classList.remove("hidden");
        if (otpStep) otpStep.classList.add("hidden");
        if (passwordStep) passwordStep.classList.add("hidden");
      } catch (error) {
        console.error("Logout error:", error);
      }
    });
  }
}

export { isAuthenticated };
