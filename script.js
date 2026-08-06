// ══════════════════════════════════════════════════════════════════
//  FIREBASE CONFIGURATION & INITIALIZATION
// ══════════════════════════════════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  deleteDoc,
  updateDoc,
  setDoc,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ══════════════════════════════════════════════════════════════════
//  GLOBAL STATE
// ══════════════════════════════════════════════════════════════════
// We keep currentUser and currentHouse in memory for UI state
window.currentUser = null;
window.currentHouse = null;
window.currentFileBase64 = null; // Hoisted for file handling

// ══════════════════════════════════════════════════════════════════
//  STARS & VISUAL EFFECTS (Unchanged)
// ══════════════════════════════════════════════════════════════════
(function initStars() {
  const c = document.getElementById("starsBg");
  for (let i = 0; i < 140; i++) {
    const s = document.createElement("div");
    s.className = "star";
    s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;width:${1 + Math.random() * 2.5}px;height:${1 + Math.random() * 2.5}px;--dur:${2 + Math.random() * 4}s;animation-delay:${Math.random() * 4}s`;
    c.appendChild(s);
  }
})();

document.addEventListener("click", function (e) {
  const r = document.createElement("div");
  r.className = "click-ripple";
  r.style.left = e.clientX + "px";
  r.style.top = e.clientY + "px";
  document.body.appendChild(r);
  const icons = ["✨", "⚡", "🌟", "💫", "✦"];
  for (let i = 0; i < 4; i++) {
    const s = document.createElement("div");
    s.className = "spell-star";
    s.textContent = icons[Math.floor(Math.random() * icons.length)];
    const dx = (Math.random() - 0.5) * 100,
      dy = -(30 + Math.random() * 60),
      rot = (Math.random() - 0.5) * 360;
    s.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;--dx:${dx}px;--dy:${dy}px;--rot:${rot}deg;animation-delay:${i * 0.05}s`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1000);
  }
  setTimeout(() => r.remove(), 700);
});

// ══════════════════════════════════════════════════════════════════
//  GLOBAL FUNCTIONS (Attached to Window for HTML access)
// ══════════════════════════════════════════════════════════════════

// LUMOS / NOX
window.castLumos = function () {
  document.body.classList.remove("nox-active");
  document.removeEventListener("mousemove", moveFlashlight);
  toast("Lumos! 💡", "success");
};

window.castNox = function () {
  document.body.classList.add("nox-active");
  document.addEventListener("mousemove", moveFlashlight);
  toast("Nox 🌑", "success");
};

function moveFlashlight(e) {
  const ol = document.getElementById("flashlight-overlay");
  ol.style.setProperty("--x", e.clientX + "px");
  ol.style.setProperty("--y", e.clientY + "px");
}

// TOAST
window.toast = function (msg, type = "success") {
  const t = document.createElement("div");
  t.className = "toast " + (type || "");
  t.textContent = (type === "success" ? "✨ " : "⚠ ") + msg;
  document.getElementById("toastContainer").appendChild(t);
  setTimeout(() => t.remove(), 1500);
};

// CONFIRM
let _confirmResolve = null;
window.confirm = function (msg) {
  return new Promise((res) => {
    _confirmResolve = res;
    document.getElementById("confirmMsg").textContent = msg;
    document.getElementById("confirmOverlay").classList.add("active");
  });
};
document.getElementById("confirmYes").onclick = () => {
  document.getElementById("confirmOverlay").classList.remove("active");
  if (_confirmResolve) _confirmResolve(true);
};
document.getElementById("confirmNo").onclick = () => {
  document.getElementById("confirmOverlay").classList.remove("active");
  if (_confirmResolve) _confirmResolve(false);
};

// NAVIGATION
window.navigateTo = function (page) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  if (page === "login") {
    document.getElementById("page-login").classList.add("active");
  } else if (page === "houses") {
    document.getElementById("page-houses").classList.add("active");
    renderHouses();
    updateOwlBadge();
  } else if (page === "house") {
    document.getElementById("page-house").classList.add("active");
    renderHouseDetail();
  } else if (page === "owls") {
    document.getElementById("page-owls").classList.add("active");
    renderOwls();
  }
};

