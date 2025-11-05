import { auth, db } from "./firebaseConfig_v2.js";
import {
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  setDoc,
  addDoc,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// ELEMENTOS
const nomeEl = document.getElementById("funcNome");
const matriculaEl = document.getElementById("funcMatricula");
const admissaoEl = document.getElementById("funcAdmissao");
const horarioEl = document.getElementById("funcHorario");
const btnAvisos = document.getElementById("btnAvisos");
const modalAvisos = document.getElementById("modalAvisos");
const avisosLista = document.getElementById("avisosLista");

const adminControls = document.getElementById("adminControls");
const adminMatriculaSelect = document.getElementById("adminMatriculaSelect");
const adminPesquisarMatricula = document.getElementById("adminPesquisarMatricula");
const adminHorarioInput = document.getElementById("adminHorarioInput");
const adminAvisoInput = document.getElementById("adminAvisoInput");
const adminAvisosLista = document.getElementById("adminAvisosLista");

const btnSalvarHorario = document.getElementById("btnSalvarHorario");
const btnSalvarAviso = document.getElementById("btnSalvarAviso");
const btnPesquisarAvisos = document.getElementById("btnPesquisarAvisos");

const mensalChartCtx = document.getElementById("mensalChart");
const comparativoChartCtx = document.getElementById("comparativoChart");

let usuarioAtual = null;
let chartMensal, chartComparativo;

const CORES_FUNCIONARIOS = {
  "4144": "#4da6ff",
  "5831": "#ffeb3b",
  "6994": "#b0b0b0",
  "7794": "#ff9800",
  "5354": "#90ee90",
  "6266": "#00bfff",
  "6414": "#8b4513",
  "5271": "#ff69b4",
  "9003": "#800080",
  "8789": "#c8a2c8",
  "1858": "#556b2f",
  "70029": "#c0c0c0"
};

// --- LOGIN STATE ---
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../../login.html";
    return;
  }
  usuarioAtual = user;
  await carregarPerfil(user);
});

// --- PERFIL ---
async function carregarPerfil(user) {
  const q = query(collection(db, "users"), where("email", "==", user.email));
  const snap = await getDocs(q);
  if (snap.empty) return;
  const dados = snap.docs[0].data();

  nomeEl.textContent = dados.nome;
  matriculaEl.textContent = dados.matricula;
  admissaoEl.textContent = dados.dataAdmissao || "—";
  horarioEl.textContent = dados.horarioTrabalho || "—";

  if (dados.isAdmin) {
    adminControls.classList.remove("hidden");
    await carregarMatriculas();
    carregarComparativo();
  }

  carregarGraficoIndividual(dados.matricula);
  carregarAvisos(dados.matricula);
}

// --- MATRICULAS ADMIN ---
async function carregarMatriculas() {
  const snap = await getDocs(collection(db, "users"));
  snap.forEach((d) => {
    const { matricula, nome } = d.data();
    [adminMatriculaSelect, adminPesquisarMatricula].forEach(sel => {
      const opt = document.createElement("option");
      opt.value = matricula;
      opt.textContent = `${matricula} - ${nome}`;
      sel.appendChild(opt);
    });
  });
}

// --- GRÁFICO INDIVIDUAL ---
async function carregarGraficoIndividual(matricula) {
  const relatoriosRef = collection(db, "relatorios");
  const agora = new Date();
  const primeiroDia = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const ultimoDia = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);

  const q = query(
    relatoriosRef,
    where("matricula", "==", matricula),
    where("dataCaixa", ">=", primeiroDia),
    where("dataCaixa", "<=", ultimoDia)
  );

  onSnapshot(q, (snap) => {
    const dias = {};
    snap.forEach(docSnap => {
      const r = docSnap.data();
      if (!r.dataCaixa) return;
      const data = r.dataCaixa.toDate ? r.dataCaixa.toDate() : new Date(r.dataCaixa);
      const dia = data.getDate();
      if (!dias[dia]) dias[dia] = { abastecimentos: 0, valorFolha: 0 };
      dias[dia].abastecimentos++;
      dias[dia].valorFolha += Number(r.valorFolha || 0);
    });

    const labels = [];
    const abastecimentos = [];
    const valores = [];
    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      labels.push(d.toString().padStart(2, "0"));
      abastecimentos.push(dias[d]?.abastecimentos || 0);
      valores.push(dias[d]?.valorFolha || 0);
    }

    if (chartMensal) chartMensal.destroy();
    chartMensal = new Chart(mensalChartCtx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Abastecimentos",
            data: abastecimentos,
            backgroundColor: "rgba(0,191,255,0.5)",
            borderColor: "#00bfff",
            borderWidth: 1,
            yAxisID: "y"
          },
          {
            label: "Valor Folha (R$)",
            data: valores,
            type: "line",
            borderColor: "#ffd700",
            backgroundColor: "rgba(255,215,0,0.3)",
            yAxisID: "y1"
          }
        ]
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        plugins: { legend: { labels: { color: "#fff", font: { size: 14 } } } },
        scales: {
          y: { beginAtZero: true, ticks: { color: "#00bfff", font: { size: 12 } } },
          y1: { position: "right", ticks: { color: "#ffd700", font: { size: 12 } }, grid: { drawOnChartArea: false } },
          x: { ticks: { color: "#ccc", font: { size: 12 } } }
        }
      }
    });
  });
}

