import { auth, db } from "./firebaseConfig.js";
import { collection, addDoc, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import * as XLSX from "./xlsx.mjs"; // Certifique-se de que xlsx.mjs está na mesma pasta

// Elementos do DOM
const fileProdata = document.getElementById("fileProdata");
const fileDigicon = document.getElementById("fileDigicon");
const tabela = document.getElementById("tabelaCartoes").querySelector("tbody");
const filtroTipo = document.getElementById("filtroTipo");
const filtroMatricula = document.getElementById("filtroMatricula");
const filtroIdBordo = document.getElementById("filtroIdBordo");
const filtroIdViagem = document.getElementById("filtroIdViagem");
const btnFiltrar = document.getElementById("btnFiltrar");

// ============================================================
// Carregar tabela com todos os cartões
// ============================================================
async function carregarTabela() {
    tabela.innerHTML = "<tr><td colspan='8'>Carregando...</td></tr>";

    let q = query(collection(db, "cartoes"), orderBy("matricula"));
    const snap = await getDocs(q);

    tabela.innerHTML = "";
    snap.forEach(docSnap => {
        const r = docSnap.data();
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${r.matricula}</td>
            <td>${r.nome}</td>
            <td class="hoverIdBordo" title="Clique para ver histórico">${r.idBordo}</td>
            <td>${r.idViagem}</td>
            <td class="hoverSerialBordo" title="Clique para ver histórico">${r.serialBordo}</td>
            <td>${r.serialViagem}</td>
            <td>${r.dataRetirada ? new Date(r.dataRetirada.seconds ? r.dataRetirada.seconds*1000 : r.dataRetirada).toLocaleDateString() : ""}</td>
            <td>${r.tipo}</td>
        `;
        tabela.appendChild(tr);
    });
}

// ============================================================
// Upload de planilha
// ============================================================
async function handleFileUpload(file, tipo) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: "array" }); // <-- CORRETO

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        const batch = [];

        json.forEach(row => {
            const item = {
                matricula: row.Matricula || row.MATRICULA || "",
                nome: row.Nome || row.NOME || "",
                idBordo: row["Identificador Bordo"] || row["ID. Bordo"] || row["ID Bordo"] || "",
                idViagem: row["Identificador ½ Viagem"] || row["ID. Viagem"] || row["ID Viagem"] || "",
                serialBordo: row["Identificação Bordo"] || row["Nº Cartão de Bordo"] || "",
                serialViagem: row["Identificação ½ Viagem"] || row["Nº Cartão Viagem"] || "",
                dataRetirada: row["Data Retirada"] ? new Date(row["Data Retirada"].split("/").reverse().join("-")) : null,
                tipo
            };
            batch.push(item);
        });

        // Salvar todos os itens no Firestore
        for (let item of batch) {
            await addDoc(collection(db, "cartoes"), item);
        }

        alert(`Planilha ${tipo} carregada com ${batch.length} registros`);
        await carregarTabela();
    };
    reader.readAsArrayBuffer(file); // <-- CORRETO
}

// ============================================================
// Eventos de upload
// ============================================================
if (fileProdata) {
    fileProdata.addEventListener("change", async (e) => {
        await handleFileUpload(e.target.files[0], "prodata");
        e.target.value = "";
    });
}

if (fileDigicon) {
    fileDigicon.addEventListener("change", async (e) => {
        await handleFileUpload(e.target.files[0], "digicon");
        e.target.value = "";
    });
}

// ============================================================
// Filtro de tabela
// ============================================================
btnFiltrar.addEventListener("click", async () => {
    const tipo = filtroTipo.value.trim().toLowerCase();
    const matricula = filtroMatricula.value.trim();
    const idBordo = filtroIdBordo.value.trim();
    const idViagem = filtroIdViagem.value.trim();

    let q = query(collection(db, "cartoes"), orderBy("matricula"));
    const snap = await getDocs(q);

    tabela.innerHTML = "";
    snap.forEach(docSnap => {
        const r = docSnap.data();
        if ((tipo && r.tipo !== tipo) ||
            (matricula && !r.matricula.includes(matricula)) ||
            (idBordo && !r.idBordo.toString().includes(idBordo)) ||
            (idViagem && !r.idViagem.toString().includes(idViagem))) return;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${r.matricula}</td>
            <td>${r.nome}</td>
            <td class="hoverIdBordo" title="Clique para ver histórico">${r.idBordo}</td>
            <td>${r.idViagem}</td>
            <td class="hoverSerialBordo" title="Clique para ver histórico">${r.serialBordo}</td>
            <td>${r.serialViagem}</td>
            <td>${r.dataRetirada ? new Date(r.dataRetirada.seconds ? r.dataRetirada.seconds*1000 : r.dataRetirada).toLocaleDateString() : ""}</td>
            <td>${r.tipo}</td>
        `;
        tabela.appendChild(tr);
    });
});

// ============================================================
// Inicialização
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    carregarTabela();
});
