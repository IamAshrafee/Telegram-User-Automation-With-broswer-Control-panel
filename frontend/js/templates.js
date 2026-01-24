import { api } from "./api.js";
import { showToast } from "./ui-components.js";

let templates = [];
let draftSaveTimer = null;

/**
 * Load all saved templates from the backend
 */
export async function loadTemplates() {
  try {
    templates = await api.get("/templates/");
    renderTemplateDropdown();
  } catch (error) {
    console.error("Error loading templates:", error);
  }
}

/**
 * Render the templates into the sidebar dropdown
 */
function renderTemplateDropdown() {
  const select = document.getElementById("loadTemplateSelect");
  if (!select) return;

  // Reset dropdown with placeholder
  select.innerHTML = '<option value="">📋 Load Template...</option>';

  templates.forEach((template) => {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = `${template.name}${template.category ? ` (${template.category})` : ""}`;
    select.appendChild(option);
  });
}

/**
 * Save current composer state as a new template
 */
export async function saveTemplate() {
  const messageText = document.getElementById("messageText").value.trim();
  const messageLink = document.getElementById("messageLink").value.trim();
  const messageMedia = document.getElementById("messageMedia").value;

  if (!messageText) {
    showToast("Please enter message text before saving template", "error");
    return;
  }

  const name = prompt("Enter template name:");
  if (!name) return;

  const category = prompt(
    "Enter category (optional, e.g., Marketing, Announcement):",
  );

  try {
    await api.post("/templates/", {
      name: name,
      text: messageText,
      link: messageLink || null,
      media_id: messageMedia ? parseInt(messageMedia) : null,
      category: category || null,
    });

    showToast(`Template "${name}" saved successfully!`, "success");
    await loadTemplates();
  } catch (error) {
    showToast("Failed to save template: " + error.message, "error");
  }
}

/**
 * Load a specific template into the composer
 */
export async function loadTemplate(templateId) {
  try {
    const template = await api.get(`/templates/${templateId}`);

    // Fill form fields
    const textEl = document.getElementById("messageText");
    const linkEl = document.getElementById("messageLink");
    const mediaEl = document.getElementById("messageMedia");

    if (textEl) textEl.value = template.text;
    if (linkEl) linkEl.value = template.link || "";
    if (mediaEl) mediaEl.value = template.media_id || "";

    // Update character counter
    const charCount = document.getElementById("charCount");
    if (charCount) charCount.textContent = template.text.length;

    // Update media selection status text and preview
    if (template.media_id) {
      const btn = document.getElementById("selectMessageMedia");
      if (btn) btn.textContent = `Image #${template.media_id} selected`;

      const previewContainer = document.getElementById("messageMediaPreview");
      const previewImg = previewContainer?.querySelector("img");
      const clearBtn = document.getElementById("clearMessageMedia");

      if (previewContainer && previewImg) {
        const token = localStorage.getItem("access_token");
        const authQuery = token ? `?token=${token}` : "";
        // Assuming template object doesn't have url, we construct it: /media/{id}
        // Actually template object from backend might not have url if it's just a template record. 
        // We typically need the Media object.
        // But for draft, we have media_id.
        // We can try to guess the URL or we might need to fetch media details?
        // Wait, normally we select from the gallery which gives us the URL.
        // If we just have ID, we can try /api/media/{id} which serves the file directly (as per my previous fix!)
        
        previewImg.src = `${api.API_BASE}/media/${template.media_id}${authQuery}`;
        previewContainer.style.display = "block";
        if (clearBtn) clearBtn.style.display = "block";
      }
    } else {
      const btn = document.getElementById("selectMessageMedia");
      if (btn) btn.textContent = "🖼️ Select Image";
      
      const previewContainer = document.getElementById("messageMediaPreview");
      const clearBtn = document.getElementById("clearMessageMedia");
      if (previewContainer) previewContainer.style.display = "none";
      if (clearBtn) clearBtn.style.display = "none";
    }

    showToast(`Template "${template.name}" loaded`, "success");
  } catch (error) {
    showToast("Failed to load template: " + error.message, "error");
  }
}

/**
 * Save current work-in-progress as a draft
 */
/**
 * Save current work-in-progress as a draft
 */
export function autoSaveDraft() {
  const messageText = document.getElementById("messageText")?.value;
  const messageLink = document.getElementById("messageLink")?.value;
  const messageMedia = document.getElementById("messageMedia")?.value;
  const bulkSendCheck = document.getElementById("bulkSendCheck");
  const bulkPermission = document.getElementById("messageBulkPermission");

  // Show discard button if we have content
  const discardBtn = document.getElementById("discardDraftBtn");
  if (discardBtn) {
      discardBtn.style.display = (messageText || messageLink || messageMedia) ? "inline-block" : "none";
  }

  // Only auto-save if something is present
  if (!messageText && !messageLink && !messageMedia) return Promise.resolve();

  const draftData = {
    text: messageText || null,
    link: messageLink || null,
    media_id: messageMedia ? parseInt(messageMedia) : null,
    bulk_send: bulkSendCheck && bulkSendCheck.checked ? 1 : 0,
    bulk_permission: bulkPermission ? bulkPermission.value : null,
  };

  return api
    .post("/templates/draft", draftData)
    .then(() => {
      const indicator = document.getElementById("draftIndicator");
      if (indicator) {
        indicator.style.display = "inline";
        setTimeout(() => {
          indicator.style.display = "none";
        }, 2000);
      }
    })
    .catch((error) => console.warn("[Draft] Auto-save failed:", error.message));
}

