// script.js
import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// 🔹 Elementos principais
const sidebar = document.getElementById('sidebar');
const logoutBtn = document.getElementById('logoutBtn');
const changePassBtn = document.getElementById('changePassBtn');
const sidebarBadge = document.getElementById('sidebarBadge');
const frame = document.getElementById('mainFrame');
const iframeContainer = document.getElementById('iframeContainer');
const avisosSection = document.getElementById('avisosSection');
const dataVigenteSpan = document.getElementById('dataVigente');

// 🔹 Rotas
const ROUTES = {
  home: null,
  abastecimento: "sistemas/abastecimento/index.html",
  emprestimo: "sistemas/emprestimo/index.html",
  relatorios: "sistemas/emprestimo/emprestimocartao-main/relatorio.html",
  diferencas: "sistemas/diferencas/index.html",
  escala: "sistemas/escala/escala.html"
};

// 🔹 Loading overlay
const loadingOverlay = document.createElement('div');
loadingOverlay.id = 'loadingOverlay';
loadingOverlay.innerHTML = `<div class="spinner"></div><div>Carregando...</div>`;
document.body.appendChild(loadingOverlay);
function showLoading() { loadingOverlay.style.display = 'flex'; }
function hideLoading() { loadingOverlay.style.display = 'none'; }

// 🔹 Ajusta topbar e iframe
document.addEventListener("DOMContentLoaded", () => {
  const topbar = document.querySelector(".topbar");
  if (topbar) topbar.style.height = "32px"; // 🔻 diminui topbar

  // 🔻 aumenta área útil dos iframes para baixo
  iframeContainer.style.height = "calc(100vh - 32px)"; // pega quase toda a tela
  iframeContainer.style.top = "0";
  frame.style.height = "calc(100vh - 32px)";
});

// 🔹 Navegação
function goHome() {
  iframeContainer.classList.remove('full');
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
    await sendAuthToIframe();
    ajustarAlturaIframe(frame);

    // 🔹 Envia mensagem para aumentar badges apenas se for escala e funcionário
    const user = auth.currentUser;
    if (user) {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      const isAdmin = userSnap.exists() ? userSnap.data().admin===true : false;

      if (!isAdmin && route === 'escala') {
        frame.contentWindow.postMessage({ type: "aumentarBadges" }, "*");
      }
    }

    hideLoading();
  };

  frame.src = src;
}

// 🔹 Adiciona rota Escala
const escalaLi = document.createElement('li');
escalaLi.dataset.target = 'escala';
escalaLi.innerHTML = "📅 <span class='label'>Escala</span>";
sidebar.querySelector('ul').appendChild(escalaLi);
escalaLi.addEventListener('click', () => openRoute('escala'));

// 🔹 Adiciona rota Funcionário
ROUTES.funcionario = "sistemas/funcionario/index.html";

const funcionarioLi = document.createElement('li');
funcionarioLi.dataset.target = 'funcionario';
funcionarioLi.innerHTML = "👤 <span class='label'>Funcionário</span>";
sidebar.querySelector('ul').appendChild(funcionarioLi);

funcionarioLi.addEventListener('click', () => openRoute('funcionario'));

// 🔹 Adiciona rota Suporte
ROUTES.suporte = "sistemas/suporte/index.html";

const suporteLi = document.createElement('li');
suporteLi.dataset.target = 'suporte';
suporteLi.innerHTML = "☎️ <span class='label'>Suporte</span>";
sidebar.querySelector('ul').appendChild(suporteLi);

suporteLi.addEventListener('click', () => openRoute('suporte'));


// 🔹 Sidebar navigation
document.querySelectorAll('.sidebar li').forEach(li => {
  li.addEventListener('click', () => {
    const t = li.dataset.target;
    if (t === 'home') goHome();
    else openRoute(t);
  });
});

// 🔹 Atualiza data
if (dataVigenteSpan) {
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2,'0');
  const mes = String(hoje.getMonth()+1).padStart(2,'0');
  const ano = hoje.getFullYear();
  dataVigenteSpan.textContent = `${dia}/${mes}/${ano}`;
}

