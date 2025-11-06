import {  
  auth, db, onAuthStateChanged, collection, getDocs, query, where, orderBy, addDoc, doc, getDoc, updateDoc, deleteDoc, serverTimestamp
} from "./firebaseConfig.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("[app] Iniciando app.js");

  // Atualiza automaticamente o sobra/falta no formulário
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

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/login.html";
      return;
    }

    console.log("[app] onAuthStateChanged fired — user:", user.uid);

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
  });
});

// ===========================
// Interface
// ===========================
function configurarInterface(admin) {
  document.querySelectorAll(".admin-only").forEach(el => el.hidden = !admin);
  document.querySelectorAll(".user-only").forEach(el => el.hidden = admin);
}

// ===========================
// Popula selects de matrícula
// ===========================
async function popularSelects(admin) {
  const selectForm = document.getElementById("matriculaForm");
  const selectResumo = document.getElementById("selectMatriculas");
  const filtroMatricula = document.getElementById("filtroMatricula");

  const snapshot = await getDocs(collection(db, "users"));
  const matriculas = [];

  snapshot.forEach(docSnap => {
    const u = docSnap.data();
    if (u.matricula) matriculas.push(u);
  });

  matriculas.sort((a, b) => a.matricula.localeCompare(b.matricula, 'pt-BR', { numeric: true }));

  [selectForm, selectResumo, filtroMatricula].forEach(sel => {
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione uma matrícula</option>';
    matriculas.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.matricula;
      opt.textContent = `${u.matricula} - ${u.nome}`;
      sel.appendChild(opt);
    });
  });

  console.log("[app] Selects populados:", matriculas.map(m => m.matricula));
}

// ===========================
// Eventos
// ===========================
function inicializarEventos(admin, matricula) {
  const btnSalvarRelatorio = document.getElementById("btnSalvarRelatorio");
  const btnLogout = document.getElementById("btnLogout");

  if (btnSalvarRelatorio) btnSalvarRelatorio.addEventListener("click", () => salvarRelatorio(admin));
  if (btnLogout) btnLogout.addEventListener("click", () => auth.signOut().then(() => window.location.href = "/login.html"));

  // Abrir modais
  document.querySelectorAll(".card h3").forEach(h3 => {
    if (h3.textContent.includes("Relatórios")) {
      h3.style.cursor = "pointer";
      h3.addEventListener("click", () => abrirModalRelatorios(admin));
    }
    if (h3.textContent.includes("Resumo do Recebedor")) {
      h3.style.cursor = "pointer";
      h3.addEventListener("click", () => abrirModalResumo(admin));
    }
  });
}