// ══════════════════════════════════════════════════════════════════
//  AUTH (Async / Firebase)
// ══════════════════════════════════════════════════════════════════
window.switchTab = function (tab) {
  document
    .querySelectorAll(".tab-btn")
    .forEach((b, i) =>
      b.classList.toggle(
        "active",
        (tab === "login" && i === 0) || (tab === "signup" && i === 1),
      ),
    );
  document
    .getElementById("form-login")
    .classList.toggle("active", tab === "login");
  document
    .getElementById("form-signup")
    .classList.toggle("active", tab === "signup");
  document.getElementById("loginMsg").textContent = "";
};

function setLoginMsg(msg, ok) {
  const el = document.getElementById("loginMsg");
  el.textContent = msg;
  el.className = "msg " + (ok ? "ok" : "err");
}

window.doLogin = async function () {
  const user = document.getElementById("login-user").value.trim();
  const pass = document.getElementById("login-pass").value;
  if (!user || !pass) {
    setLoginMsg("Please fill all fields");
    return;
  }

  setLoginMsg("Consulting the Marauder's Map...", true);

  try {
    // Get user doc where ID = username
    const userDocRef = doc(db, "users", user);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      setLoginMsg("User not found. Sign up first!");
      return;
    }

    const userData = userSnap.data();
    if (userData.password !== pass) {
      setLoginMsg("Incorrect password.");
      return;
    }

    window.currentUser = user;
    localStorage.setItem("hps_currentUser", user); // Keep session local
    setLoginMsg("Welcome back, wizard! ✨", true);
    setTimeout(() => navigateTo("houses"), 900);
  } catch (e) {
    console.error(e);
    setLoginMsg("Magic interference (Error logging in)");
  }
};

window.doSignup = async function () {
  const user = document.getElementById("signup-user").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const pass = document.getElementById("signup-pass").value;
  const pass2 = document.getElementById("signup-pass2").value;

  if (!user || !email || !pass || !pass2) {
    setLoginMsg("Please fill all fields");
    return;
  }
  if (pass !== pass2) {
    setLoginMsg("Passwords do not match!");
    return;
  }
  if (pass.length < 4) {
    setLoginMsg("Password must be at least 4 characters");
    return;
  }
  if (/[^a-zA-Z0-9_]/.test(user)) {
    setLoginMsg("Username: letters, numbers, underscore only");
    return;
  }

  setLoginMsg("Enrolling student...", true);

  try {
    // Check if user exists
    const userDocRef = doc(db, "users", user);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      setLoginMsg("Username already taken!");
      return;
    }

    // Create user
    await setDoc(userDocRef, {
      password: pass,
      email: email,
      createdAt: Date.now(),
    });

    window.currentUser = user;
    localStorage.setItem("hps_currentUser", user);
    setLoginMsg("✨ Account created! Entering Hogwarts...", true);
    setTimeout(() => navigateTo("houses"), 900);
  } catch (e) {
    console.error(e);
    setLoginMsg("Error creating account.");
  }
};

window.doLogout = function () {
  window.currentUser = null;
  window.currentHouse = null;
  localStorage.removeItem("hps_currentUser");
  // Clear inputs
  document.getElementById("login-user").value = "";
  document.getElementById("login-pass").value = "";
  document.getElementById("signup-user").value = "";
  document.getElementById("signup-email").value = "";
  document.getElementById("signup-pass").value = "";
  document.getElementById("signup-pass2").value = "";
  document.getElementById("loginMsg").textContent = "";

  navigateTo("login");
  toast("Logged out safely.", "success");
};

