import {
    auth, db, onAuthStateChanged, collection, getDocs, query, where, orderBy,
    addDoc, doc, getDoc, updateDoc, deleteDoc, serverTimestamp
} from "./firebaseConfig.js";

document.addEventListener("DOMContentLoaded", () => {
    console.log("[app] Iniciando app.js");

    // ==============================
    // Atualiza automaticamente sobra/falta
    // ==============================
    const valorFolhaInput = document.getElementById("valorFolha");
    const valorDinheiroInput = document.getElementById("valorDinheiro");
    const sobraFaltaInput = document.getElementById("sobraFalta");

    if (valorFolhaInput && valorDinheiroInput && sobraFaltaInput) {
        const atualizarSobra = () => {
            const folha = parseFloat(valorFolhaInput.value) || 0;
            const dinheiro = parseFloat(valorDinheiroInput.value) || 0;
            sobraFaltaInput.value = (dinheiro - folha).toFixed(2);
        };
        valorFolhaInput.addEventListener("input", atualizarSobra);
        valorDinheiroInput.addEventListener("input", atualizarSobra);
    }

    // ==============================
    // Monitor de autenticação
    // ==============================
    onAuthStateChanged(auth, async user => {
        if (!user) return location.href = "/login.html";

        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
            alert("Cadastro incompleto.");
            return auth.signOut();
        }

        const data = snap.data();
        const IS_ADMIN = data.admin === true;
        const MATRICULA = data.matricula;

        configurarInterface(IS_ADMIN);
        await popularSelects(IS_ADMIN);
        inicializarEventos(IS_ADMIN, MATRICULA);
        await carregarRelatorios(IS_ADMIN, MATRICULA);
        carregarResumoMensal(IS_ADMIN);

        configurarModalRelatorios(IS_ADMIN, MATRICULA);
    });
});

// ====================================
// INTERFACE
// ====================================
function configurarInterface(admin) {
    document.querySelectorAll(".admin-only").forEach(e => e.hidden = !admin);
    document.querySelectorAll(".user-only").forEach(e => e.hidden = admin);
}

// ====================================
// POPULAR SELECTS
// ====================================
async function popularSelects(admin) {
    const selectForm = document.getElementById("matriculaForm");
    const selectResumo = document.getElementById("selectMatriculas");

    const snap = await getDocs(collection(db, "users"));
    const lista = snap.docs.map(d => d.data()).filter(u => u.matricula);

    lista.sort((a, b) => a.matricula.localeCompare(b.matricula, "pt-BR", { numeric: true }));

    [selectForm, selectResumo].forEach(sel => {
        if (!sel) return;
        sel.innerHTML = `<option value="">Selecione uma matrícula</option>`;
        lista.forEach(u => {
            sel.innerHTML += `<option value="${u.matricula}">${u.matricula} - ${u.nome}</option>`;
        });
    });

    console.log("[app] Selects populados");
}

// ====================================
// EVENTOS
// ====================================
function inicializarEventos(admin, matricula) {
    document.getElementById("btnSalvarRelatorio")?.addEventListener("click", () =>
        salvarRelatorio(admin)
    );
    document.getElementById("btnCarregarResumo")?.addEventListener("click", () =>
        carregarResumoMensal(admin)
    );
    document.getElementById("btnToggleResumo")?.addEventListener("click", () =>
        document.getElementById("resumoWrap").classList.toggle("collapsed")
    );
}

// =================================================
// SALVAR RELATÓRIO
// =================================================
async function salvarRelatorio(admin) {
    if (!admin) return alert("Apenas administradores podem criar relatórios.");

    const matricula = document.getElementById("matriculaForm").value;
    const dataCaixa = document.getElementById("dataCaixa").value;
    const folha = parseFloat(document.getElementById("valorFolha").value) || 0;
    const dinheiro = parseFloat(document.getElementById("valorDinheiro").value) || 0;
    const abastecimento = document.getElementById("abastecimento").value || "";
    const observacao = document.getElementById("observacao").value || "";
    const sobra = dinheiro - folha;

    if (!matricula || !dataCaixa) return alert("Preencha todos os campos.");

    const p = dataCaixa.split("-");
    const dt = new Date(p[0], p[1] - 1, p[2]);

    await addDoc(collection(db, "relatorios"), {
        createdBy: auth.currentUser.uid,
        criadoEm: serverTimestamp(),
        dataCaixa: dt,
        matricula,
        valorFolha: folha,
        valorDinheiro: dinheiro,
        sobraFalta: sobra,
        abastecimento,
        observacao,
        posEditado: false,
        posTexto: ""
    });

    alert("Relatório salvo!");
    carregarRelatorios(true, matricula);
}

