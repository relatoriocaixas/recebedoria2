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
  
  const userSnap = await getDocs(collection(db, "users"));
  const currentUserDoc = userSnap.docs.find(d => d.data().email === user.email);
  isAdmin = currentUserDoc ? currentUserDoc.data().admin : false;

  carregarSugestoes();
});

// Salvar entrada (sempre começa EM ANÁLISE)
salvarBtn.addEventListener("click", async () => {
  if (!descricaoInput.value.trim()) return;

  const tipo = tipoInput.value;
  const collectionName = tipo === "sugestao" ? "sugestoes" : "reports";

  try {
    await addDoc(collection(db, collectionName), {
      matricula: userData.matricula,
      descricao: descricaoInput.value,
      tipo,
      status: "em analise",
      criadoEm: new Date()
    });
    descricaoInput.value = "";
    carregarSugestoes();
  } catch (err) {
    console.error("Erro ao salvar:", err);
  }
});

// Atualiza lista ao trocar tipo
tipoInput.addEventListener("change", () => carregarSugestoes());

// Carregar sugestões/reports
async function carregarSugestoes() {
  sugestoesList.innerHTML = "";
  if (!userData) return;

  const filtroTipo = tipoInput.value;
  const collectionName = filtroTipo === "sugestao" ? "sugestoes" : "reports";

  try {
    const q = query(collection(db, collectionName), orderBy("criadoEm", "desc"));
    const snapshot = await getDocs(q);

    snapshot.forEach(docSnap => {
      const data = docSnap.data();

      // 🔹 FILTRO: se não for admin, só mostra itens do próprio usuário
      if (!isAdmin && data.matricula !== userData.matricula) return;

      const card = document.createElement("div");
      card.className = "suggestion-card";

      const badge = document.createElement("span");
      badge.classList.add("status-badge");

      // Determina classe do status
      let statusClass = "";
      switch(data.status) {
        case "solucionado":
        case "aprovado":
          statusClass = "btn-aprovado";
          break;
        case "reprovado":
          statusClass = "btn-reprovado";
          break;
        case "correcao iniciada":
          statusClass = "btn-correcao";
          break;
        default:
          statusClass = "btn-analise";
      }

      badge.classList.add(statusClass);
      badge.textContent = data.status;
      card.innerHTML = `<strong>${data.matricula}</strong>: ${data.descricao}`;
      card.prepend(badge);

      // Botões admin
      if (isAdmin) {
        const actions = document.createElement("div");
        actions.className = "admin-actions";

        // Solucionado / Aprovado
        const btnSolucionado = document.createElement("button");
        btnSolucionado.className = "btn-aprovado";
        btnSolucionado.textContent = filtroTipo === "report" ? "Solucionado" : "Aprovado";
        btnSolucionado.onclick = async () =>
          await updateStatus(docSnap.id, collectionName, filtroTipo === "report" ? "solucionado" : "aprovado");

        // Em Análise
        const btnAnalise = document.createElement("button");
        btnAnalise.className = "btn-analise";
        btnAnalise.textContent = "Em análise";
        btnAnalise.onclick = async () =>
          await updateStatus(docSnap.id, collectionName, "em analise");

        // Reprovado (somente quando filtro é sugestão)
        let btnReprovado = null;
        if (filtroTipo === "sugestao") {
          btnReprovado = document.createElement("button");
          btnReprovado.className = "btn-reprovado";
          btnReprovado.textContent = "Reprovado";
          btnReprovado.onclick = async () =>
            await updateStatus(docSnap.id, collectionName, "reprovado");
        }

        // Correção iniciada (somente quando filtro é report)
        let btnCorrecao = null;
        if (filtroTipo === "report") {
          btnCorrecao = document.createElement("button");
          btnCorrecao.className = "btn-correcao";
          btnCorrecao.textContent = "Correção iniciada";
          btnCorrecao.onclick = async () =>
            await updateStatus(docSnap.id, collectionName, "correcao iniciada");
        }

        const btnExcluir = document.createElement("button");
        btnExcluir.className = "btn-excluir";
        btnExcluir.textContent = "Excluir";
        btnExcluir.onclick = async () => {
          await deleteDoc(doc(db, collectionName, docSnap.id));
          carregarSugestoes();
        };

        // Adiciona botões de acordo com o filtro
        if (filtroTipo === "report") {
          actions.append(btnSolucionado, btnCorrecao, btnAnalise, btnExcluir);
        } else {
          actions.append(btnSolucionado, btnAnalise, btnReprovado, btnExcluir);
        }

        card.appendChild(actions);
      }

      sugestoesList.appendChild(card);
    });
  } catch(err) {
    console.error("Erro ao carregar entradas:", err);
  }
}

// Atualizar status no Firestore
async function updateStatus(id, collectionName, status) {
  await updateDoc(doc(db, collectionName, id), { status });
  carregarSugestoes();
}
