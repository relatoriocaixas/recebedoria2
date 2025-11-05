import { auth, db } from "./firebaseConfig_v2.js";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  onSnapshot,
  updateDoc,
  serverTimestamp
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

let chartMensal = null;
let matriculaAtual = null;
let usuarioAtual = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "../../login.html"; return; }
  usuarioAtual = user;
  await carregarPerfil(user);
  if (usuarioAtual.admin) {
    adminControls.classList.remove("hidden");
    carregarMatriculasAdmin();
  }
});

async function carregarPerfil(user) {
  const q = query(collection(db, "users"), where("email", "==", user.email));
  const snap = await getDocs(q);
  if (snap.empty) return;
  const dados = snap.docs[0].data();
  matriculaAtual = dados.matricula;

  nomeEl.textContent = dados.nome;
  matriculaEl.textContent = dados.matricula;

  if (dados.dataAdmissao) {
    const dt = new Date(dados.dataAdmissao.toDate ? dados.dataAdmissao.toDate() : dados.dataAdmissao);
    admissaoEl.textContent = dt.toLocaleDateString("pt-BR");
  } else admissaoEl.textContent = "—";

  horarioEl.textContent = dados.horarioTrabalho || "—";

  carregarGraficoIndividual(dados.matricula);
  carregarAvisos(dados.matricula);

  mesInput.value = new Date().toISOString().slice(0,7);
  mesInput.addEventListener("change", () => {
    carregarGraficoIndividual(matriculaAtual, mesInput.value);
  });
}

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
btnAvisos.addEventListener("click",()=>modalAvisos.showModal());

async function carregarGraficoIndividual(matricula, mesEscolhido=null){
  const relatoriosRef = collection(db,"relatorios");
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = mesEscolhido ? Number(mesEscolhido.split("-")[1])-1 : agora.getMonth();

  const primeiroDia = new Date(ano,mes,1);
  const ultimoDia = new Date(ano,mes+1,0);

  const q = query(relatoriosRef,
    where("matricula","==",matricula),
    where("dataCaixa",">=",primeiroDia),
    where("dataCaixa","<=",ultimoDia)
  );

  onSnapshot(q,(snap)=>{
    const dias = {}; let totalAb=0, totalDin=0;
    snap.forEach(docSnap=>{
      const r = docSnap.data();
      if(!r.dataCaixa) return;
      const data = r.dataCaixa.toDate ? r.dataCaixa.toDate() : new Date(r.dataCaixa);
      const dia = data.getDate();
      if(!dias[dia]) dias[dia]={abastecimentos:0, valorFolha:0};
      dias[dia].abastecimentos++;
      dias[dia].valorFolha += Number(r.valorFolha||0);
      totalAb++; totalDin+=Number(r.valorFolha||0);
    });

    const labels=[], abastecimentos=[], valores=[];
    for(let d=1; d<=ultimoDia.getDate(); d++){
      labels.push(d.toString().padStart(2,"0"));
      abastecimentos.push(dias[d]?.abastecimentos||0);
      valores.push(dias[d]?.valorFolha||0);
    }

    if(chartMensal) chartMensal.destroy();
    chartMensal = new Chart(mensalChartCtx,{
      type:"bar",
      data:{
        labels,
        datasets:[
          { label:"Abastecimentos", data:abastecimentos, backgroundColor:"rgba(136,136,136,0.5)", borderColor:"#444", borderWidth:2, borderRadius:8, yAxisID:"y" },
          { label:"Valor Folha (R$)", data:valores, type:"line", borderColor:"#00f5ff", backgroundColor:"rgba(0,245,255,0.2)", borderWidth:3, tension:0.4, yAxisID:"y1", pointStyle:"rectRot", pointRadius:6, pointBackgroundColor:"#00f5ff" }
        ]
      },
      options:{
        maintainAspectRatio:false,
        responsive:true,
        plugins:{ legend:{labels:{color:"#fff"}}, tooltip:{mode:"index",intersect:false,backgroundColor:"rgba(0,0,0,0.9)",titleColor:"#00f5ff",bodyColor:"#fff",borderColor:"#00f5ff",borderWidth:1}},
        scales:{ y:{beginAtZero:true,ticks:{color:"#888"},grid:{color:"rgba(0,128,128,0.2)",borderDash:[4,2]}},
                 y1:{position:"right",ticks:{color:"#00f5ff"},grid:{drawOnChartArea:false}},
                 x:{ticks:{color:"#fff"},grid:{color:"rgba(255,255,255,0.05")}}}
      }
    });

    totalInfoEl.innerHTML = `<div class="resumo"><span class="abastecimentos">Abastecimentos: ${totalAb}</span><span class="dinheiro">Dinheiro: R$ ${totalDin.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span></div>`;
  });
}

// --- ADMIN ---
async function carregarMatriculasAdmin(){
  const snap = await getDocs(collection(db,"users"));
  adminMatriculaSelect.innerHTML="";
  snap.forEach(doc=>{
    const d=doc.data();
    const option=document.createElement("option");
    option.value=d.matricula;
    option.textContent=`${d.matricula} - ${d.nome}`;
    adminMatriculaSelect.appendChild(option);
  });
}

btnSalvarHorario.addEventListener("click",async()=>{
  const matricula=adminMatriculaSelect.value;
  const horario=adminHorarioInput.value;
  if(!matricula||!horario) return;
  const q=query(collection(db,"users"),where("matricula","==",matricula));
  const snap=await getDocs(q);
  if(!snap.empty) await updateDoc(snap.docs[0].ref,{horarioTrabalho:horario});
  alert("Horário salvo!");
});

btnSalvarAviso.addEventListener("click",async()=>{
  const matricula=adminMatriculaSelect.value;
  const texto=adminAvisoInput.value;
  if(!matricula||!texto) return;
  await addDoc(collection(db,"avisos"),{matricula,texto,timestamp:serverTimestamp()});
  adminAvisoInput.value="";
  alert("Aviso salvo!");
});

btnVerAvisosAdmin.addEventListener("click",async()=>{
  adminAvisosLista.innerHTML="";
  const snap=await getDocs(collection(db,"avisos"));
  snap.forEach(doc=>{
    const p=document.createElement("p");
    const d=doc.data();
    p.textContent=`${d.matricula}: ${d.texto}`;
    adminAvisosLista.appendChild(p);
  });
  modalAdminAvisos.showModal();
});
