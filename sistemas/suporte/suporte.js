// suporte.js
import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const sugestaoSelect = document.getElementById("tipoSugestao");
const descricaoInput = document.getElementById("descricao");
const salvarBtn = document.getElementById("salvarSugestao");
const containerSugestoes = document.getElementById("sugestoesContainer");

let currentUser = null;
let isAdmin = false;

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  currentUser = user;
  try {
    const userSnap = await getDocs(collection(db, "users"));
    const userData = userSnap.docs.find(d => d.data().email === user.email)?.data();
    isAdmin = userData?.admin || false;
    carregarSugestoes();
  } catch (e) {
    console.error("Erro ao carregar usuário:", e);
  }
});

salvarBtn.addEventListener("click", async () => {
  if (!descricaoInput.value.trim()) return alert("Digite a descrição!");

  const tipo = sugestaoSelect.value; 
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

async function carregarSugestoes() {
  containerSugestoes.innerHTML = "";

  const colS = collection(db, "sugestoes");
  const colR = collection(db, "reports");

  try {
    const docsSug = await getDocs(colS);
    const docsRep = await getDocs(colR);

    let allDocs = [];
    docsSug.forEach(d => allDocs.push({ id: d.id, ...d.data(), colecao: "sugestoes" }));
    docsRep.forEach(d => allDocs.push({ id: d.id, ...d.data(), colecao: "reports" }));

    allDocs.sort((a,b) => b.timestamp?.toDate() - a.timestamp?.toDate());

    allDocs.forEach(entry => {
      if (!isAdmin && entry.matricula !== currentUser.email.split("@")[0]) return;

      const card = document.createElement("div");
      card.classList.add("card-entrada");

      // Corrige o erro de classList adicionando hífen no lugar de espaço
      const statusClass = entry.status.replace(/\s+/g, "-");

      card.innerHTML = `
        <div class="card-header">
          <span>${entry.matricula}</span>
          <span class="status ${statusClass}">${entry.status}</span>
        </div>
        <div class="card-body">
          <p>${entry.tipo === "report" ? "(Report) " : ""}${entry.descricao}</p>
          ${isAdmin ? `
            <div class="admin-actions">
              <button class="btn-status aprovado">Aprovado</button>
              <button class="btn-status reprovado">Reprovado</button>
              <button class="btn-status em-analise">Em análise</button>
              <button class="btn-status excluir">Excluir</button>
            </div>` : ""}
          ${entry.resposta ? `<div class="resposta">Resposta: ${entry.resposta}</div>` : ""}
        </div>
      `;

      if (isAdmin) {
        card.querySelector(".aprovado")?.addEventListener("click", ()=> atualizarStatus(entry, "aprovado"));
        card.querySelector(".reprovado")?.addEventListener("click", ()=> atualizarStatus(entry, "reprovado"));
        card.querySelector(".em-analise")?.addEventListener("click", ()=> atualizarStatus(entry, "em-analise"));
        card.querySelector(".excluir")?.addEventListener("click", ()=> excluirEntrada(entry));
      }

      containerSugestoes.appendChild(card);
    });

  } catch (e) {
    console.error("Erro ao carregar entradas:", e);
  }
}

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
