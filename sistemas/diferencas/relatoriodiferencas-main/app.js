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
   Inicialização principal
============================================================ */
document.addEventListener("DOMContentLoaded", () => {

    configurarAutoSobra();

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "/login.html";
            return;
        }

        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
            alert("Cadastro incompleto.");
            auth.signOut();
            return;
        }

        const userData = snap.data();
        const IS_ADMIN = userData.admin === true;
        const MATRICULA = userData.matricula;

        configurarInterface(IS_ADMIN);
        await popularSelects(IS_ADMIN);
        inicializarEventos(IS_ADMIN, MATRICULA);
        await carregarRelatoriosModal(IS_ADMIN, MATRICULA);

        carregarResumoMensal(IS_ADMIN);
    });
});


/* ============================================================
   Atualizador automático de sobra/falta
============================================================ */
function configurarAutoSobra() {
    const f = document.getElementById("valorFolha");
    const d = document.getElementById("valorDinheiro");
    const s = document.getElementById("sobraFalta");

    if (!f || !d || !s) return;

    const atualizar = () => {
        const folha = parseFloat(f.value) || 0;
        const dinheiro = parseFloat(d.value) || 0;
        s.value = (dinheiro - folha).toFixed(2);
    };

    f.addEventListener("input", atualizar);
    d.addEventListener("input", atualizar);
}


/* ============================================================
   Interface do Admin / Usuário
============================================================ */
function configurarInterface(admin) {
    document.querySelectorAll(".admin-only").forEach(el => el.hidden = !admin);
    document.querySelectorAll(".user-only").forEach(el => el.hidden = admin);
}


/* ============================================================
   Popular selects de matrícula
============================================================ */
async function popularSelects(admin) {
    const selForm = document.getElementById("matriculaForm");
    const selResumo = document.getElementById("selectMatriculas");
    const selFiltro = document.getElementById("filtroMatricula");

    const users = await getDocs(collection(db, "users"));
    const lista = [];

    users.forEach(u => {
        const d = u.data();
        if (d.matricula) lista.push(d);
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
            opt.textContent = `${u.matricula} - ${u.nome}`;
            sel.appendChild(opt);
        });
    });
}


/* ============================================================
   Eventos principais da interface
============================================================ */
function inicializarEventos(admin, matricula) {

    // Salvar relatório
    document.getElementById("btnSalvarRelatorio")?.addEventListener("click", () =>
        salvarRelatorio(admin)
    );

    // Abrir modal principal
    document.getElementById("btnAbrirRelatorios")?.addEventListener("click", async () => {
        await carregarRelatoriosModal(admin, matricula);
        document.getElementById("modalRelatorios").showModal();
    });

    // Fechar modal de resumo
    document.getElementById("btnFecharResumo")?.addEventListener("click", () =>
        document.getElementById("modalResumo").close()
    );

    // Resumo mensal
    document.getElementById("btnCarregarResumo")
        ?.addEventListener("click", () => carregarResumoMensal(admin));

    // Ocultar/Exibir resumo
    document.getElementById("btnToggleResumo")
        ?.addEventListener("click", () =>
            document.getElementById("resumoWrap").classList.toggle("collapsed")
        );

    // Filtrar por data
    document.getElementById("btnFiltrarPorData")
        ?.addEventListener("click", () => filtrarPorData(admin, matricula));
}


/* ============================================================
   Salvar relatório
============================================================ */
async function salvarRelatorio(admin) {

    if (!admin) return alert("Apenas administradores podem salvar relatórios.");

    const matricula = document.getElementById("matriculaForm").value;
    const data = document.getElementById("dataCaixa").value;
    const folha = parseFloat(document.getElementById("valorFolha").value) || 0;
    const dinheiro = parseFloat(document.getElementById("valorDinheiro").value) || 0;
    const abastecimento = document.getElementById("abastecimento").value || "";
    const obs = document.getElementById("observacao").value || "";

    if (!matricula || !data) return alert("Preencha todos os campos.");

    const [ano, mes, dia] = data.split("-");
    const dataReal = new Date(ano, mes - 1, dia);

    try {
        await addDoc(collection(db, "relatorios"), {
            createdBy: auth.currentUser.uid,
            criadoEm: serverTimestamp(),
            dataCaixa: dataReal,
            matricula,
            observacao: obs,
            abastecimento,
            valorFolha: folha,
            valorDinheiro: dinheiro,
            sobraFalta: dinheiro - folha,
            posTexto: "",
            posEditado: false
        });

        alert("Relatório salvo!");

    } catch (e) {
        console.error(e);
        alert("Erro ao salvar relatório.");
    }
}


