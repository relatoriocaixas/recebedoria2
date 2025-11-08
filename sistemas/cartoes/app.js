// app.js
import { auth, db, onAuthStateChanged, collection, getDocs, setDoc, doc } from "./firebaseConfig.js";
import * as XLSX from "./xlsx.mjs";

// ============================================================
// Variáveis
// ============================================================
let cartoes = []; // lista de todos os cartões carregados
let currentTipo = ""; // tipo selecionado no filtro

// ============================================================
// Elementos
// ============================================================
const tabelaBody = document.querySelector("#tabelaCartoes tbody");
const filtroTipo = document.getElementById("filtroTipo");
const filtroMatricula = document.getElementById("filtroMatricula");
const filtroIdBordo = document.getElementById("filtroIdBordo");
const filtroIdViagem = document.getElementById("filtroIdViagem");
const btnFiltrar = document.getElementById("btnFiltrar");

const fileProdata = document.getElementById("fileProdata");
const fileDigicon = document.getElementById("fileDigicon");

// ============================================================
// Utilitário: Converter número Excel em Date
// ============================================================
function excelDateToJSDate(serial) {
    if (!serial) return null;
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);

    const fractional_day = serial - Math.floor(serial) + 0.0000001;
    let total_seconds = Math.floor(86400 * fractional_day);

    const seconds = total_seconds % 60;
    total_seconds -= seconds;
    const hours = Math.floor(total_seconds / 3600);
    const minutes = Math.floor(total_seconds / 60) % 60;

    date_info.setHours(hours);
    date_info.setMinutes(minutes);
    date_info.setSeconds(seconds);

    return date_info;
}

// ============================================================
// Utilitário: Formatar Date para dd/mm/yyyy
// ============================================================
function formatDate(date) {
    if (!date) return "-";
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}

// ============================================================
// Função: Renderizar tabela
// ============================================================
function renderTable(lista) {
    tabelaBody.innerHTML = "";
    lista.forEach(c => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${c.matricula}</td>
            <td>${c.nome}</td>
            <td>${c.idBordo}</td>
            <td>${c.idViagem}</td>
            <td>${c.serialBordo}</td>
            <td>${c.serialViagem}</td>
            <td>${formatDate(c.dataRetirada)}</td>
            <td>${c.tipo}</td>
        `;

        tabelaBody.appendChild(tr);
    });
}

// ============================================================
// Função: Filtrar tabela
// ============================================================
function aplicarFiltros() {
    let listaFiltrada = cartoes;

    const mat = filtroMatricula.value.trim();
    const idB = filtroIdBordo.value.trim();
    const idV = filtroIdViagem.value.trim();
    const tipo = filtroTipo.value;

    if (tipo) {
        listaFiltrada = listaFiltrada.filter(c => c.tipo === tipo);
    }
    if (mat) {
        listaFiltrada = listaFiltrada.filter(c => c.matricula.includes(mat));
    }
    if (idB) {
        listaFiltrada = listaFiltrada.filter(c => String(c.idBordo).includes(idB));
    }
    if (idV) {
        listaFiltrada = listaFiltrada.filter(c => String(c.idViagem).includes(idV));
    }

    renderTable(listaFiltrada);
}

// ============================================================
// Função: Processar upload de planilha
// ============================================================
async function handleFileUpload(file, tipo) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const json = XLSX.utils.sheet_to_json(sheet, { raw: false });

    json.forEach(r => {
        // Matrícula, sempre como string
        const matricula = r["Matrícula"] != null ? String(r["Matrícula"]).trim() : "";
        const nome = r["Nome"] || "";

        const idBordo = r["Identificação Bordo"] != null ? String(r["Identificação Bordo"]) : "";
        const idViagem = r["Identificação ½ Viagem"] != null ? String(r["Identificação ½ Viagem"]) : "";

        const serialBordo = r["ID Bordo"] != null ? String(r["ID Bordo"]) : "";
        const serialViagem = r["ID Viagem"] != null ? String(r["ID Viagem"]) : "";

        let dataRetiradaRaw = r["Data Retirada"];
        let dataRetirada = null;

        if (dataRetiradaRaw) {
            const num = Number(dataRetiradaRaw);
            dataRetirada = isNaN(num) ? new Date(dataRetiradaRaw) : excelDateToJSDate(num);
        }

        cartoes.push({
            matricula,
            nome,
            idBordo,
            idViagem,
            serialBordo,
            serialViagem,
            dataRetirada,
            tipo
        });
    });

    aplicarFiltros();
}

// ============================================================
// Eventos
// ============================================================
btnFiltrar.addEventListener("click", aplicarFiltros);

fileProdata.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    handleFileUpload(file, "prodata");
});

fileDigicon.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    handleFileUpload(file, "digicon");
});

// Filtro tipo ao mudar
filtroTipo.addEventListener("change", aplicarFiltros);

// ============================================================
// Inicialização Firebase (opcional, se precisar autenticar)
// ============================================================
onAuthStateChanged(auth, user => {
    if (!user) {
        alert("Usuário não autenticado!");
    } else {
        console.log(`Usuário autenticado: ${user.email}`);
    }
});
