/* Supabase connected enhancement: save uploads to a central database. */

let supabaseClient = null;
try {
  const supabaseUrl = 'https://npcsghmmdunnzmnptbci.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wY3NnaG1tZHVubnptbnB0YmNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MjI2OTcsImV4cCI6MjA5MzM5ODY5N30.EF-RHKa62c7QAasigDD-moNOT2pst1tAbmejDDtGoJw';
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
  } else {
    console.error("Supabase script not loaded!");
    alert("Warning: Database script failed to load. Please make sure you are connected to the internet.");
  }
} catch (e) {
  console.error(e);
}

const IMAGE_MAX_DIM = 900; // px
const IMAGE_QUALITY = 0.82; // JPEG quality

let revealObserver = null;
let myDeviceId = null;
try {
  myDeviceId = localStorage.getItem('ssc_device_id');
  if (!myDeviceId) {
    myDeviceId = uid();
    localStorage.setItem('ssc_device_id', myDeviceId);
  }
} catch (e) {
  console.error("localStorage error:", e);
  myDeviceId = uid(); // fallback
}

function getDialog(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  return typeof el.showModal === 'function' ? el : null;
}

function openDialog(id) {
  const d = getDialog(id);
  if (!d) {
      alert("Your browser does not support dialogs. Please update your browser.");
      return;
  }
  d.showModal();
}

function closeDialog(id) {
  const d = getDialog(id);
  if (!d) return;
  d.close();
}

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image."));
    };
    img.src = url;
  });
}

