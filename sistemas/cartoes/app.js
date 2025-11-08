import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, setDoc, doc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

let cartoes = []; // armazenará os cartões carregados da planilha
let userIsAdmin = false;

// 🔹 Elementos
const tabela = document.getElementById("tabelaCartoes").querySelector("tbody");
const filtroTipo = document.getElementById("filtroTipo");
const filtroMatricula = document.getElementById("filtroMatricula");
const filtroIdBordo = document.getElementById("filtroIdBordo");
const filtroIdViagem = document.getElementById("filtroIdViagem");
const btnFiltrar = document.getElementById("btnFiltrar");
const fileProdata = document.getElementById("fileProdata");
const fileDigicon = document.getElementById("fileDigicon");

// 🔹 Autenticação
onAuthStateChanged(auth, async user => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    // Verifica se o usuário é admin
    const snap = await getDocs(collection(db, "users"));
    userIsAdmin = snap.docs.some(d => d.id === user.uid && d.data().admin === true);

    // Carrega os cartões já existentes no Firestore
    await carregarCartoesFirestore();
    renderTabela();
});

// 🔹 Carregar cartões do Firestore
async function carregarCartoesFirestore() {
    const snapshot = await getDocs(collection(db, "cartoes"));
    cartoes = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            matricula: data.matricula || "",
            nome: data.nome || "",
            idBordo: String(data.idBordo || ""),
            idViagem: String(data.idViagem || ""),
            serialBordo: String(data.serialBordo || ""),
            serialViagem: String(data.serialViagem || ""),
            dataRetirada: data.dataRetirada ? new Date(data.dataRetirada.seconds * 1000) : null,
            tipo: data.tipo || ""
        };
    });
}

// 🔹 Função para processar planilha
async function handleFileUpload(file, tipo) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { raw: false });

    for (const r of json) {
        const matricula = String(r["Matrícula"] || r["matricula"] || "").trim();
        const nome = r["Nome"] || r["nome"] || "";
        const idBordo = String(r["ID Bordo"] || r["Identificador Bordo"] || r["Identificação Bordo"] || "");
        const idViagem = String(r["ID Viagem"] || r["Identificador ½ Viagem"] || r["Identificação ½ Viagem"] || "");
        const serialBordo = String(r["Serial Bordo"] || r["Nº Cartão de Bordo"] || "");
        const serialViagem = String(r["Serial Viagem"] || r["Nº Cartão Viagem"] || "");
        let dataRetiradaRaw = r["Data Retirada"] || r["dataRetirada"];
        let dataRetirada = null;

        if (dataRetiradaRaw) {
            if (!isNaN(Date.parse(dataRetiradaRaw))) {
                dataRetirada = new Date(dataRetiradaRaw);
            } else if (!isNaN(dataRetiradaRaw)) {
                // Caso Excel passe como número de dias desde 1900
                dataRetirada = XLSX.SSF.parse_date_code(Number(dataRetiradaRaw));
                dataRetirada = new Date(dataRetirada.y, dataRetirada.m - 1, dataRetirada.d);
            }
        }

        const cartaoObj = { matricula, nome, idBordo, idViagem, serialBordo, serialViagem, dataRetirada, tipo };

        // Salva na Firestore se admin
        if (userIsAdmin) {
            const docRef = doc(collection(db, "cartoes"));
            await setDoc(docRef, {
                ...cartaoObj,
                dataRetirada: dataRetirada ? serverTimestamp() : null,
                createdAt: serverTimestamp()
            });
        }

        cartoes.push(cartaoObj);
    }

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

// 🔹 Retorna histórico do cartão para tooltip
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