// =================================================
// CARREGAR RELATÓRIOS (PÁGINA PRINCIPAL)
// =================================================
async function carregarRelatorios(admin, matricula) {
    const lista = document.getElementById("listaRelatorios");
    lista.innerHTML = "";

    let q;
    if (admin) {
        q = query(collection(db, "relatorios"), orderBy("criadoEm", "desc"));
    } else {
        q = query(collection(db, "relatorios"), where("matricula", "==", matricula), orderBy("criadoEm", "desc"));
    }

    const snap = await getDocs(q);

    snap.forEach(docSnap => {
        const r = docSnap.data();
        lista.innerHTML += gerarHTMLRelatorio(docSnap.id, r, admin);
    });

    ativarEventosLista(lista, admin);
}

// =================================================
// GERA HTML DO RELATÓRIO
// =================================================
function gerarHTMLRelatorio(id, r, admin) {
    const cls = r.sobraFalta >= 0 ? "positivo" : "negativo";
    const dt = r.dataCaixa.toDate ? r.dataCaixa.toDate() : new Date(r.dataCaixa);

    return `
<div class="relatorio-item">
    <div class="item-header">
        <strong>${dt.toLocaleDateString()}</strong> — Matrícula: ${r.matricula}
        ${r.posEditado ? `<span class="alerta-pos">⚠ Pós Conferência</span>` : ""}
        <button class="btn outline btnToggle">Abrir/Fechar</button>
        <button class="btn outline btnVerDetalhes" data-id="${id}">Ver Detalhes</button>
    </div>

    <div class="item-body hidden">
        <table class="relatorio-table">
            <tr><td>Folha</td><td>R$ ${r.valorFolha.toFixed(2)}</td></tr>
            <tr><td>Dinheiro</td><td>R$ ${r.valorDinheiro.toFixed(2)}</td></tr>
            <tr><td>Diferença</td><td class="${cls}">R$ ${r.sobraFalta.toFixed(2)}</td></tr>
            <tr><td>Abastecimento</td><td>${r.abastecimento || "-"}</td></tr>
            <tr><td>Observação</td><td>${r.observacao || "-"}</td></tr>
            <tr><td>Pós Conferência</td><td>${r.posTexto || "-"}</td></tr>
        </table>

        <div class="actions">
            <button class="btn outline btnPos" data-id="${id}">Pós Conferência</button>

            ${admin ? `
                <button class="btn primary btnEdit" data-id="${id}">Editar</button>
                <button class="btn danger btnExcluir" data-id="${id}">Excluir</button>
            ` : ""}
        </div>
    </div>
</div>`;
}

// =================================================
// EVENTOS DA LISTA (TABELA + BOTÕES)
// =================================================
function ativarEventosLista(container, admin) {

    // Toggle abrir/fechar
    container.querySelectorAll(".btnToggle").forEach(btn =>
        btn.addEventListener("click", () => {
            btn.closest(".relatorio-item").querySelector(".item-body").classList.toggle("hidden");
        })
    );

    // Pós-conferência
    container.querySelectorAll(".btnPos").forEach(btn =>
        btn.addEventListener("click", () => abrirPosConferencia(btn.dataset.id, admin))
    );

    // Editar
    container.querySelectorAll(".btnEdit").forEach(btn =>
        btn.addEventListener("click", () => editarRelatorio(btn.dataset.id))
    );

    // Excluir
    container.querySelectorAll(".btnExcluir").forEach(btn =>
        btn.addEventListener("click", async () => {
            if (!confirm("Deseja excluir?")) return;

            await deleteDoc(doc(db, "relatorios", btn.dataset.id));
            alert("Excluído!");
            location.reload();
        })
    );

    // Abrir modal pequeno de detalhes
    container.querySelectorAll(".btnVerDetalhes").forEach(btn =>
        btn.addEventListener("click", () => abrirModalDetalhe(btn.dataset.id))
    );
}

// =================================================
// MODAL GRANDE – LISTA DE RELATÓRIOS
// =================================================
function configurarModalRelatorios(IS_ADMIN, MATRICULA) {
    const btn = document.getElementById("btnAbrirRelatorios");
    const modal = document.getElementById("modalRelatorios");
    const listaModal = document.getElementById("listaRelatoriosModal");

    if (!btn || !modal) return;

    btn.addEventListener("click", async () => {
        const lista = document.getElementById("listaRelatorios");

        listaModal.innerHTML = lista.innerHTML;

        ativarEventosLista(listaModal, IS_ADMIN);

        modal.showModal();
    });
}

