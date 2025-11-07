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

document.addEventListener("DOMContentLoaded", () => {
  console.log("[app] Iniciando app.js");

  /* ========================
        Atualiza sobra/falta
     ======================== */
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

  /* ========================
        Monitor de login
     ======================== */
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/login.html";
      return;
    }

    console.log("[app] onAuthStateChanged — user:", user.uid);

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      alert("Seu cadastro não está completo. Faça login novamente.");
      await auth.signOut();
      return;
    }

    const userData = userSnap.data();
    const IS_ADMIN = userData.admin === true;
    const MATRICULA = userData.matricula;

    configurarInterface(IS_ADMIN);
    await popularSelects(IS_ADMIN);
    inicializarEventos(IS_ADMIN, MATRICULA);
    await carregarRelatorios(IS_ADMIN, MATRICULA);
    carregarResumoMensal(IS_ADMIN);

    /* ========================
          Modal Relatórios
       ======================== */
    const tituloRelatorios = document.getElementById("tituloRelatorios");
    const modalRelatorios = document.getElementById("modalRelatorios");
    const listaRelatoriosModal = document.getElementById("listaRelatoriosModal");

    if (tituloRelatorios && modalRelatorios && listaRelatoriosModal) {

      tituloRelatorios.style.cursor = "pointer";

      tituloRelatorios.addEventListener("click", () => {
        const lista = document.getElementById("listaRelatorios");
        if (!lista) return;

        listaRelatoriosModal.innerHTML = lista.innerHTML;
        modalRelatorios.showModal();

        reativarEventosDentroDoModal(modalRelatorios, IS_ADMIN, MATRICULA);
      });
    }
  });
});

/* ============================================================
    Reanexa eventos de Toggle / Pós-Conferência / Editar / Excluir
   ============================================================ */
function reativarEventosDentroDoModal(modal, admin, matricula) {
  modal.querySelectorAll(".btnToggle").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.closest(".relatorio-item")
        .querySelector(".item-body")
        .classList.toggle("hidden");
    });
  });

  modal.querySelectorAll(".btnPos").forEach(btn => {
    btn.addEventListener("click", () => abrirPosConferencia(btn.dataset.id, admin));
  });

  modal.querySelectorAll(".btnEdit").forEach(btn => {
    btn.addEventListener("click", () => editarRelatorio(btn.dataset.id));
  });

  modal.querySelectorAll(".btnExcluir").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Deseja realmente excluir este relatório?")) return;

      try {
        await deleteDoc(doc(db, "relatorios", btn.dataset.id));
        alert("Relatório excluído!");
        carregarRelatorios(admin, matricula);
      } catch (e) {
        console.error("Erro ao excluir:", e);
        alert("Erro ao excluir relatório.");
      }
    });
  });
}

/* ========================
       Interface
   ======================== */
function configurarInterface(admin) {
  document.querySelectorAll(".admin-only")
    .forEach(el => el.hidden = !admin);

  document.querySelectorAll(".user-only")
    .forEach(el => el.hidden = admin);
}

/* ========================
    Popular matrículas
   ======================== */
async function popularSelects(admin) {
  const selectForm = document.getElementById("matriculaForm");
  const selectResumo = document.getElementById("selectMatriculas");

  const snapshot = await getDocs(collection(db, "users"));

  const matriculas = [];
  snapshot.forEach(docSnap => {
    const u = docSnap.data();
    if (u.matricula) matriculas.push(u);
  });

  matriculas.sort((a, b) =>
    a.matricula.localeCompare(b.matricula, "pt-BR", { numeric: true })
  );

  [selectForm, selectResumo].forEach(sel => {
    if (!sel) return;

    sel.innerHTML = `<option value="">Selecione</option>`;

    matriculas.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.matricula;
      opt.textContent = `${u.matricula} - ${u.nome}`;
      sel.appendChild(opt);
    });
  });

  console.log("[app] Selects populados:", matriculas.map(m => m.matricula));
}

/* ========================
     Inicializar Eventos
   ======================== */
function inicializarEventos(admin, matricula) {
  const btnSalvarRelatorio = document.getElementById("btnSalvarRelatorio");
  const btnCarregarResumo = document.getElementById("btnCarregarResumo");
  const btnToggleResumo = document.getElementById("btnToggleResumo");

  if (btnSalvarRelatorio)
    btnSalvarRelatorio.addEventListener("click", () => salvarRelatorio(admin));

  if (btnCarregarResumo)
    btnCarregarResumo.addEventListener("click", () => carregarResumoMensal(admin));

  if (btnToggleResumo)
    btnToggleResumo.addEventListener("click",
      () => document.getElementById("resumoWrap").classList.toggle("collapsed")
    );
}

