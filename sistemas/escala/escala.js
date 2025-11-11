// ================================================
// ✅ IMPORTAÇÕES — sempre usando firebaseConfig_v2.js
// ================================================
import {
  auth,
  db,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  where,
  orderBy
} from "../firebaseConfig_v2.js";

// ================================================
// ✅ CORES FIXAS POR MATRÍCULA
// ================================================
const coresMatriculaFixas = {
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
  "1858": "#556b2f"
};

// ================================================
// ✅ ESTILO PARA TROCAS COM ANIMAÇÃO
// ================================================
const style = document.createElement("style");
style.textContent = `
@keyframes brilhoPulse {
  0% { box-shadow: 0 0 4px 2px rgba(255,0,0,0.3); }
  50% { box-shadow: 0 0 10px 4px rgba(255,0,0,0.8); }
  100% { box-shadow: 0 0 4px 2px rgba(255,0,0,0.3); }
}
.badge.troca {
  background-color: red !important;
  color: #fff;
  animation: brilhoPulse 1.5s infinite;
}
.btn-excluir {
  margin-left: 6px;
  background: transparent;
  border: none;
  color: white;
  font-weight: bold;
  cursor: pointer;
}
.btn-excluir:hover {
  color: #ff5555;
}
`;
document.head.appendChild(style);

