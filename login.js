import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBWmq02P8pGbl2NmppEAIKtF9KtQ7AzTFQ",
  authDomain: "unificado-441cd.firebaseapp.com",
  projectId: "unificado-441cd",
  storageBucket: "unificado-441cd.firebasestorage.app",
  messagingSenderId: "671392063569",
  appId: "1:671392063569:web:57e3f6b54fcdc45862d870",
  measurementId: "G-6GQX395J9C",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ============================================================
// 🔐 LOGIN
// ============================================================
document.getElementById("loginBtn").addEventListener("click", async () => {
  const matricula = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!matricula) return alert("Digite sua matrícula.");

  const email = matricula.includes("@")
    ? matricula
    : `${matricula}@movebuss.local`;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) {
      alert("Usuário não encontrado no banco de dados.");
      return;
    }

    const userData = userDoc.data();
    localStorage.setItem("isAdmin", userData.admin === true);

    window.location.href = "index.html";
  } catch (error) {
    alert("Erro ao fazer login: " + error.message);
  }
});

// ✅ ENTER DISPARA O LOGIN
document.addEventListener("keydown", (event) => {
  const loginFormVisible = document.getElementById("loginForm").style.display !== "none";

  if (event.key === "Enter" && loginFormVisible) {
    event.preventDefault();
    document.getElementById("btnLogin").click();
  }
});

// ============================================================
// 🧾 MODAL CRIAR CONTA
// ============================================================
document.getElementById("showCreateAccountBtn").addEventListener("click", () => {
  document.getElementById("createAccountModal").classList.remove("hidden");
});

document.getElementById("closeModalBtn").addEventListener("click", () => {
  document.getElementById("createAccountModal").classList.add("hidden");
});

// ============================================================
// 🧍 CRIAR CONTA
// ============================================================
document.getElementById("createAccountBtn").addEventListener("click", async () => {
  const nome = document.getElementById("newName").value.trim();
  const matricula = document.getElementById("newEmail").value.trim();
  const dataAdmissao = document.getElementById("newDataAdmissao").value.trim();
  const senha = document.getElementById("newPassword").value;
  const confirmar = document.getElementById("confirmPassword").value;

  if (!nome || !matricula || !senha || !confirmar || !dataAdmissao)
    return alert("Preencha todos os campos.");

  if (senha !== confirmar)
    return alert("As senhas não conferem.");

  const email = matricula.includes("@")
    ? matricula
    : `${matricula}@movebuss.local`;

  try {
    // Criar no Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
    const user = userCredential.user;

    // Atualiza nome no Auth
    await updateProfile(user, { displayName: nome });

    // Salvar na coleção users
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      nome,
      matricula,
      email,
      dataAdmissao,
      createdAt: new Date(),
      admin: false
    });

    alert("Conta criada com sucesso!");
    document.getElementById("createAccountModal").classList.add("hidden");
  } catch (error) {
    alert("Erro ao criar conta: " + error.message);
  }
});
