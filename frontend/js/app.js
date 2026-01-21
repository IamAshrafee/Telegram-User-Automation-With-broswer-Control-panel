/**
 * Main App Orchestrator
 * This is the entry point for the frontend application.
 */

// Basic Navigation Setup
export function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const sections = document.querySelectorAll(".content-section");

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const targetSection = item.dataset.section;

      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");

      sections.forEach((section) => {
        section.classList.remove("active");
        const target = document.getElementById(targetSection);
        if (target) target.classList.add("active");
      });
    });
  });
}

// App Initialization Logic
const initApp = async () => {
  console.log("[Stealth Mode] Booting Main Orchestrator...");

  try {
    // Dynamic imports to prevent circular dependencies and syntax-blocking
    const [
      { setupAuth, checkAuthStatus },
      { setupGroups, loadGroups, renderGroupSelectors },
      { setupMedia, loadMedia, setupImageSelector },
      { setupMessages, loadScheduledJobs },
      { setupSettings, loadSettings },
      { setupTemplates },
      { setupTabs },
      { progressWidget },
    ] = await Promise.all([
      import("./auth.js"),
      import("./groups.js"),
      import("./media.js"),
      import("./messages.js"),
      import("./settings.js"),
      import("./templates.js"),
      import("./ui-components.js"),
      import("./progress-widget.js"),
    ]);

    // Safe Module Initialization
    const initModule = (name, initFn) => {
      try {
        if (typeof initFn === "function") initFn();
      } catch (e) {
        console.error(`[Boot Error] ${name} module failed:`, e);
      }
    };

    // 1. Setup Event Listeners
    window.addEventListener("authenticated", async () => {
      console.log("[Stealth Mode] Authenticated! Loading modules...");
      try {
        await Promise.all([
          loadGroups(),
          loadMedia(),
          loadScheduledJobs(),
          loadSettings(),
        ]);
        if (typeof renderGroupSelectors === "function") renderGroupSelectors();

        // Start rate limit monitoring
        import("./rate-limit.js").then((module) => {
          if (module.startRateLimitMonitoring)
            module.startRateLimitMonitoring();
        });
      } catch (e) {
        console.warn("[Data Error] Post-auth background load failed:", e);
      }
    });

    // 2. Component Setup
    initModule("Navigation", setupNavigation);
    initModule("Auth", setupAuth);
    initModule("Groups", setupGroups);
    initModule("Media", () => {
      setupMedia();
      setupImageSelector();
    });
    initModule("Messages", setupMessages);
    initModule("Settings", setupSettings);
    initModule("Templates", setupTemplates);
    initModule("Tabs", setupTabs);
    initModule("Progress", () => progressWidget.init());

    // 3. Final Auth Handshake
    console.log("[Stealth Mode] Checking login status...");
    await checkAuthStatus();

    // 4. Hide boot indicator
    const bootStatus = document.getElementById("bootStatus");
    if (bootStatus) bootStatus.style.display = "none";
  } catch (err) {
    console.error(
      "[Stealth Mode] SYSTEM HALTED: Critical initialization error:",
      err,
    );

    // On-screen emergency diagnostic for the user
    const alertBar = document.createElement("div");
    alertBar.style =
      "position:fixed; top:0; left:0; width:100%; background:#8b0000; color:#fff; padding:15px; z-index:99999; text-align:center; box-shadow:0 4px 20px rgba(0,0,0,0.5); font-family:sans-serif;";
    alertBar.innerHTML = `
      <div style="font-weight:bold; margin-bottom:5px;">⚠️ System Critical Error</div>
      <div style="font-size:0.85em; opacity:0.9;">Failed to load application scripts. Please verify your Nginx proxy handles subpaths correctly and press <strong>Ctrl+F5</strong>.</div>
    `;
    document.body.prepend(alertBar);
  }
};

// Start the boot sequence
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
