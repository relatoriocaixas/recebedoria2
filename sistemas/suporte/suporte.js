// suporte.js
import { auth, db } from "./firebaseConfig.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  collection,
  addDoc,
  query,
  orderBy,
  getDocs,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// 🔹 Elementos
const tipoSelect = document.getElementById("tipoSolicitacao");
const descricaoInput = document.getElementById("descricao");
const salvarBtn = document.getElementById("salvarBtn");
const sugestoesList = document.getElementById("sugestoesList");
const filtroSelect = document.getElementById("filtroTipo");

// Firestore coleções
const SUGESTOES_COL = "sugestoes";
const REPORTS_COL = "reports";

// 🔹 Salvar sugestão ou report
async function salvarEntrada() {
  const user = auth.currentUser;
  if (!user) return alert("Usuário não autenticado.");

  const tipo = tipoSelect.value;
  const descricao = descricaoInput.value.trim();
  if (!descricao) return alert("Digite a descrição.");

  const docData = {
    matricula: (user.email || "").split("@")[0],
    tipo,
    descricao,
    status: tipo === "report" ? "correcao-iniciada" : "analise",
    createdAt: new Date()
  };

  try {
    const col = tipo === "report" ? REPORTS_COL : SUGESTOES_COL;
    await addDoc(collection(db, col), docData);
    descricaoInput.value = "";
    carregarEntradas();
  } catch (err) {
    console.error("Erro ao salvar entrada:", err);
  }
}

salvarBtn.addEventListener("click", salvarEntrada);

// 🔹 Carregar sugestões/reports
async function carregarEntradas() {
  const filtro = filtroSelect.value;
  sugestoesList.innerHTML = "";

  const colS = collection(db, SUGESTOES_COL);
  const colR = collection(db, REPORTS_COL);

  const qS = query(colS, orderBy("createdAt", "desc"));
  const qR = query(colR, orderBy("createdAt", "desc"));

  const [snapS, snapR] = await Promise.all([getDocs(qS), getDocs(qR)]);

  let allDocs = [];
  snapS.forEach(d => allDocs.push({ id: d.id, ...d.data(), collection: SUGESTOES_COL }));
  snapR.forEach(d => allDocs.push({ id: d.id, ...d.data(), collection: REPORTS_COL }));

  if (filtro !== "todos") allDocs = allDocs.filter(d => d.tipo === filtro);

  allDocs.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());

  allDocs.forEach(d => {
    const card = document.createElement("div");
    card.classList.add("suggestion-card");

    // Ícone e cor do tipo
    const tipoIcon = d.tipo === "report" ? "❗" : "💡";
    card.style.borderLeftColor = d.tipo === "report" ? "#ffc107" : "#fdd835";

    const matriculaSpan = document.createElement("span");
    matriculaSpan.style.fontSize = "0.85rem";
    matriculaSpan.style.opacity = "0.8";
    matriculaSpan.textContent = `${tipoIcon} ${d.tipo.toUpperCase()} - ${d.matricula}`;

    const descP = document.createElement("p");
    descP.textContent = d.descricao;

    const statusSpan = document.createElement("span");
    statusSpan.classList.add("status-badge");
    const token = d.status.replace(/\s+/g, "-").toLowerCase();
    statusSpan.classList.add(token);
    statusSpan.textContent = d.status.replace(/-/g, " ");

    card.appendChild(matriculaSpan);
    card.appendChild(descP);
    card.appendChild(statusSpan);

    // Admin buttons
    onAuthStateChanged(auth, async user => {
      if (!user) return;
      const userSnap = await getDocs(collection(db, "users"));
      // Apenas admins podem ver botões
      const isAdmin = true; // Aqui pode implementar verificação real
      if (isAdmin) {
        const btnContainer = document.createElement("div");
        btnContainer.classList.add("admin-actions");

        const aprovarBtn = document.createElement("button");
        aprovarBtn.textContent = d.tipo === "report" ? "Solucionado" : "Aprovado";
        aprovarBtn.className = "aprovado";
        aprovarBtn.addEventListener("click", async () => {
          await updateDoc(doc(db, d.collection, d.id), { status: d.tipo === "report" ? "solucionado" : "aprovado" });
          carregarEntradas();
        });

        const reprovarBtn = document.createElement("button");
        reprovarBtn.textContent = d.tipo === "report" ? "Correção iniciada" : "Reprovado";
        reprovarBtn.className = "reprovado";
        reprovarBtn.addEventListener("click", async () => {
          await updateDoc(doc(db, d.collection, d.id), { status: d.tipo === "report" ? "correcao-iniciada" : "reprovado" });
          carregarEntradas();
        });

        const excluirBtn = document.createElement("button");
        excluirBtn.textContent = "Excluir";
        excluirBtn.className = "excluir-btn";
        excluirBtn.addEventListener("click", async () => {
          await updateDoc(doc(db, d.collection, d.id), { deleted: true });
          carregarEntradas();
        });

        btnContainer.appendChild(aprovarBtn);
        btnContainer.appendChild(reprovarBtn);
        btnContainer.appendChild(excluirBtn);
        card.appendChild(btnContainer);
      }
    });

    sugestoesList.appendChild(card);
  });
}

// 🔹 Filtro de tipo
filtroSelect.addEventListener("change", carregarEntradas);

// 🔹 Inicialização
onAuthStateChanged(auth, () => carregarEntradas());
