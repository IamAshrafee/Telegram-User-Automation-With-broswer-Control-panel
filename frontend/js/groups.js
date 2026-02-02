import { api } from "./api.js";
import { showToast } from "./ui-components.js";
import { formatDate } from "./utils.js";

let allGroups = [];
let currentPage = 1;
let totalPages = 1;
let isPageLoading = false;
let currentFilters = {
  q: "",
  sort_by: "title",
  sort_order: "asc",
  permission_type: "",
  is_active: "",
};
const pageSize = 20;

export function setupGroups() {
  const syncGroupsBtn = document.getElementById("syncGroupsBtn");
  const groupSearch = document.getElementById("groupSearch");
  const sortBy = document.getElementById("sortBy");
  const permissionFilter = document.getElementById("permissionFilter");
  const activeOnlyFilter = document.getElementById("activeOnlyFilter");
  const selectAllGroups = document.getElementById("selectAllGroups");
  const groupsList = document.getElementById("groupsList");
  const loadMoreBtnContainer = document.getElementById("groupsLoadMore");

  if (syncGroupsBtn) {
    syncGroupsBtn.addEventListener("click", async () => {
      try {
        syncGroupsBtn.disabled = true;
        syncGroupsBtn.textContent = "Syncing...";
        const response = await api.post("/groups/sync");
        showToast(
          `Synced ${response.synced_count} groups successfully!`,
          "success",
        );
        // Reset and reload
        await loadGroups(1, false);
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        syncGroupsBtn.disabled = false;
        syncGroupsBtn.innerHTML = "🔄 Sync from Telegram";
      }
    });
  }

  // Debounce Search
  let searchTimeout;
  if (groupSearch) {
    groupSearch.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentFilters.q = e.target.value.trim();
        loadGroups(1, false);
      }, 300);
    });
  }

  // Filters & Sorting
  if (sortBy) {
    sortBy.addEventListener("change", (e) => {
      const [field, order] = e.target.value.split("-");
      currentFilters.sort_by = field;
      currentFilters.sort_order = order;
      loadGroups(1, false);
    });
  }

  if (permissionFilter) {
    permissionFilter.addEventListener("change", (e) => {
      currentFilters.permission_type = e.target.value;
      loadGroups(1, false);
    });
  }

  if (activeOnlyFilter) {
    activeOnlyFilter.addEventListener("change", (e) => {
      // Backend expects boolean or null (if filter not active)
      // The checkbox UI implies "Active Only" (true) or "All" (null/false depending on implementation)
      // Our API: is_active=true filters active. is_active=false filters inactive. is_active=null shows all.
      // Usually "Active Only" toggle means: Checked -> Active, Unchecked -> All.
      // So if unchecked, we send "" (mapped to null in API logic if empty string) or just don't send it.
      currentFilters.is_active = e.target.checked ? "true" : "";
      loadGroups(1, false);
    });
  }

  // Bulk selectors
  if (selectAllGroups) {
    selectAllGroups.addEventListener("change", (e) => {
      const checkboxes = document.querySelectorAll(".group-checkbox");
      checkboxes.forEach((cb) => (cb.checked = e.target.checked));
      updateSelectedCount();
    });
  }

  // Bulk actions
  const bulkActivateBtn = document.getElementById("bulkActivateBtn");
  const bulkDeactivateBtn = document.getElementById("bulkDeactivateBtn");
  const bulkPermission = document.getElementById("bulkPermission");

  if (bulkActivateBtn) {
    bulkActivateBtn.addEventListener("click", () =>
      handleBulkAction("activate"),
    );
  }
  if (bulkDeactivateBtn) {
    bulkDeactivateBtn.addEventListener("click", () =>
      handleBulkAction("deactivate"),
    );
  }
  if (bulkPermission) {
    bulkPermission.addEventListener("change", (e) => {
      if (e.target.value) handleBulkAction("permission", e.target.value);
    });
  }

  // Analytics Toggle
  const toggleAnalyticsBtn = document.getElementById("toggleAnalyticsBtn");
  const analyticsSection = document.getElementById("groupAnalytics");

  if (toggleAnalyticsBtn && analyticsSection) {
    toggleAnalyticsBtn.addEventListener("click", () => {
      const isHidden = analyticsSection.style.display === "none";
      analyticsSection.style.display = isHidden ? "block" : "none";
      toggleAnalyticsBtn.textContent = isHidden
        ? "📊 Hide Analytics"
        : "📊 Show Analytics";
      if (isHidden) updateAnalytics();
    });
  }

  const refreshAnalyticsBtn = document.getElementById("refreshAnalyticsBtn");
  if (refreshAnalyticsBtn)
    refreshAnalyticsBtn.addEventListener("click", updateAnalytics);

  // --- Event Delegation for Groups List ---
  if (groupsList) {
    groupsList.addEventListener("change", (e) => {
      const target = e.target;
      // Toggle Group Status
      if (target.matches(".group-toggle-input")) {
        const id = parseInt(target.dataset.id);
        toggleGroup(id, target.checked);
      }
      // Update Permission
      if (target.matches(".permission-select")) {
        const id = parseInt(target.dataset.id);
        updatePermission(id, target.value);
      }
      // Bulk Checkbox
      if (target.matches(".group-checkbox")) {
        updateSelectedCount();
      }
    });

    groupsList.addEventListener("click", (e) => {
      const target = e.target;
      // Delete Group
      if (target.closest(".delete-group-btn")) {
        const btn = target.closest(".delete-group-btn");
        const id = parseInt(btn.dataset.id);
        deleteGroup(id);
      }
      // Stop propagation for checkboxes
      if (target.matches(".group-checkbox")) {
        e.stopPropagation();
      }
    });
  }
}

