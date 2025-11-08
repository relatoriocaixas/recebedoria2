// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// 🔹 Import XLSX via CDN
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.2/package/xlsx.mjs";

// 🔹 Firebase config
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 🔹 Referências DOM
const tabela = document.getElementById("tabelaCartoes").querySelector("tbody");
const filtroTipo = document.getElementById("filtroTipo");
const filtroMatricula = document.getElementById("filtroMatricula");
const filtroIdBordo = document.getElementById("filtroIdBordo");
const filtroIdViagem = document.getElementById("filtroIdViagem");
const btnFiltrar = document.getElementById("btnFiltrar");

const fileProdata = document.getElementById("fileProdata");
const fileDigicon = document.getElementById("fileDigicon");

// 🔹 Dados em memória
let cartoes = [];

// 🔹 Carregar dados do Firestore
async function carregarCartoes() {
  const snapshot = await getDocs(collection(db, "cartoes"));
  cartoes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderizarTabela(cartoes);
}

// 🔹 Renderizar tabela
function renderizarTabela(lista) {
  tabela.innerHTML = "";
  lista.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.matricula}</td>
      <td>${c.nome}</td>
      <td title="${c.idBordoHistory?.join(", ") || ""}">${c.idBordo}</td>
      <td title="${c.idViagemHistory?.join(", ") || ""}">${c.idViagem}</td>
      <td title="${c.serialBordoHistory?.join(", ") || ""}">${c.serialBordo}</td>
      <td title="${c.serialViagemHistory?.join(", ") || ""}">${c.serialViagem}</td>
      <td>${c.dataRetirada}</td>
      <td>${c.tipo}</td>
    `;
    tabela.appendChild(tr);
  });
}

// 🔹 Filtrar
btnFiltrar.addEventListener("click", () => {
  const tipo = filtroTipo.value;
  const matricula = filtroMatricula.value.trim();
  const idBordo = filtroIdBordo.value.trim();
  const idViagem = filtroIdViagem.value.trim();

  const filtrados = cartoes.filter(c => {
    return (!tipo || c.tipo === tipo)
      && (!matricula || c.matricula.includes(matricula))
      && (!idBordo || c.idBordo.includes(idBordo))
      && (!idViagem || c.idViagem.includes(idViagem));
  });

  renderizarTabela(filtrados);
});

// 🔹 Upload planilha
async function handleFileUpload(file, tipo) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(worksheet);

  for (let row of json) {
    const docData = {
      matricula: row["Matricula"] || row["Matrícula"] || "",
      nome: row["Nome"] || "",
      idBordo: row["Identificador Bordo"] || row["ID. Bordo"] || "",
      idViagem: row["Identificador ½ Viagem"] || row["ID. Viagem"] || "",
      serialBordo: row["Identificação Bordo"] || row["Nº Cartão de Bordo"] || "",
      serialViagem: row["Identificação ½ Viagem"] || row["Nº Cartão Viagem"] || "",
      dataRetirada: row["Data Retirada"] || row["Desligados"] || "",
      tipo: tipo,
      // Arrays para histórico
      idBordoHistory: [],
      idViagemHistory: [],
      serialBordoHistory: [],
      serialViagemHistory: []
    };

    await addDoc(collection(db, "cartoes"), docData);
  }

  alert(`Planilha ${tipo} carregada com sucesso!`);
  carregarCartoes();
}

// 🔹 Eventos upload
fileProdata.addEventListener("change", e => {
  if (e.target.files.length) handleFileUpload(e.target.files[0], "prodata");
});
fileDigicon.addEventListener("change", e => {
  if (e.target.files.length) handleFileUpload(e.target.files[0], "digicon");
});

// 🔹 Inicialização
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  carregarCartoes();
});