// ══════════════════════════════════════════════════════════════════
//  HOUSES
// ══════════════════════════════════════════════════════════════════
const HOUSES = [
  {
    id: "gryffindor",
    name: "Gryffindor",
    img: "assets/gryffindor.png",
    domain: "Artificial Intelligence",
    trait: "Bravery & Courage",
    color: "#ae0001",
    color2: "#d63384",
    glow: "rgba(174,0,1,.6)",
  },
  {
    id: "slytherin",
    name: "Slytherin",
    img: "assets/slytherin.png",
    domain: "Cybersecurity & Defense",
    trait: "Ambition & Cunning",
    color: "#1a472a",
    color2: "#2ecc71",
    glow: "rgba(46,204,113,.5)",
  },
  {
    id: "ravenclaw",
    name: "Ravenclaw",
    img: "assets/ravenclaw.png",
    domain: "Web Development & Architectures",
    trait: "Wisdom & Creativity",
    color: "#0e1a40",
    color2: "#4a90d9",
    glow: "rgba(74,144,217,.6)",
  },
  {
    id: "hufflepuff",
    name: "Hufflepuff",
    img: "assets/hubblepuff.png",
    domain: "IoT, Hardware & Robotics",
    trait: "Loyalty & Hard Work",
    color: "#ecb939",
    color2: "#f0d060",
    glow: "rgba(236,185,57,.5)",
  },
  {
    id: "all",
    name: "Hogwarts",
    img: "assets/4Houses.png",
    domain: "Unity & Collaboration",
    trait: "United as One",
    color: "#d4af37",
    color2: "#f0d060",
    glow: "rgba(212,175,55,.6)",
  },
];

window.renderHouses = async function () {
  const g = document.getElementById("housesGrid");
  g.innerHTML = "<div class='loading-text'>Summoning Houses...</div>";

  try {
    // Fetch all projects to count them
    const snapshot = await getDocs(collection(db, "projects"));
    const projects = snapshot.docs.map((d) => d.data());

    g.innerHTML = "";
    HOUSES.forEach((h) => {
      const count =
        h.id === "all"
          ? projects.length
          : projects.filter((p) => p.house === h.id).length;

      const card = document.createElement("div");
      card.className = "house-card";
      card.style.setProperty("--hc", h.color);
      card.style.setProperty("--hc-glow", h.glow);
      card.innerHTML = `<img src="${h.img}" alt="${h.name}"><div class="hname">${h.name}</div>`;
      card.onclick = () => {
        window.currentHouse = h.id;
        navigateTo("house");
      };
      g.appendChild(card);
    });
  } catch (e) {
    console.error(e);
    g.innerHTML = "Error loading houses.";
  }
};

// ══════════════════════════════════════════════════════════════════
//  HOUSE DETAIL + BOOKS
// ══════════════════════════════════════════════════════════════════
function getHouse(id) {
  return HOUSES.find((h) => h.id === id);
}

window.renderHouseDetail = function () {
  const h = getHouse(window.currentHouse);
  if (!h) return;
  document.getElementById("hd-emoji").innerHTML =
    `<img src="${h.img}" style="width:80px; filter:drop-shadow(0 0 10px ${h.color})">`;
  document.getElementById("hd-emoji").classList.remove("emoji");
  document.getElementById("hd-name").textContent = h.name;
  document.getElementById("hd-name").style.color = h.color;
  document.getElementById("hd-domain").textContent = h.domain;
  document.querySelector(".add-project-btn").style.background =
    `linear-gradient(135deg,${h.color},${h.color2})`;

  updateOwlBadge();
  renderBooks();
};

