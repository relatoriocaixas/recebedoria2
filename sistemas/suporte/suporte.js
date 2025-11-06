// suporte.js
import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const tipoInput = document.getElementById("tipoInput");
  const descricaoInput = document.getElementById("descricaoInput");
  const salvarBtn = document.getElementById("salvarBtn");
  const sugestoesList = document.getElementById("sugestoesList");

  let usuarioAtual = null;

  // ⚡ Ajusta texto do botão dependendo do tipo
  function atualizarBotao() {
    if (tipoInput.value === "sugestao") {
      salvarBtn.textContent = "Salvar Sugestão";
      salvarBtn.style.backgroundColor = "#00bcd4";
    } else {
      salvarBtn.textContent = "Salvar Report";
      salvarBtn.style.backgroundColor = "#f44336";
    }
  }

  tipoInput.addEventListener("change", atualizarBotao);
  atualizarBotao();

  // Autenticação
  onAuthStateChanged(auth, user => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    usuarioAtual = user;
    carregarEntradas();
  });

  // Salvar sugestão ou report
  salvarBtn.addEventListener("click", async () => {
    if (!usuarioAtual) return alert("Usuário não autenticado");

    const tipo = tipoInput.value;
    const descricao = descricaoInput.value.trim();
    if (!descricao) return alert("Digite uma descrição");

    const colecao = tipo === "sugestao" ? "sugestoes" : "reports";
    const statusInicial = tipo === "sugestao" ? "em_analise" : "correcao_iniciada";

    try {
      await addDoc(collection(db, colecao), {
        matricula: usuarioAtual.email.split("@")[0],
        descricao,
        tipo,
        status: statusInicial,
        createdAt: new Date()
      });
      descricaoInput.value = "";
      carregarEntradas();
    } catch (e) {
      console.error("Erro ao salvar entrada:", e);
    }
  });

  // Carregar sugestões/reports
  async function carregarEntradas() {
    sugestoesList.innerHTML = "";

    const colS = collection(db, "sugestoes");
    const colR = collection(db, "reports");

    try {
      const snapsS = await getDocs(query(colS, orderBy("createdAt", "desc")));
      const snapsR = await getDocs(query(colR, orderBy("createdAt", "desc")));

      const entradas = [];

      snapsS.forEach(docSnap => {
        const data = docSnap.data();
        data.id = docSnap.id;
        entradas.push(data);
      });
      snapsR.forEach(docSnap => {
        const data = docSnap.data();
        data.id = docSnap.id;
        entradas.push(data);
      });

      // Ordenar por data
      entradas.sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate());

      entradas.forEach(e => {
        const card = document.createElement("div");
        card.classList.add("suggestion-card");

        // Badge tipo
        const badge = document.createElement("span");
        badge.classList.add("status-badge");
        badge.textContent = e.tipo === "sugestao" ? "💡 Sugestão" : "❗ Report";

        // Badge status
        const statusBadge = document.createElement("span");
        statusBadge.classList.add("status-badge");
        let statusClass = "";
        switch (e.status) {
          case "aprovado": statusClass="aprovado"; break;
          case "reprovado": statusClass="reprovado"; break;
          case "em_analise": statusClass="analise"; break;
          case "solucionado": statusClass="solucionado"; break;
          case "correcao_iniciada": statusClass="correcao-iniciada"; break;
        }
        statusBadge.classList.add(statusClass);
        statusBadge.textContent = e.status.replace(/_/g," ");

        card.innerHTML = `<strong>${e.matricula}</strong>: ${e.descricao}<br>`;
        card.prepend(badge);
        card.appendChild(statusBadge);

        // Admin buttons
        if (usuarioAtual?.email?.split("@")[0] === "admin" || usuarioAtual?.admin) {
          const actions = document.createElement("div");
          actions.classList.add("admin-actions");

          if (e.tipo === "sugestao") {
            ["aprovado","reprovado","em_analise"].forEach(s => {
              const btn = document.createElement("button");
              btn.textContent = s.replace(/_/g," ");
              btn.classList.add("status-badge", s);
              btn.addEventListener("click", async ()=> {
                await updateDoc(doc(db, "sugestoes", e.id), {status: s});
                carregarEntradas();
              });
              actions.appendChild(btn);
            });
          } else {
            ["solucionado","correcao_iniciada"].forEach(s => {
              const btn = document.createElement("button");
              btn.textContent = s.replace(/_/g," ");
              btn.classList.add("status-badge", s);
              btn.addEventListener("click", async ()=> {
                await updateDoc(doc(db, "reports", e.id), {status: s});
                carregarEntradas();
              });
              actions.appendChild(btn);
            });
          }

          // Excluir
          const excluirBtn = document.createElement("button");
          excluirBtn.textContent = "Excluir";
          excluirBtn.classList.add("excluir-btn");
          excluirBtn.addEventListener("click", async ()=> {
            const colecao = e.tipo==="sugestao" ? "sugestoes":"reports";
            await updateDoc(doc(db, colecao, e.id), {deleted:true});
            carregarEntradas();
          });
          actions.appendChild(excluirBtn);

          card.appendChild(actions);
        }

        sugestoesList.appendChild(card);
      });
    } catch(e) {
      console.error("Erro ao carregar entradas:", e);
    }
  }
});
