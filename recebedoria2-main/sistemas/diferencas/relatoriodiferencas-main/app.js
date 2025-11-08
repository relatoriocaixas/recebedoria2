import {
    auth,
    db,
    onAuthStateChanged,
    collection,
    getDocs,
    query,
    where,
    orderBy,
    addDoc,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from "./firebaseConfig.js";

/* ============================================================
   INICIALIZAÇÃO GERAL
============================================================ */
document.addEventListener("DOMContentLoaded", () => {

    configurarAutoSobra();

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "/login.html";
            return;
        }

        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            alert("Erro ao carregar usuário. Faça login novamente.");
            auth.signOut();
            return;
        }

        const u = userSnap.data();
        const IS_ADMIN = u.admin === true;
        const MATRICULA = u.matricula;

        configurarInterface(IS_ADMIN);
        await popularSelects(IS_ADMIN);
        inicializarEventos(IS_ADMIN, MATRICULA);
        inicializarFiltros(IS_ADMIN, MATRICULA);

        await carregarRelatoriosModal(IS_ADMIN, MATRICULA);

        carregarResumoMensal(IS_ADMIN);
    });
});

/* ============================================================
   ATUALIZADOR AUTOMÁTICO SOBRA/FALTA
============================================================ */
function configurarAutoSobra() {
    const f = document.getElementById("valorFolha");
    const d = document.getElementById("valorDinheiro");
    const s = document.getElementById("sobraFalta");

    if (!f || !d || !s) return;

    const update = () => {
        const folha = parseFloat(f.value) || 0;
        const dinheiro = parseFloat(d.value) || 0;
        s.value = (dinheiro - folha).toFixed(2);
    };

    f.addEventListener("input", update);
    d.addEventListener("input", update);
}

/* ============================================================
   CONTROLE ADMIN/USER
============================================================ */
function configurarInterface(admin) {
    document.querySelectorAll(".admin-only").forEach(el => el.hidden = !admin);
    document.querySelectorAll(".user-only").forEach(el => el.hidden = admin);
}

/* ============================================================
   POPULAR SELECTS DE MATRÍCULA
============================================================ */
async function popularSelects(admin) {
    const selForm = document.getElementById("matriculaForm");
    const selResumo = document.getElementById("selectMatriculas");
    const selFiltro = document.getElementById("filtroMatricula");

    const snap = await getDocs(collection(db, "users"));
    const lista = [];

    snap.forEach(doc => {
        const u = doc.data();
        if (u.matricula) lista.push(u);
    });

    lista.sort((a, b) =>
        a.matricula.localeCompare(b.matricula, "pt-BR", { numeric: true })
    );

    const selects = [selForm, selResumo, admin ? selFiltro : null];

    selects.forEach(sel => {
        if (!sel) return;

        sel.innerHTML = `<option value="">Selecione</option>`;

        lista.forEach(u => {
            const opt = document.createElement("option");
            opt.value = u.matricula;
            opt.textContent = `${u.matricula} — ${u.nome}`;
            sel.appendChild(opt);
        });
    });
}

/* ============================================================
   EVENTOS
============================================================ */
function inicializarEventos(admin, matricula) {

    // SALVAR RELATÓRIO
    document.getElementById("btnSalvarRelatorio")
        ?.addEventListener("click", () => salvarRelatorio(admin));

    // ABRIR MODAL PRINCIPAL DE RELATÓRIOS
    document.getElementById("btnAbrirRelatorios")
        ?.addEventListener("click", async () => {
            await carregarRelatoriosModal(admin, matricula);
            document.getElementById("modalRelatorios").showModal();
        });

    // FECHAR RESUMO (só no rodapé)
    document.getElementById("btnFecharResumo")
        ?.addEventListener("click", () =>
            document.getElementById("modalResumo").close()
        );

    // RESUMO MENSAL
    document.getElementById("btnCarregarResumo")
        ?.addEventListener("click", () => carregarResumoMensal(admin));

    // COLAPSAR RESUMO
    document.getElementById("btnToggleResumo")
        ?.addEventListener("click", () =>
            document.getElementById("resumoWrap").classList.toggle("collapsed")
        );
}

/* ============================================================
   FILTROS
============================================================ */
function inicializarFiltros(admin, matricula) {
    const filtroMat = document.getElementById("filtroMatricula");
    if (filtroMat) {
        filtroMat.addEventListener("change", async () => {
            const filtroData = document.getElementById("filtroDataGlobal").value || null;
            await carregarRelatoriosModal(admin, filtroMat.value || null, filtroData);
        });
    }

    const filtroData = document.getElementById("filtroDataGlobal");
    if (filtroData) {
        filtroData.addEventListener("change", async () => {
            const filtroMatricula = filtroMat ? filtroMat.value || null : matricula;
            await carregarRelatoriosModal(admin, filtroMatricula, filtroData.value || null);
        });
    }
}

