import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, getDocs, setDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import * as XLSX from './xlsx.mjs';

let cartoes = [];
let userIsAdmin = false;

const tabela = document.getElementById("tabelaCartoes").querySelector("tbody");
const filtroTipo = document.getElementById("filtroTipo");
const filtroMatricula = document.getElementById("filtroMatricula");
const filtroIdBordo = document.getElementById("filtroIdBordo");
const filtroIdViagem = document.getElementById("filtroIdViagem");
const filtroSerial = document.getElementById("filtroSerial");
const btnFiltrar = document.getElementById("btnFiltrar");
const fileProdata = document.getElementById("fileProdata");
const fileDigicon = document.getElementById("fileDigicon");

// ✅ Conversor correto de serial Excel → Data real
function excelDateToJS(number) {
    if (!number) return null;
    return new Date((number - 25569) * 86400000);
}

onAuthStateChanged(auth, async user => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    const snap = await getDocs(collection(db, "users"));
    userIsAdmin = snap.docs.some(d => d.id === user.uid && d.data().admin === true);
});

// ✅ Função corrigida para leitura da planilha
async function handleFileUpload(file, tipo) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { raw: false });

    const novaLista = json.map(r => {
        const matricula =
            String(
                r["Matrícula"] ||
                r["Matricula"] ||
                r["Matricula "] ||
                r[" Matricula"] ||
                r["matricula"] ||
                r["Matrícula "] ||
                ""
            ).trim();

        const dt = r["Data Retirada"];

        return {
            matricula,
            nome: r["Nome"] || r["nome"] || "",
            idBordo: String(
                r["ID Bordo"] ||
                r["Identificador Bordo"] ||
                r["Identificação Bordo"] ||
                ""
            ),
            idViagem: String(
                r["ID Viagem"] ||
                r["Identificador ½ Viagem"] ||
                r["Identificação ½ Viagem"] ||
                ""
            ),
            serialBordo: String(r["Serial Bordo"] || r["Nº Cartão de Bordo"] || ""),
            serialViagem: String(r["Serial Viagem"] || r["Nº Cartão Viagem"] || ""),
            dataRetirada:
                typeof dt === "number"
                    ? excelDateToJS(dt)
                    : dt ? new Date(dt) : null,
            tipo
        };
    });

    cartoes = cartoes.concat(novaLista);
    renderTabela();
}

// ✅ render tabela (filtros + tooltip histórico)
function renderTabela() {
    tabela.innerHTML = "";
    let lista = cartoes;

    if (filtroTipo.value)
        lista = lista.filter(c => c.tipo.toLowerCase() === filtroTipo.value.toLowerCase());

    if (filtroMatricula.value)
        lista = lista.filter(c => String(c.matricula).includes(filtroMatricula.value));

    if (filtroIdBordo.value)
        lista = lista.filter(c => String(c.idBordo).includes(filtroIdBordo.value));

    if (filtroIdViagem.value)
        lista = lista.filter(c => String(c.idViagem).includes(filtroIdViagem.value));

    if (filtroSerial.value)
        lista = lista.filter(
            c =>
                String(c.serialBordo).includes(filtroSerial.value) ||
                String(c.serialViagem).includes(filtroSerial.value)
        );

    lista.forEach(c => {
        const tr = document.createElement("tr");
        const dataFormatada = c.dataRetirada
            ? new Date(c.dataRetirada).toLocaleDateString("pt-BR")
            : "-";

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

// ✅ tooltip histórico
function getHistoricoCartao(id) {
    if (!id) return "";
    return cartoes
        .filter(c => c.idBordo === id || c.idViagem === id)
        .map(c => `${c.matricula} (${c.dataRetirada ? new Date(c.dataRetirada).toLocaleDateString("pt-BR") : "-"})`)
        .join(", ");
}

// ✅ eventos
btnFiltrar.addEventListener("click", renderTabela);

fileProdata.addEventListener("change", e => {
    if (!userIsAdmin) return alert("Apenas admins podem subir planilhas");
    handleFileUpload(e.target.files[0], "prodata");
});

fileDigicon.addEventListener("change", e => {
    if (!userIsAdmin) return alert("Apenas admins podem subir planilhas");
    handleFileUpload(e.target.files[0], "digicon");
});