function imageFileToCompressedBlob(file, { maxDim, quality }) {
  return new Promise(async (resolve, reject) => {
    if (!file) {
      reject(new Error("No file selected"));
      return;
    }

    try {
      const img = await loadImageFromFile(file);
      const w = img.naturalWidth || img.width || 1;
      const h = img.naturalHeight || img.height || 1;
      const scale = Math.min(1, maxDim / Math.max(w, h));

      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));

      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported in this browser."));
        return;
      }

      ctx.drawImage(img, 0, 0, cw, ch);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not compress image."));
      }, "image/jpeg", quality);
    } catch (e) {
      reject(new Error("Could not process image. Try another photo."));
    }
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createFriendCard(friend) {
  const id = escapeHtml(friend.id);
  const name = escapeHtml(friend.name || "Friend");
  const roll = escapeHtml(friend.roll || "—");
  const nickRaw = String(friend.nick || "").trim();
  const nick = escapeHtml(nickRaw);
  const quoteRaw = String(friend.quote || "").trim();
  const quote = escapeHtml(quoteRaw);
  
  let tagsRaw = [];
  if (Array.isArray(friend.tags)) {
      tagsRaw = friend.tags;
  } else if (typeof friend.tags === 'string') {
      try { tagsRaw = JSON.parse(friend.tags); } catch { tagsRaw = [friend.tags]; }
  }

  const tags = tagsRaw.map((t) => String(t || "").trim()).filter(Boolean).slice(0, 6);
  const image = String(friend.image_url || friend.imageDataUrl || "");

  const article = document.createElement("article");
  article.className = "friend friend--saved";
  article.id = `friend-${id}`;
  article.setAttribute("data-photo", image);
  article.setAttribute("data-name", String(friend.name || "").trim());
  article.setAttribute("data-roll", String(friend.roll || "").trim());
  
  const canDelete = friend.device_id === myDeviceId;

  article.innerHTML = `
    <div class="friend__photo friend__photo--custom" role="img" aria-label="Friend photo"></div>
    <div class="friend__body">
      <div class="friend__header">
        <div>
          <div class="friend__name">${name}</div>
          ${nickRaw ? `<div class="friend__nick">(${nick})</div>` : ''}
        </div>
        ${canDelete ? `<button class="remove-btn" type="button" data-remove-friend="${id}">Remove</button>` : ''}
      </div>
      <div class="friend__meta">Roll No: ${roll}</div>
      ${quoteRaw ? `<p class="friend__quote">“${quote.replace(/^“|”$/g, "")}”</p>` : ``}
      ${tags.length ? `<div class="tags" aria-label="Highlights">${tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>` : ``}
    </div>
  `;

  const photo = article.querySelector(".friend__photo--custom");
  if (photo && image) {
    photo.style.backgroundImage = `url("${image}")`;
    photo.style.backgroundSize = "cover";
    photo.style.backgroundPosition = "center";
  }

  return article;
}

function extractUrlFromBackgroundImage(bg) {
  const m = String(bg || "").match(/url\((['"]?)(.*?)\1\)/i);
  return m ? m[2] : "";
}

function initPhotoViewer() {
  const img = document.getElementById("viewerImg");
  const title = document.getElementById("viewerTitle");
  const sub = document.getElementById("viewerSub");
  if (!img || !title || !sub) return;

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    const cardEl = t.closest?.(".friend, .memory");
    if (!cardEl) return;
    
    if (t.closest?.("[data-remove-friend], [data-remove-memory]")) return;

    let src = "";
    let titleText = "";
    let subText = "";

    if (cardEl.classList.contains("friend")) {
      const photoData = cardEl.getAttribute("data-photo") || "";
      const name = (cardEl.getAttribute("data-name") || "").trim();
      const roll = (cardEl.getAttribute("data-roll") || "").trim();

      src = photoData;
      if (!src) {
        const photoBox = cardEl.querySelector(".friend__photo");
        const bg = photoBox ? getComputedStyle(photoBox).backgroundImage : "";
        src = extractUrlFromBackgroundImage(bg);
      }
      titleText = name ? name : "Photo";
      subText = roll ? `Roll No: ${roll}` : "";
    } else if (cardEl.classList.contains("memory")) {
      const photoBox = cardEl.querySelector(".memory__photo");
      if (!photoBox) return; // no photo to view
      
      const bg = photoBox.style.backgroundImage;
      src = extractUrlFromBackgroundImage(bg);
      
      const h3 = cardEl.querySelector("h3");
      const byEl = cardEl.querySelector(".memory__by");
      
      titleText = h3 ? h3.textContent : "Memory Photo";
      subText = byEl ? byEl.textContent : "";
    }

    if (!src || src === 'none') return;

    img.src = src;
    title.textContent = titleText;
    sub.textContent = subText;
    openDialog("photoViewer");
  });
}

function createMemoryCard(memory) {
  const id = escapeHtml(memory.id);
  const title = escapeHtml(memory.title || "Memory");
  const text = escapeHtml(memory.text || "");
  const by = escapeHtml(memory.by_name || memory.by || "Someone");
  const image = String(memory.image_url || memory.imageDataUrl || "");
  
  const canDelete = memory.device_id === myDeviceId;

  const article = document.createElement("article");
  article.className = "memory memory--saved";
  article.id = `memory-${id}`;
  
  const colors = ["memory--a", "memory--b", "memory--c", "memory--d"];
  if (!image) {
    const index = id.charCodeAt(0) % colors.length;
    article.classList.add(colors[index] || "memory--a");
  }

  article.innerHTML = `
    ${image ? `<div class="memory__photo" aria-hidden="true" style="background-image: url('${image}')"></div>` : ''}
    <div class="memory__header">
      <h3>${title}</h3>
      ${canDelete ? `<button class="remove-btn" type="button" data-remove-memory="${id}">Remove</button>` : ''}
    </div>
    <p>${text}</p>
    <div class="memory__by">— ${by}</div>
  `;

  return article;
}

async function renderFriends() {
  const listEl = document.getElementById("friendsList");
  const plusBtn = document.getElementById("openAddFriend");
  if (!listEl || !plusBtn) return;

  listEl.querySelectorAll(".friend--saved").forEach((n) => n.remove());

  if (!supabaseClient) return;

  try {
    const { data: friends, error } = await supabaseClient.from('ssc_friends').select('*');
    if (error) {
      console.error("Error fetching friends:", error);
      return;
    }

    const sortedFriends = (friends || []).slice().sort((a, b) => {
      const ar = parseInt(String(a?.roll ?? ""), 10);
      const br = parseInt(String(b?.roll ?? ""), 10);
      const an = Number.isFinite(ar) ? ar : Number.POSITIVE_INFINITY;
      const bn = Number.isFinite(br) ? br : Number.POSITIVE_INFINITY;
      if (an !== bn) return an - bn;
      return (a?.created_at || 0) - (b?.created_at || 0);
    });

    sortedFriends.forEach((f) => {
      const card = createFriendCard(f);
      listEl.insertBefore(card, plusBtn);
    });

    applyReveal(listEl);
  } catch (e) {
    console.error("renderFriends error", e);
  }
}

async function renderMemories() {
  const listEl = document.getElementById("memoriesList");
  const plusBtn = document.getElementById("openAddMemory");
  if (!listEl || !plusBtn) return;

  listEl.querySelectorAll(".memory--saved").forEach((n) => n.remove());

  if (!supabaseClient) return;

  try {
    const { data: memories, error } = await supabaseClient.from('ssc_memories').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error("Error fetching memories:", error);
      return;
    }

    (memories || []).forEach((m) => {
      const card = createMemoryCard(m);
      listEl.insertBefore(card, plusBtn);
    });

    applyReveal(listEl);
  } catch (e) {
    console.error("renderMemories error", e);
  }
}

function initRevealObserver() {
  if (revealObserver) return;

  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const el = entry.target;
        if (entry.isIntersecting) {
          el.classList.add("is-visible");
          revealObserver?.unobserve(el);
        }
      });
    },
    { root: null, threshold: 0.18 }
  );
}

