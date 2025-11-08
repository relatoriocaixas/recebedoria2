import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.2/package/xlsx.mjs";

import { firebaseConfig } from "./firebaseConfig.js";
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const fileProdata = document.getElementById("fileProdata");
const fileDigicon = document.getElementById("fileDigicon");
const tabela = document.getElementById("tabelaCartoes").querySelector("tbody");

const btnFiltrar = document.getElementById("btnFiltrar");
const filtroTipo = document.getElementById("filtroTipo");
const filtroMatricula = document.getElementById("filtroMatricula");
const filtroIdBordo = document.getElementById("filtroIdBordo");
const filtroIdViagem = document.getElementById("filtroIdViagem");

let cartoes = [];
let isAdmin = false;

// ✅ Converte número excel → data real
function excelDateToJSDate(n) {
    if (!n || isNaN(n)) return "";
    const base = new Date(1899, 11, 30);
    return new Date(base.getTime() + n * 86400000).toLocaleDateString("pt-BR");
}

onAuthStateChanged(auth, user => {
    if (!user) return;

    getDocs(query(collection(db, "users"), where("uid", "==", user.uid)))
        .then(snapshot => {
            const u = snapshot.docs[0];
            isAdmin = u?.data()?.admin || false;
            carregarCartoes();
        });
});

// ✅ TRATAMENTO DA PLANILHA (corrigido matricula e data)
async function handleFileUpload(file, tipo) {
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

    const parsed = json.map(row => ({
        matricula: String(
            row.Matricula ||
            row["Matricula"] ||
            row["Matricula "] ||
            row["MATRICULA"] ||
            row["Matrícula"] ||
            row["matricula"] ||
            ""
        ).trim(),

        nome: row.Nome || row["Nome "] || row["NOME"] || "",

        idBordo: String(
            row["Identificador Bordo"] ||
            row["ID Bordo"] ||
            row["ID. Bordo"] ||
            row["ID"] ||
            ""
        ).trim(),

        idViagem: String(
            row["Identificador ½ Viagem"] ||
            row["ID Viagem"] ||
            row["ID. Viagem"] ||
            ""
        ).trim(),

        serialBordo: String(
            row["Identificação Bordo"] ||
            row["Nº Cartão de Bordo"] ||
            ""
        ).trim(),

        serialViagem: String(
            row["Identificação ½ Viagem"] ||
            row["Nº Cartão Viagem"] ||
            ""
        ).trim(),

        dataRetirada: excelDateToJSDate(row["Data Retirada"]),

        tipo
    }));

    // ✅ salvar no Firestore
    if (isAdmin) {
        for (const c of parsed) {
            await addDoc(collection(db, "cartoes"), c);
        }
        alert(`Planilha (${tipo}) enviada com sucesso!`);
    }

    cartoes.push(...parsed);
    renderTabela(cartoes);
}

fileProdata.addEventListener("change", e => {
    handleFileUpload(e.target.files[0], "prodata");
    e.target.value = "";
});

fileDigicon.addEventListener("change", e => {
    handleFileUpload(e.target.files[0], "digicon");
    e.target.value = "";
});

async function carregarCartoes() {
    const snap = await getDocs(collection(db, "cartoes"));
    cartoes = snap.docs.map(d => d.data());
    renderTabela(cartoes);
}

// ✅ Renderização (apenas mantendo o seu padrão)
function renderTabela(lista) {
    tabela.innerHTML = "";

    lista.forEach(c => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${c.matricula}</td>
            <td>${c.nome}</td>
            <td>${c.idBordo}</td>
            <td>${c.idViagem}</td>
            <td>${c.serialBordo}</td>
            <td>${c.serialViagem}</td>
            <td>${c.dataRetirada}</td>
            <td>${c.tipo}</td>
        `;

        tabela.appendChild(tr);
    });
}

// ✅ Filtros corrigidos (agora funcionam com number ou string)
btnFiltrar.addEventListener("click", () => {
    const tipo = filtroTipo.value.trim();
    const mat = filtroMatricula.value.trim();
    const bordo = filtroIdBordo.value.trim();
    const viagem = filtroIdViagem.value.trim();

    const filtrado = cartoes.filter(c =>
        (!tipo || c.tipo === tipo) &&
        (!mat || String(c.matricula).includes(mat)) &&
        (!bordo || String(c.idBordo).includes(bordo)) &&
        (!viagem || String(c.idViagem).includes(viagem))
    );

    renderTabela(filtrado);
});
