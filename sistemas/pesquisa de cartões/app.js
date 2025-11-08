import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, addDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import * as XLSX from "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

let userData = null;
let isAdmin = false;
let histCache = {};

onAuthStateChanged(auth, async (user) => {
  if (!user) return window.location.href = "/login.html";

  userData = { uid: user.uid, email: user.email };
  // Checa admin
  const snap = await getDocs(collection(db, "users"));
  const currentUser = snap.docs.find(d => d.data().email === user.email);
  isAdmin = currentUser ? currentUser.data().admin : false;

  carregarTabela();

  document.getElementById("btnFiltrar").onclick = carregarTabela;
  document.getElementById("fileProdata").onchange = e => uploadPlanilha(e, "prodata");
  document.getElementById("fileDigicon").onchange = e => uploadPlanilha(e, "digicon");
});

// Função para processar upload
async function uploadPlanilha(event, tipo) {
  if (!isAdmin) return alert("Apenas admins podem subir planilhas");

  const file = event.target.files[0];
  if (!file) return;

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

  for (let row of json) {
    const cartao = {
      matricula: row.Matricula || row.Matrícula || "",
      nome: row.Nome || "",
      idBordo: row["Identificador Bordo"] || row["ID. Bordo"] || "",
      idViagem: row["Identificador ½ Viagem"] || row["ID. Viagem"] || "",
      serialBordo: row["Identificação Bordo"] || row["Nº Cartão de Bordo"] || "",
      serialViagem: row["Identificação ½ Viagem"] || row["Nº Cartão Viagem"] || "",
      dataRetirada: row["Data Retirada"] ? new Date(row["Data Retirada"]) : null,
      tipo
    };

    await addDoc(collection(db, "cartoes"), cartao);
  }

  alert(`Planilha ${tipo} carregada!`);
  carregarTabela();
}

// Função para carregar tabela
async function carregarTabela() {
  const tipoFiltro = document.getElementById("filtroTipo").value;
  const matriculaFiltro = document.getElementById("filtroMatricula").value.trim();
  const idBordoFiltro = document.getElementById("filtroIdBordo").value.trim();
  const idViagemFiltro = document.getElementById("filtroIdViagem").value.trim();

  const q = query(collection(db, "cartoes"), orderBy("matricula"));
  const snap = await getDocs(q);
  const tbody = document.querySelector("#tabelaCartoes tbody");
  tbody.innerHTML = "";

  const dados = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Construir cache histórico de IDs
  histCache = {};
  dados.forEach(d => {
    if (!histCache[d.idBordo]) histCache[d.idBordo] = [];
    histCache[d.idBordo].push(d.matricula);
    if (!histCache[d.idViagem]) histCache[d.idViagem] = [];
    histCache[d.idViagem].push(d.matricula);
  });

  dados
    .filter(d => (!tipoFiltro || d.tipo === tipoFiltro) &&
                 (!matriculaFiltro || d.matricula.includes(matriculaFiltro)) &&
                 (!idBordoFiltro || d.idBordo.toString().includes(idBordoFiltro)) &&
                 (!idViagemFiltro || d.idViagem.toString().includes(idViagemFiltro)))
    .forEach(d => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.matricula}</td>
        <td>${d.nome}</td>
        <td class="hover-id" data-id="${d.idBordo}">${d.idBordo}</td>
        <td class="hover-id" data-id="${d.idViagem}">${d.idViagem}</td>
        <td>${d.serialBordo}</td>
        <td>${d.serialViagem}</td>
        <td>${d.dataRetirada ? d.dataRetirada.toDate ? d.dataRetirada.toDate().toLocaleDateString() : new Date(d.dataRetirada).toLocaleDateString() : "-"}</td>
        <td>${d.tipo}</td>
      `;
      tbody.appendChild(tr);
    });

  // Hover com cache
  document.querySelectorAll(".hover-id").forEach(td => {
    td.onmouseenter = (e) => {
      const val = td.dataset.id;
      const tooltip = document.createElement("div");
      tooltip.className = "tooltip";
      tooltip.textContent = histCache[val] ? histCache[val].join(", ") : "-";
      document.body.appendChild(tooltip);

      const rect = td.getBoundingClientRect();
      tooltip.style.top = rect.top - 30 + "px";
      tooltip.style.left = rect.left + "px";

      td.onmouseleave = () => tooltip.remove();
    };
  });
}
