import { auth, db } from "./firebaseConfig_v2.js";
import { collection, getDocs, addDoc, query, where, doc, deleteDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
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
const toggleAdminPanel = document.getElementById("toggleAdminPanel");

const adminMatriculaSelect = document.getElementById("adminMatriculaSelect");
const adminHorarioInput = document.getElementById("adminHorarioInput");
const adminAvisoInput = document.getElementById("adminAvisoInput");
const btnSalvarHorario = document.getElementById("btnSalvarHorario");
const btnSalvarAviso = document.getElementById("btnSalvarAviso");
const btnVerAvisosAdmin = document.getElementById("btnVerAvisosAdmin");
const modalAdminAvisos = document.getElementById("modalAdminAvisos");
const adminAvisosLista = document.getElementById("adminAvisosLista");

const mensalChartCtx = document.getElementById("mensalChart");
const totalInfoEl = document.getElementById("totalInfo");
const mesInput = document.getElementById("mesEscolhido");

let usuarioAtual = null;
let matriculaAtual = null;
let chartMensal = null;

// --- LOGIN STATE ---
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "../../login.html"; return; }
  usuarioAtual = user;
  await carregarPerfil(user);
  if (user.admin) toggleAdminPanel.classList.remove("hidden");
});

// --- PERFIL ---
async function carregarPerfil(user) {
  const q = query(collection(db, "users"), where("email", "==", user.email));
  const snap = await getDocs(q);
  if (snap.empty) return;
  const dados = snap.docs[0].data();

  matriculaAtual = dados.matricula;
  const matriculasRosa = ["8789","9003","6414","5271"];
  nomeEl.textContent = dados.nome;
  nomeEl.classList.toggle("nome-rosa", matriculasRosa.includes(dados.matricula));
  nomeEl.classList.toggle("nome-azul", !matriculasRosa.includes(dados.matricula));

  matriculaEl.textContent = dados.matricula;
  admissaoEl.textContent = dados.dataAdmissao ? new Date(dados.dataAdmissao).toLocaleDateString("pt-BR") : "—";
  horarioEl.textContent = dados.horarioTrabalho || "—";

  carregarGraficoIndividual(dados.matricula);
  carregarAvisos(dados.matricula);

  // mês input
  const hoje = new Date();
  mesInput.value = hoje.toISOString().slice(0,7);
  mesInput.addEventListener("change", () => carregarGraficoIndividual(matriculaAtual, mesInput.value));
}

// --- AVISOS ---
async function carregarAvisos(matricula) {
  const q = query(collection(db, "avisos"), where("matricula", "==", matricula));
  const snap = await getDocs(q);

  if (snap.empty) {
    btnAvisos.textContent = "Sem avisos vinculados à matrícula";
    btnAvisos.classList.remove("blink","aviso-vermelho");
    btnAvisos.classList.add("btn-cinza");
    return;
  }
  btnAvisos.textContent = `🔔 ${snap.size} aviso(s)`;
  btnAvisos.classList.add("blink","aviso-vermelho");
  btnAvisos.classList.remove("btn-cinza");

  avisosLista.innerHTML = "";
  snap.forEach(d => {
    const p = document.createElement("p");
    p.textContent = d.data().texto;
    avisosLista.appendChild(p);
  });
}

// Abrir modal aviso
btnAvisos.addEventListener("click", () => {
  modalAvisos.showModal();
  btnAvisos.classList.remove("blink","aviso-vermelho");
  btnAvisos.classList.add("btn-cinza");
});

// --- ADMIN PANEL ---
toggleAdminPanel.addEventListener("click", () => adminControls.classList.toggle("hidden"));

// Popula select de matriculas
async function carregarMatriculas() {
  const snap = await getDocs(collection(db, "users"));
  adminMatriculaSelect.innerHTML = "";
  snap.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.data().matricula;
    opt.textContent = `${d.data().matricula} — ${d.data().nome}`;
    adminMatriculaSelect.appendChild(opt);
  });
}
carregarMatriculas();

// Salvar horário
btnSalvarHorario.addEventListener("click", async () => {
  const matricula = adminMatriculaSelect.value;
  const horario = adminHorarioInput.value;
  const q = query(collection(db, "users"), where("matricula","==",matricula));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const docRef = snap.docs[0].ref;
    await updateDoc(docRef, { horarioTrabalho: horario });
    alert("Horário atualizado!");
  }
});

// Salvar aviso
btnSalvarAviso.addEventListener("click", async () => {
  const matricula = adminMatriculaSelect.value;
  const texto = adminAvisoInput.value;
  if (!texto) return alert("Digite um aviso!");
  await addDoc(collection(db, "avisos"), { matricula, texto, timestamp: new Date() });
  alert("Aviso adicionado!");
  adminAvisoInput.value = "";
});

// Modal Admin: listar todos avisos
btnVerAvisosAdmin.addEventListener("click", async () => {
  modalAdminAvisos.showModal();
  adminAvisosLista.innerHTML = "";

  const snap = await getDocs(collection(db, "avisos"));
  snap.forEach(d => {
    const p = document.createElement("p");
    const texto = document.createElement("span");
    texto.textContent = d.data().texto;
    const btns = document.createElement("span");
    btns.style.display = "flex";
    btns.style.gap = "5px";

    const edit = document.createElement("button");
    edit.textContent = "Editar";
    edit.addEventListener("click", async () => {
      const novoTexto = prompt("Editar aviso:", texto.textContent);
      if (novoTexto) await updateDoc(d.ref, { texto: novoTexto }) && (texto.textContent = novoTexto);
    });

    const del = document.createElement("button");
    del.textContent = "Excluir";
    del.addEventListener("click", async () => {
      if (confirm("Deseja realmente excluir este aviso?")) await deleteDoc(d.ref) && p.remove();
    });

    btns.appendChild(edit);
    btns.appendChild(del);
    p.appendChild(texto);
    p.appendChild(btns);
    adminAvisosLista.appendChild(p);
  });
});

// --- GRAFICO INDIVIDUAL ORIGINAL ---
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
    const labels = [];
    const valores = [];
    snap.forEach(docSnap => {
      const r = docSnap.data();
      if (!r.dataCaixa) return;
      labels.push(new Date(r.dataCaixa.toDate ? r.dataCaixa.toDate() : new Date(r.dataCaixa)).getDate());
      valores.push(r.valor || 0);
    });

    if(chartMensal) chartMensal.destroy();
    chartMensal = new Chart(mensalChartCtx, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Caixa', data: valores, borderColor: '#00cfff', backgroundColor: 'rgba(0,255,255,0.2)' }]},
      options: { responsive: true, maintainAspectRatio: false }
    });
  });
}
