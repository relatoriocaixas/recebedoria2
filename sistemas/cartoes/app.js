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

// Variáveis
let cartoes = [];
let userIsAdmin = false;

// Elementos
const tabela = document.querySelector("#tabelaCartoes tbody");
const filtroTipo = document.getElementById("filtroTipo");
const filtroMatricula = document.getElementById("filtroMatricula");
const filtroIdBordo = document.getElementById("filtroIdBordo");
const filtroIdViagem = document.getElementById("filtroIdViagem");
const filtroSerial = document.getElementById("filtroSerial");
const btnFiltrar = document.getElementById("btnFiltrar");
const fileProdata = document.getElementById("fileProdata");
const fileDigicon = document.getElementById("fileDigicon");

// Autenticação
auth.onAuthStateChanged(async user => {
    if (!user) { window.location.href = "login.html"; return; }

    const snap = await db.collection("users").doc(user.uid).get();
    userIsAdmin = snap.exists && snap.data().admin === true;
});

// Upload Planilha
function handleFileUpload(file, tipo) {
    const reader = new FileReader();
    reader.onload = async e => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
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

        // Salva na Firestore
        for (let c of novaLista) {
            const docRef = db.collection("cartoes").doc();
            await docRef.set({
                matricula: c.matricula,
                nome: c.nome,
                idBordo: c.idBordo,
                idViagem: c.idViagem,
                serialBordo: c.serialBordo,
                serialViagem: c.serialViagem,
                dataRetirada: c.dataRetirada ? firebase.firestore.Timestamp.fromDate(c.dataRetirada) : null,
                tipo: c.tipo
            });
        }

        cartoes = cartoes.concat(novaLista);
        renderTabela();
        alert("Planilha processada com sucesso!");
    };
    reader.readAsArrayBuffer(file);
}

// Render tabela
function renderTabela() {
    tabela.innerHTML = "";
    let listaFiltrada = cartoes;

    if (filtroTipo.value) listaFiltrada = listaFiltrada.filter(c => c.tipo.toLowerCase() === filtroTipo.value.toLowerCase());
    if (filtroMatricula.value) listaFiltrada = listaFiltrada.filter(c => c.matricula.includes(filtroMatricula.value));
    if (filtroIdBordo.value) listaFiltrada = listaFiltrada.filter(c => c.idBordo.includes(filtroIdBordo.value));
    if (filtroIdViagem.value) listaFiltrada = listaFiltrada.filter(c => c.idViagem.includes(filtroIdViagem.value));
    if (filtroSerial.value) listaFiltrada = listaFiltrada.filter(c => c.serialBordo.includes(filtroSerial.value) || c.serialViagem.includes(filtroSerial.value));

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

// Histórico para tooltip
function getHistoricoCartao(id) {
    if (!id) return "";
    const historico = cartoes
        .filter(c => c.idBordo === id || c.idViagem === id)
        .map(c => `${c.matricula} (${c.dataRetirada ? new Date(c.dataRetirada).toLocaleDateString("pt-BR") : "-"})`);
    return historico.join(", ");
}

// Eventos
btnFiltrar.addEventListener("click", renderTabela);
fileProdata.addEventListener("change", e => {
    if (!userIsAdmin) { alert("Apenas admins podem subir planilhas"); return; }
    handleFileUpload(e.target.files[0], "prodata");
});
fileDigicon.addEventListener("change", e => {
    if (!userIsAdmin) { alert("Apenas admins podem subir planilhas"); return; }
    handleFileUpload(e.target.files[0], "digicon");
});