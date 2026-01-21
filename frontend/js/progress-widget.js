import { api } from "./api.js";
import { formatDate } from "./utils.js";

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

    // Target the embedded container first (this is inside the Compose tab in index.html)
    const container = document.getElementById("embedded-progress-container");
    if (!container) {
      console.warn(
        "[Progress] Embedded progress container not found, falling back to body",
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
            <!-- Log items appear here -->
        </div>
      </div>
    `;

    if (container) {
      container.innerHTML = "";
      container.appendChild(div);
      container.style.display = "block";
    } else {
      document.body.appendChild(div);
    }

    this.container = div;

    // Minimize toggle
    const body = div.querySelector(".progress-body");
    const toggleBtn = div.querySelector("#minimizeProgressBtn");

    if (toggleBtn) {
      toggleBtn.onclick = () => {
        const isHidden = body.classList.contains("hidden");
        if (isHidden) {
          body.classList.remove("hidden");
          toggleBtn.textContent = "_";
        } else {
          body.classList.add("hidden");
          toggleBtn.textContent = "□";
        }
      };
    }
  }

  async checkForActiveJobs() {
    try {
      const activeJobs = await api.get("/messages/active");
      if (activeJobs && activeJobs.length > 0) {
        // Track the most recent active job
        this.startTracking(activeJobs[0].id);
      }
    } catch (e) {
      console.error("[Progress] Failed to poll active jobs:", e.message);
    }
  }

  startTracking(messageId) {
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.activeMessageId = messageId;
    this.show();

    // Kick off status polling
    this.updateStatus();
    this.checkInterval = setInterval(
      () => this.updateStatus(),
      this.pollInterval,
    );
  }

  async updateStatus() {
    if (!this.activeMessageId) return;

    try {
      const message = await api.get(`/messages/${this.activeMessageId}/status`);
      this.renderProgress(message);

      // Halt tracking if state is terminal
      if (message.status === "sent" || message.status === "failed") {
        this.complete(message);
      }
    } catch (e) {
      console.error("[Progress] Status fetch error:", e.message);
    }
  }

  renderProgress(message) {
    const processed = message.processed_count || 0;
    const total = message.total_count || 0;
    const groups = message.group_status || {};

    const sortedGroups = Object.values(groups).sort((a, b) => {
      return new Date(b.updated_at) - new Date(a.updated_at);
    });

    let success = 0;
    let failed = 0;

    Object.values(groups).forEach((g) => {
      if (g.status === "sent") success++;
      if (g.status === "failed" || g.status === "skipped") failed++;
    });

    const countEl = document.getElementById("progress-count");
    const successEl = document.getElementById("progress-success");
    const failedEl = document.getElementById("progress-failed");
    const fillEl = document.getElementById("progress-bar-fill");

    if (countEl) countEl.textContent = `${processed}/${total}`;
    if (successEl) successEl.textContent = success;
    if (failedEl) failedEl.textContent = failed;

    const percent = total > 0 ? (processed / total) * 100 : 0;
    if (fillEl) fillEl.style.width = `${percent}%`;

    const logContainer = document.getElementById("progress-log");
    if (logContainer) {
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

          let extraText =
            g.status === "waiting_delay" ? " (Waiting safe delay...)" : "";

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
  }

  complete(message) {
    clearInterval(this.checkInterval);
    this.checkInterval = null;
    this.activeMessageId = null;

    const title = this.container?.querySelector(".progress-title h3");
    if (title) title.textContent = "Sending Complete";

    const spinner = this.container?.querySelector(".spinner-sm");
    if (spinner) spinner.remove();

    // Keep visible for a few seconds so user sees final stats
    setTimeout(() => this.hide(), 8000);
  }

  show() {
    if (this.container) {
      this.container.classList.remove("hidden");
    }
    this.isWidgetVisible = true;
  }

  hide() {
    if (this.container) {
      this.container.classList.add("hidden");
    }
    this.isWidgetVisible = false;
  }
}

export const progressWidget = new ProgressWidget();