/**
 * Load Groups with Pagination
 */
export async function loadGroups(page = 1, append = false) {
  if (isPageLoading) return;
  isPageLoading = true;

  try {
    // Construct Query Params
    const params = new URLSearchParams({
      page: page,
      limit: pageSize,
      sort_by: currentFilters.sort_by,
      sort_order: currentFilters.sort_order,
    });

    if (currentFilters.q) params.append("q", currentFilters.q);
    if (currentFilters.permission_type)
      params.append("permission_type", currentFilters.permission_type);
    if (currentFilters.is_active === "true") params.append("is_active", "true");
    // If is_active is empty/false, we don't send it to show all

    const response = await api.get(`/groups/?${params.toString()}`);

    const items = response.items || [];
    currentPage = response.page;
    totalPages = response.pages;

    if (append) {
      allGroups = [...allGroups, ...items];
    } else {
      allGroups = items;
    }

    renderGroups(items, append);
    renderLoadMore();
    updateDashboardStats(response.total); // Total from DB

    // Update selectors for message composer (fetch separate or use first page?)
    // Note: Ideally, composer should have its own search.
    // For now we assume typical user has all relevant active groups in first few pages or uses bulk.
    // If we only render loaded groups, we might miss some.
    // A better approach for composer selector: use a search input there that querying API.
    // We will stick to rendering what we have or implement a separate "load all active" for composer later.
    renderGroupSelectors();
  } catch (error) {
    console.error("Failed to load groups:", error);
    showToast("Failed to load groups", "error");
  } finally {
    isPageLoading = false;
  }
}

