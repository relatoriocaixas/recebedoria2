// grafico.js
// Requer: chart.js (CDN) já carregado no index.html
// e Firebase Firestore com campos: matricula, dataCaixa, abastecimento

import { db } from "../firebaseConfig_v2.js";
import {
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// === MAPA DE CORES FIXAS POR MATRÍCULA ===
const coresFuncionarios = {
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
  "70029": "#c0c0c0", // prata
};

// === FUNÇÃO: RESUMO MENSAL DE UM FUNCIONÁRIO ===
export async function gerarGraficoFuncionario(matricula, ctxId) {
  const q = query(collection(db, "relatorios"), where("matricula", "==", matricula));
  const snapshot = await getDocs(q);

  // Inicializa meses
  const meses = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
  ];
  const dados = Array(12).fill(0);

  snapshot.forEach((doc) => {
    const r = doc.data();
    if (r.dataCaixa && r.abastecimento != null) {
      const mes = new Date(r.dataCaixa).getMonth();
      dados[mes] += r.abastecimento;
    }
  });

  const ctx = document.getElementById(ctxId).getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: meses,
      datasets: [{
        label: "Abastecimentos no mês",
        data: dados,
        backgroundColor: coresFuncionarios[matricula] || "#888",
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y} docs` } },
        datalabels: {
          color: "#fff",
          anchor: "center",
          align: "center",
          formatter: (value) => (value > 0 ? value : "")
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "#333" },
          ticks: { color: "#ccc" }
        },
        x: {
          ticks: { color: "#ccc" },
          grid: { color: "#222" }
        }
      }
    },
    plugins: [ChartDataLabels],
  });
}

// === FUNÇÃO: COMPARATIVO DE TODOS OS FUNCIONÁRIOS ===
export async function gerarGraficoComparativo(ctxId, mesFiltro) {
  const q = query(collection(db, "relatorios"));
  const snapshot = await getDocs(q);

  // Soma abastecimento por matrícula
  const totais = {};
  snapshot.forEach((doc) => {
    const r = doc.data();
    if (!r.dataCaixa || !r.abastecimento) return;
    const data = new Date(r.dataCaixa);
    const mes = data.getMonth() + 1;
    if (mesFiltro && mes !== mesFiltro) return;
    totais[r.matricula] = (totais[r.matricula] || 0) + r.abastecimento;
  });

  const matriculas = Object.keys(totais);
  const valores = Object.values(totais);
  const cores = matriculas.map((m) => coresFuncionarios[m] || "#999");

  const ctx = document.getElementById(ctxId).getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: matriculas,
      datasets: [{
        label: "Abastecimentos no mês",
        data: valores,
        backgroundColor: cores
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y} docs` } },
        datalabels: {
          color: "#fff",
          anchor: "center",
          align: "center",
          formatter: (value) => (value > 0 ? value : "")
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "#333" },
          ticks: { color: "#ccc" }
        },
        x: {
          ticks: { color: "#ccc" },
          grid: { color: "#222" }
        }
      }
    },
    plugins: [ChartDataLabels],
  });
}
