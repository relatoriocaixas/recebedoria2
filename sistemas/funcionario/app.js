import { auth, db } from "./firebaseConfig_v2.js";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  deleteDoc,
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
const adminAvisoInput = document.getElementById("adminAvisoInput");
const btnSalvarHorario = document.getElementById("btnSalvarHorario");
const btnSalvarAviso = document.getElementById("btnSalvarAviso");
const btnVerAvisosAdmin = document.getElementById("btnVerAvisosAdmin");
const modalAdminAvisos = document.getElementById("modalAdminAvisos");
const adminAvisosLista = document.getElementById("adminAvisosLista");

// Estado
let usuarioAtual = null;
let chartMensal = null;
let matriculaAtual = null;
let painelAberto = false;

// BOTÃO ADMIN = O PRÓPRIO NOME
nomeEl.style.cursor = "pointer";
nomeEl.addEventListener("click", () => {
  painelAberto = !painelAberto;
  adminControls.style.display = painelAberto ? "flex" : "none";
});

// LOGIN
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../../login.html";
    return;
  }

  usuarioAtual = user;
  const q = query(collection(db, "users"), where("email", "==", user.email));
  const snap = await getDocs(q);
  if (snap.empty) return;

  const dados = snap.docs[0].data();
  usuarioAtual.dados = dados;
  matriculaAtual = dados.matricula;

  await carregarPerfil(dados);

  if (dados.admin) {
    adminControls.classList.remove("hidden");
    carregarMatriculasAdmin();
  }
});

// PERFIL
async function carregarPerfil(dados) {
  const matriculasRosa = ["8789", "9003", "6414", "5271"];

  nomeEl.textContent = dados.nome;
  nomeEl.classList.toggle("nome-rosa", matriculasRosa.includes(dados.matricula));
  nomeEl.classList.toggle("nome-azul", !matriculasRosa.includes(dados.matricula));

  matriculaEl.textContent = dados.matricula;

  if (dados.dataAdmissao) {
    const data = new Date(dados.dataAdmissao);
    data.setMinutes(data.getMinutes() + data.getTimezoneOffset());
    admissaoEl.textContent = data.toLocaleDateString("pt-BR");
  } else admissaoEl.textContent = "—";

  horarioEl.textContent = dados.horarioTrabalho || "—";

  carregarGraficoIndividual(dados.matricula);
  carregarAvisos(dados.matricula);

  mesInput.value = new Date().toISOString().slice(0, 7);
  mesInput.addEventListener("change", () => {
    carregarGraficoIndividual(matriculaAtual, mesInput.value);
  });
}

// AVISOS FUNCIONÁRIO
async function carregarAvisos(matricula) {
  const q = query(collection(db, "avisos"), where("matricula", "==", matricula));
  const snap = await getDocs(q);

  if (snap.empty) {
    btnAvisos.textContent = "Sem avisos vinculados à matrícula";
    btnAvisos.classList.remove("blink", "aviso-vermelho");
    btnAvisos.classList.add("btn-cinza");
    return;
  }

  btnAvisos.textContent = `🔔 ${snap.size} aviso(s)`;
  btnAvisos.classList.add("blink", "aviso-vermelho");
  btnAvisos.classList.remove("btn-cinza");

  avisosLista.innerHTML = "";
  snap.forEach(d => {
    const p = document.createElement("p");
    p.style.color = "white";
    p.textContent = d.data().texto;
    avisosLista.appendChild(p);
  });
}

btnAvisos.addEventListener("click", () => {
  modalAvisos.showModal();
  btnAvisos.classList.remove("blink", "aviso-vermelho");
});

// GRÁFICO
async function carregarGraficoIndividual(matricula, mesEscolhido = null) {
  const relatoriosRef = collection(db, "relatorios");
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = mesEscolhido ? Number(mesEscolhido.split("-")[1]) - 1 : hoje.getMonth();

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
            backgroundColor: "rgba(136,136,136,0.5)",
            borderColor: "#444",
            borderWidth: 2,
            borderRadius: 8,
            yAxisID: "y"
          },
          {
            label: "Valor Folha (R$)",
            data: valores,
            type: "line",
            borderColor: "#00f5ff",
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
          legend: { labels: { color: "#fff", font: { size: 14 } } },
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

    totalInfoEl.innerHTML = `
      <div class="resumo">
        <span class="abastecimentos">Abastecimentos: ${totalAbastecimentos}</span>
        <span class="dinheiro">Dinheiro: R$ ${totalDinheiro.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
      </div>
    `;
  });
}

// ADMIN
async function carregarMatriculasAdmin() {
  const q = query(collection(db, "users"));
  const snap = await getDocs(q);

  adminMatriculaSelect.innerHTML = "";
  snap.forEach(docSnap => {
    const d = docSnap.data();
    const option = document.createElement("option");
    option.value = d.matricula;
    option.textContent = `${d.matricula} - ${d.nome}`;
    adminMatriculaSelect.appendChild(option);
  });
}

btnSalvarHorario.addEventListener("click", async () => {
  const matricula = adminMatriculaSelect.value;
  const horario = adminHorarioInput.value.trim();
  if (!horario) return alert("Informe um horário válido.");

  const q = query(collection(db, "users"), where("matricula", "==", matricula));
  const snap = await getDocs(q);

  if (!snap.empty) {
    await updateDoc(snap.docs[0].ref, { horarioTrabalho: horario });
    alert("Horário salvo!");
    carregarPerfil(usuarioAtual.dados);
  }
});

btnSalvarAviso.addEventListener("click", async () => {
  const matricula = adminMatriculaSelect.value;
  const texto = adminAvisoInput.value.trim();
  if (!texto) return alert("Informe um aviso.");

  await addDoc(collection(db, "avisos"), {
    matricula,
    texto,
    criadoEm: serverTimestamp()
  });
  adminAvisoInput.value = "";
  carregarAvisos(matriculaAtual);
});

// ADMIN → LISTA EDITÁVEL
btnVerAvisosAdmin.addEventListener("click", async () => {
  modalAdminAvisos.showModal();
  const snap = await getDocs(collection(db, "avisos"));

  adminAvisosLista.innerHTML = "";

  snap.forEach(docSnap => {
    const d = docSnap.data();

    const item = document.createElement("p");
    item.style.display = "flex";
    item.style.justifyContent = "space-between";
    item.style.alignItems = "center";

    item.innerHTML = `<span style="color:white"><strong>${d.matricula}:</strong> ${d.texto}</span>`;

    const btns = document.createElement("div");

    const btnEdit = document.createElement("button");
    btnEdit.textContent = "Editar";
    btnEdit.classList.add("btn-small");
    btnEdit.onclick = async () => {
      const novo = prompt("Editar aviso", d.texto);
      if (novo) {
        await updateDoc(doc(db, "avisos", docSnap.id), { texto: novo });
        btnVerAvisosAdmin.click();
      }
    };

    const btnDel = document.createElement("button");
    btnDel.textContent = "Excluir";
    btnDel.classList.add("btn-small");
    btnDel.onclick = async () => {
      if (confirm("Excluir aviso?")) {
        await deleteDoc(doc(db, "avisos", docSnap.id));
        btnVerAvisosAdmin.click();
      }
    };

    btns.appendChild(btnEdit);
    btns.appendChild(btnDel);

    item.appendChild(btns);
    adminAvisosLista.appendChild(item);
  });
});
