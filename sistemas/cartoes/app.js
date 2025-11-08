import { auth, db } from "/recebedoria2-main/sistemas/cartoes/firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import * as XLSX from "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

const tabela = document.getElementById("tabelaCartoes").querySelector("tbody");
const filtroTipo = document.getElementById("filtroTipo");
const filtroMatricula = document.getElementById("filtroMatricula");
const filtroIdBordo = document.getElementById("filtroIdBordo");
const filtroIdViagem = document.getElementById("filtroIdViagem");
const btnFiltrar = document.getElementById("btnFiltrar");

const fileProdata = document.getElementById("fileProdata");
const fileDigicon = document.getElementById("fileDigicon");

let cartoes = []; // Array local

// 🔹 Função para processar planilha
async function processarArquivo(file, tipo) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const processado = json.map(r => ({
        matricula: r["Matricula"] || r["Matrícula"] || "",
        nome: r["Nome"] || "",
        idBordo: r["Identificador Bordo"] || r["ID. Bordo"] || "",
        idViagem: r["Identificador ½ Viagem"] || r["ID. Viagem"] || "",
        serialBordo: r["Identificação Bordo"] || r["Nº Cartão de Bordo"] || "",
        serialViagem: r["Identificação ½ Viagem"] || r["Nº Cartão Viagem"] || "",
        dataRetirada: r["Data Retirada"] || r["Desligados"] || "",
        tipo
    }));

    // Salvar no Firestore se admin
    const user = auth.currentUser;
    if (!user) {
        alert("Usuário não autenticado!");
        return;
    }

    const userSnap = await getDocs(query(collection(db, "users")));
    const currentUser = userSnap.docs.find(d => d.data().uid === user.uid);
    const isAdmin = currentUser ? currentUser.data().admin : false;

    if (isAdmin) {
        const col = collection(db, "cartoes");
        for (let c of processado) {
            await addDoc(col, { ...c, criadoEm: serverTimestamp() });
        }
        alert(`Planilha ${tipo} enviada com sucesso!`);
    }

    cartoes = cartoes.concat(processado);
    renderizarTabela();
}

// 🔹 Renderizar tabela
function renderizarTabela() {
    tabela.innerHTML = "";
    let lista = [...cartoes];

    const tipo = filtroTipo.value;
    const mat = filtroMatricula.value.trim();
    const idB = filtroIdBordo.value.trim();
    const idV = filtroIdViagem.value.trim();

    if (tipo) lista = lista.filter(c => c.tipo === tipo);
    if (mat) lista = lista.filter(c => c.matricula.includes(mat));
    if (idB) lista = lista.filter(c => c.idBordo.toString().includes(idB));
    if (idV) lista = lista.filter(c => c.idViagem.toString().includes(idV));

    lista.forEach(c => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${c.matricula}</td>
            <td>${c.nome}</td>
            <td title="Cartões anteriores: ${cartoes.filter(x=>x.idBordo===c.idBordo && x.matricula!==c.matricula).map(x=>x.matricula).join(", ")}">${c.idBordo}</td>
            <td title="Cartões anteriores: ${cartoes.filter(x=>x.idViagem===c.idViagem && x.matricula!==c.matricula).map(x=>x.matricula).join(", ")}">${c.idViagem}</td>
            <td>${c.serialBordo}</td>
            <td>${c.serialViagem}</td>
            <td>${c.dataRetirada}</td>
            <td>${c.tipo}</td>
        `;
        tabela.appendChild(tr);
    });
}

// 🔹 Eventos de filtro
btnFiltrar.addEventListener("click", renderizarTabela);

// 🔹 Uploads
fileProdata.addEventListener("change", e => processarArquivo(e.target.files[0], "prodata"));
fileDigicon.addEventListener("change", e => processarArquivo(e.target.files[0], "digicon"));

// 🔹 Carregar dados do Firestore ao iniciar
onAuthStateChanged(auth, async user => {
    if (!user) return;

    const snap = await getDocs(collection(db, "cartoes"));
    cartoes = snap.docs.map(d => d.data());
    renderizarTabela();
});