/* ============================================================
   SALVAR RELATÓRIO
============================================================ */
async function salvarRelatorio(admin) {

    if (!admin)
        return alert("Apenas administradores podem criar relatórios.");

    const matricula = document.getElementById("matriculaForm").value;
    const dataCaixa = document.getElementById("dataCaixa").value;
    const folha = parseFloat(document.getElementById("valorFolha").value) || 0;
    const dinheiro = parseFloat(document.getElementById("valorDinheiro").value) || 0;
    const abastecimento = document.getElementById("abastecimento").value || "";
    const observacao = document.getElementById("observacao").value || "";

    if (!matricula || !dataCaixa)
        return alert("Preencha todos os campos obrigatórios.");

    const [ano, mes, dia] = dataCaixa.split("-");
    const dataReal = new Date(ano, mes - 1, dia);

    try {
        await addDoc(collection(db, "relatorios"), {
            createdBy: auth.currentUser.uid,
            criadoEm: serverTimestamp(),
            dataCaixa: dataReal,
            matricula,

            valorFolha: folha,
            valorDinheiro: dinheiro,
            sobraFalta: dinheiro - folha,

            abastecimento,
            observacao,

            posTexto: "",
            posEditado: false
        });

        alert("Relatório salvo!");

        // Limpar campos para próximo lançamento
        document.getElementById("matriculaForm").value = "";
        document.getElementById("dataCaixa").value = "";
        document.getElementById("valorFolha").value = "";
        document.getElementById("valorDinheiro").value = "";
        document.getElementById("sobraFalta").value = "";
        document.getElementById("abastecimento").value = "";
        document.getElementById("observacao").value = "";

        // Atualizar lista
        await carregarRelatoriosModal(admin, matricula);

    } catch (e) {
        console.error(e);
        alert("Erro ao salvar.");
    }
}

/* ============================================================
   CARREGAR RELATÓRIOS MODAL
============================================================ */
async function carregarRelatoriosModal(admin, filtroMatricula = null, filtroData = null) {

    const div = document.getElementById("listaRelatoriosModal");
    if (!div) return;

    div.innerHTML = "<p>Carregando...</p>";

    let q;
    if (admin) {
        q = query(collection(db, "relatorios"), orderBy("dataCaixa", "desc"));
    } else {
        q = query(collection(db, "relatorios"), where("matricula", "==", filtroMatricula), orderBy("dataCaixa", "desc"));
    }

    const snap = await getDocs(q);
    div.innerHTML = "";

    snap.forEach(docSnap => {
        const r = docSnap.data();
        const id = docSnap.id;

        // Normaliza data
        const dataObj = r.dataCaixa.toDate ? r.dataCaixa.toDate() : new Date(r.dataCaixa);
        const dataStr = `${dataObj.getFullYear()}-${(dataObj.getMonth() + 1).toString().padStart(2, "0")}-${dataObj.getDate().toString().padStart(2, "0")}`;

        // Filtrar por data
        if (filtroData && filtroData !== dataStr) return;

        // Filtrar por matrícula
        if (admin && filtroMatricula && r.matricula !== filtroMatricula) return;

        const posAlerta = r.posEditado ? `<span class="alerta-pos">⚠️ Pós Conferência</span>` : "";

        const item = document.createElement("div");
        item.className = "relatorio-item";

        item.innerHTML = `
            <div class="item-header">
                <strong>${dataObj.toLocaleDateString()}</strong> — Matrícula: ${r.matricula} ${posAlerta}
                <button class="btn outline btnVer" data-id="${id}">Ver Detalhes</button>
            </div>
            <div class="actions">
                <button class="btn outline btnPos" data-id="${id}">Pós-Conferência</button>
                ${admin ? `
                    <button class="btn primary btnEdit" data-id="${id}">Editar</button>
                    <button class="btn danger btnExcluir" data-id="${id}">Excluir</button>
                ` : ""}
            </div>
        `;

        div.appendChild(item);
    });

    ativarEventosLista(admin, filtroMatricula);
}

/* ============================================================
   ATIVAR EVENTOS DA LISTA
============================================================ */
function ativarEventosLista(admin, matricula) {

    document.querySelectorAll(".btnVer").forEach(btn => {
        btn.addEventListener("click", () => abrirResumo(btn.dataset.id));
    });

    document.querySelectorAll(".btnPos").forEach(btn => {
        btn.addEventListener("click", () => abrirPosConferencia(btn.dataset.id, admin));
    });

    document.querySelectorAll(".btnEdit").forEach(btn => {
        btn.addEventListener("click", () => editarRelatorio(btn.dataset.id));
    });

    document.querySelectorAll(".btnExcluir").forEach(btn => {
        btn.addEventListener("click", async () => {

            if (!confirm("Excluir relatório?")) return;

            try {
                await deleteDoc(doc(db, "relatorios", btn.dataset.id));
                alert("Excluído.");
                carregarRelatoriosModal(admin, matricula);
            } catch (e) {
                alert("Erro ao excluir.");
            }
        });
    });
}