/**
 * Discard current draft
 */
export async function discardDraft() {
   if(!confirm("Discard current draft? This cannot be undone.")) return;
   
   try {
       await api.delete("/templates/draft");
       
       // Clear inputs
       document.getElementById("messageText").value = "";
       document.getElementById("messageLink").value = "";
       document.getElementById("messageMedia").value = "";
       
       const preview = document.getElementById("messageMediaPreview");
       if (preview) preview.style.display = "none";
 
       const selectBtn = document.getElementById("selectMessageMedia");
       if (selectBtn) selectBtn.textContent = "🖼️ Select Image";
       
       const clearBtn = document.getElementById("clearMessageMedia");
       if (clearBtn) clearBtn.style.display = "none";
       
       const discardBtn = document.getElementById("discardDraftBtn");
       if (discardBtn) discardBtn.style.display = "none";
       
       showToast("Draft discarded", "success");
   } catch (error) {
       showToast("Failed to discard draft: " + error.message, "error");
   }
}

/**
 * Restore previous session's draft
 */
export async function loadDraft() {
  try {
    const draft = await api.request("/templates/draft", { silent: true });
    
    // Show discard button/hide it
    const discardBtn = document.getElementById("discardDraftBtn");
    if (discardBtn) {
        discardBtn.style.display = draft ? "inline-block" : "none";
    }

    if (!draft) return;

    if (draft.text) document.getElementById("messageText").value = draft.text;
    if (draft.link) document.getElementById("messageLink").value = draft.link;
    if (draft.media_id) {
      document.getElementById("messageMedia").value = draft.media_id;
      const btn = document.getElementById("selectMessageMedia");
      if (btn) btn.textContent = `Image #${draft.media_id} (Restored)`;

      // Restore Preview
      const previewContainer = document.getElementById("messageMediaPreview");
      const previewImg = previewContainer?.querySelector("img");
      const clearBtn = document.getElementById("clearMessageMedia");

      if (previewContainer && previewImg) {
        const token = localStorage.getItem("access_token");
        const authQuery = token ? `?token=${token}` : "";
        previewImg.src = `${api.API_BASE}/media/${draft.media_id}${authQuery}`;
        previewContainer.style.display = "block";
        if (clearBtn) clearBtn.style.display = "block";
      }
    }

    // Restore bulk session state
    const bulkSendCheck = document.getElementById("bulkSendCheck");
    if (bulkSendCheck && draft.bulk_send) {
      bulkSendCheck.checked = true;
      bulkSendCheck.dispatchEvent(new Event("change"));

      if (draft.bulk_permission) {
        document.getElementById("messageBulkPermission").value =
          draft.bulk_permission;
      }
    }
  } catch (error) {
    // No draft or network error during silent fetch is acceptable
  }
}

/**
 * Initialize listeners for the template system
 */
export function setupTemplates() {
  loadTemplates();
  loadDraft();

  const saveBtn = document.getElementById("saveTemplateBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", saveTemplate);
  }

  const loadSelect = document.getElementById("loadTemplateSelect");
  if (loadSelect) {
    loadSelect.addEventListener("change", (e) => {
      if (e.target.value) {
        loadTemplate(parseInt(e.target.value));
        e.target.value = "";
      }
    });
  }

  const saveDraftBtn = document.getElementById("saveDraftBtn");
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener("click", async () => {
      const originalText = saveDraftBtn.innerHTML;
      saveDraftBtn.disabled = true;
      saveDraftBtn.innerHTML = "💾 Saving...";
      
      await autoSaveDraft();
      showToast("Draft saved successfully", "success");
      
      setTimeout(() => {
          saveDraftBtn.disabled = false;
          saveDraftBtn.innerHTML = originalText;
      }, 500);
    });
  }
  
  const discardDraftBtn = document.getElementById("discardDraftBtn");
  if (discardDraftBtn) {
      discardDraftBtn.addEventListener("click", discardDraft);
  }

  // Setup auto-save listener
  const messageText = document.getElementById("messageText");
  if (messageText) {
    messageText.addEventListener("input", () => {
      clearTimeout(draftSaveTimer);
      draftSaveTimer = setTimeout(autoSaveDraft, 30000);
      
      // Show discard button as soon as user types
      const discardBtn = document.getElementById("discardDraftBtn");
      if (discardBtn && messageText.value.trim().length > 0) {
          discardBtn.style.display = "inline-block";
      }
    });
  }
}
