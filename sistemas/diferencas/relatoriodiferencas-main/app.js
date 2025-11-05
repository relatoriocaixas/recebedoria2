import {
  auth,
  db,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "../firebaseConfig_v2.js";

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
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    matriculaForm.innerHTML = '<option value="">Selecione</option>';
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const opt = document.createElement("option");
      opt.value = data.matricula;
      opt.textContent = `${data.matricula} - ${data.nome}`;
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
    const relatoriosRef = collection(db, "relatorios");

    await addDoc(relatoriosRef, {
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
    await carregarRelatorios(); // Atualiza automaticamente após salvar

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

// CARREGAR RELATÓRIOS
async function carregarRelatorios() {
  listaRelatorios.innerHTML = "<p>Carregando...</p>";

  try {
    const relatoriosRef = collection(db, "relatorios");
    const q = query(relatoriosRef, orderBy("criadoEm", "desc"));
    const snapshot = await getDocs(q);

    listaRelatorios.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const r = docSnap.data();
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
  } catch (err) {
    console.error("Erro ao carregar relatórios:", err);
    listaRelatorios.innerHTML = "<p>Erro ao carregar relatórios.</p>";
  }
}

// 🔄 Atualiza lista ao abrir
carregarRelatorios();