window.renderBooks = async function () {
  const g = document.getElementById("booksGrid");
  g.innerHTML = "<div class='loading-text'>Opening Library...</div>";

  try {
    let q;
    if (window.currentHouse === "all") {
      q = query(collection(db, "projects"));
    } else {
      q = query(
        collection(db, "projects"),
        where("house", "==", window.currentHouse),
      );
    }

    const snapshot = await getDocs(q);
    const projects = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Fetch owls once to check collab status efficiently (or fetch per book - simple here)
    // For simplicity, we fetch all user's owls to check statuses
    const owlsSnap = await getDocs(
      query(collection(db, "owls"), where("from", "==", window.currentUser)),
    );
    const myOwls = owlsSnap.docs.map((d) => d.data());

    g.innerHTML = "";

    if (!projects.length) {
      g.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">📖</span>No enchanted books yet.<br/><small>Be the first to add a project!</small></div>`;
      return;
    }

    const h = getHouse(window.currentHouse);

    projects.forEach((p) => {
      const isOwner = p.owner === window.currentUser;

      // Check collab status using fetched owls
      const sentOwl = myOwls.find((o) => o.projectId === p.id);
      const collabStatus = sentOwl ? sentOwl.status : null;

      const collaborators = p.collaborators || [];
      const card = document.createElement("div");
      card.className = "book-card";

      let ownerActions = "";
      if (isOwner)
        ownerActions = `<div class="owner-actions"><button class="owner-btn" onclick="openEditProject('${p.id}')">✏ Edit</button><button class="owner-btn del" onclick="deleteProject('${p.id}')">🗑 Delete</button></div>`;

      let collabBtn = "";
      if (!isOwner) {
        if (collabStatus === "pending")
          collabBtn = `<button class="collab-btn sent" disabled>🦉 Owl Sent</button>`;
        else if (collaborators.includes(window.currentUser))
          collabBtn = `<span style="font-size:.7rem;color:#2ecc71;font-family:'Cinzel',serif">✓ Collaborator</span>`;
        else
          collabBtn = `<button class="collab-btn" onclick="openSendOwl('${p.id}')">🦉 Collaborate</button>`;
      }

      let collabList = "";
      if (collaborators.length)
        collabList = `<div class="collaborators">Collaborators: <span>${collaborators.join(", ")}</span></div>`;

      let imgHtml = "";
      if (p.image) {
        imgHtml = `<div style="height:140px; overflow:hidden; border-radius:8px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.1);"><img src="${p.image}" style="width:100%; height:100%; object-fit:cover;"></div>`;
      }

      const userPoints = p.pointAllocations
        ? p.pointAllocations[window.currentUser] || 0
        : 0;

      const posBtns = [10, 20, 50]
        .map((amt) => {
          return `<button class="point-btn" onclick="awardPoints('${p.id}', ${amt})">+${amt}</button>`;
        })
        .join("");

      const negBtns = [-10, -20]
        .map((amt) => {
          return `<button class="point-btn neg" onclick="awardPoints('${p.id}', ${amt})">${amt}</button>`;
        })
        .join("");

      card.innerHTML = `
          <div class="book-spine" style="background:linear-gradient(90deg,${h.color},${h.color2})"></div>
          <div class="book-body">
            ${imgHtml}
            <div class="book-title">${escHtml(p.name)}</div>
            <div class="book-owner">by <span>${escHtml(p.student)}</span> · <small style="color:${h.color}">${escHtml(p.owner)}</small></div>
            <div class="book-desc">${escHtml(p.description)}</div>
            <div style="font-size:0.75rem; color:#888; margin-bottom:8px;">${p.tech ? "<strong>Invocations:</strong> " + escHtml(p.tech) : ""}</div>
            ${collabList}
            <div class="book-footer">
              <div class="points-area">
                 <div class="points-label">Award Points:</div>
                 <div class="points-c">
                    ${posBtns}
                    <span style="width:1px; height:20px; background:rgba(255,255,255,0.1); margin:0 4px;"></span>
                    ${negBtns}
                 </div>
                 <div class="total-points">Total: <span>${p.votes || 0}</span> <span style="font-size:0.7em; color:#888">(You gave: ${userPoints})</span></div>
              </div>
              <div>${collabBtn}${ownerActions}</div>
            </div>
          </div>`;
      g.appendChild(card);
    });
  } catch (e) {
    console.error(e);
    g.innerHTML = "Error loading books.";
  }
};

function escHtml(s) {
  if (!s) return "";
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// ══════════════════════════════════════════════════════════════════
//  ADD / EDIT / DELETE PROJECT
// ══════════════════════════════════════════════════════════════════
const audioSuccess = new Audio("assets/shortHP.mp3");

window.handleFileSelect = function (input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    window.currentFileBase64 = e.target.result;
    const img = document.getElementById("preview-img");
    img.src = window.currentFileBase64;
    document.getElementById("file-preview").style.display = "flex";
    document.getElementById("file-label").textContent = file.name;
  };
  reader.readAsDataURL(file);
};

