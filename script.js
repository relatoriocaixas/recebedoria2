// script.js (substitua todo o arquivo atual por este)

// ======================================================
// IMPORTS
// - Usa firebaseConfig (original) para auth + db
// - Importa helpers do SDK (auth/firestore) diretamente
// ======================================================
import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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
// ROTAS (ajuste BASE se necessário)
// ======================================================
// se preferir usar caminhos relativos, substitua BASE por '' (string vazia)
const BASE = (typeof BASE !== 'undefined' && BASE) ? BASE : "https://relatoriocaixas.github.io/recebedoria2";
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
// LOADING OVERLAY (simples)
// ======================================================
const loadingOverlay = document.createElement('div');
loadingOverlay.id = 'loadingOverlay';
loadingOverlay.style.cssText = "position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:9999;background:rgba(0,0,0,0.45);color:#fff;font-size:1.1rem;";
loadingOverlay.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;"><div class="spinner" style="width:40px;height:40px;border:4px solid rgba(255,255,255,0.15);border-top-color:#fff;border-radius:50%;animation:spin 1s linear infinite"></div><div>Carregando...</div></div>`;
document.body.appendChild(loadingOverlay);
const styleSpin = document.createElement('style');
styleSpin.textContent = `@keyframes spin{to{transform:rotate(360deg)}}`;
document.head.appendChild(styleSpin);
function showLoading(){ loadingOverlay.style.display = 'flex'; }
function hideLoading(){ loadingOverlay.style.display = 'none'; }

// ======================================================
// AJUSTES VISUAIS BÁSICOS
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
function goHome(){
  if(iframeContainer) iframeContainer.classList.remove('full');
  if(iframeContainer) iframeContainer.style.display = 'none';
  if(avisosSection) avisosSection.style.display = 'block';
  if(sidebar) sidebar.style.display = 'flex';
}

function openRoute(route){
  const src = ROUTES[route];
  if(!src){ goHome(); return; }

  showLoading();
  if(avisosSection) avisosSection.style.display = 'none';
  if(iframeContainer) { iframeContainer.style.display = 'block'; iframeContainer.classList.add('full'); }

  // set onload once to run after the document is loaded inside iframe
  frame.onload = async () => {
    // espera que iframe esteja pronto para receber postMessage
    await waitForIframeReady(frame, 3000);
    await sendAuthToIframe();            // envia auth sempre que um iframe carrega
    ajustarAlturaIframe(frame);

    // se rota for escala e for funcionário, solicita aumentar badges
    try {
      const user = auth.currentUser;
      if(user && route === "escala") {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const isAdmin = userSnap.exists() ? userSnap.data().admin === true : false;
        if(!isAdmin && frame.contentWindow) {
          frame.contentWindow.postMessage({ type: "aumentarBadges" }, "*");
        }
      }
    } catch(e){ console.warn("Erro ao checar admin/escala:", e); }

    hideLoading();
  };

  // Atribui src por último
  frame.src = src;
}

// helper para esperar até que iframe.contentWindow e document estajam prontos
function waitForIframeReady(iframe, timeout = 3000){
  const start = Date.now();
  return new Promise((resolve) => {
    (function loop(){
      try {
        if(iframe && iframe.contentWindow){
          // se disponível, tenta checar readyState por try/catch (cross-origin pode lançar)
          try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            if(doc && (doc.readyState === "complete" || doc.readyState === "interactive")){
              return resolve(true);
            }
          } catch(e){
            // cross-origin: ainda assim contentWindow existe; resolve (iframe pode receber postMessage)
            return resolve(true);
          }
        }
      } catch(e){ /* ignorar */ }

      if(Date.now() - start > timeout) return resolve(false);
      setTimeout(loop, 120);
    })();
  });
}

// ======================================================
// RENDERIZAÇÃO DO MENU (adiciona rotas dinamicamente)
// ======================================================
function addRoute(label, emoji, target){
  const li = document.createElement('li');
  li.dataset.target = target;
  li.innerHTML = `${emoji} <span class='label'>${label}</span>`;
  sidebar.querySelector('ul').appendChild(li);
  li.addEventListener('click', () => openRoute(target));
}
// rotas fixas
addRoute("Escala", "📅", "escala");
addRoute("Funcionário", "👤", "funcionario");
addRoute("Suporte", "☎️", "suporte");
addRoute("Pesquisa", "🔍", "pesquisa");

// clique genérico nas li do sidebar (home/others)
document.querySelectorAll('.sidebar li').forEach(li => {
  li.addEventListener('click', () => {
    const t = li.dataset.target;
    if(t === 'home') goHome();
    else openRoute(t);
  });
});

// data do portal
if(dataVigenteSpan){
  const hoje = new Date();
  dataVigenteSpan.textContent = `${String(hoje.getDate()).padStart(2,'0')}/${String(hoje.getMonth()+1).padStart(2,'0')}/${hoje.getFullYear()}`;
}

