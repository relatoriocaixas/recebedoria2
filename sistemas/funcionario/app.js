import { auth, db } from "./firebaseConfig_v2.js";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  onSnapshot,
  setDoc,
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

  // Data de admissão no padrão brasileiro (corrige dia anterior)
  if (dados.dataAdmissao) {
    let data = dados.dataAdmissao.seconds
      ? new Date(dados.dataAdmissao.seconds * 1000)
      : new Date(dados.dataAdmissao);
    const dia = String(data.getDate()).padStart(2, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const ano = data.getFullYear();
    admissaoEl.textContent = `${dia}/${mes}/${ano}`;
  } else {
    admissaoEl.textContent = "—";
  }

  horarioEl.textContent = dados.horarioTrabalho || "—";

  // Carregar gráfico individual (não altera nada do gráfico)
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

  // Painel admin
  if (dados.isAdmin) await configurarPainelAdmin();
}

// --- AVISOS ---
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
  snap.forEach(d => {
    const p = document.createElement("p");
    p.textContent = d.data().texto;
    avisosLista.appendChild(p);
  });
}

btnAvisos.addEventListener("click", () => modalAvisos.showModal());

// --- ADMIN PANEL ---
async function configurarPainelAdmin() {
  const adminPanel = document.getElementById("adminControls");
  adminPanel.classList.remove("hidden");

  const select = document.getElementById("adminMatriculaSelect");
  select.innerHTML = "";
  const usersSnap = await getDocs(collection(db, "users"));
  usersSnap.forEach(d => {
    const u = d.data();
    const opt = document.createElement("option");
    opt.value = u.matricula;
    opt.textContent = `${u.matricula} - ${u.nome}`;
    select.appendChild(opt);
  });

  document.getElementById("btnSalvarHorario").addEventListener("click", async () => {
    const mat = select.value;
    const horario = document.getElementById("adminHorarioInput").value.trim();
    if (!mat || !horario) return alert("Informe matrícula e horário.");

    const q = query(collection(db, "users"), where("matricula", "==", mat));
    const s = await getDocs(q);
    if (s.empty) return;
    await setDoc(s.docs[0].ref, { horarioTrabalho: horario }, { merge: true });

    alert("Horário atualizado!");
    if (mat === matriculaAtual) horarioEl.textContent = horario;
  });

  document.getElementById("btnSalvarAviso").addEventListener("click", async () => {
    const mat = select.value;
    const texto = document.getElementById("adminAvisoInput").value.trim();
    if (!mat || !texto) return alert("Informe matrícula e aviso.");

    await addDoc(collection(db, "avisos"), { matricula: mat, texto, criadoEm: serverTimestamp() });
    document.getElementById("adminAvisoInput").value = "";
    alert("Aviso salvo!");
  });

  document.getElementById("btnVerAvisosAdmin").addEventListener("click", async () => {
    const lista = document.getElementById("adminAvisosLista");
    lista.innerHTML = "";
    const snap = await getDocs(collection(db, "avisos"));
    snap.forEach(d => {
      const aviso = d.data();
      const div = document.createElement("div");
      div.textContent = `${aviso.matricula}: ${aviso.texto}`;
      lista.appendChild(div);
    });
    document.getElementById("modalAdminAvisos").showModal();
  });
}
