import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, setDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import * as XLSX from "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

// 🔹 Elementos
const filtroTipo = document.getElementById("filtroTipo");
const filtroMatricula = document.getElementById("filtroMatricula");
const filtroIdBordo = document.getElementById("filtroIdBordo");
const filtroIdViagem = document.getElementById("filtroIdViagem");
const btnFiltrar = document.getElementById("btnFiltrar");

const fileProdata = document.getElementById("fileProdata");
const fileDigicon = document.getElementById("fileDigicon");

const tabela = document.getElementById("tabelaCartoes").querySelector("tbody");

let cartoes = [];

// 🔹 Carregar dados do Firestore
async function carregarCartoes() {
    const tipos = ["prodata", "digicon"];
    cartoes = [];

    for (const tipo of tipos) {
        const q = query(collection(db, "cartoes_" + tipo), orderBy("matricula", "asc"));
        const snap = await getDocs(q);

        snap.forEach(docSnap => {
            const data = docSnap.data();
            cartoes.push({ ...data, tipo });
        });
    }

    renderizarTabela();
}

// 🔹 Renderizar tabela
function renderizarTabela() {
    tabela.innerHTML = "";

    const tipoFiltro = filtroTipo.value.toLowerCase();
    const matriculaFiltro = filtroMatricula.value.trim();
    const idBordoFiltro = filtroIdBordo.value.trim();
    const idViagemFiltro = filtroIdViagem.value.trim();

    const filtrados = cartoes.filter(c => {
        if (tipoFiltro && c.tipo !== tipoFiltro) return false;
        if (matriculaFiltro && !c.matricula.includes(matriculaFiltro)) return false;
        if (idBordoFiltro && !c.idBordo.toString().includes(idBordoFiltro)) return false;
        if (idViagemFiltro && !c.idViagem.toString().includes(idViagemFiltro)) return false;
        return true;
    });

    filtrados.forEach(c => {
        const tr = document.createElement("tr");

        const tdMat = document.createElement("td");
        tdMat.textContent = c.matricula;
        tr.appendChild(tdMat);

        const tdNome = document.createElement("td");
        tdNome.textContent = c.nome;
        tr.appendChild(tdNome);

        const tdIdBordo = document.createElement("td");
        tdIdBordo.textContent = c.idBordo;
        tdIdBordo.title = gerarTooltip(c.idBordo, "bordo", c.tipo);
        tr.appendChild(tdIdBordo);

        const tdIdViagem = document.createElement("td");
        tdIdViagem.textContent = c.idViagem;
        tdIdViagem.title = gerarTooltip(c.idViagem, "viagem", c.tipo);
        tr.appendChild(tdIdViagem);

        const tdSerialBordo = document.createElement("td");
        tdSerialBordo.textContent = c.serialBordo || "";
        tr.appendChild(tdSerialBordo);

        const tdSerialViagem = document.createElement("td");
        tdSerialViagem.textContent = c.serialViagem || "";
        tr.appendChild(tdSerialViagem);

        const tdData = document.createElement("td");
        tdData.textContent = c.dataRetirada || "";
        tr.appendChild(tdData);

        const tdTipo = document.createElement("td");
        tdTipo.textContent = c.tipo;
        tr.appendChild(tdTipo);

        tabela.appendChild(tr);
    });
}

// 🔹 Gerar tooltip com histórico de matrículas para o ID
function gerarTooltip(id, campo, tipo) {
    const historico = cartoes
        .filter(c => c.tipo === tipo && c[campo] === id)
        .map(c => `${c.matricula} (${c.dataRetirada || "-"})`)
        .join("\n");
    return historico;
}

// 🔹 Filtrar
btnFiltrar.addEventListener("click", renderizarTabela);

// 🔹 Upload arquivos Excel
fileProdata.addEventListener("change", (e) => handleFileUpload(e, "prodata"));
fileDigicon.addEventListener("change", (e) => handleFileUpload(e, "digicon"));

async function handleFileUpload(event, tipo) {
    const file = event.target.files[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { raw: false });

    const batchPromises = [];

    json.forEach(row => {
        const docData = {
            matricula: row.Matricula || row["Matrícula"] || "",
            nome: row.Nome || "",
            idBordo: row["Identificador Bordo"] || row["ID. Bordo"] || row["ID Bordo"] || "",
            idViagem: row["Identificador ½ Viagem"] || row["ID. Viagem"] || row["ID Viagem"] || "",
            serialBordo: row["Identificação Bordo"] || row["Nº Cartão de Bordo"] || "",
            serialViagem: row["Identificação ½ Viagem"] || row["Nº Cartão Viagem"] || "",
            dataRetirada: row["Data Retirada"] || row["Desligados"] || "",
        };
        batchPromises.push(addDoc(collection(db, "cartoes_" + tipo), docData));
    });

    try {
        await Promise.all(batchPromises);
        alert(`Planilha ${tipo.toUpperCase()} importada com sucesso!`);
        carregarCartoes();
    } catch (err) {
        console.error(err);
        alert("Erro ao enviar planilha.");
    }
}

// 🔹 Inicialização
onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    await carregarCartoes();
});
