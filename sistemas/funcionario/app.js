import { auth, db } from "./firebaseConfig_v2.js";
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp
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

// Mapa de cores fixo
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
    carregarMatriculas();
  }

  carregarGraficoMensal(dados.matricula);
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

// --- AVISOS FUNCIONÁRIO ---
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

// --- GRÁFICO MENSAL INDIVIDUAL ---
async function carregarGraficoMensal(matricula) {
  const snap = await getDocs(collection(db, "relatorios"));
  const mapa = {};
  snap.forEach((d) => {
    const r = d.data();
    if (r.matricula !== matricula) return;
    const mes = r.dataCaixa?.slice(0, 7);
    mapa[mes] = (mapa[mes] || 0) + (r.abastecimento || 0);
  });
  const labels = Object.keys(mapa).sort();
  const data = Object.values(mapa);

  if (chartMensal) chartMensal.destroy();
  chartMensal = new Chart(mensalChartCtx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Abastecimentos",
        data,
        backgroundColor: "#00bfff"
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
  carregarComparativo();
}

// --- GRÁFICO COMPARATIVO (TODOS FUNCIONÁRIOS) ---
async function carregarComparativo() {
  const snap = await getDocs(collection(db, "relatorios"));
  const mes = document.getElementById("mesEscolhido").value || new Date().toISOString().slice(0,7);
  const mapa = {};
  snap.forEach((d) => {
    const r = d.data();
    if (!r.dataCaixa?.startsWith(mes)) return;
    mapa[r.matricula] = (mapa[r.matricula] || 0) + (r.abastecimento || 0);
  });

  const labels = Object.keys(mapa);
  const data = Object.values(mapa);
  const cores = labels.map(l => CORES_FUNCIONARIOS[l] || "#999");

  if (chartComparativo) chartComparativo.destroy();
  chartComparativo = new Chart(comparativoChartCtx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: cores
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        datalabels: {
          display: true,
          color: "#fff"
        }
      },
      scales: { y: { beginAtZero: true } }
    }
  });
}
document.getElementById("mesEscolhido").addEventListener("change", carregarComparativo);
