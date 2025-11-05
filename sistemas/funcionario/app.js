import { auth, db } from "./firebaseConfig_v2.js";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  setDoc,
  serverTimestamp,
  onSnapshot
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
let chartMensal = null;
let chartComparativo = null;

// Mapa de cores fixo
const CORES_FUNCIONARIOS = {
  "4144": "#4da6ff", "5831": "#ffeb3b", "6994": "#b0b0b0",
  "7794": "#ff9800", "5354": "#90ee90", "6266": "#00bfff",
  "6414": "#8b4513", "5271": "#ff69b4", "9003": "#800080",
  "8789": "#c8a2c8", "1858": "#556b2f", "70029": "#c0c0c0"
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
    carregarMatriculas();
  }

  carregarGraficoIndividual(dados.matricula);

  if (dados.isAdmin) carregarComparativo();

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
  await addDoc(collection(db, "avisos"), {
    matricula: mat,
    texto: aviso,
    criadoEm: serverTimestamp()
  });
  alert("Aviso salvo!");
  adminAvisoInput.value = "";
});

// --- PESQUISAR AVISOS ADMIN ---
btnPesquisarAvisos.addEventListener("click", async () => {
  const mat = adminPesquisarMatricula.value;
  const q = query(collection(db, "avisos"), where("matricula", "==", mat), orderBy("criadoEm", "desc"));
  const snap = await getDocs(q);
  adminAvisosLista.innerHTML = "";
  snap.forEach(d => {
    const aviso = d.data();
    const div = document.createElement("div");
    div.textContent = aviso.texto;
    adminAvisosLista.appendChild(div);
  });
});

// --- CARREGAR AVISOS USUARIO ---
async function carregarAvisos(matricula) {
  const q = query(collection(db, "avisos"), where("matricula", "==", matricula), orderBy("criadoEm", "desc"));
  const snap = await getDocs(q);
  btnAvisos.textContent = snap.empty ? "Sem avisos vinculados à matrícula" : `Avisos (${snap.size})`;
  btnAvisos.addEventListener("click", () => {
    avisosLista.innerHTML = "";
    snap.forEach(d => {
      const aviso = d.data();
      const p = document.createElement("p");
      p.textContent = aviso.texto;
      avisosLista.appendChild(p);
    });
    modalAvisos.showModal();
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
          y: { beginAtZero: true, ticks: { color: "#00bfff", font: { size: 14 } } },
          y1: { position: "right", ticks: { color: "#ffd700", font: { size: 14 } }, grid: { drawOnChartArea: false } },
          x: { ticks: { color: "#ccc", font: { size: 14 } } }
        }
      }
    });
  });
}

// --- GRÁFICO COMPARATIVO (ADMIN) ---
async function carregarComparativo() {
  const mes = document.getElementById("mesEscolhido").value || new Date().toISOString().slice(0, 7);
  const snap = await getDocs(collection(db, "relatorios"));
  const mapa = {};

  snap.forEach((d) => {
    const r = d.data();
    if (!r.dataCaixa) return;
    const data = r.dataCaixa.toDate ? r.dataCaixa.toDate() : new Date(r.dataCaixa);
    const mesRegistro = data.toISOString().slice(0, 7);
    if (mesRegistro !== mes) return;

    if (!mapa[r.matricula]) mapa[r.matricula] = { abastecimentos: 0, valorFolha: 0 };
    mapa[r.matricula].abastecimentos++;
    mapa[r.matricula].valorFolha += Number(r.valorFolha || 0);
  });

  const labels = Object.keys(mapa);
  const abastecimentos = labels.map(m => mapa[m].abastecimentos);
  const valores = labels.map(m => mapa[m].valorFolha);
  const cores = labels.map(m => CORES_FUNCIONARIOS[m] || "#888");

  if (chartComparativo) chartComparativo.destroy();
  chartComparativo = new Chart(comparativoChartCtx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Abastecimentos", data: abastecimentos, backgroundColor: cores },
        { label: "Valor Total Folha (R$)", data: valores, type: "line", borderColor: "#ffd700", backgroundColor: "rgba(255,215,0,0.3)" }
      ]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      plugins: { legend: { labels: { color: "#fff", font: { size: 14 } } } },
      scales: {
        y: { beginAtZero: true, ticks: { color: "#fff", font: { size: 14 } } },
        x: { ticks: { color: "#ccc", font: { size: 14 } } }
      }
    }
  });
}

document.getElementById("mesEscolhido").addEventListener("change", carregarComparativo);
