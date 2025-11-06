import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc, collection, addDoc, query, where, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const sugestaoInput = document.getElementById('sugestaoInput');
const salvarBtn = document.getElementById('salvarSugestaoBtn');
const sugestoesList = document.getElementById('sugestoesList');

let currentUser = null;
let isAdmin = false;

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  currentUser = user;

  const userSnap = await getDoc(doc(db, "users", user.uid));
  isAdmin = userSnap.exists() ? userSnap.data().admin===true : false;

  carregarSugestoes();
});

salvarBtn.addEventListener('click', async () => {
  if (!currentUser) { alert("Usuário não autenticado."); return; }
  const texto = sugestaoInput.value.trim();
  if (!texto) return alert("Digite uma sugestão.");

  try {
    await addDoc(collection(db, "sugestoes"), {
      texto,
      usuario: currentUser.email,
      uid: currentUser.uid,
      status: "analise",
      timestamp: new Date()
    });
    sugestaoInput.value = "";
    carregarSugestoes();
  } catch(err) {
    console.error("Erro ao salvar sugestão:", err);
    alert("Erro ao salvar sugestão.");
  }
});

async function carregarSugestoes() {
  sugestoesList.innerHTML = "";
  try {
    const q = isAdmin 
      ? query(collection(db, "sugestoes"))
      : query(collection(db, "sugestoes"), where("uid", "==", currentUser.uid));

    const snapshot = await getDocs(q);
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const card = document.createElement("div");
      card.classList.add("suggestion-card");
      card.innerHTML = `
        <p>${data.texto}</p>
        <p class="status-badge ${data.status}">${data.status.toUpperCase()}</p>
      `;

      if (isAdmin) {
        const actions = document.createElement("div");
        actions.classList.add("admin-actions");

        ["aprovado","reprovado","analise"].forEach(st => {
          const btn = document.createElement("button");
          btn.textContent = st.toUpperCase();
          btn.classList.add(st);
          btn.addEventListener('click', async () => {
            await updateDoc(doc(db, "sugestoes", docSnap.id), { status: st });
            carregarSugestoes();
          });
          actions.appendChild(btn);
        });

        // Botão excluir
        const delBtn = document.createElement("button");
        delBtn.textContent = "EXCLUIR";
        delBtn.classList.add("excluir-btn");
        delBtn.addEventListener('click', async () => {
          if (confirm("Deseja realmente excluir esta sugestão?")) {
            await deleteDoc(doc(db, "sugestoes", docSnap.id));
            carregarSugestoes();
          }
        });
        actions.appendChild(delBtn);

        card.appendChild(actions);
      }

      sugestoesList.appendChild(card);
    });
  } catch(err) {
    console.error("Erro ao carregar sugestões:", err);
  }
}