/* ========================
       Salvar Relatório
   ======================== */
async function salvarRelatorio(admin) {
  if (!admin) return alert("Apenas administradores podem criar relatórios.");

  const matricula = document.getElementById("matriculaForm").value;
  const dataCaixa = document.getElementById("dataCaixa").value;
  const valorFolha = parseFloat(document.getElementById("valorFolha").value) || 0;
  const valorDinheiro = parseFloat(document.getElementById("valorDinheiro").value) || 0;
  const abastecimento = document.getElementById("abastecimento").value || "";
  const sobraFalta = valorDinheiro - valorFolha;
  const observacao = document.getElementById("observacao").value || "";

  if (!matricula || !dataCaixa)
    return alert("Preencha todos os campos.");

  try {
    const [ano, mes, dia] = dataCaixa.split("-");
    const dataFormatada = new Date(ano, mes - 1, dia);

    await addDoc(collection(db, "relatorios"), {
      createdBy: auth.currentUser.uid,
      criadoEm: serverTimestamp(),
      dataCaixa: dataFormatada,
      imagemPath: "",
      matricula,
      observacao,
      abastecimento,
      posEditado: false,
      posTexto: "",
      sobraFalta,
      valorDinheiro,
      valorFolha
    });

    alert("Relatório salvo!");
    carregarRelatorios(true, matricula);

  } catch (e) {
    console.error("Erro ao salvar relatório:", e);
    alert("Erro ao salvar.");
  }
}

/* ========================
     Carregar Relatórios
   ======================== */
async function carregarRelatorios(admin, userMatricula) {
  const lista = document.getElementById("listaRelatorios");
  if (!lista) return;

  lista.innerHTML = "";

  try {
    let q;

    if (admin) {
      q = query(collection(db, "relatorios"),
        orderBy("criadoEm", "desc"));
    } else {
      q = query(collection(db, "relatorios"),
        where("matricula", "==", userMatricula),
        orderBy("criadoEm", "desc"));
    }

    const snapshot = await getDocs(q);

    snapshot.forEach(docSnap => {
      const r = docSnap.data();

      const tr = document.createElement("div");
      tr.className = "relatorio-item";

      const diferencaClass = r.sobraFalta >= 0 ? "positivo" : "negativo";
      const dataFormatada = r.dataCaixa.toDate
        ? r.dataCaixa.toDate().toLocaleDateString()
        : new Date(r.dataCaixa).toLocaleDateString();

      const alerta = r.posEditado
        ? `<span class="alerta-pos">⚠️ Verificar Pós Conferência</span>`
        : "";

      tr.innerHTML = `
        <div class="item-header">
            <strong>${dataFormatada}</strong> — Matrícula: ${r.matricula}
            ${alerta}
            <button class="btn outline btnToggle">Ocultar/Exibir</button>
        </div>

        <div class="item-body hidden">
            <table class="relatorio-table">
                <tr><td>Folha:</td><td>R$ ${r.valorFolha.toFixed(2)}</td></tr>
                <tr><td>Dinheiro:</td><td>R$ ${r.valorDinheiro.toFixed(2)}</td></tr>
                <tr><td>Diferença:</td><td class="${diferencaClass}">R$ ${r.sobraFalta.toFixed(2)}</td></tr>
                <tr><td>Abastecimento:</td><td>${r.abastecimento || "-"}</td></tr>
                <tr><td>Observação:</td><td>${r.observacao || "-"}</td></tr>
                <tr><td>Pós Conferência:</td><td>${r.posTexto || "-"}</td></tr>
            </table>

            <div class="actions">
                <button class="btn outline btnPos" data-id="${docSnap.id}">Pós Conferência</button>

                ${admin ? `
                <button class="btn primary btnEdit" data-id="${docSnap.id}">Editar</button>
                <button class="btn danger btnExcluir" data-id="${docSnap.id}">Excluir</button>
                ` : ""}
            </div>
        </div>
      `;

      lista.appendChild(tr);
    });

    /* Reanexar eventos fora do modal */
    lista.querySelectorAll(".btnToggle").forEach(btn => {
      btn.addEventListener("click", () => {
        btn.closest(".relatorio-item")
          .querySelector(".item-body")
          .classList.toggle("hidden");
      });
    });

    lista.querySelectorAll(".btnPos").forEach(btn => {
      btn.addEventListener("click", () => abrirPosConferencia(btn.dataset.id, admin));
    });

    lista.querySelectorAll(".btnEdit").forEach(btn => {
      btn.addEventListener("click", () => editarRelatorio(btn.dataset.id));
    });

    lista.querySelectorAll(".btnExcluir").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Deseja realmente excluir este relatório?")) return;

        try {
          await deleteDoc(doc(db, "relatorios", btn.dataset.id));
          alert("Relatório excluído!");
          carregarRelatorios(admin, userMatricula);
        } catch (e) {
          console.error("Erro ao excluir:", e);
          alert("Erro ao excluir.");
        }
      });
    });

  } catch (e) {
    console.error("Erro ao carregar relatórios:", e);
  }
}