/* ============================================================
   Carregar relatórios no modal principal
============================================================ */
async function carregarRelatoriosModal(admin, userMatricula) {
    const container = document.getElementById("listaRelatoriosModal");
    if (!container) return;

    container.innerHTML = `<p>Carregando...</p>`;

    let q;

    if (admin) {
        q = query(collection(db, "relatorios"), orderBy("criadoEm", "desc"));
    } else {
        q = query(
            collection(db, "relatorios"),
            where("matricula", "==", userMatricula),
            orderBy("criadoEm", "desc")
        );
    }

    const snap = await getDocs(q);
    container.innerHTML = "";

    snap.forEach(docSnap => {
        const r = docSnap.data();
        const id = docSnap.id;

        const alerta = r.posEditado ? `<span class="alerta-pos">⚠️ Pós Conferência</span>` : "";

        const data = r.dataCaixa.toDate
            ? r.dataCaixa.toDate().toLocaleDateString()
            : new Date(r.dataCaixa).toLocaleDateString();

        const item = document.createElement("div");
        item.className = "relatorio-item";

        item.innerHTML = `
            <div class="item-header">
                <strong>${data}</strong> – Matrícula: ${r.matricula} ${alerta}
                <button class="btn outline btnVer" data-id="${id}">Ver Detalhes</button>
            </div>

            <div class="actions">
                <button class="btn outline btnPos" data-id="${id}">Pós-Conferência</button>

                ${admin ?
                `
                    <button class="btn primary btnEdit" data-id="${id}">Editar</button>
                    <button class="btn danger btnExcluir" data-id="${id}">Excluir</button>
                `
                : ""}
            </div>
        `;

        container.appendChild(item);
    });

    ativarEventosLista(admin, userMatricula);
}


