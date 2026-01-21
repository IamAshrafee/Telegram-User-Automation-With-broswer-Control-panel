import { api } from "./api.js";
import { showToast, confirmAction } from "./ui-components.js";
import { loadGroups } from "./groups.js";
import { loadMedia } from "./media.js";
import { loadScheduledJobs } from "./messages.js";

let currentSettings = {};

export async function loadSettings() {
  try {
    currentSettings = await api.get("/settings/");
    renderSettings();
  } catch (error) {
    console.error("Error loading settings:", error);
  }
}

function renderSettings() {
  const minDelay = document.getElementById("minDelay");
  const maxDelay = document.getElementById("maxDelay");
  const dailyLimit = document.getElementById("dailyLimit");
  const timezoneSelect = document.getElementById("timezoneSelect");

  if (minDelay) minDelay.value = currentSettings.min_delay_seconds || 10;
  if (maxDelay) maxDelay.value = currentSettings.max_delay_seconds || 30;
  if (dailyLimit) dailyLimit.value = currentSettings.daily_message_limit || 100;
  if (timezoneSelect) timezoneSelect.value = currentSettings.timezone || "UTC";
}

export function setupSettings() {
  const saveBtn = document.getElementById("saveSettingsBtn");
  const resetBtn = document.getElementById("resetSettingsBtn");
  const minDelayInput = document.getElementById("minDelay");
  const maxDelayInput = document.getElementById("maxDelay");
  const dailyLimitInput = document.getElementById("dailyLimit");

  if (!saveBtn) return;

  // Real-time validation
  if (minDelayInput)
    minDelayInput.addEventListener("input", () => validateDelays());
  if (maxDelayInput)
    maxDelayInput.addEventListener("input", () => validateDelays());
  if (dailyLimitInput)
    dailyLimitInput.addEventListener("input", () => validateDailyLimit());

  // Save settings
  saveBtn.addEventListener("click", async () => {
    const minDelay = parseInt(minDelayInput.value);
    const maxDelay = parseInt(maxDelayInput.value);
    const dailyLimit = parseInt(dailyLimitInput.value);
    const timezone = document.getElementById("timezoneSelect")?.value || "UTC";

    if (!validateAll(minDelay, maxDelay, dailyLimit)) {
      return;
    }

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = "💾 Saving...";

      currentSettings = {
        min_delay_seconds: minDelay,
        max_delay_seconds: maxDelay,
        daily_message_limit: dailyLimit,
        timezone: timezone,
      };

      await api.put("/settings/", currentSettings);
      showToast("Settings saved successfully!", "success");
    } catch (error) {
      showToast("Failed to save settings: " + error.message, "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "💾 Save Changes";
    }
  });

  // Reset to defaults
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      const confirmed = await confirmAction(
        "Reset all settings to default values?",
        { title: "Reset Settings", confirmText: "Reset", type: "warning" },
      );
      if (!confirmed) return;

      try {
        resetBtn.disabled = true;
        resetBtn.textContent = "🔄 Resetting...";

        const defaults = {
          min_delay_seconds: 10,
          max_delay_seconds: 30,
          daily_message_limit: 100,
          timezone: "UTC",
        };

        await api.put("/settings/", defaults);
        await loadSettings();
        showToast("Settings reset to defaults!", "success");
      } catch (error) {
        showToast("Failed to reset settings: " + error.message, "error");
      } finally {
        resetBtn.disabled = false;
        resetBtn.textContent = "🔄 Reset to Defaults";
      }
    });
  }

  // Setup clear data buttons
  setupClearDataButtons();

  // Settings Logout Button
  const settingsLogoutBtn = document.getElementById("settingsLogoutBtn");
  if (settingsLogoutBtn) {
    settingsLogoutBtn.addEventListener("click", () => {
      const mainLogoutBtn = document.getElementById("logoutBtn");
      if (mainLogoutBtn) mainLogoutBtn.click();
    });
  }
}

