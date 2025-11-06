// suporte.js
import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const tipoSelect = document.getElementById("tipoInput");
  const descricaoInput = document.getElementById("descricaoInput");
  const salvarBtn = document.getElementById("salvarBtn");
  const sugestoesList = document.getElementById("sugestoesList");

  if (!tipoSelect || !descricaoInput || !salvarBtn || !sugestoesList) return;

  let currentUser = null;
  let isAdmin = false;

  // Ajusta o botão conforme tipo
  tipoSelect.addEventListener("change", () => {
    if (tipoSelect.value === "report") {
      descricaoInput.placeholder = "Use essa opção somente para reportar erros";
      salvarBtn.textContent = "Salvar Report";
      salvarBtn.style.backgroundColor = "#f44336";
    } else {
      descricaoInput.placeholder = "";
      salvarBtn.textContent = "Salvar Sugestão";
      salvarBtn.style.backgroundColor = "";
    }
  });

  // Salvar sugestão ou report
  salvarBtn.addEventListener("click", async () => {
    if (!currentUser) return alert("Usuário não autenticado!");
    const matricula = currentUser.matricula || "";
    const tipo = tipoSelect.value || "sugestao";
    const descricao = descricaoInput.value.trim();
    if (!descricao) return alert("Digite a descrição.");

    try {
      const colName = tipo === "report" ? "reports" : "sugestoes";
      await addDoc(collection(db, colName), {
        matricula,
        descricao,
        tipo,
        status: tipo === "report" ? "solucionar" : "em_analise",
        createdAt: new Date()
      });
      descricaoInput.value = "";
      carregarSugestoes();
    } catch (err) {
      console.error("Erro ao salvar entrada:", err);
      alert("Falha ao salvar entrada.");
    }
  });

  // Carregar entradas do Firestore
  async function carregarSugestoes() {
    if (!currentUser) return;

    sugestoesList.innerHTML = "";

    try {
      const colNames = ["sugestoes", "reports"];
      for (const colName of colNames) {
        let q;
        if (isAdmin) {
          q = query(collection(db, colName), orderBy("createdAt", "desc"));
        } else {
          q = query(collection(db, colName), where("matricula", "==", currentUser.matricula), orderBy("createdAt", "desc"));
        }
        const snapshot = await getDocs(q);
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          const card = document.createElement("div");
          card.classList.add("suggestion-card");

          // Status badge
          const statusSpan = document.createElement("span");
          statusSpan.classList.add("status-badge");
          statusSpan.textContent = data.status.replace("_", " ");
          if (data.status === "aprovado" || data.status === "solucionado") statusSpan.classList.add("aprovado");
          if (data.status === "reprovado") statusSpan.classList.add("reprovado");
          if (data.status === "em_analise" || data.status === "em_analise_report") statusSpan.classList.add("analise");

          // Conteúdo
          const conteudo = document.createElement("div");
          conteudo.innerHTML = `<strong>${data.matricula}</strong>: ${data.descricao} `;
          conteudo.appendChild(statusSpan);

          card.appendChild(conteudo);

          // Botões admin
          if (isAdmin) {
            const actions = document.createElement("div");
            actions.classList.add("admin-actions");

            ["aprovado", "reprovado", "em_analise"].forEach(stat => {
              const btn = document.createElement("button");
              btn.textContent = stat.replace("_", " ");
              btn.addEventListener("click", async () => {
                await updateDoc(doc(db, colName, docSnap.id), { status: stat });
                carregarSugestoes();
              });
              actions.appendChild(btn);
            });

            // Botão excluir
            const delBtn = document.createElement("button");
            delBtn.classList.add("excluir-btn");
            delBtn.textContent = "Excluir";
            delBtn.addEventListener("click", async () => {
              if (confirm("Deseja realmente excluir esta entrada?")) {
                await deleteDoc(doc(db, colName, docSnap.id));
                carregarSugestoes();
              }
            });
            actions.appendChild(delBtn);
            card.appendChild(actions);
          }

          sugestoesList.appendChild(card);
        });
      }
    } catch (err) {
      console.error("Erro ao carregar entradas:", err);
    }
  }

  // Autenticação
  onAuthStateChanged(auth, async (user) => {
    if (!user) return alert("Não autenticado!");
    const userSnap = await getDocs(query(collection(db, "users"), where("uid", "==", user.uid)));
    let u = null;
    userSnap.forEach(docSnap => { u = docSnap.data(); });
    currentUser = u;
    isAdmin = u.admin || false;

    carregarSugestoes();
  });
});