window.openAddProject = function () {
  document.getElementById("editProjectId").value = "";
  document.getElementById("proj-name").value = "";
  document.getElementById("proj-desc").value = "";
  document.getElementById("proj-tech").value = "";
  document.getElementById("proj-student").value = window.currentUser;
  document.getElementById("proj-house").value =
    window.currentHouse && window.currentHouse !== "all"
      ? window.currentHouse
      : "gryffindor";

  document.getElementById("proj-file").value = "";
  window.currentFileBase64 = null;
  document.getElementById("preview-img").src = "";
  document.getElementById("file-preview").style.display = "none";
  document.getElementById("file-label").textContent = "Click to Select File";

  document.getElementById("modalProjectTitle").textContent = "Use The Spell 🌟";
  document.getElementById("saveProjectBtn").textContent =
    "REVEALER INNOVATION 🪄";
  openModal("modalAddProject");
};

window.openEditProject = async function (id) {
  // Fetch fresh data
  const docRef = doc(db, "projects", id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;

  const p = { id: snap.id, ...snap.data() };
  if (p.owner !== window.currentUser) return;

  document.getElementById("editProjectId").value = id;
  document.getElementById("proj-name").value = p.name;
  document.getElementById("proj-desc").value = p.description;
  document.getElementById("proj-tech").value = p.tech || "";
  document.getElementById("proj-student").value = p.student;
  document.getElementById("proj-house").value = p.house || window.currentHouse;

  window.currentFileBase64 = p.image || null;
  if (window.currentFileBase64) {
    document.getElementById("preview-img").src = window.currentFileBase64;
    document.getElementById("file-preview").style.display = "flex";
    document.getElementById("file-label").textContent =
      "Update Snapshot (Optional)";
  } else {
    document.getElementById("preview-img").src = "";
    document.getElementById("file-preview").style.display = "none";
    document.getElementById("file-label").textContent = "Click to Select File";
  }

  document.getElementById("modalProjectTitle").textContent = "✏️ Refine Spell";
  document.getElementById("saveProjectBtn").textContent =
    "✨ Update Innovation";
  openModal("modalAddProject");
};

window.saveProject = async function () {
  const name = document.getElementById("proj-name").value.trim();
  const desc = document.getElementById("proj-desc").value.trim();
  const tech = document.getElementById("proj-tech").value.trim();
  const house = document.getElementById("proj-house").value;
  const student =
    document.getElementById("proj-student").value.trim() || window.currentUser;
  const editId = document.getElementById("editProjectId").value;

  if (!name || !desc) {
    toast("Please fill required fields (Title & Desc)", "error");
    return;
  }

  toast("Casting spell...", "success");

  try {
    if (editId) {
      // UPDATE
      const docRef = doc(db, "projects", editId);
      const updateData = {
        name,
        description: desc,
        student,
        tech,
        house,
      };
      if (window.currentFileBase64) updateData.image = window.currentFileBase64;

      await updateDoc(docRef, updateData);

      closeModal("modalAddProject");

      if (window.currentHouse !== "all" && window.currentHouse !== house) {
        window.currentHouse = house;
        renderHouseDetail();
        toast("Updated and teleported!", "success");
      } else {
        renderBooks();
        toast("Spell updated successfully!", "success");
      }
    } else {
      // CREATE
      const proj = {
        house: house || window.currentHouse,
        name,
        description: desc,
        tech,
        student,
        image: window.currentFileBase64,
        owner: window.currentUser,
        votes: 0,
        pointAllocations: {},
        collaborators: [],
        createdAt: Date.now(),
      };

      await addDoc(collection(db, "projects"), proj);

      closeModal("modalAddProject");

      if (window.currentHouse !== "all" && window.currentHouse !== house) {
        window.currentHouse = house;
        renderHouseDetail();
        toast("Portkeying to " + house + "...", "success");
      } else {
        renderBooks();
      }

      toast("Innovation Revealed! 🪄", "success");
      audioSuccess.currentTime = 0;
      audioSuccess.play().catch(() => {});
    }
  } catch (e) {
    console.error(e);
    toast("Spell failed (DB Error)", "error");
  }
};

window.deleteProject = async function (id) {
  const yes = await confirm("Delete project? This cannot be undone.");
  if (!yes) return;

  try {
    await deleteDoc(doc(db, "projects", id));

    // Cleanup owls related to this project (optional but good practice)
    const q = query(collection(db, "owls"), where("projectId", "==", id));
    const snap = await getDocs(q);
    snap.forEach(async (d) => await deleteDoc(d.ref));

    renderBooks();
    toast("Project removed from the library.", "success");
  } catch (e) {
    toast("Could not delete project", "error");
  }
};

// ══════════════════════════════════════════════════════════════════
//  POINTS SYSTEM
// ══════════════════════════════════════════════════════════════════
window.awardPoints = async function (id, amount) {
  try {
    const docRef = doc(db, "projects", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;

    const p = snap.data();
    const alloc = p.pointAllocations || {};
    const currentVal = alloc[window.currentUser] || 0;

    // Update local value
    alloc[window.currentUser] = currentVal + amount;

    // Recalculate total
    const newTotal = Object.values(alloc).reduce((a, b) => a + b, 0);

    await updateDoc(docRef, {
      pointAllocations: alloc,
      votes: newTotal,
    });

    renderBooks(); // Refresh UI
  } catch (e) {
    toast("Points spell fizzled out", "error");
  }
};

// ══════════════════════════════════════════════════════════════════
//  OWL (COLLABORATION) SYSTEM
// ══════════════════════════════════════════════════════════════════
window.openSendOwl = async function (projectId) {
  // We need project details
  const snap = await getDoc(doc(db, "projects", projectId));
  if (!snap.exists()) return;
  const p = snap.data();

  document.getElementById("owlProjectId").value = projectId;
  document.getElementById("owlProjectName").value = p.name;
  document.getElementById("owlOwnerName").value = p.owner;
  document.getElementById("owlMessage").value = "";
  openModal("modalSendOwl");
};

window.sendOwl = async function () {
  const projectId = document.getElementById("owlProjectId").value;
  const msg = document.getElementById("owlMessage").value.trim();
  const owner = document.getElementById("owlOwnerName").value;
  const projectName = document.getElementById("owlProjectName").value;

  try {
    // Check existing owl
    const q = query(
      collection(db, "owls"),
      where("projectId", "==", projectId),
      where("from", "==", window.currentUser),
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      toast("Owl already sent for this project", "error");
      closeModal("modalSendOwl");
      return;
    }

    await addDoc(collection(db, "owls"), {
      projectId,
      projectName,
      from: window.currentUser,
      to: owner,
      message: msg,
      status: "pending",
      createdAt: Date.now(),
    });

    closeModal("modalSendOwl");
    toast("🦉 Owl sent to " + owner + "!", "success");

    if (document.getElementById("page-house").classList.contains("active"))
      renderBooks();
  } catch (e) {
    toast("Owl got lost (Error)", "error");
  }
};

window.acceptOwl = async function (owlId) {
  try {
    const owlRef = doc(db, "owls", owlId);
    const owlSnap = await getDoc(owlRef);
    const owlData = owlSnap.data();

    // Update Owl Status
    await updateDoc(owlRef, { status: "accepted" });

    // Add to Project Collaborators
    const projRef = doc(db, "projects", owlData.projectId);
    const projSnap = await getDoc(projRef);
    if (projSnap.exists()) {
      const p = projSnap.data();
      const collaborators = p.collaborators || [];
      if (!collaborators.includes(owlData.from)) {
        collaborators.push(owlData.from);
        await updateDoc(projRef, { collaborators });
      }
    }

    renderOwls();
    toast("Collaboration accepted!", "success");
  } catch (e) {
    toast("Error accepting owl", "error");
  }
};

window.rejectOwl = async function (owlId) {
  try {
    await updateDoc(doc(db, "owls", owlId), { status: "rejected" });
    renderOwls();
    toast("Owl rejected.", "success");
  } catch (e) {
    toast("Error rejecting owl", "error");
  }
};

window.updateOwlBadge = async function () {
  if (!window.currentUser) return;
  try {
    const q = query(
      collection(db, "owls"),
      where("to", "==", window.currentUser),
      where("status", "==", "pending"),
    );
    const snap = await getDocs(q);
    const count = snap.size;

    ["owlBadge", "owlBadge2"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = count;
        el.style.display = count ? "flex" : "none";
      }
    });
  } catch (e) {
    console.log("Badge error", e);
  }
};

