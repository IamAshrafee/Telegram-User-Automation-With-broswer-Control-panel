import { api, formatDate } from "./app.js";

class ProgressWidget {
  constructor() {
    this.checkInterval = null;
    this.activeMessageId = null;
    this.isWidgetVisible = false;
    this.container = null;
    this.pollInterval = 2000; // 2 seconds
  }

  init() {
    this.createWidgetDOM();
    this.checkForActiveJobs();
  }

  createWidgetDOM() {
    if (document.getElementById("progress-widget")) return; // Already exists

    // Target the embedded container first
    const container = document.getElementById("embedded-progress-container");
    if (!container) {
      console.warn(
        "Embedded progress container not found, falling back to body",
      );
    }

    const div = document.createElement("div");
    div.id = "progress-widget";
    div.className = "progress-widget hidden";
    div.innerHTML = `
      <div class="progress-header">
        <div class="progress-title">
          <span class="spinner-sm"></span>
          <h3>Sending Messages...</h3>
        </div>
        <div class="progress-controls">
          <button id="minimizeProgressBtn" class="btn-icon" title="Toggle Detail">_</button>
        </div>
      </div>
      <div class="progress-body">
        <div class="progress-stats">
            <div class="stat-item">
                <span class="label">Progress</span>
                <span class="value" id="progress-count">0/0</span>
            </div>
            <div class="stat-item">
                <span class="label">Success</span>
                <span class="value success" id="progress-success">0</span>
            </div>
            <div class="stat-item">
                <span class="label">Failed</span>
                <span class="value error" id="progress-failed">0</span>
            </div>
        </div>
        <div class="progress-bar-wrapper">
            <div class="progress-bar-fill" id="progress-bar-fill" style="width: 0%"></div>
        </div>
        <div class="progress-log" id="progress-log">
            <!-- Log items -->
        </div>
      </div>
    `;

    // Append to container if exists, else body (but if body, it needs fixed position styles)
    if (container) {
      container.innerHTML = ""; // Clear any previous
      container.appendChild(div);
      // Make sure container is visible
      container.style.display = "block";
    } else {
      document.body.appendChild(div);
    }

    this.container = div;

    // Minimize toggle
    const body = div.querySelector(".progress-body");
    const toggleBtn = div.querySelector("#minimizeProgressBtn");

    toggleBtn.onclick = () => {
      const isHidden = body.classList.contains("hidden");
      if (isHidden) {
        body.classList.remove("hidden");
        toggleBtn.textContent = "_";
      } else {
        body.classList.add("hidden");
        toggleBtn.textContent = "□"; // Maximise icon
      }
    };
  }

  async checkForActiveJobs() {
    try {
      const activeJobs = await api.get("/messages/active");
      if (activeJobs && activeJobs.length > 0) {
        // Pick the first one for now
        this.startTracking(activeJobs[0].id);
      }
    } catch (e) {
      console.error("Failed to check active jobs", e);
    }
  }

  startTracking(messageId) {
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.activeMessageId = messageId;
    this.show();

    // Immediate check
    this.updateStatus();

    // Poll
    this.checkInterval = setInterval(
      () => this.updateStatus(),
      this.pollInterval,
    );
  }

  async updateStatus() {
    if (!this.activeMessageId) return;

    try {
      const message = await api.get(`/messages/${this.activeMessageId}/status`);

      // Update UI
      this.renderProgress(message);

      // Check completion
      if (message.status === "sent" || message.status === "failed") {
        this.complete(message);
      }
    } catch (e) {
      console.error("Error fetching status", e);
    }
  }

  renderProgress(message) {
    const processed = message.processed_count || 0;
    const total = message.total_count || 0;
    const groups = message.group_status || {};

    // Sort groups by update time (recent first)
    const sortedGroups = Object.values(groups).sort((a, b) => {
      return new Date(b.updated_at) - new Date(a.updated_at);
    });

    // Calc stats
    let success = 0;
    let failed = 0;

    Object.values(groups).forEach((g) => {
      if (g.status === "sent") success++;
      if (g.status === "failed" || g.status === "skipped") failed++;
    });

    // Update Header
    document.getElementById("progress-count").textContent =
      `${processed}/${total}`;
    document.getElementById("progress-success").textContent = success;
    document.getElementById("progress-failed").textContent = failed;

    const percent = total > 0 ? (processed / total) * 100 : 0;
    document.getElementById("progress-bar-fill").style.width = `${percent}%`;

    // Logs
    const logContainer = document.getElementById("progress-log");
    logContainer.innerHTML = sortedGroups
      .map((g) => {
        let icon = "⏳";
        let statusClass = "pending";
        if (g.status === "sent") {
          icon = "✅";
          statusClass = "success";
        } else if (g.status === "failed") {
          icon = "❌";
          statusClass = "error";
        } else if (g.status === "skipped") {
          icon = "⏭️";
          statusClass = "warning";
        } else if (g.status === "sending") {
          icon = "🚀";
          statusClass = "active";
        } else if (g.status === "waiting_delay") {
          icon = "⏱️";
          statusClass = "info";
        }

        // Show delay if waiting
        let extraText = "";
        if (g.status === "waiting_delay") {
          extraText = " (Waiting safe delay...)";
        }

        return `
            <div class="log-item ${statusClass}">
                <span class="log-icon">${icon}</span>
                <span class="log-name">${g.group_name || "Unknown Group"}</span>
                <span class="log-status">${g.status}${extraText}</span>
            </div>
        `;
      })
      .join("");
  }

  complete(message) {
    clearInterval(this.checkInterval);
    this.checkInterval = null;
    this.activeMessageId = null;

    // Show done state
    const title = this.container.querySelector(".progress-title h3");
    title.textContent = "Sending Complete";
    this.container.querySelector(".spinner-sm").remove();

    // Auto hide after 5s
    setTimeout(() => {
      this.hide();
    }, 8000);
  }

  show() {
    if (this.container) {
      this.container.classList.remove("hidden");
      // Also ensure the compose tab is visible if we want (optional)
      // document.querySelector('[data-tab="compose"]').click();
    }
    this.isWidgetVisible = true;
  }

  hide() {
    if (this.container) {
      this.container.innerHTML = ""; // Clear content to "hide"
    }
    this.isWidgetVisible = false;
  }
}

export const progressWidget = new ProgressWidget();