function applyReveal(container) {
  initRevealObserver();
  const items = container.querySelectorAll(".friend, .memory");
  items.forEach((el) => {
    if (!el.classList.contains("reveal")) {
      el.classList.add("reveal", "float-on-view");
      revealObserver?.observe(el);
    }
  });
}

async function uploadImageToSupabase(blob, folder) {
  if (!supabaseClient) throw new Error("Database not connected");
  const fileName = `${folder}/${uid()}.jpg`;
  const { data, error } = await supabaseClient.storage.from('ssc_images').upload(fileName, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  
  const { data: { publicUrl } } = supabaseClient.storage.from('ssc_images').getPublicUrl(fileName);
  return publicUrl;
}

function initFriendForm() {
  const form = document.getElementById("addFriendForm");
  const fileInput = document.getElementById("friendPhoto");
  const preview = document.getElementById("friendPreviewBox");
  if (!form || !fileInput || !preview) return;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const objectUrl = URL.createObjectURL(file);
      preview.style.backgroundImage = `url("${objectUrl}")`;
      preview.classList.add("upload-preview--has");
    } catch (e) {
      alert(e?.message || "Could not preview image.");
      fileInput.value = "";
      preview.style.backgroundImage = "";
      preview.classList.remove("upload-preview--has");
    }
  });
  
  form.addEventListener("reset", () => {
    preview.style.backgroundImage = "";
    preview.classList.remove("upload-preview--has");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabaseClient) {
      alert("Database is not connected. Cannot save.");
      return;
    }
    
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Saving...";

    try {
      const fd = new FormData(form);
      const file = fileInput.files?.[0];
      if (!file) throw new Error("Please select a photo.");

      const blob = await imageFileToCompressedBlob(file, {
        maxDim: IMAGE_MAX_DIM,
        quality: IMAGE_QUALITY,
      });

      const imageUrl = await uploadImageToSupabase(blob, 'friends');

      const tags = String(fd.get("tags") || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 8);

      const friend = {
        id: uid(),
        name: String(fd.get("name") || "").trim(),
        roll: String(fd.get("roll") || "").trim(),
        nick: String(fd.get("nick") || "").trim(),
        quote: String(fd.get("quote") || "").trim(),
        tags,
        image_url: imageUrl,
        device_id: myDeviceId,
        created_at: Date.now(),
      };

      const { error } = await supabaseClient.from('ssc_friends').insert([friend]);
      if (error) throw error;

      form.reset();
      closeDialog("friendModal");
      
      // Re-fetch
      await renderFriends();
    } catch (err) {
      alert(err?.message || "Could not save friend.");
      console.error(err);
    } finally {
      btn.disabled = false;
      btn.textContent = "Save";
    }
  });
}

