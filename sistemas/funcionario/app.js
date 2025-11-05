import { auth, db } from "./firebaseConfig_v2.js";
import {
  collection,
  getDocs,
  addDoc,
  setDoc,
  doc,
  query,
  where,
  orderBy,
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

const adminControls = document.getElementById("adminControls");
const adminMatriculaSelect = document.getElementById("adminMatriculaSelect");
const adminHorarioInput = document.getElementById("adminHorarioInput");
const btnSalvarHorario = document.getElementById("btnSalvarHorario");
const adminAvisoInput = document.getElementById("adminAvisoInput");
const btnSalvarAviso = document.getElementById("btnSalvarAviso");
const btnVerAvisosAdmin = document.getElementById("btnVerAvisosAdmin");
const modalAdminAvisos = document.getElementById("modalAdminAvisos");
const adminAvisosLista = document.getElementById("adminAvisosLista");

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

// --- CARREGA PERFIL ---
async function carregarPerfil(user) {
  const q = query(collection(db, "users"), where("email", "==", user.email));
  const snap = await getDocs(q);
  if (snap.empty) return;
  const dados = snap.docs[0].data();

  matriculaAtual = dados.matricula;

  // Nome com cor conforme matrícula
  const matriculasRosa = ["9003", "5271", "6414", "8789"];
  nomeEl.textContent = dados.nome;
  nomeEl.style.color = matriculasRosa.includes(dados.matricula) ? "#ff69b4" : "#00ffff";

  matriculaEl.textContent = dados.matricula;

  // Data de admissão no padrão brasileiro
  admissaoEl.textContent = dados.dataAdmissao
    ? new Date(dados.dataAdmissao.seconds ? dados.dataAdmissao.seconds * 1000 : dados.dataAdmissao).toLocaleDateString("pt-BR")
    : "—";

  // Horário
  horarioEl.textContent = dados.horarioTrabalho || "—";

  // Carregar gráfico individual
  carregarGraficoIndividual(dados.matricula);

  // Carregar avisos
  carregarAvisos(dados.matricula);

  // Configura input de mês
  if (mesInput) {
    const hoje = new Date();
    const mesAtual = hoje.toISOString().slice(0, 7);
    mesInput.value = mesAtual;
    mesInput.addEventListener("change", () => {
      carregarGraficoIndividual(matriculaAtual, mesInput.value);
    });
  }

  // Admin controls
  if (dados.isAdmin) {
    adminControls.classList.remove("hidden");
    await popularSelectAdmin();
    ligarEventosAdmin();
  }
}

// --- AVISOS FUNCIONÁRIO ---
async function carregarAvisos(matricula) {
  const q = query(collection(db, "avisos"), where("matricula", "==", matricula), orderBy("criadoEm", "desc"));
  const snap = await getDocs(q);

  if (snap.empty) {
    btnAvisos.textContent = "Sem avisos vinculados à matrícula";
    btnAvisos.style.backgroundColor = "#888";
    btnAvisos.style.animation = "none";
    return;
  }

  btnAvisos.textContent = `🔔 ${snap.size} aviso(s)`;
  btnAvisos.style.backgroundColor = "red";
  btnAvisos.style.animation = "brilhoPulse 1.5s infinite";

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
  const mes = mesEscolhido ? Number(mesEscolhido.split("-")[1]) - 1 : agora.getMonth();

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

    snap.forEach((docSnap) => {
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
            backgroundColor: "rgba(136,136,136,0.6)",
            borderColor: "#004d4d",
            borderWidth: 2,
            borderRadius: 8,
            yAxisID: "y",
          },
          {
            label: "Valor Folha (R$)",
            data: valores,
            type: "line",
            borderColor: "#00CED1",
            backgroundColor: "rgba(0,206,209,0.2)",
            borderWidth: 3,
            tension: 0.4,
            yAxisID: "y1",
            pointStyle: "rectRot",
            pointRadius: 6,
            pointBackgroundColor: "#00CED1",
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          legend: {
            labels: { color: "#fff", font: { size: 14 } },
          },
          tooltip: {
            mode: "index",
            intersect: false,
            backgroundColor: "rgba(0,0,0,0.9)",
            titleColor: "#00CED1",
            bodyColor: "#fff",
            borderColor: "#00CED1",
            borderWidth: 1,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: "#888", font: { size: 12 } },
            grid: { color: "rgba(136,136,136,0.2)", borderDash: [4, 2] },
          },
          y1: {
            position: "right",
            ticks: { color: "#00CED1", font: { size: 12 } },
            grid: { drawOnChartArea: false },
          },
          x: {
            ticks: { color: "#fff", font: { size: 12 } },
            grid: { color: "rgba(255,255,255,0.05)" },
          },
        },
      },
    });

    totalInfoEl.innerHTML = `
      <div class="resumo">
        <span class="abastecimentos">Abastecimentos: ${totalAbastecimentos}</span>
        <span class="dinheiro">Dinheiro: R$ ${totalDinheiro.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
      </div>
    `;
  });
}

// --- FUNÇÕES ADMIN ---
async function popularSelectAdmin() {
  adminMatriculaSelect.innerHTML = "";
  const usersSnap = await getDocs(collection(db, "users"));
  usersSnap.forEach((d) => {
    const u = d.data();
    const opt = document.createElement("option");
    opt.value = u.matricula;
    opt.textContent = `${u.matricula} - ${u.nome}`;
    adminMatriculaSelect.appendChild(opt);
  });
}

function ligarEventosAdmin() {
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
    if (mat === matriculaAtual) horarioEl.textContent = horario;
  });

  btnSalvarAviso.addEventListener("click", async () => {
    const mat = adminMatriculaSelect.value;
    const texto = adminAvisoInput.value.trim();
    if (!mat || !texto) return alert("Informe matrícula e aviso.");
    await addDoc(collection(db, "avisos"), {
      matricula: mat,
      texto,
      criadoEm: serverTimestamp(),
    });
    adminAvisoInput.value = "";
    alert("Aviso salvo!");
  });

  btnVerAvisosAdmin.addEventListener("click", async () => {
    modalAdminAvisos.showModal();
    adminAvisosLista.innerHTML = "";
    const snap = await getDocs(collection(db, "avisos"));
    snap.forEach((d) => {
      const aviso = d.data();
      const div = document.createElement("div");
      div.className = "admin-aviso";
      div.innerHTML = `
        <span>${aviso.matricula}: ${aviso.texto}</span>
        <button class="btn small red">Excluir</button>
      `;
      const btnExcluir = div.querySelector("button");
      btnExcluir.addEventListener("click", async () => {
        await setDoc(d.ref, {}, { merge: true }); // Ou deleteDoc(d.ref)
        div.remove();
      });
      adminAvisosLista.appendChild(div);
    });
  });
}
