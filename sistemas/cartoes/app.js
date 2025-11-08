// ✅ firebaseConfig como módulo ES
import { auth, db } from "./firebaseConfig.js";
import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
    collection,
    getDocs,
    setDoc,
    doc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ✅ XLSX JÁ ESTÁ DISPONÍVEL GLOBALMENTE
// NÃO IMPORTAR, NÃO USAR "import XLSX", NEM "import * as XLSX"

// ===================================================================
// VARIÁVEIS
// ===================================================================

let cartoes = [];
let userIsAdmin = false;

// ===================================================================
// ELEMENTOS
// ===================================================================

const tabela = document.getElementById("tabelaCartoes").querySelector("tbody");
const filtroTipo = document.getElementById("filtroTipo");
const filtroMatricula = document.getElementById("filtroMatricula");
const filtroIdBordo = document.getElementById("filtroIdBordo");
const filtroIdViagem = document.getElementById("filtroIdViagem");
const filtroSerial = document.getElementById("filtroSerial");
const btnFiltrar = document.getElementById("btnFiltrar");

const fileProdata = document.getElementById("fileProdata");
const fileDigicon = document.getElementById("fileDigicon");

// ===================================================================
// LOGIN + PERMISSÃO
// ===================================================================

onAuthStateChanged(auth, async user => {
    if (!user) {
        window.location.href = "/login.html";
        return;
    }

    const snap = await getDocs(collection(db, "users"));
    userIsAdmin = snap.docs.some(doc => doc.id === user.uid && doc.data().admin === true);
});

// ===================================================================
// CONVERSÃO DE DATA DO EXCEL (ex: 45722 → data real)
// ===================================================================

function excelDateToJS(value) {
    if (!value || isNaN(value)) return null;
    return new Date((value - 25569) * 86400000);
}

// ===================================================================
// PROCESSAMENTO DA PLANILHA
// ===================================================================

async function handleFileUpload(file, tipo) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { raw: false });

    const registros = json.map(r => ({
        matricula: String(r["Matrícula"] || r["Matricula"] || r["matricula"] || "").trim(),
        nome: r["Nome"] || "",
        idBordo: String(r["ID Bordo"] || r["Identificador Bordo"] || r["Identificação Bordo"] || ""),
        idViagem: String(r["ID Viagem"] || r["Identificador ½ Viagem"] || r["Identificação ½ Viagem"] || ""),
        serialBordo: String(r["Serial Bordo"] || r["Nº Cartão de Bordo"] || ""),
        serialViagem: String(r["Serial Viagem"] || r["Nº Cartão Viagem"] || ""),

        // ✅ converte data númerica ou data normal
        dataRetirada: (() => {
            const d = r["Data Retirada"];
            if (!d) return null;

            if (!isNaN(d)) return excelDateToJS(Number(d));
            return new Date(d);
        })(),

        tipo
    }));

    // ✅ salva todos no Firestore
    for (const c of registros) {
        const ref = doc(collection(db, "cartoes"));
        await setDoc(ref, {
            ...c,
            criadoEm: serverTimestamp()
        });
    }

    // ✅ carrega no array local
    cartoes = cartoes.concat(registros);

    // ✅ renderiza tabela
    renderTabela();
}

// ===================================================================
// RENDERIZA A TABELA
// ===================================================================

function renderTabela() {
    tabela.innerHTML = "";

    let lista = cartoes;

    if (filtroTipo.value) lista = lista.filter(c => c.tipo === filtroTipo.value);
    if (filtroMatricula.value) lista = lista.filter(c => c.matricula.includes(filtroMatricula.value));
    if (filtroIdBordo.value) lista = lista.filter(c => c.idBordo.includes(filtroIdBordo.value));
    if (filtroIdViagem.value) lista = lista.filter(c => c.idViagem.includes(filtroIdViagem.value));

    if (filtroSerial.value) {
        lista = lista.filter(c =>
            c.serialBordo.includes(filtroSerial.value) ||
            c.serialViagem.includes(filtroSerial.value)
        );
    }

    lista.forEach(c => {
        const tr = document.createElement("tr");

        const dataFormatada = c.dataRetirada
            ? new Date(c.dataRetirada).toLocaleDateString("pt-BR")
            : "-";

        tr.innerHTML = `
            <td>${c.matricula}</td>
            <td>${c.nome}</td>
            <td title="${getHistorico(c.idBordo)}">${c.idBordo}</td>
            <td title="${getHistorico(c.idViagem)}">${c.idViagem}</td>
            <td>${c.serialBordo}</td>
            <td>${c.serialViagem}</td>
            <td>${dataFormatada}</td>
            <td>${c.tipo}</td>
        `;

        tabela.appendChild(tr);
    });
}

// ===================================================================
// HISTÓRICO DO CARTÃO (TOOLTIP)
// ===================================================================

function getHistorico(id) {
    if (!id) return "";
    return cartoes
        .filter(c => c.idBordo === id || c.idViagem === id)
        .map(c => `${c.matricula} - ${(c.dataRetirada ? new Date(c.dataRetirada).toLocaleDateString("pt-BR") : "-")}`)
        .join("\n");
}

// ===================================================================
// EVENTOS
// ===================================================================

btnFiltrar.addEventListener("click", renderTabela);

fileProdata.addEventListener("change", e => {
    if (!userIsAdmin) return alert("Apenas admins podem enviar planilhas.");
    handleFileUpload(e.target.files[0], "prodata");
});

fileDigicon.addEventListener("change", e => {
    if (!userIsAdmin) return alert("Apenas admins podem enviar planilhas.");
    handleFileUpload(e.target.files[0], "digicon");
});