// ============================================================
// 🔹 Garante usuário no Firestore
// ============================================================
async function ensureUserInFirestore(user) {
  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const parts = (user.email||'').split('@');
    const matricula = parts[0]||'';

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email||'',
        matricula,
        nome: user.displayName||matricula,
        admin: false,
        createdAt: new Date()
      });
      console.log("🟢 Usuário criado com admin: false");
    } else {
      console.log("✅ Usuário já existe, mantendo admin atual");
    }

    const finalSnap = await getDoc(userRef);
    const userData = finalSnap.data();
    return { matricula: userData.matricula, isAdmin: userData.admin };

  } catch(e) {
    console.error("Erro ao salvar usuário em 'users':", e);
    throw e;
  }
}

// ============================================================
// 🔹 Autenticação e inicialização
// ============================================================
let authChecked = false;
let retryCount = 0;
const MAX_RETRIES = 3;

onAuthStateChanged(auth, async (user) => {
  showLoading();

  if (!user) {
    setTimeout(() => {
      if (!auth.currentUser && !authChecked) {
        authChecked = true;
        hideLoading();
        window.location.href = 'login.html';
      }
    }, 1000);
    return;
  }

  try {
    authChecked = true;
    const { matricula, isAdmin } = await ensureUserInFirestore(user);

    sidebar.classList.remove('hidden');
    sidebarBadge.textContent = matricula;
    sidebar.addEventListener('mouseenter', ()=> {
      sidebarBadge.textContent = (user.displayName||'Usuário') + ' • ' + matricula;
    });
    sidebar.addEventListener('mouseleave', ()=> {
      sidebarBadge.textContent = matricula;
    });

    if (!isAdmin) {
      const adminButtons = document.querySelectorAll('.adminOnly');
      adminButtons.forEach(b => b.style.display = 'none');
    }

    await sendAuthToIframe();
    goHome();
    hideLoading();

    console.log(`Usuário autenticado: ${matricula} | Admin: ${isAdmin}`);

  } catch(err) {
    console.warn("⚠️ Falha temporária ao inicializar usuário:", err);

    if (retryCount < MAX_RETRIES) {
      retryCount++;
      console.log(`Tentando novamente (${retryCount}/${MAX_RETRIES})...`);
      setTimeout(() => { onAuthStateChanged(auth, ()=>{}); }, 1500);
      return;
    }

    console.error("Erro persistente — mantendo tela de carregamento.");
    showLoading();
  }
});

// ============================================================
// 🔹 Envio de autenticação para iframe
// ============================================================
async function sendAuthToIframe() {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const parts = (user.email||'').split('@');
    const userSnap = await getDoc(doc(db, "users", user.uid));
    const isAdmin = userSnap.exists() ? userSnap.data().admin===true : false;

    const payload = {
      type: 'syncAuth',
      usuario: { matricula: parts[0]||'', email:user.email||'', nome:user.displayName||'' },
      admin: isAdmin
    };

    frame.contentWindow.postMessage(payload, "*");

  } catch(err) {
    console.error("Erro ao enviar auth ao iframe:", err);
  }
}

// ============================================================
// 🔹 Logout
// ============================================================
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
      window.location.href = 'login.html';
    } catch(err) {
      console.error("Erro ao deslogar:", err);
      alert("Falha ao deslogar, tente novamente.");
    }
  });
}

// ============================================================
// 🔹 Ajuste automático de altura de iframe
// ============================================================
function ajustarAlturaIframe(iframe) {
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    if (!doc) return;
    const altura = doc.body.scrollHeight;
    iframe.style.height = altura + "px";
  } catch (err) {
    console.warn("Não foi possível ajustar iframe:", err);
  }
}

const observer = new MutationObserver(mutations => {
  mutations.forEach(m => {
    if (m.type === "attributes" && m.attributeName === "src") {
      ajustarAlturaIframe(m.target);
    }
  });
});
observer.observe(frame, { attributes: true });