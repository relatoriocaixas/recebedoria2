// script.js
import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ----------------------------------------------------------------------
// ELEMENTOS PRINCIPAIS
// ----------------------------------------------------------------------
const sidebar = document.getElementById('sidebar');
const logoutBtn = document.getElementById('logoutBtn');
const changePassBtn = document.getElementById('changePassBtn');
const sidebarBadge = document.getElementById('sidebarBadge');
const frame = document.getElementById('mainFrame');
const iframeContainer = document.getElementById('iframeContainer');
const avisosSection = document.getElementById('avisosSection');
const dataVigenteSpan = document.getElementById('dataVigente');

// ----------------------------------------------------------------------
// ROTAS
// ----------------------------------------------------------------------
const ROUTES = {
  home: null,
  abastecimento: "sistemas/abastecimento/index.html",
  emprestimo: "sistemas/emprestimo/index.html",
  relatorios: "sistemas/emprestimo/emprestimocartao-main/relatorio.html",
  diferencas: "sistemas/diferencas/index.html",
  escala: "sistemas/escala/escala.html",
  funcionario: "sistemas/funcionario/index.html",
  suporte: "sistemas/suporte/index.html",
  pesquisa: "sistemas/cartoes/index.html"
};

// ----------------------------------------------------------------------
// LOADING OVERLAY
// ----------------------------------------------------------------------
const loadingOverlay = document.createElement("div");
loadingOverlay.id = "loadingOverlay";
loadingOverlay.innerHTML = `<div class="spinner"></div><div>Carregando...</div>`;
document.body.appendChild(loadingOverlay);

function showLoading() { loadingOverlay.style.display = "flex"; }
function hideLoading() { loadingOverlay.style.display = "none"; }

// ----------------------------------------------------------------------
// AJUSTE DE LAYOUT
// ----------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const topbar = document.querySelector(".topbar");
  if (topbar) topbar.style.height = "15px";

  iframeContainer.style.height = "calc(100vh - 32px)";
  iframeContainer.style.top = "0";
  frame.style.height = "calc(100vh - 32px)";
});

// ----------------------------------------------------------------------
// NAVEGAÇÃO
// ----------------------------------------------------------------------
function goHome() {
  iframeContainer.classList.remove("full");
  iframeContainer.style.display = "none";
  avisosSection.style.display = "block";
  sidebar.style.display = "flex";
}

async function openRoute(route) {
  const src = ROUTES[route];
  if (!src) { goHome(); return; }

  showLoading();
  avisosSection.style.display = "none";
  iframeContainer.style.display = "block";
  iframeContainer.classList.add("full");

  frame.onload = async () => {
    await sendAuthToIframe();
    ajustarAlturaIframe(frame);

    const user = auth.currentUser;
    if (user) {
      const snap = await getDoc(doc(db, "users", user.uid));
      const isAdmin = snap.exists() ? snap.data().admin === true : false;

      if (!isAdmin && route === "escala") {
        frame.contentWindow.postMessage({ type: "aumentarBadges" }, "*");
      }
    }

    hideLoading();
  };

  frame.src = src;
}

// Sidebar items dinâmicos (Escala, Funcionário, Suporte, Pesquisa)
["escala", "funcionario", "suporte", "pesquisa"].forEach((route) => {
  const li = document.createElement("li");
  li.dataset.target = route;
  li.innerHTML =
    route === "escala" ? "📅 <span class='label'>Escala</span>" :
    route === "funcionario" ? "👤 <span class='label'>Funcionário</span>" :
    route === "suporte" ? "☎️ <span class='label'>Suporte</span>" :
    "🔍 <span class='label'>Pesquisa</span>";

  sidebar.querySelector("ul").appendChild(li);
  li.addEventListener("click", () => openRoute(route));
});

