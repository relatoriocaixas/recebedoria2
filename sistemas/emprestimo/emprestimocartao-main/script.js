// emprestimo.js — versão modular + compatível com Auth do portal via postMessage

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "./firebaseConfig.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentUser = null;

// 🔄 Recebe usuário autenticado do portal principal
window.addEventListener("message", (event) => {
  if (event.data?.user) {
    currentUser = event.data.user;
  }
});

// 🔄 Solicita user ao portal
window.parent?.postMessage({ action: "getUser" }, "*");

// Espera carregar o DOM
document.addEventListener("DOMContentLoaded", () => {
  const tipoCartao = document.getElementById("tipoCartao");
  const digiconField = document.getElementById("digiconField");
  const prodataField = document.getElementById("prodataField");
  const meiaViagemField = document.getElementById("meiaViagemField");
  const dataRetirada = document.getElementById("dataRetirada");
  const form = document.getElementById("emprestimoForm");

  // Preenche a data automaticamente (pt-BR)
  const hoje = new Date();
  dataRetirada.value = hoje.toLocaleDateString("pt-BR");

  // Mostrar / ocultar campos
  tipoCartao.addEventListener("change", () => {
    digiconField.style.display = "none";
    prodataField.style.display = "none";
    meiaViagemField.style.display = "none";

    if (tipoCartao.value === "DIGICON") {
      digiconField.style.display = "flex";
      meiaViagemField.style.display = "flex";
    } else if (tipoCartao.value === "PRODATA") {
      prodataField.style.display = "flex";
      meiaViagemField.style.display = "flex";
    } else if (tipoCartao.value === "MEIA") {
      meiaViagemField.style.display = "flex";
    }
  });

  // Calcula o prazo de devolução
  function calcularPrazo(motivo) {
    const prazo = new Date();
    const m = motivo.toLowerCase();
    if (m === "perda" || m === "roubo/furto") {
      prazo.setDate(prazo.getDate() + 3);
    } else if (m === "danificado") {
      prazo.setDate(prazo.getDate() + 2);
    } else {
      prazo.setDate(prazo.getDate() + 1);
    }
    return prazo.toLocaleDateString("pt-BR");
  }

  // Salvar no Firestore
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const dados = {
      nomeMotorista: document.getElementById("nomeMotorista").value.trim(),
      matriculaMotorista: document.getElementById("matriculaMotorista").value.trim(),
      tipoCartao: tipoCartao.value,
      numBordoDigicon: document.getElementById("numBordoDigicon")?.value.trim() || "",
      numBordoProdata: document.getElementById("numBordoProdata")?.value.trim() || "",
      numMeiaViagem: document.getElementById("numMeiaViagem")?.value.trim() || "",
      motivo: document.getElementById("motivo").value,
      matriculaEmpresto: document.getElementById("matriculaEmpresto").value.trim(),
      dataRetirada: dataRetirada.value,
      prazoDevolucao: calcularPrazo(document.getElementById("motivo").value),
      status: "em aberto",
      timestamp: serverTimestamp(),
      criadoPor: currentUser?.email || "desconhecido",
      uid: currentUser?.uid || null,
    };

    try {
      await addDoc(collection(db, "emprestimos"), dados);

      // Gera PDFs (mantém tuas funções locais)
      if (typeof gerarPDF_A4 === "function") gerarPDF_A4(dados);
      if (typeof gerarPDF_Termica === "function") gerarPDF_Termica(dados);

      alert("Registro salvo com sucesso!");
      form.reset();
      dataRetirada.value = hoje.toLocaleDateString("pt-BR");
      digiconField.style.display = "none";
      prodataField.style.display = "none";
      meiaViagemField.style.display = "none";
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar registro. Veja o console.");
    }
  });
});
