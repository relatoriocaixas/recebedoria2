import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const tipoInput = document.getElementById("tipoInput");
const descricaoInput = document.getElementById("descricaoInput");
const salvarBtn = document.getElementById("salvarBtn");
const sugestoesList = document.getElementById("sugestoesList");

let userData = null;
let isAdmin = false;

// Inicializa usuário e verifica admin
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  const parts = user.email.split("@");
  userData = { matricula: parts[0], email: user.email };
  
  // Verifica se é admin
  const userSnap = await getDocs(collection(db, "users"));
  const currentUserDoc = userSnap.docs.find(d => d.data().email === user.email);
  isAdmin = currentUserDoc ? currentUserDoc.data().admin : false;

  carregarSugestoes();
});

// Salvar entrada
salvarBtn.addEventListener("click", async () => {
  if (!descricaoInput.value.trim()) return;

  const tipo = tipoInput.value;
  const collectionName = tipo === "sugestao" ? "sugestoes" : "reports";

  try {
    await addDoc(collection(db, collectionName), {
      matricula: userData.matricula,
      descricao: descricaoInput.value,
      tipo,
      // ✅ REPORT agora sempre nasce como "em analise"
      status: "em analise",
      criadoEm: new Date()
    });
    descricaoInput.value = "";
    carregarSugestoes();
  } catch (err) {
    console.error("Erro ao salvar:", err);
  }
});

// Atualiza a lista filtrando por tipo selecionado
tipoInput.addEventListener("change", () => carregarSugestoes());

// Carregar entradas
async function carregarSugestoes() {
  sugestoesList.innerHTML = "";
  if (!userData) return;

  const filtroTipo = tipoInput.value; // "sugestao" ou "report"
  const collectionName = filtroTipo === "sugestao" ? "sugestoes" : "reports";

  try {
    const q = query(collection(db, collectionName), orderBy("criadoEm", "desc"));
    const snapshot = await getDocs(q);

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const card = document.createElement("div");
      card.className = "suggestion-card";

      // ✅ Ajuste do status (REPORT nunca mostra reprovado)
      let statusFinal = data.tipo === "report" && data.status === "reprovado"
        ? "em analise"
        : data.status;

      // Status badge
      const badge = document.createElement("span");
      badge.classList.add("status-badge");

      let statusClass = "";
      switch(statusFinal) {
        case "aprovado":
        case "solucionado":
          statusClass = "btn-aprovado";
          break;
        case "reprovado":
          statusClass = "btn-reprovado";
          break;
        case "em analise":
        case "correcao iniciada":
        default:
          statusClass = "btn-analise";
          break;
      }

      badge.classList.add(statusClass);
      badge.textContent = statusFinal;

      // Conteúdo do card
      card.innerHTML = `<strong>${data.matricula}</strong>: ${data.descricao}`;
      card.prepend(badge);

      // Botões admin
      if (isAdmin) {
        const actions = document.createElement("div");
        actions.className = "admin-actions";

        // ✅ Aprovado / Solucionado
        const btnAprovado = document.createElement("button");
        btnAprovado.className = "btn-aprovado";
        btnAprovado.textContent = data.tipo === "report" ? "Solucionado" : "Aprovado";
        btnAprovado.onclick = async () =>
          await updateStatus(docSnap.id, collectionName, data.tipo === "report" ? "solucionado" : "aprovado");

        // ✅ SOMENTE SUGESTÕES têm botão Reprovado
        if (data.tipo !== "report") {
          const btnReprovado = document.createElement("button");
          btnReprovado.className = "btn-reprovado";
          btnReprovado.textContent = "Reprovado";
          btnReprovado.onclick = async () =>
            await updateStatus(docSnap.id, collectionName, "reprovado");
          actions.appendChild(btnReprovado);
        }

        // ✅ Em análise
        const btnAnalise = document.createElement("button");
        btnAnalise.className = "btn-analise";
        btnAnalise.textContent = "Em análise";
        btnAnalise.onclick = async () =>
          await updateStatus(docSnap.id, collectionName, "em analise");

        // Excluir
        const btnExcluir = document.createElement("button");
        btnExcluir.className = "btn-excluir";
        btnExcluir.textContent = "Excluir";
        btnExcluir.onclick = async () => {
          await deleteDoc(doc(db, collectionName, docSnap.id));
          carregarSugestoes();
        };

        actions.append(btnAprovado, btnAnalise, btnExcluir);
        card.appendChild(actions);
      }

      sugestoesList.appendChild(card);
    });
  } catch(err) {
    console.error("Erro ao carregar entradas:", err);
  }
}

// Atualizar status
async function updateStatus(id, collectionName, status) {
  await updateDoc(doc(db, collectionName, id), { status });
  carregarSugestoes();
}