function setupClearDataButtons() {
  const clearButtons = document.querySelectorAll("[data-clear]");
  clearButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const clearType = button.dataset.clear;
      await clearData(clearType);
    });
  });
}

async function clearData(type) {
  const confirmations = {
    media: "Delete ALL media files and records?\n\nThis cannot be undone!",
    groups: "Delete ALL groups?\n\nThis cannot be undone!",
    messages: "Delete ALL sent message records?\n\nThis cannot be undone!",
    scheduled: "Delete ALL scheduled messages?\n\nThis cannot be undone!",
    all: "Delete ALL data except authentication?\n\nYou will stay logged in.\n\nThis cannot be undone!",
    everything:
      "Delete EVERYTHING including your login session?\n\nYou will be logged out!\n\nThis cannot be undone!",
  };

  const confirmed = await confirmAction(
    `⚠️ WARNING\n\n${confirmations[type]}`,
    { title: "Clear Data", confirmText: "Delete", type: "warning" },
  );
  if (!confirmed) return;

  if (type === "all" || type === "everything") {
    const finalConfirm = await confirmAction(
      "⚠️⚠️⚠️ FINAL WARNING ⚠️⚠️⚠️\n\nAre you ABSOLUTELY SURE?",
      {
        title: "Final Warning",
        confirmText: "Yes, Delete Everything",
        type: "warning",
      },
    );
    if (!finalConfirm) return;
  }

  try {
    const endpoint = type === "all" ? "all-except-auth" : type;
    const result = await api.delete(`/admin/clear/${endpoint}`);

    showToast(result.message, "success");
    await reloadAfterClear(type);
  } catch (error) {
    showToast(`Failed to clear data: ${error.message}`, "error");
  }
}

async function reloadAfterClear(type) {
  switch (type) {
    case "media":
      await loadMedia();
      break;
    case "groups":
      await loadGroups();
      break;
    case "scheduled":
      await loadScheduledJobs();
      break;
    case "all":
      await loadGroups();
      await loadMedia();
      await loadScheduledJobs();
      break;
    case "everything":
      window.location.reload();
      break;
  }
}

function validateDelays() {
  const minDelayInput = document.getElementById("minDelay");
  const maxDelayInput = document.getElementById("maxDelay");
  if (!minDelayInput || !maxDelayInput) return false;

  const minDelay = parseInt(minDelayInput.value);
  const maxDelay = parseInt(maxDelayInput.value);

  minDelayInput.style.borderColor = "";
  maxDelayInput.style.borderColor = "";

  if (minDelay < 5) {
    minDelayInput.style.borderColor = "var(--error)";
    return false;
  }
  if (maxDelay > 300) {
    maxDelayInput.style.borderColor = "var(--error)";
    return false;
  }
  if (minDelay >= maxDelay) {
    minDelayInput.style.borderColor = "var(--error)";
    maxDelayInput.style.borderColor = "var(--error)";
    return false;
  }
  return true;
}

function validateDailyLimit() {
  const dailyLimitInput = document.getElementById("dailyLimit");
  if (!dailyLimitInput) return false;

  const dailyLimit = parseInt(dailyLimitInput.value);
  dailyLimitInput.style.borderColor = "";

  if (dailyLimit < 1 || dailyLimit > 1000) {
    dailyLimitInput.style.borderColor = "var(--error)";
    return false;
  }
  return true;
}

function validateAll(minDelay, maxDelay, dailyLimit) {
  if (minDelay < 5) {
    showToast("Minimum delay must be at least 5 seconds", "error");
    return false;
  }
  if (maxDelay > 300) {
    showToast("Maximum delay cannot exceed 300 seconds (5 minutes)", "error");
    return false;
  }
  if (minDelay >= maxDelay) {
    showToast("Minimum delay must be less than maximum delay", "error");
    return false;
  }
  if (dailyLimit < 1) {
    showToast("Daily limit must be at least 1", "error");
    return false;
  }
  if (dailyLimit > 1000) {
    showToast("Daily limit cannot exceed 1000 messages", "error");
    return false;
  }
  return true;
}