// Sidebar existente
document.querySelectorAll(".sidebar li").forEach((li) => {
  li.addEventListener("click", () => {
    const t = li.dataset.target;
    if (t === "home") goHome();
    else openRoute(t);
  });
});

// ----------------------------------------------------------------------
// DATA DO DIA
// ----------------------------------------------------------------------
if (dataVigenteSpan) {
  const hoje = new Date();
  dataVigenteSpan.textContent =
    hoje.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ----------------------------------------------------------------------
// GARANTE QUE O USUÁRIO EXISTE NO FIRESTORE
// ----------------------------------------------------------------------
async function ensureUserInFirestore(user) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const matricula = (user.email || "").split("@")[0] || "";

  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || "",
      matricula,
      nome: user.displayName || matricula,
      admin: false,
      createdAt: new Date()
    });
  }

  const final = await getDoc(userRef);
  const data = final.data();
  return { matricula: data.matricula, isAdmin: data.admin };
}

// ----------------------------------------------------------------------
// AUTENTICAÇÃO — VERSÃO CORRIGIDA (SEM LOOP / SEM REDIRECT PREMATURO)
// ----------------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    showLoading();

    await user.getIdToken(true);

    const { matricula, isAdmin } = await ensureUserInFirestore(user);

    sidebar.classList.remove("hidden");

    sidebarBadge.textContent = matricula;
    sidebar.addEventListener("mouseenter", () => {
      sidebarBadge.textContent = `${user.displayName || "Usuário"} • ${matricula}`;
    });
    sidebar.addEventListener("mouseleave", () => {
      sidebarBadge.textContent = matricula;
    });

    if (!isAdmin) {
      document.querySelectorAll(".adminOnly").forEach(b => (b.style.display = "none"));
    }

    await sendAuthToIframe();

    goHome();
    hideLoading();

    console.log("✅ Usuário autenticado:", matricula, "| Admin:", isAdmin);
  } catch (err) {
    console.error("🔥 Erro ao validar sessão:", err);
    await signOut(auth);
    window.location.href = "login.html";
  }
});

// ----------------------------------------------------------------------
// ENVIA TOKEN PARA O IFRAME
// ----------------------------------------------------------------------
async function sendAuthToIframe() {
  const user = auth.currentUser;
  if (!user) return;

  const snap = await getDoc(doc(db, "users", user.uid));
  const isAdmin = snap.exists() ? snap.data().admin === true : false;
  const matricula = (user.email || "").split("@")[0];

  frame.contentWindow.postMessage(
    {
      type: "syncAuth",
      usuario: {
        matricula,
        email: user.email || "",
        nome: user.displayName || ""
      },
      admin: isAdmin
    },
    "*"
  );
}

// ----------------------------------------------------------------------
// LOGOUT
// ----------------------------------------------------------------------
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}

// ----------------------------------------------------------------------
// AJUSTE AUTOMÁTICO DE ALTURA DO IFRAME
// ----------------------------------------------------------------------
function ajustarAlturaIframe(iframe) {
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    if (!doc) return;
    iframe.style.height = doc.body.scrollHeight + "px";
  } catch {}
}

new MutationObserver((m) => {
  if (m[0].attributeName === "src") ajustarAlturaIframe(frame);
}).observe(frame, { attributes: true });

// ----------------------------------------------------------------------
// ALTERAR SENHA
// ----------------------------------------------------------------------
if (changePassBtn) {
  changePassBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return alert("Usuário não autenticado.");

    const nova = prompt("Digite a nova senha (mínimo 6 caracteres):");
    if (!nova || nova.length < 6) return alert("Senha inválida.");

    try {
      await updatePassword(user, nova);
      alert("Senha alterada com sucesso.");
    } catch (err) {
      if (err.code === "auth/requires-recent-login") {
        alert("Você precisa fazer login novamente.");
        await signOut(auth);
        window.location.href = "login.html";
      } else {
        alert("Erro ao alterar senha.");
      }
    }
  });
}