function renderLoadMore() {
  let container = document.getElementById("groupsLoadMore");

  // Create if missing (it wasn't in original HTML)
  if (!container) {
    container = document.createElement("div");
    container.id = "groupsLoadMore";
    container.className = "load-more-container mt-4 text-center";
    document.getElementById("groupsList")?.after(container);
  }

  if (currentPage >= totalPages || totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <button id="loadMoreGroupsBtn" class="btn btn-secondary shadow-sm">
      <span class="btn-text">Load More Groups</span>
      <div class="spinner-sm hidden" style="margin-left: 8px;"></div>
    </button>
  `;

  const btn = document.getElementById("loadMoreGroupsBtn");
  const spinner = btn?.querySelector(".spinner-sm");

  btn.onclick = async () => {
    btn.disabled = true;
    spinner?.classList.remove("hidden");
    await loadGroups(currentPage + 1, true);
  };
}

function updateDashboardStats(totalCount) {
  const totalGroups = document.getElementById("totalGroups");
  // Active count needs a separate API call if we want it perfect,
  // or we accept we only know total from pagination metadata.
  // The API response.total is total filtered records.
  // If no filter, it is total db records.

  if (totalGroups) totalGroups.textContent = totalCount;

  // NOTE: 'activeGroups' count on dashboard might be misleading if we don't fetch it specifically.
  // We can't count from 'allGroups' since it is partial.
  // For now, we leave it or fetch analytics to get correct counts.
  updateAnalyticsCounts();
}

async function updateAnalyticsCounts() {
  // Fetch overview only for dashboard stats
  try {
    const analytics = await api.get("/groups/analytics");
    const activeGroupsCount = document.getElementById("activeGroups");
    if (activeGroupsCount)
      activeGroupsCount.textContent = analytics.overview.active_groups;
  } catch (e) {
    // silent fail
  }
}

function renderGroups(groups, append = false) {
  const groupsList = document.getElementById("groupsList");
  if (!groupsList) return;

  if (!append) {
    groupsList.innerHTML = "";
  }

  if (groups.length === 0 && !append) {
    groupsList.innerHTML =
      '<div class="empty-state"><p>No groups found.</p></div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  const searchTerm = currentFilters.q.toLowerCase();

  groups.forEach((group, index) => {
    const card = document.createElement("div");
    card.className = `group-card ${group.is_active ? "active" : ""}`;
    // Stagger animation only for new batch
    card.style.animationDelay = `${(index % pageSize) * 0.05}s`;

    // Highlight logic
    const titleContainer = document.createElement("h3");
    titleContainer.className = "ml-2";

    if (searchTerm) {
      const parts = group.title.split(new RegExp(`(${searchTerm})`, "gi"));
      parts.forEach((part) => {
        if (part.toLowerCase() === searchTerm) {
          const highlight = document.createElement("span");
          highlight.className = "highlight";
          highlight.textContent = part;
          titleContainer.appendChild(highlight);
        } else {
          titleContainer.appendChild(document.createTextNode(part));
        }
      });
    } else {
      titleContainer.textContent = group.title;
    }

    // 🎨 ENHANCED BADGES - Organized by Priority
    let badgesHtml = "";

    // PRIORITY 1: Security Warnings (CRITICAL - Show first!)
    if (group.is_scam) {
      badgesHtml += `<span class="badge badge-danger badge-pulse" title="⚠️ Flagged as Scam by Telegram">🚨 SCAM</span>`;
    }
    if (group.is_fake) {
      badgesHtml += `<span class="badge badge-danger badge-pulse" title="⚠️ Flagged as Fake/Impersonator">⚠️ FAKE</span>`;
    }

    // PRIORITY 2: Admin Status
    if (group.is_admin) {
      badgesHtml += `<span class="badge badge-gold" title="You are an Admin">👑 Admin</span>`;
    }

    // PRIORITY 3: Activity Indicators
    if (group.slow_mode_delay > 0) {
      badgesHtml += `<span class="badge badge-info" title="Slow Mode: ${group.slow_mode_delay}s delay between messages">⏳ ${group.slow_mode_delay}s</span>`;
    }
    if (group.unread_count > 0) {
      badgesHtml += `<span class="badge badge-primary" title="${group.unread_count} Unread Messages">💬 ${group.unread_count}</span>`;
    }

    // 🔐 PERMISSION GRID - Visual representation of all 5 permissions
    const permissionGrid = `
      <div class="permission-grid" title="What you can send in this group">
        <div class="permission-item ${group.can_send_messages ? 'allowed' : 'restricted'}">
          <span class="perm-icon">${group.can_send_messages ? '✅' : '❌'}</span>
          <span class="perm-label">Msg</span>
        </div>
        <div class="permission-item ${group.can_send_media ? 'allowed' : 'restricted'}">
          <span class="perm-icon">${group.can_send_media ? '✅' : '❌'}</span>
          <span class="perm-label">Media</span>
        </div>
        <div class="permission-item ${group.can_embed_links ? 'allowed' : 'restricted'}">
          <span class="perm-icon">${group.can_embed_links ? '✅' : '❌'}</span>
          <span class="perm-label">Links</span>
        </div>
        <div class="permission-item ${group.can_send_polls ? 'allowed' : 'restricted'}">
          <span class="perm-icon">${group.can_send_polls ? '✅' : '❌'}</span>
          <span class="perm-label">Polls</span>
        </div>
        <div class="permission-item ${group.can_send_stickers ? 'allowed' : 'restricted'}">
          <span class="perm-icon">${group.can_send_stickers ? '✅' : '❌'}</span>
          <span class="perm-label">Sticker</span>
        </div>
      </div>
    `;

    // Member Count Formatting
    const memberCount = group.member_count
      ? new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(group.member_count)
      : "Unknown";

    // 📸 Group Photo Avatar
    // For now, using emoji placeholder - in future, can fetch actual Telegram photo
    const hasPhoto = group.has_photo || false;
    const avatarHtml = hasPhoto
      ? `<div class="group-avatar" title="Group has profile photo">📷</div>`
      : `<div class="group-avatar placeholder" title="No profile photo">${group.title.charAt(0).toUpperCase()}</div>`;

    card.innerHTML = `
        <div class="group-header-compact">
            <div class="header-main">
                <input type="checkbox" class="group-checkbox" data-id="${group.id}">
                ${avatarHtml}
                <div class="title-section">
                    <div class="title-row">
                        ${titleContainer.outerHTML}
                        <span class="member-badge" title="${group.member_count || 0} members">👥 ${memberCount}</span>
                    </div>
                    ${group.username ? `<a href="https://t.me/${group.username}" target="_blank" class="username-link">@${group.username}</a>` : ''}
                </div>
            </div>
            <div class="group-status">
                <label class="switch switch-sm">
                    <input type="checkbox" class="group-toggle-input" data-id="${group.id}" ${group.is_active ? "checked" : ""}>
                    <span class="slider round"></span>
                </label>
            </div>
        </div>

        <div class="badges-row">
            <span class="badge badge-permission badge-${group.permission_type}">${group.permission_type.replace("_", " ")}</span>
            ${badgesHtml}
        </div>

        ${permissionGrid}

        <div class="group-stats-compact">
             <div class="stat-pill" title="Messages Sent">
                <span class="icon">💬</span> ${group.messages_sent || 0}
            </div>
             <div class="stat-pill ${group.success_rate < 80 ? 'text-danger' : 'text-success'}" title="Success Rate">
                <span class="icon">✅</span> ${group.success_rate || 0}%
            </div>
             <div class="stat-pill text-muted" title="Added Date">
                <span class="icon">📅</span> ${new Date(group.created_at).toLocaleDateString()}
            </div>
        </div>

        <div class="group-actions-compact">
             <select class="form-control form-control-xs permission-select" data-id="${group.id}">
                <option value="all" ${group.permission_type === "all" ? "selected" : ""}>✅ All Content</option>
                <option value="text_only" ${group.permission_type === "text_only" ? "selected" : ""}>💬 Text Only</option>
                <option value="text_link" ${group.permission_type === "text_link" ? "selected" : ""}>🔗 Text + Link</option>
                <option value="text_image" ${group.permission_type === "text_image" ? "selected" : ""}>🖼️ Text + Image</option>
                <option value="text_link_image" ${group.permission_type === "text_link_image" ? "selected" : ""}>🎯 Text + Link + Image</option>
            </select>

            <button class="btn-icon delete-group-btn" data-id="${group.id}" title="Remove Group">🗑️</button>
        </div>
    `;

    // No longer appending titleContainer manually since we used outerHTML above
    // card.querySelector(".group-header .d-flex").appendChild(titleContainer);
    fragment.appendChild(card);
  });

  groupsList.appendChild(fragment);
}

function updateSelectedCount() {
  const selected = document.querySelectorAll(".group-checkbox:checked").length;
  const badge = document.getElementById("selectedCount");
  const dropdown = document.getElementById("bulkActionsDropdown");
  if (badge) badge.textContent = selected;
  if (dropdown) dropdown.style.display = selected > 0 ? "flex" : "none";
}

async function handleBulkAction(action, value = null) {
  const selectedIds = Array.from(
    document.querySelectorAll(".group-checkbox:checked"),
  ).map((cb) => parseInt(cb.dataset.id));
  if (selectedIds.length === 0) return;

  try {
    const payload = {
      group_ids: selectedIds,
      update_data: {},
    };

    if (action === "activate") payload.update_data.is_active = true;
    else if (action === "deactivate") payload.update_data.is_active = false;
    else if (action === "permission")
      payload.update_data.permission_type = value;

    await api.post("/groups/bulk-update", payload);
    showToast(`Bulk ${action} successful!`, "success");
    await loadGroups(1, false); // Reload first page
    const selectAll = document.getElementById("selectAllGroups");
    if (selectAll) selectAll.checked = false;
  } catch (error) {
    showToast(error.message, "error");
  }
}

// Internal functions
const toggleGroup = async (id, isActive) => {
  try {
    await api.patch(`/groups/${id}`, { is_active: isActive });
  } catch (error) {
    showToast(error.message, "error");
    // Revert visual change if failed is tricky without React, just reload
    await loadGroups(currentPage, false);
  }
};

const updatePermission = async (id, type) => {
  try {
    await api.patch(`/groups/${id}`, { permission_type: type });
    showToast("Permission updated", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
};

const deleteGroup = async (id) => {
  if (!confirm("Are you sure you want to remove this group?")) return;
  try {
    await api.delete(`/groups/${id}`);
    showToast("Group removed", "success");
    await loadGroups(currentPage, false);
  } catch (error) {
    showToast(error.message, "error");
  }
};

async function updateAnalytics() {
  try {
    const analytics = await api.get("/groups/analytics");
    renderAnalytics(analytics);
  } catch (error) {
    console.error("Failed to load analytics:", error);
  }
}

function renderAnalytics(data) {
  const overview = data.overview || {};
  const totalSpan = document.getElementById("analyticsTotalMessages");
  const rateSpan = document.getElementById("analyticsSuccessRate");
  const failedSpan = document.getElementById("analyticsFailed");

  if (totalSpan)
    totalSpan.textContent =
      (overview.total_messages_sent || 0) +
      (overview.total_messages_failed || 0);
  if (rateSpan)
    rateSpan.textContent = `${Math.round(overview.overall_success_rate || 0)}%`;
  if (failedSpan) failedSpan.textContent = overview.total_messages_failed || 0;

  renderRankedList("topGroupsList", data.top_groups || [], "success_rate", "%");
  renderRankedList(
    "problemGroupsList",
    data.problem_groups || [],
    "total_attempts",
  );
  renderRankedList(
    "inactiveGroupsList",
    data.inactive_groups || [],
    "last_message_at",
    "date",
  );
}

function renderRankedList(id, items, valueKey, unit = "") {
  const container = document.getElementById(id);
  if (!container) return;
  if (items.length === 0) {
    container.innerHTML = '<p class="text-sm text-muted">No data available</p>';
    return;
  }

  container.innerHTML = "";
  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "ranked-item";

    let val = item[valueKey];
    if (unit === "%") val = Math.round(val);
    else if (unit === "date") {
      val = val ? new Date(val).toLocaleDateString() : "Never";
    }

    const titleSpan = document.createElement("span");
    titleSpan.className = "ranked-title";
    titleSpan.textContent = item.title;

    const valueSpan = document.createElement("span");
    valueSpan.className = "ranked-value";
    valueSpan.textContent = `${val}${unit !== "date" ? unit : ""}`;

    div.appendChild(titleSpan);
    div.appendChild(valueSpan);
    fragment.appendChild(div);
  });

  container.appendChild(fragment);
}

export async function renderGroupSelectors() {
  const selector = document.getElementById("groupSelector");
  if (!selector) return;

  try {
    // Fetch all active groups specifically for the selector
    const activeGroups = await api.get("/groups/all");

    if (activeGroups.length === 0) {
      selector.innerHTML = '<p class="text-muted">No active groups found.</p>';
      return;
    }

    selector.innerHTML = "";

    activeGroups.forEach((group) => {
      const label = document.createElement("label");
      label.className = "group-select-item";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "target_groups";
      input.value = group.id;

      const spanTitle = document.createElement("span");
      spanTitle.textContent = group.title;

      const smallPerm = document.createElement("small");
      smallPerm.textContent = group.permission_type;

      label.appendChild(input);
      label.appendChild(spanTitle);
      label.appendChild(smallPerm);

      selector.appendChild(label);
    });
  } catch (error) {
    console.error("Failed to load group selectors:", error);
    selector.innerHTML = '<p class="text-danger">Failed to load groups.</p>';
  }
}
