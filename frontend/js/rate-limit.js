import { api } from "./api.js";

let rateLimitInterval = null;

// Load rate limit status
export async function loadRateLimitStatus() {
  try {
    const status = await api.get("/admin/rate-limit-status");
    renderRateLimitWidget(status);
  } catch (error) {
    console.error("Error loading rate limit status:", error);
  }
}

// Render rate limit widget
function renderRateLimitWidget(status) {
  const widget = document.getElementById("rateLimitWidget");
  if (!widget) return;

  const percentage = status.percentage_used;

  // Determine color based on usage
  let color, statusText, statusIcon;
  if (percentage >= 90) {
    color = "#ef4444"; // Red
    statusText = "Critical";
    statusIcon = "🔴";
  } else if (percentage >= 70) {
    color = "#f59e0b"; // Orange
    statusText = "Warning";
    statusIcon = "🟡";
  } else {
    color = "#10b981"; // Green
    statusText = "Healthy";
    statusIcon = "🟢";
  }

  // Format reset time
  const resetDate = new Date(status.reset_at);
  const now = new Date();
  const diffMs = resetDate - now;

  let resetText = "Soon";
  if (diffMs > 0) {
    const hoursUntilReset = Math.floor(diffMs / (1000 * 60 * 60));
    const minutesUntilReset = Math.floor(
      (diffMs % (1000 * 60 * 60)) / (1000 * 60),
    );
    resetText = `${hoursUntilReset}h ${minutesUntilReset}m`;
  }

  widget.innerHTML = `
    <div class="rate-limit-widget">
      <div class="rate-limit-header">
        <div>
          <span class="rate-limit-title">📊 Daily Message Limit</span>
          <span class="rate-limit-status" style="color: ${color};">${statusIcon} ${statusText}</span>
        </div>
        <div class="rate-limit-count">
          <span class="sent-count">${status.sent_today}</span>
          <span class="limit-separator">/</span>
          <span class="total-limit">${status.daily_limit}</span>
        </div>
      </div>
      
      <div class="progress-bar-container">
        <div class="progress-bar-fill" style="width: ${percentage}%; background: ${color};"></div>
        <div class="progress-percentage" style="min-width: 40px; text-align: center;">${percentage.toFixed(0)}%</div>
      </div>
      
      <div class="rate-limit-footer">
        <div class="remaining-messages">
          <span class="label">Remaining</span>
          <span class="value">${status.remaining}</span>
        </div>
        <div class="reset-time">
          <span class="label">Resets In</span>
          <span class="value">${resetText}</span>
        </div>
      </div>
    </div>
  `;
}

// Start auto-refresh (every 30 seconds)
export function startRateLimitMonitoring() {
  // Load immediately
  loadRateLimitStatus();

  // Refresh every 30 seconds
  if (rateLimitInterval) {
    clearInterval(rateLimitInterval);
  }
  rateLimitInterval = setInterval(loadRateLimitStatus, 30000);
}

// Stop auto-refresh
export function stopRateLimitMonitoring() {
  if (rateLimitInterval) {
    clearInterval(rateLimitInterval);
    rateLimitInterval = null;
  }
}
