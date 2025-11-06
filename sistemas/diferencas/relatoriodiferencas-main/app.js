import { auth, db, onAuthStateChanged, collection, getDocs, query, orderBy } from "./firebaseConfig.js";

document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/login.html";
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await auth.signOut();
      return;
    }

    const userData = userSnap.data();
    const IS_ADMIN = userData.admin === true;
    const MATRICULA = userData.matricula;

    configurarInterface(IS_ADMIN);
    await popularSelects(IS_ADMIN);
    inicializarEventos(IS_ADMIN, MATRICULA);
  });
});

function inicializarEventos(admin, matricula) {
  const btnSalvarRelatorio = document.getElementById("btnSalvarRelatorio");
  if (btnSalvarRelatorio) btnSalvarRelatorio.addEventListener("click", () => salvarRelatorio(admin));

  const h3Relatorios = document.querySelectorAll(".clickable-relatorios");
  h3Relatorios.forEach(h3 => {
    h3.style.cursor = "pointer";
    h3.addEventListener("click", () => abrirModalRelatorios(admin));
  });

  const btnFecharRelatorios = document.getElementById("btnFecharRelatorios");
  btnFecharRelatorios?.addEventListener("click", () => relatoriosModal.close());
}

const relatoriosModal = document.getElementById("relatoriosModal");
const relatoriosContainer = document.getElementById("relatoriosContainer");

async function abrirModalRelatorios(admin) {
  relatoriosContainer.innerHTML = "";
  try {
    const snapshot = await getDocs(query(collection(db, "relatorios"), orderBy("criadoEm", "desc")));
    snapshot.forEach(docSnap => {
      const r = docSnap.data();
      const div = document.createElement("div");
      div.className = "relatorio-item";

      const diferencaClass = r.sobraFalta >= 0 ? "positivo" : "negativo";
      const dataFormatada = r.dataCaixa.toDate ? r.dataCaixa.toDate().toLocaleDateString() : new Date(r.dataCaixa).toLocaleDateString();

      div.innerHTML = `
        <div class="item-header">
          <strong>${dataFormatada}</strong> — Matrícula: ${r.matricula}
          <button class="btn outline btnToggle">Ocultar/Exibir</button>
        </div>
        <div class="item-body hidden">
          <table class="relatorio-table">
            <tr><td>Folha:</td><td>R$ ${r.valorFolha.toFixed(2)}</td></tr>
            <tr><td>Dinheiro:</td><td>R$ ${r.valorDinheiro.toFixed(2)}</td></tr>
            <tr><td>Diferença:</td><td class="${diferencaClass}">R$ ${r.sobraFalta.toFixed(2)}</td></tr>
            <tr><td>Abastecimento:</td><td>${r.abastecimento || "-"}</td></tr>
            <tr><td>Observação:</td><td>${r.observacao || "-"}</td></tr>
          </table>
        </div>
      `;
      relatoriosContainer.appendChild(div);
    });

    relatoriosContainer.querySelectorAll(".btnToggle").forEach(btn => {
      btn.addEventListener("click", () => {
        btn.closest(".relatorio-item").querySelector(".item-body").classList.toggle("hidden");
      });
    });

    relatoriosModal.showModal();

  } catch (e) {
    console.error("Erro ao carregar relatórios:", e);
  }
}
