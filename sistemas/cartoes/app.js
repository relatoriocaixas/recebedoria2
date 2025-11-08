import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, getDocs, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import * as XLSX from './xlsx.mjs';

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

    const snap = await getDocs(collection(db, "users"));
    userIsAdmin = snap.docs.some(d => d.id === user.uid && d.data().admin === true);
});

// 🔹 Função para processar planilha
async function handleFileUpload(file, tipo) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { raw: false });

    const novaLista = json.map(r => {
        // 🔹 Matricula: se estiver vazia, tenta pegar de outro campo
        let matricula = r["Matrícula"] || r["matricula"] || "";
        matricula = String(matricula).trim();

        // 🔹 Data: se vier como número (Excel serial date), converte para Date
        let dataRetirada = r["Data Retirada"] || r["dataRetirada"] || null;
        if (dataRetirada) {
            if (!isNaN(dataRetirada)) {
                // Excel serial date para JS Date
                dataRetirada = new Date(Math.round((dataRetirada - 25569) * 86400 * 1000));
            } else {
                dataRetirada = new Date(dataRetirada);
            }
        } else {
            dataRetirada = null;
        }

        return {
            matricula,
            nome: r["Nome"] || r["nome"] || "",
            idBordo: String(r["ID Bordo"] || r["Identificador Bordo"] || r["Identificação Bordo"] || ""),
            idViagem: String(r["ID Viagem"] || r["Identificador ½ Viagem"] || r["Identificação ½ Viagem"] || ""),
            serialBordo: String(r["Serial Bordo"] || r["Nº Cartão de Bordo"] || ""),
            serialViagem: String(r["Serial Viagem"] || r["Nº Cartão Viagem"] || ""),
            dataRetirada,
            tipo
        };
    });

    // Atualiza lista principal
    cartoes = cartoes.concat(novaLista);
    renderTabela();
}

// 🔹 Renderizar tabela
function renderTabela() {
    tabela.innerHTML = "";
    let listaFiltrada = cartoes;

    // filtros
    if (filtroTipo.value) listaFiltrada = listaFiltrada.filter(c => c.tipo.toLowerCase() === filtroTipo.value.toLowerCase());
    if (filtroMatricula.value) listaFiltrada = listaFiltrada.filter(c => String(c.matricula).includes(filtroMatricula.value));
    if (filtroIdBordo.value) listaFiltrada = listaFiltrada.filter(c => String(c.idBordo).includes(filtroIdBordo.value));
    if (filtroIdViagem.value) listaFiltrada = listaFiltrada.filter(c => String(c.idViagem).includes(filtroIdViagem.value));

    listaFiltrada.forEach(c => {
        const tr = document.createElement("tr");

        const dataFormatada = c.dataRetirada ? c.dataRetirada.toLocaleDateString("pt-BR") : "-";

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
        .map(c => `${c.matricula || "-"} (${c.dataRetirada ? c.dataRetirada.toLocaleDateString("pt-BR") : "-"})`);
    return historico.join(", ");
}

// 🔹 Eventos
btnFiltrar.addEventListener("click", renderTabela);

fileProdata.addEventListener("change", e => {
    if (!userIsAdmin) { alert("Apenas admins podem subir planilhas"); return; }
    handleFileUpload(e.target.files[0], "prodata");
});

fileDigicon.addEventListener("change", e => {
    if (!userIsAdmin) { alert("Apenas admins podem subir pl
