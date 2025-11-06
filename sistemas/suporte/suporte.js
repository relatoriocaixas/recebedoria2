// suporte.js
import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Elementos
const sugestaoSelect = document.getElementById("tipoSugestao");
const descricaoInput = document.getElementById("descricao");
const salvarBtn = document.getElementById("salvarSugestao");
const containerSugestoes = document.getElementById("sugestoesContainer");
const filtroSelect = document.getElementById("filtroTipo");

// Estado
let currentUser = null;
let isAdmin = false;

// Inicialização
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  currentUser = user;
  try {
    const userSnap = await getDocs(query(collection(db, "users"), where("email", "==", user.email)));
    if (!userSnap.empty) {
      isAdmin = userSnap.docs[0].data().admin === true;
    }
    carregarSugestoes();
  } catch (e) {
    console.error("Erro ao carregar usuário:", e);
  }
});

// Salvar sugestão/report
salvarBtn.addEventListener("click", async () => {
  if (!descricaoInput.value.trim()) return alert("Digite a descrição!");

  const tipo = sugestaoSelect.value; // 'sugestao' ou 'report'
  const colecao = tipo === "report" ? "reports" : "sugestoes";

  try {
    await addDoc(collection(db, colecao), {
      descricao: descricaoInput.value.trim(),
      matricula: currentUser.email.split("@")[0],
      tipo,
      status: tipo === "report" ? "em-aberto" : "em-analise",
      resposta: "",
      timestamp: new Date()
    });

    descricaoInput.value = "";
    carregarSugestoes();
  } catch (e) {
    console.error("Erro ao salvar sugestão:", e);
    alert("Erro ao salvar. Tente novamente.");
  }
});

// Filtrar sugestões
filtroSelect?.addEventListener("change", carregarSugestoes);

async function carregarSugestoes() {
  containerSugestoes.innerHTML = "";
  const tipoFiltro = filtroSelect?.value || "todos";

  const colS = collection(db, "sugestoes");
  const colR = collection(db, "reports");

  let allDocs = [];

  try {
    const docsSug = await getDocs(colS);
    const docsRep = await getDocs(colR);

    docsSug.forEach(d => allDocs.push({ id: d.id, ...d.data(), colecao: "sugestoes" }));
    docsRep.forEach(d => allDocs.push({ id: d.id, ...d.data(), colecao: "reports" }));

    if (tipoFiltro !== "todos") {
      allDocs = allDocs.filter(d => d.tipo === tipoFiltro);
    }

    allDocs.sort((a,b)=>b.timestamp?.toDate() - a.timestamp?.toDate());

    allDocs.forEach(entry => {
      // Apenas próprio usuário ou admin
      if (!isAdmin && entry.matricula !== currentUser.email.split("@")[0]) return;

      const card = document.createElement("div");
      card.classList.add("card-entrada");

      card.innerHTML = `
        <div class="card-header">
          <span>${entry.matricula}</span>
          <span class="status ${entry.status.replace(/\s+/g,'-')}">${entry.status.replace(/\-/g,' ')}</span>
        </div>
        <div class="card-body">
          <p>${entry.tipo === "report" ? "(Report) " : ""}${entry.descricao}</p>
          ${isAdmin ? `
            <div class="admin-actions">
              <button class="btn-status aprovado">Aprovado</button>
              <button class="btn-status reprovado">Reprovado</button>
              <button class="btn-status analise">Em análise</button>
              <button class="btn-status excluir">Excluir</button>
            </div>` : ""}
          ${entry.resposta ? `<div class="resposta">Resposta: ${entry.resposta}</div>` : ""}
        </div>
      `;

      if (isAdmin) {
        const aprovadoBtn = card.querySelector(".aprovado");
        const reprovadoBtn = card.querySelector(".reprovado");
        const analiseBtn = card.querySelector(".analise");
        const excluirBtn = card.querySelector(".excluir");

        aprovadoBtn?.addEventListener("click", ()=> atualizarStatus(entry, "aprovado"));
        reprovadoBtn?.addEventListener("click", ()=> atualizarStatus(entry, "reprovado"));
        analiseBtn?.addEventListener("click", ()=> atualizarStatus(entry, "em-analise"));
        excluirBtn?.addEventListener("click", ()=> excluirEntrada(entry));
      }

      containerSugestoes.appendChild(card);
    });

  } catch (e) {
    console.error("Erro ao carregar entradas:", e);
  }
}

// Funções admin
async function atualizarStatus(entry, status) {
  try {
    const docRef = doc(db, entry.colecao, entry.id);
    await updateDoc(docRef, { status });
    carregarSugestoes();
  } catch(e) {
    console.error("Erro ao atualizar status:", e);
  }
}

async function excluirEntrada(entry) {
  if(!confirm("Deseja realmente excluir?")) return;
  try {
    const docRef = doc(db, entry.colecao, entry.id);
    await updateDoc(docRef, { status: "excluido" });
    carregarSugestoes();
  } catch(e) {
    console.error("Erro ao excluir:", e);
  }
}
