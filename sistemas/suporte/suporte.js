import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, addDoc, getDocs, query, where, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const sugestaoInput = document.getElementById('sugestaoInput');
const salvarBtn = document.getElementById('salvarSugestaoBtn');
const sugestoesList = document.getElementById('sugestoesList');
const tipoEntrada = document.getElementById('tipoEntrada');
const filtroTipo = document.getElementById('filtroTipo');

let currentUser = null;
let isAdmin = false;

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  currentUser = user;

  const userSnap = await (await getDocs(query(collection(db,"users"),where("uid","==",user.uid)))).docs[0];
  isAdmin = userSnap ? userSnap.data().admin===true : false;

  carregarSugestoes();
});

tipoEntrada.addEventListener('change', () => {
  if (tipoEntrada.value === 'report') {
    sugestaoInput.placeholder = "Use esta opção somente para reportar erros";
    salvarBtn.textContent = "Salvar Report";
    salvarBtn.classList.remove('sugestao');
    salvarBtn.classList.add('report');
  } else {
    sugestaoInput.placeholder = "Escreva sua sugestão (até 1000 caracteres)";
    salvarBtn.textContent = "Salvar Sugestão";
    salvarBtn.classList.remove('report');
    salvarBtn.classList.add('sugestao');
  }
});

salvarBtn.addEventListener('click', async () => {
  if (!currentUser) return alert("Usuário não autenticado.");
  const texto = sugestaoInput.value.trim();
  if (!texto) return alert("Digite um texto.");

  const tipo = tipoEntrada.value;
  const collectionName = tipo === 'report' ? 'reports' : 'sugestoes';

  try {
    await addDoc(collection(db, collectionName), {
      texto,
      usuario: currentUser.email,
      matricula: currentUser.email.split('@')[0],
      uid: currentUser.uid,
      tipo,
      status: tipo==='report' ? 'em aberto' : 'analise',
      timestamp: new Date()
    });
    sugestaoInput.value = "";
    carregarSugestoes();
  } catch(err) {
    console.error("Erro ao salvar entrada:", err);
    alert("Erro ao salvar entrada.");
  }
});

filtroTipo.addEventListener('change', carregarSugestoes);

async function carregarSugestoes() {
  sugestoesList.innerHTML = "";
  try {
    const tipoFilter = filtroTipo.value;
    const entradas = [];

    // Sugestões
    if (tipoFilter==='all' || tipoFilter==='sugestao') {
      const q = isAdmin 
        ? query(collection(db, "sugestoes")) 
        : query(collection(db, "sugestoes"), where("uid","==",currentUser.uid));
      const snapshot = await getDocs(q);
      snapshot.forEach(docSnap => entradas.push({id: docSnap.id, ...docSnap.data()}));
    }
    // Reports
    if (tipoFilter==='all' || tipoFilter==='report') {
      const q = isAdmin 
        ? query(collection(db, "reports")) 
        : query(collection(db, "reports"), where("uid","==",currentUser.uid));
      const snapshot = await getDocs(q);
      snapshot.forEach(docSnap => entradas.push({id: docSnap.id, ...docSnap.data()}));
    }

    entradas.sort((a,b)=> b.timestamp?.toDate?.()-a.timestamp?.toDate?.());

    entradas.forEach(data => {
      const card = document.createElement("div");
      card.classList.add("suggestion-card");
      card.innerHTML = `
        <p>${data.texto}</p>
        <p>Enviado por: ${data.matricula}</p>
        <p class="status-badge ${data.status.replace(' ','')}">${data.status.toUpperCase()}</p>
      `;

      if (isAdmin) {
        const actions = document.createElement("div");
        actions.classList.add("admin-actions");
        if (data.tipo==='sugestao') {
          ["aprovado","reprovado","analise"].forEach(st => {
            const btn = document.createElement("button");
            btn.textContent = st.toUpperCase();
            btn.classList.add(st);
            btn.addEventListener('click', async ()=> {
              await updateDoc(doc(db, "sugestoes", data.id), {status:st});
              carregarSugestoes();
            });
            actions.appendChild(btn);
          });
        } else { // report
          ["solucionado","em aberto"].forEach(st => {
            const btn = document.createElement("button");
            btn.textContent = st.toUpperCase();
            btn.classList.add(st);
            btn.addEventListener('click', async ()=> {
              await updateDoc(doc(db, "reports", data.id), {status:st});
              carregarSugestoes();
            });
            actions.appendChild(btn);
          });
        }

        // Botão excluir
        const delBtn = document.createElement("button");
        delBtn.textContent = "EXCLUIR";
        delBtn.classList.add("excluir-btn");
        delBtn.addEventListener('click', async ()=> {
          if (confirm("Deseja realmente excluir esta entrada?")) {
            await deleteDoc(doc(db, data.tipo==='report'?'reports':'sugestoes', data.id));
            carregarSugestoes();
          }
        });
        actions.appendChild(delBtn);
        card.appendChild(actions);
      }

      sugestoesList.appendChild(card);
    });

  } catch(err) {
    console.error("Erro ao carregar entradas:", err);
  }
}
