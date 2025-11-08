// Inicialização Firebase
const firebaseConfig = {
apiKey: "AIzaSyBWmq02P8pGbl2NmppEAIKtF9KtQ7AzTFQ",
  authDomain: "unificado-441cd.firebaseapp.com",
  projectId: "unificado-441cd",
  storageBucket: "unificado-441cd.firebasestorage.app",
  messagingSenderId: "671392063569",
  appId: "1:671392063569:web:57e3f6b54fcdc45862d870",
  measurementId: "G-6GQX395J9C"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// 🔹 Variáveis
let cartoes = [];
let userIsAdmin = false;

// 🔹 Elementos
const tabela = document.querySelector("#tabelaCartoes tbody");
const filtroTipo = document.getElementById("filtroTipo");
const filtroMatricula = document.getElementById("filtroMatricula");
const filtroIdBordo = document.getElementById("filtroIdBordo");
const filtroIdViagem = document.getElementById("filtroIdViagem");
const filtroSerial = document.getElementById("filtroSerial");
const btnFiltrar = document.getElementById("btnFiltrar");
const fileProdata = document.getElementById("fileProdata");
const fileDigicon = document.getElementById("fileDigicon");

// 🔹 Autenticação
auth.onAuthStateChanged(async user => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const userSnap = await db.collection("users").doc(user.uid).get();
  userIsAdmin = userSnap.exists && userSnap.data().admin === true;

  // Carrega cartões já salvos no Firebase
  const snapshot = await db.collection("cartoes").get();
  cartoes = snapshot.docs.map(doc => doc.data());
  renderTabela();
});

// 🔹 Upload
async function handleFileUpload(file, tipo) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { raw: false });

  const novaLista = json.map(r => ({
    matricula: String(r["Matrícula"] || r["matricula"] || "").trim(),
    nome: r["Nome"] || r["nome"] || "",
    idBordo: String(r["ID Bordo"] || r["Identificador Bordo"] || r["Identificação Bordo"] || ""),
    idViagem: String(r["ID Viagem"] || r["Identificador ½ Viagem"] || r["Identificação ½ Viagem"] || ""),
    serialBordo: String(r["Serial Bordo"] || r["Nº Cartão de Bordo"] || ""),
    serialViagem: String(r["Serial Viagem"] || r["Nº Cartão Viagem"] || ""),
    dataRetirada: r["Data Retirada"] ? new Date(r["Data Retirada"]) : null,
    tipo: tipo
  }));

  // Salva na Firebase
  if (userIsAdmin) {
    const batch = db.batch();
    novaLista.forEach(c => {
      const docRef = db.collection("cartoes").doc(); // cria doc auto id
      batch.set(docRef, c);
    });
    await batch.commit();
  }

  cartoes = cartoes.concat(novaLista);
  renderTabela();
}

// 🔹 Renderiza tabela
function renderTabela() {
  tabela.innerHTML = "";
  let listaFiltrada = cartoes;

  if (filtroTipo.value) listaFiltrada = listaFiltrada.filter(c => c.tipo.toLowerCase() === filtroTipo.value.toLowerCase());
  if (filtroMatricula.value) listaFiltrada = listaFiltrada.filter(c => String(c.matricula).includes(filtroMatricula.value));
  if (filtroIdBordo.value) listaFiltrada = listaFiltrada.filter(c => String(c.idBordo).includes(filtroIdBordo.value));
  if (filtroIdViagem.value) listaFiltrada = listaFiltrada.filter(c => String(c.idViagem).includes(filtroIdViagem.value));
  if (filtroSerial.value) listaFiltrada = listaFiltrada.filter(c => String(c.serialBordo).includes(filtroSerial.value) || String(c.serialViagem).includes(filtroSerial.value));

  listaFiltrada.forEach(c => {
    const tr = document.createElement("tr");
    const dataFormatada = c.dataRetirada ? new Date(c.dataRetirada).toLocaleDateString("pt-BR") : "-";

    tr.innerHTML = `
      <td>${c.matricula}</td>
      <td>${c.nome}</td>
      <td title="${getHistoricoCartao(c.idBordo)}">${c.idBordo}</td>
      <td title="${getHistoricoCartao(c.idViagem)}">${c.idViagem}</td>
      <td>${c.serialBordo}</td>
      <td>${c.serialViagem}</td>
      <td>${dataFormatada}</td>
      <td>${c.tipo}</td>
    `;
    tabela.appendChild(tr);
  });
}

// 🔹 Histórico do cartão (hover)
function getHistoricoCartao(id) {
  if (!id) return "";
  const historico = cartoes
    .filter(c => c.idBordo === id || c.idViagem === id)
    .map(c => `${c.matricula} (${c.dataRetirada ? new Date(c.dataRetirada).toLocaleDateString("pt-BR") : "-"})`);
  return historico.join(", ");
}

// 🔹 Eventos
btnFiltrar.addEventListener("click", renderTabela);

fileProdata.addEventListener("change", e => {
  if (!userIsAdmin) { alert("Apenas admins podem subir planilhas"); return; }
  handleFileUpload(e.target.files[0], "prodata");
});

fileDigicon.addEventListener("change", e => {
  if (!userIsAdmin) { alert("Apenas admins podem subir planilhas"); return; }
  handleFileUpload(e.target.files[0], "digicon");
});