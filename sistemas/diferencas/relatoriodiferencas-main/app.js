// Importações diretas do Firebase (sem precisar de módulos locais)
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// === CONFIGURAÇÃO FIREBASE ===
const firebaseConfig = {
  apiKey: "AIzaSyDbv2jGEJbA_0J0w9rEwflhYpKaqhe_RgU",
  authDomain: "unificado-441cd.firebaseapp.com",
  projectId: "unificado-441cd",
  storageBucket: "unificado-441cd.appspot.com",
  messagingSenderId: "932372316846",
  appId: "1:932372316846:web:4b1906cb0b3ff405b021d0"
};

// Inicialização
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ELEMENTOS
const btnSalvarRelatorio = document.getElementById("btnSalvarRelatorio");
const listaRelatorios = document.getElementById("listaRelatorios");
const matriculaForm = document.getElementById("matriculaForm");

// CAMPOS DO FORMULÁRIO
const dataCaixaInput = document.getElementById("dataCaixa");
const valorFolhaInput = document.getElementById("valorFolha");
const valorDinheiroInput = document.getElementById("valorDinheiro");
const sobraFaltaInput = document.getElementById("sobraFalta");
const abastecimentoInput = document.getElementById("abastecimento");
const observacaoInput = document.getElementById("observacao");

// === FUNÇÕES ===

// CALCULA SOBRA/FALTA AUTOMATICAMENTE
function atualizarSobraFalta() {
  const valorFolha = parseFloat(valorFolhaInput.value) || 0;
  const valorDinheiro = parseFloat(valorDinheiroInput.value) || 0;
  const resultado = valorDinheiro - valorFolha;
  sobraFaltaInput.value = resultado.toFixed(2);
}
valorFolhaInput.addEventListener("input", atualizarSobraFalta);
valorDinheiroInput.addEventListener("input", atualizarSobraFalta);

// CARREGA LISTA DE USUÁRIOS
async function carregarUsuarios() {
  try {
    const usersCol = collection(db, "users");
    const snapshot = await getDocs(usersCol);
    snapshot.forEach((doc) => {
      const opt = document.createElement("option");
      opt.value = doc.data().matricula;
      opt.textContent = `${doc.data().matricula} - ${doc.data().nome}`;
      matriculaForm.appendChild(opt);
    });
  } catch (err) {
    console.error("Erro ao carregar usuários:", err);
  }
}
carregarUsuarios();

// SALVAR RELATÓRIO
btnSalvarRelatorio.addEventListener("click", async () => {
  const matricula = matriculaForm.value.trim();
  const dataCaixa = dataCaixaInput.value;
  const valorFolha = parseFloat(valorFolhaInput.value) || 0;
  const valorDinheiro = parseFloat(valorDinheiroInput.value) || 0;
  const sobraFalta = parseFloat(sobraFaltaInput.value) || 0;
  const abastecimento = parseInt(abastecimentoInput.value) || 0;
  const observacao = observacaoInput.value.trim();

  if (!matricula || !dataCaixa) {
    alert("Preencha a matrícula e a data do caixa.");
    return;
  }

  try {
    await addDoc(collection(db, "relatorios"), {
      matricula,
      dataCaixa,
      valorFolha,
      valorDinheiro,
      sobraFalta,
      abastecimento,
      observacao,
      criadoEm: serverTimestamp(),
    });

    alert("Relatório salvo com sucesso!");
    limparCamposFormulario();

    // 🔄 Atualiza automaticamente
    listaRelatorios.innerHTML = "";
    await carregarRelatorios();

  } catch (error) {
    console.error("Erro ao salvar relatório:", error);
    alert("Erro ao salvar relatório. Veja o console.");
  }
});

// LIMPA OS CAMPOS
function limparCamposFormulario() {
  dataCaixaInput.value = "";
  valorFolhaInput.value = "";
  valorDinheiroInput.value = "";
  sobraFaltaInput.value = "";
  abastecimentoInput.value = "";
  observacaoInput.value = "";
  matriculaForm.selectedIndex = 0;
}

// CARREGAR RELATÓRIOS
async function carregarRelatorios() {
  listaRelatorios.innerHTML = "<p>Carregando...</p>";

  try {
    const q = query(collection(db, "relatorios"), orderBy("criadoEm", "desc"));
    const snapshot = await getDocs(q);

    listaRelatorios.innerHTML = "";
    snapshot.forEach((doc) => {
      const r = doc.data();
      const item = document.createElement("div");
      item.classList.add("item");
      item.innerHTML = `
        <p><strong>${r.matricula}</strong> — ${r.dataCaixa}</p>
        <p>Folha: R$ ${r.valorFolha.toFixed(2)} | Dinheiro: R$ ${r.valorDinheiro.toFixed(2)}</p>
        <p>Sobra/Falta: R$ ${r.sobraFalta.toFixed(2)}</p>
        <p>Abastecimento: ${r.abastecimento || 0}</p>
        <p>${r.observacao || ""}</p>
      `;
      listaRelatorios.appendChild(item);
    });
  } catch (err) {
    console.error("Erro ao carregar relatórios:", err);
    listaRelatorios.innerHTML = "<p>Erro ao carregar relatórios.</p>";
  }
}

// 🔄 Carregar ao abrir
carregarRelatorios();