function initMemoryForm() {
  const form = document.getElementById("addMemoryForm");
  const fileInput = document.getElementById("memoryPhoto");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabaseClient) {
      alert("Database is not connected. Cannot save.");
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Saving...";

    try {
      const fd = new FormData(form);
      const file = fileInput?.files?.[0];
      
      let imageUrl = null;
      if (file) {
        const blob = await imageFileToCompressedBlob(file, {
          maxDim: IMAGE_MAX_DIM,
          quality: IMAGE_QUALITY,
        });
        imageUrl = await uploadImageToSupabase(blob, 'memories');
      }

      const memory = {
        id: uid(),
        title: String(fd.get("title") || "").trim(),
        text: String(fd.get("text") || "").trim(),
        by_name: String(fd.get("by") || "").trim(),
        image_url: imageUrl,
        device_id: myDeviceId,
        created_at: Date.now(),
      };

      const { error } = await supabaseClient.from('ssc_memories').insert([memory]);
      if (error) throw error;

      form.reset();
      closeDialog("memoryModal");
      
      await renderMemories();
    } catch (err) {
      alert(err?.message || "Could not save memory.");
      console.error(err);
    } finally {
      btn.disabled = false;
      btn.textContent = "Save";
    }
  });
}

function initRemoveHandlers() {
  document.addEventListener("click", async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    const friendId = t.getAttribute("data-remove-friend");
    if (friendId) {
      if (!confirm("Delete this friend entry?")) return;
      if (!supabaseClient) return;
      try {
          await supabaseClient.from('ssc_friends').delete().eq('id', friendId).eq('device_id', myDeviceId);
          await renderFriends();
      } catch (err) {
          alert("Could not delete.");
      }
      return;
    }

    const memoryId = t.getAttribute("data-remove-memory");
    if (memoryId) {
      if (!confirm("Delete this memory?")) return;
      if (!supabaseClient) return;
      try {
          await supabaseClient.from('ssc_memories').delete().eq('id', memoryId).eq('device_id', myDeviceId);
          await renderMemories();
      } catch (err) {
          alert("Could not delete.");
      }
      return;
    }
  });
}

function initModals() {
  const openFriend = document.getElementById("openAddFriend");
  const openMemory = document.getElementById("openAddMemory");

  openFriend?.addEventListener("click", () => openDialog("friendModal"));
  openMemory?.addEventListener("click", () => openDialog("memoryModal"));

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const closeId = t.getAttribute("data-close-modal");
    if (closeId) closeDialog(closeId);
  });

  ["friendModal", "memoryModal"].forEach((id) => {
    const d = getDialog(id);
    if (!d) return;
    d.addEventListener("click", (e) => {
      const rect = d.getBoundingClientRect();
      const within =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (e.target === d && within) d.close();
    });
  });
}

function init() {
  try {
    initModals(); // Initialize modals FIRST so they work even if DB fails
    initFriendForm();
    initMemoryForm();
    initRemoveHandlers();
    initPhotoViewer();
    
    // Then render data
    renderFriends();
    renderMemories();
  } catch (e) {
    console.error("Initialization error:", e);
  }
}

document.addEventListener("DOMContentLoaded", init);
