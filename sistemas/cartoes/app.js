// cartoes.js — versão para iframe (usa Auth do portal e Firestore localmente)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, getDocs, query, where, orderBy 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.2/package/xlsx.mjs";
import { firebaseConfig } from "./firebaseConfig.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Captura Auth do portal (sem inicializar getAuth local)
let currentUser = null;
let isAdmin = false;

// 🔄 Aguarda que o portal envie o user autenticado via postMessage
window.addEventListener("message", (event) => {
  if (!event.data?.user) return;
  currentUser = event.data.user;
  carregarPermissoes();
  carregarCartoes();
}, false);

// ✅ Envia requisição ao portal para receber o usuário atual
window.parent?.postMessage({ action: "getUser" }, "*");

// --- Elementos DOM ---
const fileProdata = document.getElementById("fileProdata");
const fileDigicon = document.getElementById("fileDigicon");
const tabela = document.querySelector("#tabelaCartoes tbody");
const btnLimpar = document.getElementById("btnLimpar");

const filtroTipo = document.getElementById("filtroTipo");
const filtroMatricula = document.getElementById("filtroMatricula");
const filtroIdBordo = document.getElementById("filtroIdBordo");
const filtroIdViagem = document.getElementById("filtroIdViagem");
const filtroSerial = document.getElementById("filtroSerial");

let cartoes = [];

// --- Funções ---
function excelDateToJSDate(excelSerial) {
  if (!excelSerial) return "";
  if (typeof excelSerial === "string") return excelSerial;
  const date = new Date((excelSerial - 25569) * 86400 * 1000);
  return date.toLocaleDateString("pt-BR");
}

async function carregarPermissoes() {
  if (!currentUser?.uid) return;
  try {
    const usersSnap = await getDocs(query(collection(db, "users"), where("uid", "==", currentUser.uid)));
    if (!usersSnap.empty) {
      const userDoc = usersSnap.docs[0].data();
      isAdmin = userDoc.admin || false;
      aplicarPermissoes();
    }
  } catch (e) {
    console.error("Erro ao verificar permissões:", e);
  }
}

/** ✅ Mostrar upload apenas se admin */
function aplicarPermissoes() {
  const uploadBtns = document.querySelectorAll(".upload-btn");
  uploadBtns.forEach(btn => {
    btn.style.display = isAdmin ? "inline-block" : "none";
  });
}

async function handleFileUpload(file, tipo) {
  if (!file) return;

  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

  const parsed = json.map(row => ({
    matricula: row.Matricula || row.MATRICULA || row["Matricula "] || "",
    nome: row.Nome || row.NOME || "",
    idBordo: row["Identificador Bordo"] || row["ID. Bordo"] || "",
    idViagem:
      row["Identificador ½ Viagem"] ||
      row["Identificador 1/2 Viagem"] ||
      row["ID. Viagem"] || "",
    serialBordo:
      row["Identificação Bordo"] || row["Nº Cartão de Bordo"] || "",
    serialViagem:
      row["Identificação ½ Viagem"] ||
      row["Identificação 1/2 Viagem"] ||
      row["Nº Cartão Viagem"] || "",
    dataRetirada: excelDateToJSDate(row["Data Retirada"] || row["Desligados"]),
    tipo
  }));

  if (isAdmin) {
    for (const c of parsed) {
      await addDoc(collection(db, "cartoes"), c);
    }
    alert(`Planilha ${tipo} enviada com sucesso!`);
  }

  cartoes.push(...parsed);
  renderTabela(cartoes);
}

fileProdata?.addEventListener("change", async e => {
  await handleFileUpload(e.target.files[0], "prodata");
  e.target.value = "";
});

fileDigicon?.addEventListener("change", async e => {
  await handleFileUpload(e.target.files[0], "digicon");
  e.target.value = "";
});

async function carregarCartoes() {
  const q = query(collection(db, "cartoes"), orderBy("matricula"));
  const ss = await getDocs(q);
  cartoes = ss.docs.map(doc => doc.data());
  renderTabela(cartoes);
}

function renderTabela(lista) {
  tabela.innerHTML = "";
  lista.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.matricula}</td>
      <td>${c.nome}</td>
      <td>${c.idBordo}</td>
      <td>${c.idViagem}</td>
      <td>${c.serialBordo}</td>
      <td>${c.serialViagem}</td>
      <td>${c.dataRetirada}</td>
      <td>${c.tipo}</td>
    `;
    tabela.appendChild(tr);
  });
}

/** ✅ Filtros instantâneos */
function aplicarFiltros() {
  const tipo = filtroTipo.value;
  const mat = filtroMatricula.value.trim();
  const bordo = filtroIdBordo.value.trim();
  const viagem = filtroIdViagem.value.trim();
  const serial = filtroSerial.value.trim();

  const filtrado = cartoes.filter(c =>
    (!tipo || c.tipo === tipo) &&
    (!mat || String(c.matricula).includes(mat)) &&
    (!bordo || String(c.idBordo).includes(bordo)) &&
    (!viagem || String(c.idViagem).includes(viagem)) &&
    (!serial ||
      String(c.serialBordo).includes(serial) ||
      String(c.serialViagem).includes(serial))
  );

  renderTabela(filtrado);
}

[filtroTipo, filtroMatricula, filtroIdBordo, filtroIdViagem, filtroSerial]
  .forEach(el => el?.addEventListener("input", aplicarFiltros));

btnLimpar?.addEventListener("click", () => {
  filtroTipo.value = "";
  filtroMatricula.value = "";
  filtroIdBordo.value = "";
  filtroIdViagem.value = "";
  filtroSerial.value = "";
  renderTabela(cartoes);
});
