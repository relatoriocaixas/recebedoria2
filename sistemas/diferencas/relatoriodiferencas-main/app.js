import { auth, db, onAuthStateChanged, collection, getDocs, query, orderBy } from "./firebaseConfig.js";

document.addEventListener("DOMContentLoaded", async () => {
  const btnAbrirRelatorios = document.getElementById("btnAbrirRelatorios");
  const btnAbrirResumo = document.getElementById("btnAbrirResumo");
  const modalRelatorios = document.getElementById("modalRelatorios");
  const modalResumo = document.getElementById("modalResumo");
  const listaRelatoriosModal = document.getElementById("listaRelatoriosModal");

  // Verificar autenticação e permissões
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    const snapshot = await getDocs(query(collection(db, "users")));
    const currentUser = snapshot.docs.find(d => d.data().email === user.email);
    const isAdmin = currentUser ? currentUser.data().admin : false;

    // Mostrar botão de resumo apenas para admins
    if(isAdmin) btnAbrirResumo.hidden = false;

    // Carregar Relatórios
    const relatoriosSnap = await getDocs(query(collection(db, "relatorios"), orderBy("criadoEm","desc")));
    listaRelatoriosModal.innerHTML = "";
    relatoriosSnap.forEach(docSnap => {
      const r = docSnap.data();
      const div = document.createElement("div");
      div.className = "relatorio-item";
      const data = r.dataCaixa.toDate ? r.dataCaixa.toDate().toLocaleDateString() : new Date(r.dataCaixa).toLocaleDateString();
      div.innerHTML = `<div class="item-header">${data} - Matrícula: ${r.matricula}</div>
        <div class="item-body">
          <div>Folha: R$ ${r.valorFolha}</div>
          <div>Dinheiro: R$ ${r.valorDinheiro}</div>
          <div>Diferença: <span class="${r.sobraFalta>=0?'positivo':'negativo'}">R$ ${r.sobraFalta}</span></div>
          <div>Observação: ${r.observacao||"-"}</div>
        </div>`;
      listaRelatoriosModal.appendChild(div);
      div.querySelector(".item-header").addEventListener("click", () => {
        div.querySelector(".item-body").classList.toggle("hidden");
      });
    });
  });

  // Eventos de abertura dos modais
  btnAbrirRelatorios.addEventListener("click", () => modalRelatorios.showModal());
  btnAbrirResumo?.addEventListener("click", () => modalResumo.showModal());
});
