// ======================================================
// CORREÇÃO IMPORTANTE:
// - Define BASE antes de qualquer uso, e de forma segura.
// - Mantém tudo igual ao seu comportamento anterior.
// ======================================================

// Define BASE primeiro (para evitar ReferenceError)
const BASE = "https://relatoriocaixas.github.io/recebedoria2";

// ======================================================
// IMPORTS
// ======================================================
import { auth, db } from "./firebaseConfig.js";
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
// ELEMENTOS PRINCIPAIS
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
// ROTAS (usando BASE já definida)
// ======================================================
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
// LOADING OVERLAY
// ======================================================
const loadingOverlay = document.createElement('div');
loadingOverlay.id = 'loadingOverlay';
loadingOverlay.style.cssText =
  "position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:9999;background:rgba(0,0,0,0.45);color:#fff;font-size:1.1rem;";
loadingOverlay.innerHTML = `
  <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
    <div class="spinner" style="width:40px;height:40px;border:4px solid rgba(255,255,255,0.15);border-top-color:#fff;border-radius:50%;animation:spin 1s linear infinite"></div>
    <div>Carregando...</div>
  </div>`;
document.body.appendChild(loadingOverlay);
const styleSpin = document.createElement('style');
styleSpin.textContent = `@keyframes spin{to{transform:rotate(360deg)}}`;
document.head.appendChild(styleSpin);
function showLoading() { loadingOverlay.style.display = 'flex'; }
function hideLoading() { loadingOverlay.style.display = 'none'; }

// ======================================================
// VISUAL
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
  const topbar = document.querySelector(".topbar");
  if (topbar) topbar.style.height = "32px";
  if (iframeContainer) iframeContainer.style.height = "calc(100vh - 32px)";
  if (frame) frame.style.height = "calc(100vh - 32px)";
});

// ======================================================
// NAVEGAÇÃO / IFRAME
// ======================================================
function goHome() {
  iframeContainer?.classList.remove('full');
  iframeContainer.style.display = 'none';
  avisosSection.style.display = 'block';
  sidebar.style.display = 'flex';
}

function openRoute(route) {
  const src = ROUTES[route];
  if (!src) { goHome(); return; }

  showLoading();
  avisosSection.style.display = 'none';
  iframeContainer.style.display = 'block';
  iframeContainer.classList.add('full');

  frame.onload = async () => {
    await waitForIframeReady(frame, 3000);
    await sendAuthToIframe();
    ajustarAlturaIframe(frame);

    try {
      const user = auth.currentUser;
      if (user && route === "escala") {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const isAdmin = userSnap.exists() ? userSnap.data().admin === true : false;
        if (!isAdmin && frame.contentWindow) {
          frame.contentWindow.postMessage({ type: "aumentarBadges" }, "*");
        }
      }
    } catch (e) { console.warn("Erro ao checar admin/escala:", e); }

    hideLoading();
  };

  frame.src = src;
}

function waitForIframeReady(iframe, timeout = 3000) {
  const start = Date.now();
  return new Promise((resolve) => {
    (function loop() {
      try {
        if (iframe && iframe.contentWindow) {
          try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            if (doc && (doc.readyState === "complete" || doc.readyState === "interactive")) {
              return resolve(true);
            }
          } catch (e) { return resolve(true); }
        }
      } catch { }
      if (Date.now() - start > timeout) return resolve(false);
      setTimeout(loop, 120);
    })();
  });
}

// ======================================================
// MENU
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

document.querySelectorAll('.sidebar li').forEach(li => {
  li.addEventListener('click', () => {
    const t = li.dataset.target;
    if (t === 'home') goHome();
    else openRoute(t);
  });
});

if (dataVigenteSpan) {
  const hoje = new Date();
  dataVigenteSpan.textContent = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
}

// ======================================================
// FIRESTORE
// ======================================================
async function ensureUserInFirestore(user) {
  try {
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
  } catch (e) {
    console.error("Erro ensureUserInFirestore:", e);
    throw e;
  }
}

// ======================================================
// AUTH LISTENER
// ======================================================
let initialized = false;
onAuthStateChanged(auth, async (user) => {
  showLoading();

  if (!user) {
    hideLoading();
    window.location.href = "login.html";
    return;
  }

  if (initialized) {
    try { await sendAuthToIframe(); } catch { }
    hideLoading();
    return;
  }
  initialized = true;

  try {
    const { matricula, isAdmin } = await ensureUserInFirestore(user);

    sidebar?.classList.remove('hidden');
    sidebarBadge.textContent = matricula;

    sidebar?.addEventListener('mouseenter', () => {
      sidebarBadge.textContent = (user.displayName || 'Usuário') + ' • ' + matricula;
    });
    sidebar?.addEventListener('mouseleave', () => {
      sidebarBadge.textContent = matricula;
    });

    if (!isAdmin) document.querySelectorAll('.adminOnly').forEach(b => b.style.display = "none");

    await sendAuthToIframe();
    goHome();

    hideLoading();
    console.log(`Usuário autenticado: ${matricula} | Admin: ${isAdmin}`);
  } catch (err) {
    console.error("Erro no init after auth:", err);
    hideLoading();
  }
});

// ======================================================
// AUTH SYNC COM IFRAMES
// ======================================================
async function sendAuthToIframe(retries = 5, interval = 250) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const snap = await getDoc(doc(db, "users", user.uid));
    const isAdmin = snap.exists() ? snap.data().admin === true : false;

    const payload = {
      type: "syncAuth",
      usuario: { matricula: user.email.split("@")[0], email: user.email, nome: user.displayName || "" },
      admin: isAdmin
    };

    for (let i = 0; i < retries; i++) {
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage(payload, "*");
        return true;
      }
      await new Promise(r => setTimeout(r, interval));
    }
    console.warn("Não foi possível postar auth ao iframe após tentativas.");
  } catch (e) {
    console.error("Erro sendAuthToIframe:", e);
  }
}

// ======================================================
// LOGOUT
// ======================================================
logoutBtn?.addEventListener('click', async () => {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (e) {
    console.error("Erro ao deslogar:", e);
    alert("Falha ao deslogar, tente novamente.");
  }
});

// ======================================================
// AJUSTE ALTURA IFRAME
// ======================================================
function ajustarAlturaIframe(iframe) {
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    if (!doc) return;
    iframe.style.height = doc.body.scrollHeight + "px";
  } catch { }
}
new MutationObserver(m => {
  for (const x of m) {
    if (x.type === "attributes" && x.attributeName === "src") ajustarAlturaIframe(frame);
  }
}).observe(frame, { attributes: true });

// ======================================================
// ALTERAR SENHA
// ======================================================
changePassBtn?.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return alert("Usuário não autenticado!");

  const newPass = prompt("Nova senha (mínimo 6 dígitos):");
  if (!newPass || newPass.length < 6) return alert("Senha inválida.");

  try {
    await updatePassword(user, newPass);
    alert("Senha alterada.");
  } catch (e) {
    console.error("Erro alterar senha:", e);
    if (e.code === "auth/requires-recent-login") {
      alert("Faça login novamente para alterar a senha.");
      await signOut(auth);
      window.location.href = "login.html";
    } else {
      alert("Erro ao alterar senha: " + (e.message || e));
    }
  }
});