// ===========================
// Salvar relatório
// ===========================
async function salvarRelatorio(admin) {
  if (!admin) { alert("Apenas administradores podem criar relatórios."); return; }

  const matricula = document.getElementById("matriculaForm").value;
  const dataCaixa = document.getElementById("dataCaixa").value;
  const valorFolha = parseFloat(document.getElementById("valorFolha").value) || 0;
  const valorDinheiro = parseFloat(document.getElementById("valorDinheiro").value) || 0;
  const abastecimento = document.getElementById("abastecimento")?.value || "";
  const sobraFalta = valorDinheiro - valorFolha;
  const observacao = document.getElementById("observacao").value || "";
  const createdBy = auth.currentUser.uid;

  if (!matricula || !dataCaixa) { alert("Preencha todos os campos."); return; }

  try {
    const partes = dataCaixa.split("-");
    const dataCorrigida = new Date(partes[0], partes[1] - 1, partes[2]);

    await addDoc(collection(db, "relatorios"), {
      createdBy,
      criadoEm: serverTimestamp(),
      dataCaixa: dataCorrigida,
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
    document.getElementById("formRelatorio")?.reset();
  } catch (e) {
    console.error("Erro ao salvar relatório:", e);
    alert("Erro ao salvar relatório.");
  }
}

// ===========================
// Modais Relatórios & Resumo
// ===========================

const relatoriosModal = document.getElementById("relatoriosModal");
const relatoriosContainer = document.getElementById("relatoriosContainer");
const btnFecharRelatorios = document.getElementById("btnFecharRelatorios");

const resumoModal = document.getElementById("resumoModal");
const resumoContainer = document.getElementById("resumoContainer");
const btnFecharResumo = document.getElementById("btnFecharResumo");

btnFecharRelatorios?.addEventListener("click", () => relatoriosModal.close());
btnFecharResumo?.addEventListener("click", () => resumoModal.close());

async function abrirModalRelatorios(admin) {
  await carregarRelatoriosModal(admin);
  relatoriosModal.showModal();
}

async function carregarRelatoriosModal(admin) {
  relatoriosContainer.innerHTML = "";
  try {
    const q = query(collection(db, "relatorios"), orderBy("criadoEm", "desc"));
    const snapshot = await getDocs(q);

    snapshot.forEach(docSnap => {
      const r = docSnap.data();
      const div = document.createElement("div");
      div.className = "relatorio-item";

      const diferencaClass = r.sobraFalta >= 0 ? "positivo" : "negativo";
      const dataFormatada = r.dataCaixa.toDate ? r.dataCaixa.toDate().toLocaleDateString() : new Date(r.dataCaixa).toLocaleDateString();
      const alertaPos = r.posEditado ? `<span class="alerta-pos">⚠️ Pós Conferência</span>` : "";

      div.innerHTML = `
        <div class="item-header">
          <strong>${dataFormatada}</strong> — Matrícula: ${r.matricula} ${alertaPos}
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
        </div>
      `;

      relatoriosContainer.appendChild(div);
    });

    // Toggle
    relatoriosContainer.querySelectorAll(".btnToggle").forEach(btn => {
      btn.addEventListener("click", () => {
        btn.closest(".relatorio-item").querySelector(".item-body").classList.toggle("hidden");
      });
    });

  } catch (e) {
    console.error("Erro ao carregar relatórios:", e);
  }
}

async function abrirModalResumo(admin) {
  await carregarResumoModal(admin);
  resumoModal.showModal();
}

async function carregarResumoModal(admin) {
  resumoContainer.innerHTML = "<p>Carregando...</p>";
  const select = document.getElementById("selectMatriculas");
  const matricula = select.value;
  if (!matricula) return;

  const mesInput = document.getElementById("mesResumo");
  if (!mesInput.value) {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    mesInput.value = `${now.getFullYear()}-${month}`;
  }

  const [year, month] = mesInput.value.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  try {
    const q = query(collection(db, "relatorios"), where("matricula", "==", matricula), orderBy("criadoEm", "desc"));
    const snapshot = await getDocs(q);

    let totalFolha = 0;
    let saldo = 0;
    const detalhesPos = [];
    const detalhesNeg = [];

    snapshot.forEach(docSnap => {
      const r = docSnap.data();
      const dt = r.dataCaixa.toDate ? r.dataCaixa.toDate() : new Date(r.dataCaixa);
      if (dt >= start && dt <= end) {
        const vf = Number(r.valorFolha || 0);
        const vd = Number(r.valorDinheiro || 0);
        const diff = vd - vf;
        totalFolha += vf;
        saldo += diff;
        (diff >= 0 ? detalhesPos : detalhesNeg).push(`${dt.toLocaleDateString()}: R$ ${diff.toFixed(2)}`);
      }
    });

    resumoContainer.innerHTML = `
      <div><strong>Total Folha:</strong> R$ ${totalFolha.toFixed(2)}</div>
      <div><strong>Saldo:</strong> R$ ${saldo.toFixed(2)}</div>
      <div><strong>Situação:</strong> ${saldo >= 0 ? "Positivo" : "Negativo"}</div>
      <details><summary>Dias com sobra</summary>${detalhesPos.join("<br>") || "-"}</details>
      <details><summary>Dias com falta</summary>${detalhesNeg.join("<br>") || "-"}</details>
    `;
  } catch (e) {
    console.error("Erro ao carregar resumo:", e);
  }
}
