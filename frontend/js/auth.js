import { api } from "./app.js";
import { showToast } from "./ui-components.js";

let isAuthenticated = false;

export async function checkAuthStatus() {
  try {
    const status = await api.get("/auth/status");
    isAuthenticated = status.is_active;

    if (isAuthenticated) {
      showApp(status.phone_number);
      // Load data immediately after showing app
      setTimeout(() => {
        window.dispatchEvent(new Event("authenticated"));
      }, 100);
    } else {
      showAuthModal();
    }
  } catch (error) {
    showAuthModal();
  }
}

function showAuthModal() {
  document.getElementById("authModal").classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
}

function showApp(phoneNumber) {
  document.getElementById("authModal").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("userPhone").textContent = phoneNumber;
}

export function setupAuth() {
  const sendCodeBtn = document.getElementById("sendCodeBtn");
  const verifyCodeBtn = document.getElementById("verifyCodeBtn");
  const verifyPasswordBtn = document.getElementById("verifyPasswordBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const phoneInput = document.getElementById("phoneInput");
  const otpInput = document.getElementById("otpInput");
  const passwordInput = document.getElementById("passwordInput");
  // const authMessage = document.getElementById("authMessage"); // Deprecated
  const phoneStep = document.getElementById("phoneStep");
  const otpStep = document.getElementById("otpStep");
  const passwordStep = document.getElementById("passwordStep");

  sendCodeBtn.addEventListener("click", async () => {
    const phoneNumber = phoneInput.value.trim();

    if (!phoneNumber) {
      showToast("Please enter a phone number", "error");
      return;
    }

    try {
      sendCodeBtn.disabled = true;
      sendCodeBtn.textContent = "Sending...";

      await api.post("/auth/send-code", { phone_number: phoneNumber });

      showToast("OTP code sent! Check your Telegram app.", "success");
      phoneStep.classList.add("hidden");
      otpStep.classList.remove("hidden");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      sendCodeBtn.disabled = false;
      sendCodeBtn.textContent = "Send Code";
    }
  });

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
        otpStep.classList.add("hidden");
        passwordStep.classList.remove("hidden");
      }
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      verifyCodeBtn.disabled = false;
      verifyCodeBtn.textContent = "Verify Code";
    }
  });

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

  logoutBtn.addEventListener("click", async () => {
    try {
      await api.post("/auth/logout", {});
      isAuthenticated = false;
      showAuthModal();
      // Reset form
      phoneInput.value = "";
      otpInput.value = "";
      passwordInput.value = "";
      phoneStep.classList.remove("hidden");
      otpStep.classList.add("hidden");
      passwordStep.classList.add("hidden");
    } catch (error) {
      console.error("Logout error:", error);
    }
  });
}

export { isAuthenticated };
