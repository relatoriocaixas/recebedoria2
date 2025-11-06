import { auth, db } from "../firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, addDoc, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const sugestaoInput = document.getElementById("sugestao");
const btnSalvar = document.getElementById("btnSalvarSugestao");
const listaSugestoes = document.getElementById("listaSugestoes");

// Variável global para armazenar usuário logado
let usuarioLogado = null;
let isAdmin = false;

// Observa autenticação
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  usuarioLogado = user;
  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDocs(collection(db, "users"));
    const userDoc = await userRef.get?.() || { exists: () => false, data: () => ({ admin:false }) };
    isAdmin = userDoc.exists() ? userDoc.data().admin===true : false;
    carregarSugestoes();
  } catch (e) {
    console.error("Erro ao carregar usuário:", e);
  }
});

// Salvar sugestão
btnSalvar.addEventListener("click", async () => {
  if (!usuarioLogado) {
    alert("Usuário não autenticado.");
    return;
  }

  const texto = sugestaoInput.value.trim();
  if (!texto) {
    alert("Escreva alguma sugestão antes de salvar.");
    return;
  }

  try {
    await addDoc(collection(db, "suporte_sugestoes"), {
      texto,
      uid: usuarioLogado.uid,
      email: usuarioLogado.email || "",
      status: "analise",
      resposta: "",
      timestamp: new Date()
    });
    sugestaoInput.value = "";
    carregarSugestoes();
    alert("Sugestão salva com sucesso!");
  } catch (e) {
    console.error("Erro ao salvar sugestão:", e);
    alert("Erro ao salvar sugestão.");
  }
});

// Carregar sugestões
async function carregarSugestoes() {
  listaSugestoes.innerHTML = "";
  try {
    const snapshot = await getDocs(collection(db, "suporte_sugestoes"));
    snapshot.forEach(docSnap => {
      const dados = docSnap.data();
      const id = docSnap.id;

      // Funcionário comum vê só suas sugestões
      if (!isAdmin && dados.uid !== usuarioLogado.uid) return;

      const card = document.createElement("div");
      card.className = "suggestion-card";

      card.innerHTML = `
        <p>${dados.texto}</p>
        <p>Status: <span class="status-badge ${dados.status}">${dados.status.toUpperCase()}</span></p>
        ${isAdmin ? `
          <div class="admin-actions">
            <button class="aprovado">Aprovado</button>
            <button class="reprovado">Reprovado</button>
            <button class="analise">Em análise</button>
          </div>` : ""}
      `;

      if (isAdmin) {
        const btns = card.querySelectorAll(".admin-actions button");
        btns.forEach(btn => {
          btn.addEventListener("click", async () => {
            try {
              await updateDoc(doc(db, "suporte_sugestoes", id), { status: btn.className });
              carregarSugestoes();
            } catch (e) {
              console.error("Erro ao atualizar status:", e);
            }
          });
        });
      }

      listaSugestoes.appendChild(card);
    });
  } catch (e) {
    console.error("Erro ao carregar sugestões:", e);
  }
}