/* ============================================================
   MODAL FLUTUANTE — VER DETALHES
============================================================ */
async function abrirResumo(id) {

    const modal = document.getElementById("modalResumo");
    const conteudo = document.getElementById("conteudoResumo");

    const snap = await getDoc(doc(db, "relatorios", id));
    if (!snap.exists()) return;
    const r = snap.data();

    const classe = r.sobraFalta >= 0 ? "positivo" : "negativo";

    const data = r.dataCaixa.toDate
        ? r.dataCaixa.toDate().toLocaleDateString()
        : new Date(r.dataCaixa).toLocaleDateString();

    conteudo.innerHTML = `
        <table class="relatorio-table">
            <tr><td>Data:</td><td>${data}</td></tr>
            <tr><td>Matrícula:</td><td>${r.matricula}</td></tr>
            <tr><td>Folha:</td><td>R$ ${r.valorFolha.toFixed(2)}</td></tr>
            <tr><td>Dinheiro:</td><td>R$ ${r.valorDinheiro.toFixed(2)}</td></tr>
            <tr><td>Diferença:</td><td class="${classe}">R$ ${r.sobraFalta.toFixed(2)}</td></tr>
            <tr><td>Abastecimento:</td><td>${r.abastecimento || "-"}</td></tr>
            <tr><td>Observação:</td><td>${r.observacao || "-"}</td></tr>
            <tr><td>Pós Conferência:</td><td>${r.posTexto || "-"}</td></tr>
        </table>
    `;

    modal.showModal();
}

/* ============================================================
   PÓS-CONFERÊNCIA
============================================================ */
async function abrirPosConferencia(id, admin) {

    const modal = document.getElementById("posModal");
    const textarea = document.getElementById("posTexto");

    const ref = doc(db, "relatorios", id);
    const snap = await getDoc(ref);

    if (snap.exists()) {
        textarea.value = snap.data().posTexto || "";
        textarea.disabled = !admin;
    }

    document.getElementById("btnSalvarPos").onclick = async () => {

        if (!admin) return;

        await updateDoc(ref, {
            posTexto: textarea.value,
            posEditado: true
        });

        alert("Pós Conferência salva!");
        modal.close();
    };

    modal.showModal();
}

/* ============================================================
   EDITAR RELATÓRIO
============================================================ */
async function editarRelatorio(id) {

    const ref = doc(db, "relatorios", id);
    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    const r = snap.data();

    const nf = parseFloat(prompt("Folha:", r.valorFolha)) || r.valorFolha;
    const nd = parseFloat(prompt("Dinheiro:", r.valorDinheiro)) || r.valorDinheiro;
    const obs = prompt("Observação:", r.observacao || "") || r.observacao;

    await updateDoc(ref, {
        valorFolha: nf,
        valorDinheiro: nd,
        sobraFalta: nd - nf,
        observacao: obs
    });

    alert("Atualizado!");
}

/* ============================================================
   RESUMO MENSAL DO ADMIN
============================================================ */
async function carregarResumoMensal(admin) {

    if (!admin) return;

    const sel = document.getElementById("selectMatriculas");
    const matricula = sel.value;
    if (!matricula) return;

    const mes = document.getElementById("mesResumo").value;
    if (!mes) return;

    const [ano, m] = mes.split("-");
    const inicio = new Date(ano, m - 1, 1);
    const fim = new Date(ano, m, 0, 23, 59, 59);

    const q = query(
        collection(db, "relatorios"),
        where("matricula", "==", matricula),
        orderBy("criadoEm", "desc")
    );

    const snap = await getDocs(q);

    let totalFolha = 0;
    let saldo = 0;

    const pos = [];
    const neg = [];

    snap.forEach(doc => {

        const r = doc.data();
        const data = r.dataCaixa.toDate();

        if (data >= inicio && data <= fim) {

            const diff = r.valorDinheiro - r.valorFolha;

            totalFolha += r.valorFolha;
            saldo += diff;

            const linha = `${data.toLocaleDateString()}: R$ ${diff.toFixed(2)}`;

            if (diff >= 0) pos.push(linha);
            else neg.push(linha);
        }
    });

    document.getElementById("resumoTotalFolha").textContent = `R$ ${totalFolha.toFixed(2)}`;
    document.getElementById("resumoSaldo").textContent = `R$ ${saldo.toFixed(2)}`;
    document.getElementById("resumoSituacao").textContent = saldo >= 0 ? "Positivo" : "Negativo";

    document.getElementById("resumoLista").innerHTML = `
        <details><summary>Dias com sobra</summary>${pos.join("<br>") || "-"}</details>
        <details><summary>Dias com falta</summary>${neg.join("<br>") || "-"}</details>
    `;
}
