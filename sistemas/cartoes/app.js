import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, getDocs, setDoc, doc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let cartoes = [];
let userIsAdmin = false;

// Elementos
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

    const userRef = doc(db, "users", user.uid);
    const snap = await getDocs(collection(db, "users"));
    userIsAdmin = snap.docs.some(d => d.id === user.uid && d.data().admin === true);

    // Carrega dados existentes do Firestore
    await carregarCartoesFirestore();
});

// 🔹 Função para processar planilha
async function handleFileUpload(file, tipo) {
    if (!userIsAdmin) { alert("Apenas admins podem subir planilhas"); return; }

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

    // Atualiza lista principal e salva no Firestore
    cartoes = cartoes.concat(novaLista);
    await salvarCartoesFirestore(novaLista);
    renderTabela();
}

// 🔹 Salvar no Firestore
async function salvarCartoesFirestore(lista) {
    const colecaoRef = collection(db, "cartoes");
    for (let c of lista) {
        try {
            await addDoc(colecaoRef, {
                matricula: c.matricula,
                nome: c.nome,
                idBordo: c.idBordo,
                idViagem: c.idViagem,
                serialBordo: c.serialBordo,
                serialViagem: c.serialViagem,
                dataRetirada: c.dataRetirada ? serverTimestamp() : null,
                tipo: c.tipo
            });
        } catch (err) {
            console.error("Erro ao salvar cartão:", err);
        }
    }
}

// 🔹 Carregar do Firestore
async function carregarCartoesFirestore() {
    const snapshot = await getDocs(collection(db, "cartoes"));
    cartoes = snapshot.docs.map(d => {
        const data = d.data();
        return {
            matricula: data.matricula || "",
            nome: data.nome || "",
            idBordo: data.idBordo || "",
            idViagem: data.idViagem || "",
            serialBordo: data.serialBordo || "",
            serialViagem: data.serialViagem || "",
            dataRetirada: data.dataRetirada ? data.dataRetirada.toDate() : null,
            tipo: data.tipo || ""
        };
    });
    renderTabela();
}

// 🔹 Renderizar tabela
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
fileProdata.addEventListener("change", e => handleFileUpload(e.target.files[0], "prodata"));
fileDigicon.addEventListener("change", e => handleFileUpload(e.target.files[0], "digicon"));
