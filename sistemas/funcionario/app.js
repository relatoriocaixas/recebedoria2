import { auth, db } from "./firebaseConfig_v2.js";
import {
  collection,
  getDocs,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const nomeEl = document.getElementById("funcNome");
const matriculaEl = document.getElementById("funcMatricula");
const admissaoEl = document.getElementById("funcAdmissao");
const horarioEl = document.getElementById("funcHorario");

const btnAvisos = document.getElementById("btnAvisos");
const modalAvisos = document.getElementById("modalAvisos");
const avisosLista = document.getElementById("avisosLista");

const mensalChartCtx = document.getElementById("mensalChart");
let chartMensal = null;

// --- LOGIN STATE ---
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../../login.html";
    return;
  }
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

  carregarGraficoIndividual(dados.matricula);
  carregarAvisos(dados.matricula);
}

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
    let totalAbastecimentos = 0;
    let totalValor = 0;

    snap.forEach(docSnap => {
      const r = docSnap.data();
      if (!r.dataCaixa) return;
      const data = r.dataCaixa.toDate ? r.dataCaixa.toDate() : new Date(r.dataCaixa);
      const dia = data.getDate();
      if (!dias[dia]) dias[dia] = { abastecimentos: 0, valorFolha: 0 };
      dias[dia].abastecimentos++;
      dias[dia].valorFolha += Number(r.valorFolha || 0);

      totalAbastecimentos++;
      totalValor += Number(r.valorFolha || 0);
    });

    const labels = [];
    const abastecimentos = [];
    const valores = [];

    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      labels.push(d.toString().padStart(2, "0"));
      abastecimentos.push(dias[d]?.abastecimentos || 0);
      valores.push(dias[d]?.valorFolha || 0);
    }

    // Exibe resumo acima do gráfico
    const totalInfoEl = document.getElementById("totalInfo");
    totalInfoEl.innerHTML = `
      <strong>Total Abastecimentos:</strong> ${totalAbastecimentos} |
      <strong>Total Recebido:</strong> R$ ${totalValor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
    `;

    if (chartMensal) chartMensal.destroy();

    chartMensal = new Chart(mensalChartCtx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Abastecimentos",
            data: abastecimentos,
            backgroundColor: "rgba(0, 255, 255, 0.7)",
            borderColor: "#00ffff",
            borderWidth: 2,
            borderRadius: 6,
            yAxisID: "y"
          },
          {
            label: "Valor Folha (R$)",
            data: valores,
            type: "line",
            borderColor: "#ffd700",
            backgroundColor: "rgba(255,215,0,0.4)",
            borderWidth: 3,
            tension: 0.3,
            yAxisID: "y1",
            pointStyle: "rectRot",
            pointRadius: 6,
            pointBackgroundColor: "#ffd700"
          }
        ]
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          legend: {
            labels: {
              color: "#fff",
              font: { size: 14 },
              usePointStyle: true,
              pointStyle: 'circle'
            },
            onClick: null
          },
          tooltip: {
            mode: "index",
            intersect: false,
            backgroundColor: "rgba(0,0,0,0.9)",
            titleColor: "#00ffff",
            bodyColor: "#fff",
            borderColor: "#00ffff",
            borderWidth: 1
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: "#0ff", font: { size: 12 } },
            grid: {
              color: "rgba(0,255,255,0.2)"
            }
          },
          y1: {
            position: "right",
            ticks: { color: "#ffd700", font: { size: 12 } },
            grid: { drawOnChartArea: false }
          },
          x: {
            ticks: { color: "#fff", font: { size: 12 } },
            grid: { color: "rgba(255,255,255,0.05)" }
          }
        }
      }
    });
  });
}