/* ========================
     Pós-Conferência
   ======================== */
async function abrirPosConferencia(id, admin) {
  const modal = document.getElementById("posModal");
  const textarea = document.getElementById("posTexto");
  if (!modal || !textarea) return;

  modal.showModal();

  const docRef = doc(db, "relatorios", id);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    textarea.value = docSnap.data().posTexto || "";
    textarea.disabled = !admin;
  }

  document.getElementById("btnSalvarPos").onclick = async () => {
    if (!admin) return;

    await updateDoc(docRef, {
      posTexto: textarea.value,
      posEditado: true
    });

    alert("Pós Conferência salva!");
    modal.close();
    carregarRelatorios(true, "");
  };
}

/* ========================
     Editar Relatório
   ======================== */
async function editarRelatorio(id) {
  const docRef = doc(db, "relatorios", id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;

  const r = snap.data();

  const novoFolha = parseFloat(prompt("Valor Folha:", r.valorFolha)) || r.valorFolha;
  const novoDin = parseFloat(prompt("Dinheiro:", r.valorDinheiro)) || r.valorDinheiro;
  const novaObs = prompt("Observação:", r.observacao || "") || r.observacao;

  await updateDoc(docRef, {
    valorFolha: novoFolha,
    valorDinheiro: novoDin,
    sobraFalta: novoDin - novoFolha,
    observacao: novaObs
  });

  alert("Relatório atualizado!");
  carregarRelatorios(true, "");
}

/* ========================
     Resumo Mensal
   ======================== */
async function carregarResumoMensal(admin) {
  if (!admin) return;

  const select = document.getElementById("selectMatriculas");
  const matricula = select.value;
  if (!matricula) return;

  const mesInput = document.getElementById("mesResumo");

  if (!mesInput.value) {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    mesInput.value = `${now.getFullYear()}-${m}`;
  }

  const [year, month] = mesInput.value.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  try {
    const q = query(
      collection(db, "relatorios"),
      where("matricula", "==", matricula),
      orderBy("criadoEm", "desc")
    );

    const snapshot = await getDocs(q);

    let totalFolha = 0;
    let saldo = 0;

    const positivos = [];
    const negativos = [];

    snapshot.forEach(docSnap => {
      const r = docSnap.data();

      const dt = r.dataCaixa.toDate
        ? r.dataCaixa.toDate()
        : new Date(r.dataCaixa);

      if (dt >= start && dt <= end) {

        const vf = Number(r.valorFolha || 0);
        const vd = Number(r.valorDinheiro || 0);
        const diff = vd - vf;

        totalFolha += vf;
        saldo += diff;

        const linha = `${dt.toLocaleDateString()}: R$ ${diff.toFixed(2)}`;

        if (diff >= 0) positivos.push(linha);
        else negativos.push(linha);
      }
    });

    document.getElementById("resumoTotalFolha").textContent =
      `R$ ${totalFolha.toFixed(2)}`;

    document.getElementById("resumoSaldo").textContent =
      `R$ ${saldo.toFixed(2)}`;

    document.getElementById("resumoSituacao").textContent =
      saldo >= 0 ? "Positivo" : "Negativo";

    document.getElementById("resumoLista").innerHTML = `
      <details>
        <summary>Dias com sobra</summary>
        ${positivos.join("<br>") || "-"}
      </details>

      <details>
        <summary>Dias com falta</summary>
        ${negativos.join("<br>") || "-"}
      </details>
    `;

  } catch (e) {
    console.error("Erro ao carregar resumo:", e);
  }
}
