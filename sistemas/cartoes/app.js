// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.19.0/package/xlsx.mjs';

// 🔹 Configuração Firebase
const firebaseConfig = {
apiKey: "AIzaSyBWmq02P8pGbl2NmppEAIKtF9KtQ7AzTFQ",
  authDomain: "unificado-441cd.firebaseapp.com",
  projectId: "unificado-441cd",
  storageBucket: "unificado-441cd.firebasestorage.app",
  messagingSenderId: "671392063569",
  appId: "1:671392063569:web:57e3f6b54fcdc45862d870",
  measurementId: "G-6GQX395J9C"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 🔹 Elementos
const tabela = document.querySelector("#tabelaCartoes tbody");
const filtroTipo = document.getElementById("filtroTipo");
const filtroMatricula = document.getElementById("filtroMatricula");
const filtroIdBordo = document.getElementById("filtroIdBordo");
const filtroIdViagem = document.getElementById("filtroIdViagem");
const btnFiltrar = document.getElementById("btnFiltrar");
const fileProdata = document.getElementById("fileProdata");
const fileDigicon = document.getElementById("fileDigicon");

// 🔹 Dados em memória
let cartoes = [];

// 🔹 Autenticação
onAuthStateChanged(auth, async user => {
  if (!user) {
    alert("Usuário não autenticado");
    return;
  }
  carregarTabela();
});

// 🔹 Função para processar planilha
async function handleFileUpload(file, tipo) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const data = e.target.result;
    const workbook = XLSX.read(data, { type: "binary" });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    const batch = [];

    json.forEach(row => {
      const item = {
        matricula: row.Matricula || row.MATRICULA || "",
        nome: row.Nome || row.NOME || "",
        idBordo: row["Identificador Bordo"] || row["ID. Bordo"] || row["ID Bordo"] || "",
        idViagem: row["Identificador ½ Viagem"] || row["ID. Viagem"] || row["ID Viagem"] || "",
        serialBordo: row["Identificação Bordo"] || row["Nº Cartão de Bordo"] || "",
        serialViagem: row["Identificação ½ Viagem"] || row["Nº Cartão Viagem"] || "",
        dataRetirada: row["Data Retirada"] ? new Date(row["Data Retirada"].split("/").reverse().join("-")) : null,
        tipo
      };
      batch.push(item);
    });

    // Salvar todos os itens no Firestore
    for (let item of batch) {
      await addDoc(collection(db, "cartoes"), item);
    }

    alert(`Planilha ${tipo} carregada com ${batch.length} registros`);
    await carregarTabela();
  };
  reader.readAsBinaryString(file);
}

// 🔹 Event Listeners upload
fileProdata.addEventListener("change", e => {
  const file = e.target.files[0];
  if (file) handleFileUpload(file, "prodata");
});

fileDigicon.addEventListener("change", e => {
  const file = e.target.files[0];
  if (file) handleFileUpload(file, "digicon");
});

// 🔹 Filtrar tabela
btnFiltrar.addEventListener("click", carregarTabela);

async function carregarTabela() {
  tabela.innerHTML = "<tr><td colspan='8'>Carregando...</td></tr>";

  const tipo = filtroTipo.value;
  const matricula = filtroMatricula.value.trim();
  const idBordo = filtroIdBordo.value.trim();
  const idViagem = filtroIdViagem.value.trim();

  let q = collection(db, "cartoes");

  // Puxar todos
  const snap = await getDocs(q);
  cartoes = [];
  snap.forEach(docSnap => {
    const data = docSnap.data();
    cartoes.push({ id: docSnap.id, ...data });
  });

  // Aplicar filtros
  let filtrados = cartoes.filter(c => {
    return (!tipo || c.tipo === tipo) &&
           (!matricula || c.matricula.includes(matricula)) &&
           (!idBordo || String(c.idBordo).includes(idBordo)) &&
           (!idViagem || String(c.idViagem).includes(idViagem));
  });

  // Montar tabela
  tabela.innerHTML = "";
  filtrados.forEach(c => {
    const tr = document.createElement("tr");

    // Hover histórico de IDs
    const bordIdCell = document.createElement("td");
    bordIdCell.textContent = c.idBordo;
    bordIdCell.title = cartoes
      .filter(x => x.idBordo === c.idBordo && x.matricula !== c.matricula && x.dataRetirada < c.dataRetirada)
      .map(x => x.matricula).join(", ");

    const viagIdCell = document.createElement("td");
    viagIdCell.textContent = c.idViagem;
    viagIdCell.title = cartoes
      .filter(x => x.idViagem === c.idViagem && x.matricula !== c.matricula && x.dataRetirada < c.dataRetirada)
      .map(x => x.matricula).join(", ");

    tr.innerHTML = `
      <td>${c.matricula}</td>
      <td>${c.nome}</td>
    `;
    tr.appendChild(bordIdCell);
    tr.appendChild(viagIdCell);

    tr.innerHTML += `
      <td>${c.serialBordo}</td>
      <td>${c.serialViagem}</td>
      <td>${c.dataRetirada ? c.dataRetirada.toLocaleDateString() : ""}</td>
      <td>${c.tipo}</td>
    `;

    tabela.appendChild(tr);
  });
}