import { auth, db } from "/sistemas/cartoes/firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, updateDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import * as XLSX from "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

const tabela = document.getElementById("tabelaCartoes").querySelector("tbody");
const filtroTipo = document.getElementById("filtroTipo");
const filtroMatricula = document.getElementById("filtroMatricula");
const filtroIdBordo = document.getElementById("filtroIdBordo");
const filtroIdViagem = document.getElementById("filtroIdViagem");
const btnFiltrar = document.getElementById("btnFiltrar");
const fileProdata = document.getElementById("fileProdata");
const fileDigicon = document.getElementById("fileDigicon");

let cartoes = [];

onAuthStateChanged(auth, async user => {
  if (!user) return;

  await carregarCartoes();
});

async function carregarCartoes() {
  cartoes = [];
  const snap = await getDocs(collection(db, "cartoes"));
  snap.forEach(docSnap => {
    cartoes.push({ id: docSnap.id, ...docSnap.data() });
  });
  renderTabela(cartoes);
}

function renderTabela(dados) {
  tabela.innerHTML = "";
  dados.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.matricula}</td>
      <td>${c.nome}</td>
      <td title="Histórico de matrículas">${c.idBordo}</td>
      <td title="Histórico de matrículas">${c.idViagem}</td>
      <td>${c.serialBordo}</td>
      <td>${c.serialViagem}</td>
      <td>${c.dataRetirada}</td>
      <td>${c.tipo}</td>
    `;
    tabela.appendChild(tr);
  });
}

btnFiltrar.addEventListener("click", () => {
  const tipo = filtroTipo.value.toLowerCase();
  const matricula = filtroMatricula.value.trim();
  const idBordo = filtroIdBordo.value.trim();
  const idViagem = filtroIdViagem.value.trim();

  let filtrados = cartoes;
  if (tipo) filtrados = filtrados.filter(c => c.tipo.toLowerCase() === tipo);
  if (matricula) filtrados = filtrados.filter(c => c.matricula.includes(matricula));
  if (idBordo) filtrados = filtrados.filter(c => c.idBordo.includes(idBordo));
  if (idViagem) filtrados = filtrados.filter(c => c.idViagem.includes(idViagem));

  renderTabela(filtrados);
});

// 🔹 Upload XLSX
async function processarArquivo(file, tipo) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet);

  for (const linha of json) {
    const novo = {
      matricula: linha.Matricula || linha["Matrícula"] || "",
      nome: linha.Nome || "",
      idBordo: linha["Identificador Bordo"] || linha["ID. Bordo"] || linha["ID. Bordo"] || "",
      idViagem: linha["Identificador ½ Viagem"] || linha["ID. Viagem"] || linha["ID. Viagem"] || "",
      serialBordo: linha["Identificação Bordo"] || linha["Nº Cartão de Bordo"] || "",
      serialViagem: linha["Identificação ½ Viagem"] || linha["Nº Cartão Viagem"] || "",
      dataRetirada: linha["Data Retirada"] || linha["Desligados"] || "",
      tipo
    };
    await addDoc(collection(db, "cartoes"), novo);
  }

  await carregarCartoes();
}

fileProdata.addEventListener("change", e => {
  if (e.target.files.length) processarArquivo(e.target.files[0], "prodata");
});

fileDigicon.addEventListener("change", e => {
  if (e.target.files.length) processarArquivo(e.target.files[0], "digicon");
});
