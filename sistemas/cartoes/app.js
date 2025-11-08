// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// 🔹 SheetJS via CDN
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.2/package/xlsx.mjs";

// 🔹 Firebase config
import { firebaseConfig } from "./firebaseConfig.js";
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 🔹 Elementos
const fileProdata = document.getElementById("fileProdata");
const fileDigicon = document.getElementById("fileDigicon");
const tabela = document.getElementById("tabelaCartoes").querySelector("tbody");
const btnFiltrar = document.getElementById("btnFiltrar");
const filtroTipo = document.getElementById("filtroTipo");
const filtroMatricula = document.getElementById("filtroMatricula");
const filtroIdBordo = document.getElementById("filtroIdBordo");
const filtroIdViagem = document.getElementById("filtroIdViagem");

let cartoes = []; // Array completo

// 🔹 Monitorar autenticação
let isAdmin = false;
onAuthStateChanged(auth, user => {
    if (!user) return;
    const uid = user.uid;
    // Busca info do usuário
    getDocs(query(collection(db, "users"), where("uid", "==", uid))).then(snapshot => {
        const docUser = snapshot.docs[0];
        isAdmin = docUser?.data()?.admin || false;
        carregarCartoes();
    });
});

// 🔹 Função para processar upload de planilha
async function handleFileUpload(file, tipo) {
    if (!file) return;
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

    const batch = jsonData.map(row => {
        return {
            matricula: row.Matricula || row.MATRICULA || "",
            nome: row.Nome || row.NOME || "",
            idBordo: row["Identificador Bordo"] || row["ID. Bordo"] || "",
            idViagem: row["Identificador ½ Viagem"] || row["ID. Viagem"] || "",
            serialBordo: row["Identificação Bordo"] || row["Nº Cartão de Bordo"] || "",
            serialViagem: row["Identificação ½ Viagem"] || row["Nº Cartão Viagem"] || "",
            dataRetirada: row["Data Retirada"] || row["Desligados"] || "",
            tipo
        };
    });

    // Salvar no Firestore se for admin
    if (isAdmin) {
        for (const c of batch) {
            await addDoc(collection(db, "cartoes"), c);
        }
        alert(`Planilha ${tipo} enviada com sucesso!`);
    }

    cartoes.push(...batch);
    renderTabela(cartoes);
}

// 🔹 Uploads
fileProdata.addEventListener("change", async e => {
    const file = e.target.files[0];
    await handleFileUpload(file, "prodata");
    e.target.value = "";
});

fileDigicon.addEventListener("change", async e => {
    const file = e.target.files[0];
    await handleFileUpload(file, "digicon");
    e.target.value = "";
});

// 🔹 Carregar do Firestore
async function carregarCartoes() {
    const q = query(collection(db, "cartoes"), orderBy("matricula"));
    const snapshot = await getDocs(q);
    cartoes = snapshot.docs.map(doc => doc.data());
    renderTabela(cartoes);
}

// 🔹 Renderizar tabela
function renderTabela(data) {
    tabela.innerHTML = "";
    for (const c of data) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${c.matricula}</td>
            <td>${c.nome}</td>
            <td title="${getHistorico(c.idBordo, c.tipo)}">${c.idBordo}</td>
            <td title="${getHistorico(c.idViagem, c.tipo)}">${c.idViagem}</td>
            <td title="${getHistorico(c.serialBordo, c.tipo)}">${c.serialBordo}</td>
            <td title="${getHistorico(c.serialViagem, c.tipo)}">${c.serialViagem}</td>
            <td>${c.dataRetirada}</td>
            <td>${c.tipo}</td>
        `;
        tabela.appendChild(tr);
    }
}

// 🔹 Função para mostrar histórico em tooltip
function getHistorico(valor, tipo) {
    const historico = cartoes
        .filter(c => (c.idBordo === valor || c.idViagem === valor || c.serialBordo === valor || c.serialViagem === valor) && c.tipo === tipo)
        .map(c => `${c.matricula} (${c.dataRetirada})`);
    return historico.join(", ");
}

// 🔹 Filtros
btnFiltrar.addEventListener("click", () => {
    const tipo = filtroTipo.value;
    const mat = filtroMatricula.value.trim();
    const idBordo = filtroIdBordo.value.trim();
    const idViagem = filtroIdViagem.value.trim();

    const filtrado = cartoes.filter(c => {
        return (!tipo || c.tipo === tipo)
            && (!mat || c.matricula.includes(mat))
            && (!idBordo || c.idBordo.includes(idBordo))
            && (!idViagem || c.idViagem.includes(idViagem));
    });

    renderTabela(filtrado);
});
