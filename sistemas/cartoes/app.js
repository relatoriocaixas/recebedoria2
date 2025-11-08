import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, getDocs, setDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs";

let cartoes = []; // todos os cartões carregados
let userIsAdmin = false;

// 🔹 Elementos
const tabela = document.getElementById("tabelaCartoes").querySelector("tbody");
const filtroTipo = document.getElementById("filtroTipo");
const filtroMatricula = document.getElementById("filtroMatricula");
const filtroIdBordo = document.getElementById("filtroIdBordo");
const filtroIdViagem = document.getElementById("filtroIdViagem");
const filtroSerialBordo = document.getElementById("filtroSerialBordo");
const filtroSerialViagem = document.getElementById("filtroSerialViagem");
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

    if (!userIsAdmin) {
        // se não for admin, carrega todos os cartões já salvos no Firestore
        await carregarCartoesFirestore();
    }
    renderTabela();
});

// 🔹 Carregar cartões do Firestore
async function carregarCartoesFirestore() {
    try {
        const snapshot = await getDocs(collection(db, "cartoes"));
        cartoes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.error("Erro ao carregar cartões do Firestore:", err);
    }
}

// 🔹 Função para processar planilha
async function handleFileUpload(file, tipo) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { raw: false });

    const novaLista = [];

    for (const r of json) {
        let matricula = (
            r["Matrícula"] || r["matricula"] || r["VerificadorMatricula"] || ""
        ).toString().trim();

        let nome = (
            r["Nome"] || r["nome"] || ""
        ).toString().trim();

        let idBordo = (
            r["ID Bordo"] || r["Identificador Bordo"] || r["Identificação Bordo"] || r["ID. Bordo"] || ""
        ).toString();

        let idViagem = (
            r["ID Viagem"] || r["Identificador ½ Viagem"] || r["Identificação ½ Viagem"] || r["ID. Viagem"] || ""
        ).toString();

        let serialBordo = (
            r["Serial Bordo"] || r["Nº Cartão de Bordo"] || ""
        ).toString();

        let serialViagem = (
            r["Serial Viagem"] || r["Nº Cartão Viagem"] || ""
        ).toString();

        let dataRetiradaRaw = r["Data Retirada"] || r["dataRetirada"];
        let dataRetirada = null;
        if (dataRetiradaRaw) {
            if (!isNaN(dataRetiradaRaw)) {
                // Excel armazena datas como números
                const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                dataRetirada = new Date(excelEpoch.getTime() + Number(dataRetiradaRaw) * 86400000);
            } else {
                dataRetirada = new Date(dataRetiradaRaw);
            }
        }

        const cartaoObj = {
            matricula,
            nome,
            idBordo,
            idViagem,
            serialBordo,
            serialViagem,
            dataRetirada,
            tipo
        };

        // salva no Firestore se for admin
        if (userIsAdmin) {
            try {
                const docRef = doc(collection(db, "cartoes"));
                await setDoc(docRef, {
                    matricula,
                    nome,
                    idBordo,
                    idViagem,
                    serialBordo,
                    serialViagem,
                    dataRetirada,
                    tipo,
                    createdAt: serverTimestamp()
                });
            } catch (err) {
                console.error("Erro ao salvar no Firestore:", err);
            }
        }

        novaLista.push(cartaoObj);
    }

    cartoes = cartoes.concat(novaLista);
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
    if (filtroSerialBordo && filtroSerialBordo.value) listaFiltrada = listaFiltrada.filter(c => String(c.serialBordo).includes(filtroSerialBordo.value));
    if (filtroSerialViagem && filtroSerialViagem.value) listaFiltrada = listaFiltrada.filter(c => String(c.serialViagem).includes(filtroSerialViagem.value));

    listaFiltrada.forEach(c => {
        const tr = document.createElement("tr");
        const dataFormatada = c.dataRetirada ? new Date(c.dataRetirada).toLocaleDateString("pt-BR") : "-";

        tr.innerHTML = `
            <td title="${getHistoricoCartaoMatricula(c.matricula, c.tipo)}">${c.matricula}</td>
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

// 🔹 Histórico de cartão
function getHistoricoCartao(id) {
    if (!id) return "";
    const historico = cartoes
        .filter(c => c.idBordo === id || c.idViagem === id)
        .map(c => `${c.matricula} (${c.dataRetirada ? new Date(c.dataRetirada).toLocaleDateString("pt-BR") : "-"})`);
    return historico.join(", ");
}

// 🔹 Histórico das matrículas no hover
function getHistoricoCartaoMatricula(matricula, tipo) {
    if (!matricula) return "";
    const historico = cartoes
        .filter(c => (c.matricula === matricula || c.tipo === tipo))
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
