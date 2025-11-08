// ✅ Firebase já está inicializado pelo portal principal
const db = firebase.firestore();
const auth = firebase.auth();

// 🔹 Variáveis globais
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

// ✅ Autenticação sem reinicializar firebase
auth.onAuthStateChanged(async user => {
  if (!user) return;

  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();
  userIsAdmin = snap.exists && snap.data().admin === true;

  // Carrega cartões existentes
  const listaSnap = await db.collection("cartoes").get();
  cartoes = listaSnap.docs.map(d => d.data());

  renderTabela();
});

// ✅ Upload de planilha usando SheetJS já carregado pelo <script>
async function handleFileUpload(file, tipo) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const ws = workbook.Sheets[workbook.SheetNames[0]];

  const json = XLSX.utils.sheet_to_json(ws, { raw: false });

  const novaLista = json.map(r => ({
    matricula: String(r["Matrícula"] || r["matricula"] || "").trim(),
    nome: r["Nome"] || "",
    idBordo: String(r["ID Bordo"] || r["Identificador Bordo"] || r["Identificação Bordo"] || ""),
    idViagem: String(r["ID Viagem"] || r["Identificador ½ Viagem"] || r["Identificação ½ Viagem"] || ""),
    serialBordo: String(r["Serial Bordo"] || r["Nº Cartão de Bordo"] || ""),
    serialViagem: String(r["Serial Viagem"] || r["Nº Cartão Viagem"] || ""),
    dataRetirada: r["Data Retirada"] ? new Date(r["Data Retirada"]) : null,
    tipo: tipo
  }));

  // ✅ Somente admins salvam
  if (userIsAdmin) {
    const batch = db.batch();
    novaLista.forEach(c => {
      const docRef = db.collection("cartoes").doc();
      batch.set(docRef, c);
    });
    await batch.commit();
  }

  cartoes = cartoes.concat(novaLista);
  renderTabela();
}

// ✅ Renderização da Tabela
function renderTabela() {
  tabela.innerHTML = "";

  let lista = cartoes;

  if (filtroTipo.value) lista = lista.filter(c => c.tipo === filtroTipo.value);
  if (filtroMatricula.value) lista = lista.filter(c => c.matricula.includes(filtroMatricula.value));
  if (filtroIdBordo.value) lista = lista.filter(c => c.idBordo.includes(filtroIdBordo.value));
  if (filtroIdViagem.value) lista = lista.filter(c => c.idViagem.includes(filtroIdViagem.value));
  if (filtroSerial.value) lista = lista.filter(c =>
    c.serialBordo.includes(filtroSerial.value) || c.serialViagem.includes(filtroSerial.value)
  );

  lista.forEach(c => {
    const tr = document.createElement("tr");

    const dataFmt = c.dataRetirada
      ? new Date(c.dataRetirada).toLocaleDateString("pt-BR")
      : "-";

    tr.innerHTML = `
      <td>${c.matricula}</td>
      <td>${c.nome}</td>
      <td title="${getHistorico(c.idBordo)}">${c.idBordo}</td>
      <td title="${getHistorico(c.idViagem)}">${c.idViagem}</td>
      <td>${c.serialBordo}</td>
      <td>${c.serialViagem}</td>
      <td>${dataFmt}</td>
      <td>${c.tipo}</td>
    `;
    tabela.appendChild(tr);
  });
}

// ✅ Hover de histórico
function getHistorico(id) {
  if (!id) return "";
  return cartoes
    .filter(c => c.idBordo === id || c.idViagem === id)
    .map(c => `${c.matricula} (${c.dataRetirada ? new Date(c.dataRetirada).toLocaleDateString("pt-BR") : "-"})`)
    .join(", ");
}

// ✅ Eventos
btnFiltrar.addEventListener("click", renderTabela);
fileProdata.addEventListener("change", e => handleFileUpload(e.target.files[0], "prodata"));
fileDigicon.addEventListener("change", e => handleFileUpload(e.target.files[0], "digicon"));
