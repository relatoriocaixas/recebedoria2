// ======================================================
// ✅ IMPORTAÇÕES — usando firebaseConfig original
// ======================================================
import { auth, db } from "./firebaseConfig_v2.js";
import {
  onAuthStateChanged,
  signOut,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ======================================================
// ✅ ELEMENTOS PRINCIPAIS
// ======================================================
const sidebar = document.getElementById('sidebar');
const logoutBtn = document.getElementById('logoutBtn');
const changePassBtn = document.getElementById('changePassBtn');
const sidebarBadge = document.getElementById('sidebarBadge');
const frame = document.getElementById('mainFrame');
const iframeContainer = document.getElementById('iframeContainer');
const avisosSection = document.getElementById('avisosSection');
const dataVigenteSpan = document.getElementById('dataVigente');

// ======================================================
// ✅ ROTAS ABSOLUTAS (corrige logout e reload)
// ======================================================
// GitHub Pages exige rotas 100% absolutas
const BASE = "https://relatoriocaixas.github.io/recebedoria2";

const ROUTES = {
  home: null,
  abastecimento: `${BASE}/sistemas/abastecimento/index.html`,
  emprestimo: `${BASE}/sistemas/emprestimo/index.html`,
  relatorios: `${BASE}/sistemas/emprestimo/emprestimocartao-main/relatorio.html`,
  diferencas: `${BASE}/sistemas/diferencas/index.html`,
  escala: `${BASE}/sistemas/escala/escala.html`,
  funcionario: `${BASE}/sistemas/funcionario/index.html`,
  suporte: `${BASE}/sistemas/suporte/index.html`,
  pesquisa: `${BASE}/sistemas/cartoes/index.html`,
};

// ======================================================
// ✅ LOADING OVERLAY
// ======================================================
const loadingOverlay = document.createElement('div');
loadingOverlay.id = 'loadingOverlay';
loadingOverlay.innerHTML = `<div class="spinner"></div><div>Carregando...</div>`;
document.body.appendChild(loadingOverlay);

function showLoading() { loadingOverlay.style.display = 'flex'; }
function hideLoading() { loadingOverlay.style.display = 'none'; }

// ======================================================
// ✅ AJUSTE VISUAL DO IFRAme
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
  const topbar = document.querySelector(".topbar");
  if (topbar) topbar.style.height = "32px";

  iframeContainer.style.height = "calc(100vh - 32px)";
  iframeContainer.style.top = "0";
  frame.style.height = "calc(100vh - 32px)";
});

// ======================================================
// ✅ NAVEGAÇÃO
// ======================================================
function goHome() {
  iframeContainer.classList.remove('full');
  iframeContainer.style.display = 'none';
  avisosSection.style.display = 'block';
  sidebar.style.display = 'flex';
}

function openRoute(route) {
  const src = ROUTES[route];
  if (!src) {
    goHome();
    return;
  }

  showLoading();
  avisosSection.style.display = 'none';
  iframeContainer.style.display = 'block';
  iframeContainer.classList.add('full');

  frame.onload = async () => {
    await sendAuthToIframe();
    ajustarAlturaIframe(frame);

    // Aumenta badges se for funcionário comum
    const user = auth.currentUser;
    if (user && route === "escala") {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists()) {
        const isAdmin = userSnap.data().admin === true;
        if (!isAdmin) {
          frame.contentWindow.postMessage({ type: "aumentarBadges" }, "*");
        }
      }
    }

    hideLoading();
  };

  frame.src = src;
}

// ======================================================
// ✅ RENDERIZAÇÃO DAS ROTAS DO MENU
// ======================================================
function addRoute(label, emoji, target) {
  const li = document.createElement('li');
  li.dataset.target = target;
  li.innerHTML = `${emoji} <span class='label'>${label}</span>`;
  sidebar.querySelector('ul').appendChild(li);
  li.addEventListener('click', () => openRoute(target));
}

addRoute("Escala", "📅", "escala");
addRoute("Funcionário", "👤", "funcionario");
addRoute("Suporte", "☎️", "suporte");
addRoute("Pesquisa", "🔍", "pesquisa");

// ======================================================
// ✅ SIDEBAR NAV
// ======================================================
document.querySelectorAll('.sidebar li').forEach(li => {
  li.addEventListener('click', () => {
    const t = li.dataset.target;
    if (t === 'home') goHome();
    else openRoute(t);
  });
});

// ======================================================
// ✅ DATA NO PORTAL
// ======================================================
if (dataVigenteSpan) {
  const hoje = new Date();
  dataVigenteSpan.textContent =
    `${String(hoje.getDate()).padStart(2,'0')}/` +
    `${String(hoje.getMonth() + 1).padStart(2,'0')}/` +
    `${hoje.getFullYear()}`;
}

// ======================================================
// ✅ GARANTE USUÁRIO NO FIRESTORE
// ======================================================
async function ensureUserInFirestore(user) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  const matricula = (user.email || "").split("@")[0] ?? "";

  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      matricula,
      nome: user.displayName || matricula,
      admin: false,
      createdAt: new Date()
    });
  }

  const finalSnap = await getDoc(userRef);
  const data = finalSnap.data();
  return { matricula: data.matricula, isAdmin: data.admin };
}

// ======================================================
// ✅ ONAUTHSTATECHANGED FINAL — ESTÁVEL (sem loop)
// ======================================================
let initialized = false;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // Evita rodar duas vezes (causa logout)
  if (initialized) return;
  initialized = true;

  showLoading();

  const { matricula, isAdmin } = await ensureUserInFirestore(user);

  sidebar.classList.remove('hidden');
  sidebarBadge.textContent = matricula;

  if (!isAdmin) {
    document.querySelectorAll('.adminOnly')
      .forEach(btn => btn.style.display = "none");
  }

  await sendAuthToIframe();

  goHome();
  hideLoading();
});

// ======================================================
// ✅ ENVIA AUTH PARA O IFRAME
// ======================================================
async function sendAuthToIframe() {
  const user = auth.currentUser;
  if (!user) return;

  const snap = await getDoc(doc(db, "users", user.uid));
  const isAdmin = snap.exists() ? snap.data().admin === true : false;

  const payload = {
    type: "syncAuth",
    usuario: {
      matricula: user.email.split("@")[0],
      email: user.email,
      nome: user.displayName || ""
    },
    admin: isAdmin
  };

  frame.contentWindow.postMessage(payload, "*");
}

// ======================================================
// ✅ LOGOUT
// ======================================================
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}

// ======================================================
// ✅ AJUSTE AUTOMÁTICO DE ALTURA DO IFRAME
// ======================================================
function ajustarAlturaIframe(iframe) {
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    if (!doc) return;
    iframe.style.height = doc.body.scrollHeight + "px";
  } catch (e) {}
}

new MutationObserver(m => {
  if (m[0].attributeName === "src") ajustarAlturaIframe(frame);
}).observe(frame, { attributes: true });

// ======================================================
// ✅ ALTERAR SENHA
// ======================================================
if (changePassBtn) {
  changePassBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return alert("Usuário não autenticado!");

    const newPass = prompt("Nova senha (mínimo 6 dígitos):");
    if (!newPass || newPass.length < 6) return alert("Senha inválida.");

    try {
      await updatePassword(user, newPass);
      alert("Senha alterada.");
    } catch (e) {
      if (e.code === "auth/requires-recent-login") {
        alert("Faça login novamente para alterar a senha.");
        await signOut(auth);
        window.location.href = "login.html";
      }
    }
  });
}
