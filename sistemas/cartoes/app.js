// 🔹 App.js - Pesquisa de Cartões (XLSX global + Firebase)
import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, getDocs, setDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let cartoes = []; // Armazena cartões carregados
let userIsAdmin = false;

// 🔹 Elementos
const tabela = document.getElementById("tabelaCartoes").querySelector("tbody");
const filtroTipo = document.getElementById("filtroTipo");
const filtroMatricula = document.getElementById("filtroMatricula");
const filtroIdBordo = document.getElementById("filtroIdBordo");
const filtroIdViagem = document.getElementById("filtroIdViagem");
const filtroSerial = document.getElementById("filtroSerial");
const btnFiltrar = document.getElementById("btnFiltrar");
const fileProdata = document.getElementById("fileProdata");
const fileDigicon = document.getElementById("fileDigicon");

// 🔹 Autenticação
onAuthStateChanged(auth, async user => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    const snap = await getDocs(collection(db, "users"));
    userIsAdmin = snap.docs.some(d => d.id === user.uid && d.data().admin === true);

    // Carregar dados existentes da Firestore
    const snapshot = await getDocs(collection(db, "cartoes"));
    cartoes = snapshot.docs.map(doc => doc.data());
    renderTabela();
});

// 🔹 Função para processar planilha
async function handleFileUpload(file, tipo) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { raw: false });

    const novaLista = json.map(r => {
        let matricula = String(r["Matrícula"] || r["matricula"] || "").trim();
        let nome = r["Nome"] || r["nome"] || "";
        let idBordo = String(r["ID Bordo"] || r["Identificador Bordo"] || r["Identificação Bordo"] || "");
        let idViagem = String(r["ID Viagem"] || r["Identificador ½ Viagem"] || r["Identificação ½ Viagem"] || "");
        let serialBordo = String(r["Serial Bordo"] || r["Nº Cartão de Bordo"] || "");
        let serialViagem = String(r["Serial Viagem"] || r["Nº Cartão Viagem"] || "");
        let dataRetirada = r["Data Retirada"];
        if (dataRetirada) {
            // Se veio como número do Excel, converte
            if (!isNaN(dataRetirada)) {
                dataRetirada = new Date((dataRetirada - 25569) * 86400000);
            } else {
                dataRetirada = new Date(dataRetirada);
            }
        } else {
            dataRetirada = null;
        }
        return { matricula, nome, idBordo, idViagem, serialBordo, serialViagem, dataRetirada, tipo };
    });

    // Salvar na Firestore
    if (userIsAdmin) {
        const batchPromises = novaLista.map(async c => {
            const id = `${c.tipo}_${c.matricula}_${c.idBordo}_${c.idViagem}_${c.serialBordo}_${c.serialViagem}`;
            await setDoc(doc(db, "cartoes", id), { ...c, createdAt: serverTimestamp() });
        });
        await Promise.all(batchPromises);
        console.log("✅ Planilha salva na Firestore");
    }

    cartoes = cartoes.concat(novaLista);
    renderTabela();
}

// 🔹 Renderizar tabela
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

// 🔹 Histórico de matriculas para tooltip
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