// ======================================================
// FIRESTORE: garante usuário na coleção users
// ======================================================
async function ensureUserInFirestore(user){
  try {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    const matricula = (user.email||"").split("@")[0] || "";

    if(!snap.exists()){
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
  } catch(e){
    console.error("Erro ensureUserInFirestore:", e);
    throw e;
  }
}

// ======================================================
// onAuthStateChanged (uma única vez, protegido contra múltiplas execuções)
// ======================================================
let initialized = false;
onAuthStateChanged(auth, async (user) => {
  showLoading();

  if(!user){
    // usuário não autenticado → manda para login
    hideLoading();
    window.location.href = "login.html";
    return;
  }

  // evita executar o init duas vezes (ponto crítico que causava comportamento estranho)
  if(initialized){
    // mas mesmo depois de inicializado, envia auth para iframe caso exista e mude
    try { await sendAuthToIframe(); } catch(e){ /* ignoring */ }
    hideLoading();
    return;
  }
  initialized = true;

  try {
    const { matricula, isAdmin } = await ensureUserInFirestore(user);

    if(sidebar) sidebar.classList.remove('hidden');
    if(sidebarBadge) sidebarBadge.textContent = matricula;

    // hover mostra nome + matricula (se existir)
    if(sidebar){
      sidebar.addEventListener('mouseenter', ()=> {
        sidebarBadge.textContent = (user.displayName||'Usuário') + ' • ' + matricula;
      });
      sidebar.addEventListener('mouseleave', ()=> {
        sidebarBadge.textContent = matricula;
      });
    }

    // oculta botões adminOnly para não-admins
    if(!isAdmin){
      document.querySelectorAll('.adminOnly').forEach(b => b.style.display = "none");
    }

    // envia credenciais para o iframe atual (se existir) e inicializa home
    await sendAuthToIframe();
    goHome();

    hideLoading();
    console.log(`Usuário autenticado: ${matricula} | Admin: ${isAdmin}`);
  } catch(err){
    console.error("Erro no init after auth:", err);
    hideLoading();
    // não forçar logout aqui — apenas log
  }
});

// ======================================================
// envia auth ao iframe com tentativas (evita perda de mensagem quando iframe ainda não pronto)
// ======================================================
async function sendAuthToIframe(retries = 5, interval = 250){
  try {
    const user = auth.currentUser;
    if(!user) return;

    const snap = await getDoc(doc(db, "users", user.uid));
    const isAdmin = snap.exists() ? snap.data().admin === true : false;

    const payload = {
      type: "syncAuth",
      usuario: { matricula: user.email.split("@")[0], email: user.email, nome: user.displayName || "" },
      admin: isAdmin
    };

    // tenta garantir contentWindow disponível
    for(let i=0;i<retries;i++){
      if(frame && frame.contentWindow){
        try {
          frame.contentWindow.postMessage(payload, "*");
          return true;
        } catch(e){
          console.warn("Falha postMessage (tentativa):", i, e);
        }
      }
      await new Promise(r => setTimeout(r, interval));
    }
    // se não conseguiu, somente logar — mas não forçar logout
    console.warn("Não foi possível postar auth ao iframe após tentativas.");
  } catch(e){
    console.error("Erro sendAuthToIframe:", e);
  }
}

// ======================================================
// LOGOUT
// ======================================================
if(logoutBtn){
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
      window.location.href = "login.html";
    } catch(e){
      console.error("Erro ao deslogar:", e);
      alert("Falha ao deslogar, tente novamente.");
    }
  });
}

// ======================================================
// ajuste automático de altura do iframe (tenta, sem forçar cross-origin)
// ======================================================
function ajustarAlturaIframe(iframe){
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    if(!doc) return;
    iframe.style.height = doc.body.scrollHeight + "px";
  } catch(e){ /* cross-origin ou inacessível — ok */ }
}
new MutationObserver(mutations => {
  for(const m of mutations){
    if(m.type === "attributes" && m.attributeName === "src"){
      ajustarAlturaIframe(frame);
    }
  }
}).observe(frame, { attributes: true });

// ======================================================
// ALTERAR SENHA
// ======================================================
if(changePassBtn){
  changePassBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if(!user) return alert("Usuário não autenticado!");

    const newPass = prompt("Nova senha (mínimo 6 dígitos):");
    if(!newPass || newPass.length < 6) return alert("Senha inválida.");

    try {
      await updatePassword(user, newPass);
      alert("Senha alterada.");
    } catch(e){
      console.error("Erro alterar senha:", e);
      if(e.code === "auth/requires-recent-login"){
        alert("Faça login novamente para alterar a senha.");
        try { await signOut(auth); } catch(err){/*ignore*/ }
        window.location.href = "login.html";
      } else {
        alert("Erro ao alterar senha: " + (e.message || e));
      }
    }
  });
}
