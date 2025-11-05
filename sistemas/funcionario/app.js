import { auth, db } from "./firebaseConfig_v2.js";
import { collection, getDocs, addDoc, query, where, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
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
const toggleAdminPanel = document.createElement("button");
toggleAdminPanel.id = "toggleAdminPanel";
toggleAdminPanel.textContent = "📂 Abrir/Fechar Painel Admin";
adminControls.parentNode.insertBefore(toggleAdminPanel, adminControls);

const adminMatriculaSelect = document.getElementById("adminMatriculaSelect");
const adminHorarioInput = document.getElementById("adminHorarioInput");
const adminAvisoInput = document.getElementById("adminAvisoInput");
const btnSalvarHorario = document.getElementById("btnSalvarHorario");
const btnSalvarAviso = document.getElementById("btnSalvarAviso");
const btnVerAvisosAdmin = document.getElementById("btnVerAvisosAdmin");
const modalAdminAvisos = document.getElementById("modalAdminAvisos");
const adminAvisosLista = document.getElementById("adminAvisosLista");

let usuarioAtual = null;
let matriculaAtual = null;
let chartMensal = null;

// --- LOGIN STATE ---
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../../login.html";
    return;
  }
  usuarioAtual = user;
  await carregarPerfil(user);
  if (user.admin) adminControls.classList.remove("hidden"); // mostra painel admin
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
  nomeEl.classList.toggle("nome-rosa", matriculasRosa.includes(dados.matricula));
  nomeEl.classList.toggle("nome-azul", !matriculasRosa.includes(dados.matricula));

  matriculaEl.textContent = dados.matricula;
  admissaoEl.textContent = new Date(dados.dataAdmissao).toLocaleDateString("pt-BR");
  horarioEl.textContent = dados.horarioTrabalho || "—";

  carregarGraficoIndividual(dados.matricula);
  carregarAvisos(dados.matricula);

  // mês input
  const hoje = new Date();
  const mesAtual = hoje.toISOString().slice(0,7);
  document.getElementById("mesEscolhido").value = mesAtual;
  document.getElementById("mesEscolhido").addEventListener("change", () => {
    carregarGraficoIndividual(matriculaAtual, document.getElementById("mesEscolhido").value);
  });
}

// --- GRAFICO (mantido como estava) ---
async function carregarGraficoIndividual(matricula, mesEscolhido = null) {
  // Aqui você insere seu código de geração de gráfico existente
  // Exemplo placeholder:
  const ctx = document.getElementById("mensalChart").getContext("2d");
  if (chartMensal) chartMensal.destroy();
  chartMensal = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Semana 1","Semana 2","Semana 3","Semana 4"],
      datasets: [{
        label: "Caixa",
        data: [1000, 1500, 1200, 1700],
        backgroundColor: "#00cfff"
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
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
toggleAdminPanel.addEventListener("click", () => {
  adminControls.classList.toggle("hidden");
});

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

// Ver/Editar todos avisos
btnVerAvisosAdmin.addEventListener("click", async () => {
  modalAdminAvisos.showModal();
  adminAvisosLista.innerHTML = "";

  const snap = await getDocs(collection(db, "avisos"));
  snap.forEach(d => {
    const p = document.createElement("p");
    const texto = document.createElement("span");
    texto.textContent = d.data().texto;
    const btns = document.createElement("span");
    btns.classList.add("adminAvisoBtns");

    const edit = document.createElement("button");
    edit.textContent = "Editar";
    edit.classList.add("edit");
    edit.addEventListener("click", async () => {
      const novoTexto = prompt("Editar aviso:", texto.textContent);
      if (novoTexto) {
        await updateDoc(d.ref, { texto: novoTexto });
        texto.textContent = novoTexto;
      }
    });

    const del = document.createElement("button");
    del.textContent = "Excluir";
    del.classList.add("delete");
    del.addEventListener("click", async () => {
      if (confirm("Deseja realmente excluir este aviso?")) {
        await deleteDoc(d.ref);
        p.remove();
      }
    });

    btns.appendChild(edit);
    btns.appendChild(del);
    p.appendChild(texto);
    p.appendChild(btns);
    adminAvisosLista.appendChild(p);
  });
});