/* ============================================================
   Ativar eventos internos da lista (modal principal)
============================================================ */
function ativarEventosLista(admin, matricula) {

    // Botão VER DETALHES (modal flutuante)
    document.querySelectorAll(".btnVer").forEach(btn => {
        btn.addEventListener("click", () => abrirResumo(btn.dataset.id));
    });

    // PÓS CONFERÊNCIA
    document.querySelectorAll(".btnPos").forEach(btn => {
        btn.addEventListener("click", () => abrirPosConferencia(btn.dataset.id, admin));
    });

    // EDITAR
    document.querySelectorAll(".btnEdit").forEach(btn => {
        btn.addEventListener("click", () => editarRelatorio(btn.dataset.id));
    });

    // EXCLUIR
    document.querySelectorAll(".btnExcluir").forEach(btn => {
        btn.addEventListener("click", async () => {

            if (!confirm("Excluir este relatório?")) return;

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
   MODAL FLUTUANTE — RESUMO DO RELATÓRIO
============================================================ */
async function abrirResumo(id) {

    const modal = document.getElementById("modalResumo");
    const conteudo = document.getElementById("conteudoResumo");

    const snap = await getDoc(doc(db, "relatorios", id));

    if (!snap.exists()) return;

    const r = snap.data();

    const cls = r.sobraFalta >= 0 ? "positivo" : "negativo";

    const data = r.dataCaixa.toDate
        ? r.dataCaixa.toDate().toLocaleDateString()
        : new Date(r.dataCaixa).toLocaleDateString();

    conteudo.innerHTML = `
        <table class="relatorio-table">
            <tr><td>Data:</td><td>${data}</td></tr>
            <tr><td>Matrícula:</td><td>${r.matricula}</td></tr>
            <tr><td>Folha:</td><td>R$ ${r.valorFolha.toFixed(2)}</td></tr>
            <tr><td>Dinheiro:</td><td>R$ ${r.valorDinheiro.toFixed(2)}</td></tr>
            <tr><td>Diferença:</td><td class="${cls}">R$ ${r.sobraFalta.toFixed(2)}</td></tr>
            <tr><td>Abastecimento:</td><td>${r.abastecimento || "-"}</td></tr>
            <tr><td>Observação:</td><td>${r.observacao || "-"}</td></tr>
            <tr><td>Pós Conferência:</td><td>${r.posTexto || "-"}</td></tr>
        </table>
    `;

    modal.showModal();
}


/* ============================================================
   Pós-Conferência
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
   Editar Relatório
============================================================ */
async function editarRelatorio(id) {

    const ref = doc(db, "relatorios", id);
    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    const r = snap.data();

    const folha = parseFloat(prompt("Folha:", r.valorFolha)) || r.valorFolha;
    const dinheiro = parseFloat(prompt("Dinheiro:", r.valorDinheiro)) || r.valorDinheiro;
    const obs = prompt("Observação:", r.observacao || "") || r.observacao;

    await updateDoc(ref, {
        valorFolha: folha,
        valorDinheiro: dinheiro,
        sobraFalta: dinheiro - folha,
        observacao: obs
    });

    alert("Atualizado!");
}


/* ============================================================
   Resumo Mensal (Admin)
============================================================ */
async function carregarResumoMensal(admin) {
    if (!admin) return;

    const sel = document.getElementById("selectMatriculas");
    const matricula = sel.value;
    if (!matricula) return;

    const mes = document.getElementById("mesResumo").value;
    if (!mes) return;

    const [ano, mesNum] = mes.split("-");

    const inicio = new Date(ano, mesNum - 1, 1);
    const fim = new Date(ano, mesNum, 0, 23, 59, 59);

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

    snap.forEach(d => {
        const r = d.data();
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
    document.getElementById("resumoSituacao").textContent = saldo >= 0 ? "Positivo" : "Negativo`;

    document.getElementById("resumoLista").innerHTML = `
        <details><summary>Dias com sobra</summary>${pos.join("<br>") || "-"}</details>
        <details><summary>Dias com falta</summary>${neg.join("<br>") || "-"}</details>
    `;
}


/* ============================================================
   Filtrar por Data no Modal Principal
============================================================ */
async function filtrarPorData(admin, matricula) {

    const dataFiltro = document.getElementById("filtroDataGlobal").value;

    if (!dataFiltro) return carregarRelatoriosModal(admin, matricula);

    const container = document.getElementById("listaRelatoriosModal");

    container.innerHTML = `<p>Filtrando...</p>`;

    const [ano, mes, dia] = dataFiltro.split("-");
    const alvo = new Date(ano, mes - 1, dia).toLocaleDateString();

    let q;

    if (admin) {
        q = query(collection(db, "relatorios"), orderBy("criadoEm", "desc"));
    } else {
        q = query(
            collection(db, "relatorios"),
            where("matricula", "==", matricula),
            orderBy("criadoEm", "desc")
        );
    }

    const snap = await getDocs(q);

    container.innerHTML = "";

    snap.forEach(docSnap => {
        const r = docSnap.data();
        const id = docSnap.id;

        const data = r.dataCaixa.toDate
            ? r.dataCaixa.toDate().toLocaleDateString()
            : new Date(r.dataCaixa).toLocaleDateString();

        if (data !== alvo) return;

        const alerta = r.posEditado ? `<span class="alerta-pos">⚠️ Pós Conferência</span>` : "";

        const item = document.createElement("div");
        item.className = "relatorio-item";

        item.innerHTML = `
            <div class="item-header">
                <strong>${data}</strong> – Matrícula: ${r.matricula} ${alerta}
                <button class="btn outline btnVer" data-id="${id}">Ver Detalhes</button>
            </div>

            <div class="actions">
                <button class="btn outline btnPos" data-id="${id}">Pós-Conferência</button>

                ${admin ?
                `
                    <button class="btn primary btnEdit" data-id="${id}">Editar</button>
                    <button class="btn danger btnExcluir" data-id="${id}">Excluir</button>
                `
                : ""}
            </div>
        `;

        container.appendChild(item);
    });

    ativarEventosLista(admin, matricula);
}
