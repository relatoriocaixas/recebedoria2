import { auth, db } from "../firebaseConfig_v2.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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

// CARREGA LISTA DE USUÁRIOS (para admins)
async function carregarUsuarios() {
  const snapshot = await getDocs(collection(db, "users"));
  snapshot.forEach((doc) => {
    const opt = document.createElement("option");
    opt.value = doc.data().matricula;
    opt.textContent = `${doc.data().matricula} - ${doc.data().nome}`;
    matriculaForm.appendChild(opt);
  });
}
carregarUsuarios();

// SALVAR RELATÓRIO
btnSalvarRelatorio.addEventListener("click", async () => {
  const matricula = matriculaForm.value.trim();
  const dataCaixa = dataCaixaInput.value;
  const valorFolha = parseFloat(valorFolhaInput.value) || 0;
  const valorDinheiro = parseFloat(valorDinheiroInput.value) || 0;
  const sobraFalta = parseFloat(sobraFaltaInput.value) || 0;
  const abastecimento = parseInt(abastecimentoInput.value) || 0; // ✅ campo abastecimento
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

    // 🔄 Limpa e recarrega a lista automaticamente
    listaRelatorios.innerHTML = "";
    await carregarRelatorios();

  } catch (error) {
    console.error("Erro ao salvar relatório:", error);
    alert("Erro ao salvar relatório. Verifique o console.");
  }
});

// LIMPA OS CAMPOS DO FORMULÁRIO
function limparCamposFormulario() {
  dataCaixaInput.value = "";
  valorFolhaInput.value = "";
  valorDinheiroInput.value = "";
  sobraFaltaInput.value = "";
  abastecimentoInput.value = "";
  observacaoInput.value = "";
  matriculaForm.selectedIndex = 0;
}

// EXIBIR RELATÓRIOS
async function carregarRelatorios() {
  listaRelatorios.innerHTML = "<p>Carregando...</p>";
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
      <p>Abastecimento: ${r.abastecimento || 0} documentos</p>
      <p>${r.observacao || ""}</p>
    `;
    listaRelatorios.appendChild(item);
  });
}

// 🔄 Carrega os relatórios ao iniciar
carregarRelatorios();