// =====================================================
// ✅ INICIALIZAÇÃO COMPLETA
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("[escala] escala.js carregado");

  const selectTipo = document.getElementById("selectTipo");
  const horarioWrapper = document.getElementById("horarioWrapper");
  const inputHorario = document.getElementById("inputHorario");
  const btnSalvar = document.getElementById("btnSalvar");

  if (selectTipo && horarioWrapper) {
    selectTipo.addEventListener("change", () => {
      if (selectTipo.value === "troca") {
        horarioWrapper.style.display = "block";
      } else {
        horarioWrapper.style.display = "none";
        inputHorario.value = "";
      }
    });
  }

  let currentMonth;
  let currentYear;

  // =====================================================
  // ✅ RECEBE AUTENTICAÇÃO — (ÚNICA FONTE DE AUTENTICAÇÃO)
  // =====================================================
  window.addEventListener("message", async (event) => {
    if (event.data?.type !== "syncAuth") return;

    console.log("[escala] Auth recebida do portal:", event.data);

    const isAdmin = event.data.admin === true;
    const matricula = event.data.usuario.matricula;

    if (!isAdmin) {
      btnSalvar.style.display = "none";
    }

    await popularSelectMatriculas(isAdmin, matricula);

    inicializarCalendario(isAdmin, matricula);

    await carregarFolgas(isAdmin, matricula);
  });

  // =====================================================
  // ✅ CARREGAR MATRÍCULAS
  // =====================================================
  async function popularSelectMatriculas(admin, matriculaAtual) {
    const selectMatricula = document.getElementById("selectMatricula");
    selectMatricula.innerHTML = "<option value=''>Carregando...</option>";

    const snapshot = await getDocs(collection(db, "users"));
    const lista = snapshot.docs
      .map(d => d.data())
      .filter(u => u?.matricula)
      .sort((a, b) => a.matricula.localeCompare(b.matricula, "pt-BR", { numeric: true }));

    selectMatricula.innerHTML = "<option value=''>Selecione</option>";

    lista.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.matricula;
      opt.textContent = `${u.matricula} - ${u.nome}`;
      selectMatricula.appendChild(opt);
    });

    if (!admin) {
      selectMatricula.value = matriculaAtual;
      selectMatricula.disabled = true;
    }
  }

  // =====================================================
  // ✅ SALVAR FOLGA
  // =====================================================
  async function salvarFolga() {
    const mat = document.getElementById("selectMatricula").value;
    const tipo = document.getElementById("selectTipo").value;
    const periodo = document.getElementById("selectPeriodo").value;
    const dia = document.getElementById("inputDia").value;
    const horario = document.getElementById("inputHorario").value;

    if (!mat || !dia)
      return alert("Preencha matrícula e data.");

    await addDoc(collection(db, "folgas"), {
      matricula: mat,
      tipo,
      periodo,
      dia,
      horario: tipo === "troca" ? horario : "",
      criadoPor: auth.currentUser?.uid || "iframe",
      criadoEm: new Date().toISOString()
    });

    alert("Registrado com sucesso!");
  }

  if (btnSalvar) {
    btnSalvar.addEventListener("click", async () => {
      await salvarFolga();

      const mat = document.getElementById("selectMatricula").value;
      await carregarFolgas(true, mat, currentMonth, currentYear);
    });
  }

  // =====================================================
  // ✅ INICIALIZAR CALENDÁRIO
  // =====================================================
  function inicializarCalendario(admin, matriculaAtual) {
    const escalaWrap = document.querySelector(".escala-wrap");
    const calGrid = document.getElementById("calGrid");
    const monthLabel = document.getElementById("monthLabel");
    const prevMonthBtn = document.getElementById("prevMonth");
    const nextMonthBtn = document.getElementById("nextMonth");

    const hoje = new Date();
    currentMonth = hoje.getMonth();
    currentYear = hoje.getFullYear();

    async function renderCalendar() {
      calGrid.innerHTML = "";

      const firstDay = new Date(currentYear, currentMonth, 1).getDay();
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      monthLabel.textContent = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

      for (let i = 0; i < firstDay; i++) calGrid.appendChild(document.createElement("div"));

      for (let d = 1; d <= daysInMonth; d++) {
        const el = document.createElement("div");
        el.className = "day";
        el.innerHTML = `<div class="num">${d}</div><div class="badges"></div>`;
        calGrid.appendChild(el);
      }

      await carregarFolgas(admin, matriculaAtual, currentMonth, currentYear);
    }

    prevMonthBtn.addEventListener("click", () => {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      renderCalendar();
    });

    nextMonthBtn.addEventListener("click", () => {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      renderCalendar();
    });

    renderCalendar();
    escalaWrap.style.visibility = "visible";
  }

  // =====================================================
  // ✅ CARREGAR FOLGAS
  // =====================================================
  async function carregarFolgas(admin, matriculaAtual, monthOverride, yearOverride) {
    const calGrid = document.getElementById("calGrid");
    if (!calGrid) return;

    let q;

    if (admin) {
      q = query(collection(db, "folgas"), orderBy("dia", "asc"));
    } else {
      q = query(collection(db, "folgas"), where("matricula", "==", matriculaAtual));
    }

    const snapshot = await getDocs(q);

    const month = typeof monthOverride === "number" ? monthOverride : new Date().getMonth();
    const year = typeof yearOverride === "number" ? yearOverride : new Date().getFullYear();

    [...calGrid.getElementsByClassName("day")].forEach(d => {
      d.querySelector(".badges").innerHTML = "";
    });

    snapshot.forEach(docSnap => {
      const f = docSnap.data();
      const id = docSnap.id;

      const [yyyy, mm, dd] = f.dia.split("-").map(Number);
      const dt = new Date(yyyy, mm - 1, dd);

      if (dt.getFullYear() !== year || dt.getMonth() !== month) return;

      const allDays = [...calGrid.getElementsByClassName("day")];

      allDays.forEach(el => {
        if (parseInt(el.querySelector(".num").textContent) === dt.getDate()) {
          const badge = document.createElement("span");
          badge.className = f.tipo === "troca" ? "badge troca" : "badge";

          badge.textContent = admin
            ? f.matricula
            : (f.tipo === "troca" ? "Troca" : "Folga");

          if (f.tipo !== "troca") {
            const cor = coresMatriculaFixas[f.matricula] || "#4da6ff";
            badge.style.backgroundColor = cor;
          }

          if (f.tipo === "troca" && f.horario) {
            badge.setAttribute("data-tooltip", f.horario);
          }

          if (admin) {
            const del = document.createElement("button");
            del.textContent = "✕";
            del.className = "btn-excluir";
            del.onclick = async (e) => {
              e.stopPropagation();
              if (confirm("Excluir folga?")) {
                await deleteDoc(doc(db, "folgas", id));
                await carregarFolgas(admin, matriculaAtual, month, year);
              }
            };
            badge.appendChild(del);
          }

          el.querySelector(".badges").appendChild(badge);
        }
      });
    });
  }
});
