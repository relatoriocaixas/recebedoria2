import { auth, db } from "./firebaseConfig_v2.js";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  onSnapshot,
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

const mensalChartCtx = document.getElementById("mensalChart");
const totalInfoEl = document.getElementById("totalInfo");
const mesInput = document.getElementById("mesEscolhido");

let usuarioAtual = null;
let chartMensal = null;
let matriculaAtual = null;

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

  matriculaAtual = dados.matricula;

  // Nome rosa ou azul
  const matriculasRosa = ["8789","9003","6414","5271"];
  nomeEl.textContent = dados.nome;
  if (matriculasRosa.includes(dados.matricula)) {
    nomeEl.classList.add("nome-rosa");
    nomeEl.classList.remove("nome-azul");
  } else {
    nomeEl.classList.add("nome-azul");
    nomeEl.classList.remove("nome-rosa");
  }

  matriculaEl.textContent = dados.matricula;
  admissaoEl.textContent = dados.dataAdmissao || "—";
  horarioEl.textContent = dados.horarioTrabalho || "—";

  // Carregar gráfico individual
  carregarGraficoIndividual(dados.matricula);

  // Carregar avisos
  carregarAvisos(dados.matricula);

  // Configura input de mês
  const hoje = new Date();
  const mesAtual = hoje.toISOString().slice(0, 7);
  mesInput.value = mesAtual;

  mesInput.addEventListener("change", () => {
    carregarGraficoIndividual(matriculaAtual, mesInput.value);
  });
}

// --- AVISOS FUNCIONÁRIO ---
async function carregarAvisos(matricula) {
  const q = query(collection(db, "avisos"), where("matricula", "==", matricula));
  const snap = await getDocs(q);
  if (snap.empty) {
    btnAvisos.textContent = "Sem avisos vinculados à matrícula";
    btnAvisos.classList.remove("blink");
    btnAvisos.classList.remove("aviso-vermelho");
    btnAvisos.classList.add("btn-cinza");
    return;
  }
  btnAvisos.textContent = `🔔 ${snap.size} aviso(s)`;
  btnAvisos.classList.add("blink", "aviso-vermelho");
  btnAvisos.classList.remove("btn-cinza");

  avisosLista.innerHTML = "";
  snap.forEach((d) => {
    const p = document.createElement("p");
    p.textContent = d.data().texto;
    avisosLista.appendChild(p);
  });
}

btnAvisos.addEventListener("click", () => modalAvisos.showModal());

// --- GRÁFICO INDIVIDUAL ---
async function carregarGraficoIndividual(matricula, mesEscolhido = null) {
  const relatoriosRef = collection(db, "relatorios");
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = mesEscolhido ? Number(mesEscolhido.split("-")[1])-1 : agora.getMonth();

  const primeiroDia = new Date(ano, mes, 1);
  const ultimoDia = new Date(ano, mes + 1, 0);

  const q = query(
    relatoriosRef,
    where("matricula", "==", matricula),
    where("dataCaixa", ">=", primeiroDia),
    where("dataCaixa", "<=", ultimoDia)
  );

  onSnapshot(q, (snap) => {
    const dias = {};
    let totalAbastecimentos = 0;
    let totalDinheiro = 0;

    snap.forEach(docSnap => {
      const r = docSnap.data();
      if (!r.dataCaixa) return;
      const data = r.dataCaixa.toDate ? r.dataCaixa.toDate() : new Date(r.dataCaixa);
      const dia = data.getDate();
      if (!dias[dia]) dias[dia] = { abastecimentos: 0, valorFolha: 0 };
      dias[dia].abastecimentos++;
      dias[dia].valorFolha += Number(r.valorFolha || 0);

      totalAbastecimentos++;
      totalDinheiro += Number(r.valorFolha || 0);
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
            backgroundColor: "rgba(136,136,136,0.5)", // barra cinza transparente
            borderColor: "#444",
            borderWidth: 2,
            borderRadius: 8,
            yAxisID: "y"
          },
          {
            label: "Valor Folha (R$)",
            data: valores,
            type: "line",
            borderColor: "#00f5ff", // linha azul turquesa
            backgroundColor: "rgba(0,245,255,0.2)",
            borderWidth: 3,
            tension: 0.4,
            yAxisID: "y1",
            pointStyle: "rectRot",
            pointRadius: 6,
            pointBackgroundColor: "#00f5ff"
          }
        ]
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          legend: {
            labels: { color: "#fff", font: { size: 14 } }
          },
          tooltip: {
            mode: "index",
            intersect: false,
            backgroundColor: "rgba(0,0,0,0.9)",
            titleColor: "#00f5ff",
            bodyColor: "#fff",
            borderColor: "#00f5ff",
            borderWidth: 1
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: "#888", font: { size: 12 } },
            grid: { color: "rgba(0,128,128,0.2)", borderDash: [4,2] }
          },
          y1: {
            position: "right",
            ticks: { color: "#00f5ff", font: { size: 12 } },
            grid: { drawOnChartArea: false }
          },
          x: {
            ticks: { color: "#fff", font: { size: 12 } },
            grid: { color: "rgba(255,255,255,0.05)" }
          }
        }
      }
    });

    // Resumo abaixo do gráfico
    totalInfoEl.innerHTML = `
      <div class="resumo">
        <span class="abastecimentos">Abastecimentos: ${totalAbastecimentos}</span>
        <span class="dinheiro">Dinheiro: R$ ${totalDinheiro.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
      </div>
    `;
  });
}
