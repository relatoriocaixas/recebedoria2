import { auth, db } from "./firebaseConfig.js";
import { 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { 
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Referências do DOM
const tipoInput = document.getElementById("tipoInput");
const descricaoInput = document.getElementById("descricaoInput");
const salvarBtn = document.getElementById("salvarBtn");
const sugestoesList = document.getElementById("sugestoesList");

let userData = null;
let isAdmin = false;

// 🔹 Espera autenticação ser detectada pelo portal
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.warn("Usuário não autenticado. Aguardando login no portal...");
    return;
  }

  const matricula = user.email.split("@")[0];
  userData = { matricula, email: user.email };

  try {
    const userSnap = await getDocs(collection(db, "users"));
    const currentUserDoc = userSnap.docs.find(d => d.data().email === user.email);
    isAdmin = currentUserDoc ? currentUserDoc.data().admin : false;
  } catch (err) {
    console.error("Erro ao verificar admin:", err);
  }

  carregarSugestoes();
});

// 🔹 Salvar entrada (sempre começa EM ANÁLISE)
salvarBtn.addEventListener("click", async () => {
  if (!descricaoInput.value.trim() || !userData) {
    alert("Preencha a descrição e aguarde o login ser carregado.");
    return;
  }

  const tipo = tipoInput.value;
  const collectionName = tipo === "sugestao" ? "sugestoes" : "reports";

  try {
    await addDoc(collection(db, collectionName), {
      matricula: userData.matricula,
      descricao: descricaoInput.value.trim(),
      tipo,
      status: "em analise",
      criadoEm: new Date()
    });

    descricaoInput.value = "";
    carregarSugestoes();
  } catch (err) {
    console.error("Erro ao salvar:", err);
    alert("Erro ao salvar sugestão.");
  }
});

// 🔹 Atualiza lista ao trocar tipo
tipoInput.addEventListener("change", carregarSugestoes);

// 🔹 Carregar sugestões/reports
async function carregarSugestoes() {
  sugestoesList.innerHTML = "";

  if (!userData) return;

  const filtroTipo = tipoInput.value;
  const collectionName = filtroTipo === "sugestao" ? "sugestoes" : "reports";

  try {
    const q = query(collection(db, collectionName), orderBy("criadoEm", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      sugestoesList.innerHTML = `<p class="sem-resultados">Nenhuma ${filtroTipo} encontrada.</p>`;
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      // 🔒 Se não for admin, só mostra as próprias entradas
      if (!isAdmin && data.matricula !== userData.matricula) return;

      const card = document.createElement("div");
      card.className = "suggestion-card";

      const badge = document.createElement("span");
      badge.classList.add("status-badge");

      // 🔹 Define classe do status visual
      const statusMap = {
        "solucionado": "btn-aprovado",
        "aprovado": "btn-aprovado",
        "reprovado": "btn-reprovado",
        "correcao iniciada": "btn-correcao",
        "em analise": "btn-analise"
      };
      badge.classList.add(statusMap[data.status] || "btn-analise");
      badge.textContent = data.status;

      // 🔹 Conteúdo principal
      card.innerHTML = `<strong>${data.matricula}</strong>: ${data.descricao}`;
      card.prepend(badge);

      // 🔹 Botões administrativos
      if (isAdmin) {
        const actions = document.createElement("div");
        actions.className = "admin-actions";

        const createButton = (text, cls, status) => {
          const btn = document.createElement("button");
          btn.className = cls;
          btn.textContent = text;
          btn.onclick = async () => await updateStatus(docSnap.id, collectionName, status);
          return btn;
        };

        if (filtroTipo === "report") {
          actions.append(
            createButton("Solucionado", "btn-aprovado", "solucionado"),
            createButton("Correção iniciada", "btn-correcao", "correcao iniciada"),
            createButton("Em análise", "btn-analise", "em analise"),
          );
        } else {
          actions.append(
            createButton("Aprovado", "btn-aprovado", "aprovado"),
            createButton("Em análise", "btn-analise", "em analise"),
            createButton("Reprovado", "btn-reprovado", "reprovado"),
          );
        }

        const btnExcluir = createButton("Excluir", "btn-excluir");
        btnExcluir.onclick = async () => {
          await deleteDoc(doc(db, collectionName, docSnap.id));
          carregarSugestoes();
        };

        actions.append(btnExcluir);
        card.appendChild(actions);
      }

      sugestoesList.appendChild(card);
    });

  } catch (err) {
    console.error("Erro ao carregar entradas:", err);
  }
}

// 🔹 Atualiza status de um documento
async function updateStatus(id, collectionName, status) {
  try {
    await updateDoc(doc(db, collectionName, id), { status });
    carregarSugestoes();
  } catch (err) {
    console.error("Erro ao atualizar status:", err);
  }
}