// =================================================
// MODAL PEQUENO – DETALHE INDIVIDUAL
// =================================================
async function abrirModalDetalhe(id) {
    const modal = document.getElementById("modalDetalheRelatorio");
    const corpo = document.getElementById("detalheConteudo");

    const snap = await getDoc(doc(db, "relatorios", id));
    if (!snap.exists()) return;

    const r = snap.data();
    const dt = r.dataCaixa.toDate ? r.dataCaixa.toDate() : new Date(r.dataCaixa);

    corpo.innerHTML = `
        <p><b>Data:</b> ${dt.toLocaleDateString()}</p>
        <p><b>Matrícula:</b> ${r.matricula}</p>
        <p><b>Folha:</b> R$ ${r.valorFolha.toFixed(2)}</p>
        <p><b>Dinheiro:</b> R$ ${r.valorDinheiro.toFixed(2)}</p>
        <p><b>Diferença:</b> R$ ${(r.valorDinheiro - r.valorFolha).toFixed(2)}</p>
        <p><b>Abastecimento:</b> ${r.abastecimento || "-"}</p>
        <p><b>Observação:</b> ${r.observacao || "-"}</p>
        <p><b>Pós Conferência:</b> ${r.posTexto || "-"}</p>
    `;

    modal.showModal();
}

// =================================================
// PÓS-CONFERÊNCIA
// =================================================
async function abrirPosConferencia(id, admin) {
    const modal = document.getElementById("posModal");
    const textarea = document.getElementById("posTexto");

    const snap = await getDoc(doc(db, "relatorios", id));
    const r = snap.data();

    textarea.value = r.posTexto || "";
    textarea.disabled = !admin;

    modal.showModal();

    document.getElementById("btnSalvarPos").onclick = async () => {
        if (!admin) return;

        await updateDoc(doc(db, "relatorios", id), {
            posEditado: true,
            posTexto: textarea.value
        });

        alert("Salvo!");
        modal.close();
        location.reload();
    };
}

// =================================================
// EDITAR RELATÓRIO
// =================================================
async function editarRelatorio(id) {
    const snap = await getDoc(doc(db, "relatorios", id));
    const r = snap.data();

    const novoFolha = parseFloat(prompt("Folha:", r.valorFolha)) || r.valorFolha;
    const novoDin = parseFloat(prompt("Dinheiro:", r.valorDinheiro)) || r.valorDinheiro;
    const novaObs = prompt("Observação:", r.observacao || "") || r.observacao;
    const novaDif = novoDin - novoFolha;

    await updateDoc(doc(db, "relatorios", id), {
        valorFolha: novoFolha,
        valorDinheiro: novoDin,
        sobraFalta: novaDif,
        observacao: novaObs
    });

    alert("Atualizado!");
    location.reload();
}

// =================================================
// RESUMO MENSAL
// =================================================
async function carregarResumoMensal(admin) {
    if (!admin) return;

    const matricula = document.getElementById("selectMatriculas").value;
    if (!matricula) return;

    const mesInput = document.getElementById("mesResumo");
    if (!mesInput.value) {
        const d = new Date();
        mesInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }

    const [year, month] = mesInput.value.split("-");
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const q = query(collection(db, "relatorios"), where("matricula", "==", matricula));
    const snap = await getDocs(q);

    let totalFolha = 0, saldo = 0;
    let pos = [], neg = [];

    snap.forEach(docSnap => {
        const r = docSnap.data();
        const dt = r.dataCaixa.toDate ? r.dataCaixa.toDate() : new Date(r.dataCaixa);

        if (dt >= start && dt <= end) {
            const diff = r.valorDinheiro - r.valorFolha;
            totalFolha += r.valorFolha;
            saldo += diff;
            (diff >= 0 ? pos : neg).push(`${dt.toLocaleDateString()}: R$ ${diff.toFixed(2)}`);
        }
    });

    document.getElementById("resumoTotalFolha").textContent = `R$ ${totalFolha.toFixed(2)}`;
    document.getElementById("resumoSaldo").textContent = `R$ ${saldo.toFixed(2)}`;
    document.getElementById("resumoSituacao").textContent = saldo >= 0 ? "Positivo" : "Negativo`;

    document.getElementById("resumoLista").innerHTML = `
        <details><summary>Dias com sobra</summary>${pos.join("<br>") || "-"}</details>
        <details><summary>Dias com falta</summary>${neg.join("<br>") || "-"}</details>
    `;
}

