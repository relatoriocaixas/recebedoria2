// ===============================
// PORTAL PRINCIPAL - script.js
// ===============================

// ===== Imports Firebase =====
import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ===== Elementos da página =====
const loader = document.getElementById("loader");
const sidebar = document.getElementById("sidebar");
const userBadge = document.getElementById("user-badge");
const mainFrame = document.getElementById("mainFrame");
const iframeContainer = document.getElementById("iframeContainer");
const avisos = document.getElementById("avisos");
const logoutBtn = document.getElementById("logoutBtn");

// ===== Base URL e Rotas =====
const BASE = "https://relatoriocaixas.github.io/recebedoria2";
const ROUTES = {
  home: null,
  escala: `${BASE}/sistemas/escala/escala.html`,
  funcionario: `${BASE}/sistemas/funcionario/index.html`,
  suporte: `${BASE}/sistemas/suporte/index.html`,
  pesquisa: `${BASE}/sistemas/cartoes/index.html`,
  emprestimo: `${BASE}/sistemas/emprestimo/index.html`,
  relatorios: `${BASE}/sistemas/emprestimo/emprestimocartao-main/relatorio.html`,
  diferencas: `${BASE}/sistemas/diferencas/index.html`,
};

// ===== Loader =====
loader.style.display = "flex";
iframeContainer.style.display = "none";

// ===== Estado global =====
let currentUser = null;
let userToken = null;

// ===============================
// 🔐 Autenticação Firebase
// ===============================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.warn("[portal] Usuário não autenticado. Redirecionando...");
    window.location.href = "login.html";
    return;
  }

  // Usuário autenticado
  currentUser = user;
  console.log("[portal] Usuário autenticado:", user.email);

  // Garante presença no Firestore
  await ensureUserInFirestore(user);

  // Exibe interface
  loader.style.display = "none";
  iframeContainer.style.display = "block";
  sidebar.style.display = "flex";
  userBadge.textContent = (user.displayName || user.email.split("@")[0]);

  // Envia token inicial aos iframes
  await refreshAndSendToken();

  // Atualiza token periodicamente
  setInterval(refreshAndSendToken, 60 * 1000);

  // Vai para home
  goHome();
});

// ===============================
// 🔁 Atualiza token e envia aos iframes
// ===============================
async function refreshAndSendToken() {
  try {
    if (!currentUser) return;
    userToken = await currentUser.getIdToken(true);

    const payload = {
      type: "FIREBASE_TOKEN",
      token: userToken,
      user: {
        uid: currentUser.uid,
        email: currentUser.email,
        nome: currentUser.displayName || "",
      },
    };

    const frames = document.querySelectorAll("iframe");
    frames.forEach((frame) => {
      frame.contentWindow?.postMessage(payload, "*");
    });

    console.log("[portal] Token enviado para", frames.length, "iframes");
  } catch (err) {
    console.error("[portal] Erro ao enviar token:", err);
  }
}

// ===============================
// 🧩 Firestore - garantir user
// ===============================
async function ensureUserInFirestore(user) {
  try {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const matricula = (user.email || "").split("@")[0];
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        nome: user.displayName || matricula,
        matricula,
        admin: false,
        createdAt: new Date(),
      });
      console.log("[portal] Usuário criado no Firestore");
    }
  } catch (e) {
    console.error("[portal] Erro ao garantir user Firestore:", e);
  }
}

// ===============================
// 🧭 Rotas e Navegação
// ===============================
function goHome() {
  if (avisos) avisos.style.display = "block";
  if (iframeContainer) iframeContainer.classList.remove("full");
  mainFrame.src = "";
}

function openRoute(routeKey) {
  const route = ROUTES[routeKey];
  if (!route) return goHome();

  avisos.style.display = "none";
  iframeContainer.classList.add("full");
  mainFrame.src = route;

  // Quando iframe carregar, reenviar token
  mainFrame.onload = async () => {
    await refreshAndSendToken();
  };
}

// Adiciona listeners às opções do menu
document.querySelectorAll(".sidebar li").forEach((li) => {
  li.addEventListener("click", () => {
    const route = li.dataset.target;
    openRoute(route);
  });
});

// ===============================
// 🚪 Logout
// ===============================
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      console.log("[portal] Logout feito com sucesso.");
      window.location.href = "login.html";
    } catch (e) {
      console.error("[portal] Erro ao deslogar:", e);
      alert("Erro ao sair. Tente novamente.");
    }
  });
}

// ===============================
// 🧠 Recebe mensagens dos iframes (opcional futuro)
// ===============================
window.addEventListener("message", (event) => {
  if (event.data?.type === "REQUEST_TOKEN") {
    refreshAndSendToken();
  }
});