window.renderOwls = async function () {
  const incEl = document.getElementById("owlIncoming");
  const sentEl = document.getElementById("owlSent");

  incEl.innerHTML = "<div class='loading-text'>Waiting for owls...</div>";
  sentEl.innerHTML =
    "<div class='loading-text'>Checking dispatched owls...</div>";

  try {
    // Incoming
    const qInc = query(
      collection(db, "owls"),
      where("to", "==", window.currentUser),
    );
    const snapInc = await getDocs(qInc);
    const incoming = snapInc.docs.map((d) => ({ id: d.id, ...d.data() }));

    incEl.innerHTML = "";
    if (!incoming.length) {
      incEl.innerHTML = '<div class="owl-empty">No incoming owls</div>';
    } else {
      incoming.forEach((o) => {
        const card = document.createElement("div");
        card.className = "owl-card";
        let actionsHtml = "";
        if (o.status === "pending")
          actionsHtml = `<div class="owl-card-actions"><button class="owl-accept" onclick="acceptOwl('${o.id}')">✓ Accept</button><button class="owl-reject" onclick="rejectOwl('${o.id}')">✕ Reject</button></div>`;
        else
          actionsHtml = `<span class="owl-status ${o.status}">${o.status === "accepted" ? "✓ Accepted" : "✕ Rejected"}</span>`;
        card.innerHTML = `<div class="owl-card-title">${escHtml(o.projectName)}</div><div class="owl-card-detail"><strong>From:</strong> ${escHtml(o.from)} ${o.message ? '· "' + escHtml(o.message) + '"' : ""}</div>${actionsHtml}`;
        incEl.appendChild(card);
      });
    }

    // Sent
    const qSent = query(
      collection(db, "owls"),
      where("from", "==", window.currentUser),
    );
    const snapSent = await getDocs(qSent);
    const sent = snapSent.docs.map((d) => ({ id: d.id, ...d.data() }));

    sentEl.innerHTML = "";
    if (!sent.length) {
      sentEl.innerHTML = '<div class="owl-empty">No owls sent yet</div>';
    } else {
      sent.forEach((o) => {
        const card = document.createElement("div");
        card.className = "owl-card";
        card.innerHTML = `<div class="owl-card-title">${escHtml(o.projectName)}</div><div class="owl-card-detail"><strong>To:</strong> ${escHtml(o.to)}</div><span class="owl-status ${o.status}">${o.status.charAt(0).toUpperCase() + o.status.slice(1)}</span>`;
        sentEl.appendChild(card);
      });
    }
    updateOwlBadge();
  } catch (e) {
    console.error(e);
    incEl.innerHTML = "Error fetching owls";
  }
};

// ══════════════════════════════════════════════════════════════════
//  MODAL HELPERS
// ══════════════════════════════════════════════════════════════════
window.openModal = function (id) {
  document.getElementById(id).classList.add("active");
};
window.closeModal = function (id) {
  document.getElementById(id).classList.remove("active");
};
document.querySelectorAll(".modal-overlay").forEach((ov) => {
  ov.addEventListener("click", function (e) {
    if (e.target === ov) ov.classList.remove("active");
  });
});

// ══════════════════════════════════════════════════════════════════
//  INIT CHECK
// ══════════════════════════════════════════════════════════════════
(async function () {
  try {
    const cu = localStorage.getItem("hps_currentUser");
    if (cu) {
      // Verify user exists in DB
      const snap = await getDoc(doc(db, "users", cu));
      if (snap.exists()) {
        window.currentUser = cu;
        navigateTo("houses");
      } else {
        localStorage.removeItem("hps_currentUser");
      }
    }
  } catch (e) {
    console.error("Init Error", e);
  }
})();