// --- GRÁFICO COMPARATIVO ---
async function carregarComparativo() {
  if (!usuarioAtual) return;

  const userSnap = await getDocs(collection(db, "users"));
  const userData = userSnap.docs.find(d => d.data().email === usuarioAtual.email)?.data();
  if (!userData?.isAdmin) {
    comparativoChartCtx.parentElement.style.display = "none";
    return;
  }
  comparativoChartCtx.parentElement.style.display = "block";

  const mes = mesEscolhidoInput.value;

  const snap = await getDocs(collection(db, "relatorios"));
  const mapa = {};

  snap.forEach((d) => {
    const r = d.data();
    if (!r.dataCaixa) return;
    const data = r.dataCaixa.toDate ? r.dataCaixa.toDate() : new Date(r.dataCaixa);
    
    // FILTRO CORRIGIDO: usa mês local
    const mesRegistro = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2,'0')}`;
    if (mesRegistro !== mes) return;

    if (!mapa[r.matricula]) mapa[r.matricula] = { abastecimentos: 0, valorFolha: 0 };
    mapa[r.matricula].abastecimentos++;
    mapa[r.matricula].valorFolha += Number(r.valorFolha || 0);
  });

  const labels = Object.keys(mapa).sort();
  const abastecimentos = labels.map(m => mapa[m].abastecimentos);
  const valores = labels.map(m => mapa[m].valorFolha);
  const cores = labels.map(m => CORES_FUNCIONARIOS[m] || "#888");

  if (chartComparativo) chartComparativo.destroy();

  chartComparativo = new Chart(comparativoChartCtx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Abastecimentos", data: abastecimentos, backgroundColor: cores, borderColor: cores, borderWidth: 1, yAxisID: "y" },
        { label: "Valor Total Folha (R$)", data: valores, type: "line", borderColor: "#ffd700", backgroundColor: "rgba(255,215,0,0.3)", yAxisID: "y1" }
      ]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      layout: { padding: { top: 20, bottom: 20 } },
      scales: {
        y: { beginAtZero: true, ticks: { color: "#00bfff", font: { size: 12 } } },
        y1: { position: "right", ticks: { color: "#ffd700", font: { size: 12 } }, grid: { drawOnChartArea: false } },
        x: { ticks: { color: "#ccc", font: { size: 12 } } }
      },
      plugins: { legend: { labels: { color: "#fff", font: { size: 14 } } }, tooltip: { mode: 'index', intersect: false } }
    }
  });
}
document.getElementById("mesEscolhido").addEventListener("change", carregarComparativo);

// --- AVISOS ---
async function carregarAvisos(matricula) {
  const q = query(collection(db, "avisos"), where("matricula", "==", matricula));
  const snap = await getDocs(q);
  if (snap.empty) {
    btnAvisos.textContent = "Sem avisos vinculados à matrícula";
    btnAvisos.classList.remove("blink");
    return;
  }
  btnAvisos.classList.add("blink");
  btnAvisos.textContent = `🔔 ${snap.size} aviso(s)`;
  avisosLista.innerHTML = "";
  snap.forEach((d) => {
    const p = document.createElement("p");
    p.textContent = d.data().texto;
    avisosLista.appendChild(p);
  });
}

btnAvisos.addEventListener("click", () => modalAvisos.showModal());

// --- SALVAR HORÁRIO ---
btnSalvarHorario.addEventListener("click", async () => {
  const mat = adminMatriculaSelect.value;
  const horario = adminHorarioInput.value.trim();
  if (!mat || !horario) return alert("Informe matrícula e horário.");
  const q = query(collection(db, "users"), where("matricula", "==", mat));
  const s = await getDocs(q);
  if (s.empty) return;
  const ref = s.docs[0].ref;
  await setDoc(ref, { horarioTrabalho: horario }, { merge: true });
  alert("Horário atualizado!");
});

// --- SALVAR AVISO ---
btnSalvarAviso.addEventListener("click", async () => {
  const mat = adminMatriculaSelect.value;
  const aviso = adminAvisoInput.value.trim();
  if (!mat || !aviso) return alert("Preencha aviso e matrícula.");
  await addDoc(collection(db, "avisos"), { matricula: mat, texto: aviso, criadoEm: serverTimestamp() });
  alert("Aviso salvo!");
  adminAvisoInput.value = "";
});

// --- PESQUISAR AVISOS ADMIN ---
btnPesquisarAvisos.addEventListener("click", async () => {
  const mat = adminPesquisarMatricula.value;
  adminAvisosLista.innerHTML = "Carregando...";
  const q = query(collection(db, "avisos"), where("matricula", "==", mat), orderBy("criadoEm", "desc"));
  const snap = await getDocs(q);
  adminAvisosLista.innerHTML = "";
  snap.forEach((d) => {
    const div = document.createElement("div");
    div.className = "aviso-item";
    div.textContent = d.data().texto;
    adminAvisosLista.appendChild(div);
  });
});
