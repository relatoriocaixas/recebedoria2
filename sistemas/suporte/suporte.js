document.addEventListener("DOMContentLoaded", async () => {

    // Firebase do PORTAL (somente leitura e autenticação)
    const portalConfig = {
        apiKey: "AIzaSyBWmq02P8pGbl2NmppEAIKtF9KtQ7AzTFQ",
        authDomain: "unificado-441cd.firebaseapp.com",
        projectId: "unificado-441cd"
    };

    const portalApp = firebase.initializeApp(portalConfig, "portalApp");
    const portalDB = portalApp.firestore();
    const portalAuth = portalApp.auth();

    let userLogado = null;
    let isAdmin = false;

    // Captura usuário logado
    portalAuth.onAuthStateChanged(async (user) => {
        if (!user) return;
        userLogado = user;

        // Pegar matrícula e admin
        try {
            const snap = await portalDB.collection("users").where("email", "==", user.email).get();
            if (!snap.empty) {
                const dados = snap.docs[0].data();
                isAdmin = dados.admin || false;
            }
        } catch(e) {
            console.error("Erro ao buscar usuário no portal:", e);
        }

        carregarSugestoes();
    });

    // Enviar sugestão
    const btnEnviar = document.getElementById("btnEnviarSugestao");
    const sugestaoInput = document.getElementById("sugestaoInput");

    btnEnviar.addEventListener("click", async () => {
        const texto = sugestaoInput.value.trim();
        if (!texto) return alert("Digite uma sugestão.");

        try {
            await portalDB.collection("suporteSugestoes").add({
                sugestao: texto,
                matricula: userLogado.email || "",
                nome: userLogado.displayName || "",
                status: "em analise",
                respostaAdmin: "",
                data: new Date()
            });
            sugestaoInput.value = "";
            carregarSugestoes();
            alert("Sugestão enviada com sucesso!");
        } catch(e) {
            console.error("Erro ao salvar sugestão:", e);
            alert("Erro ao enviar sugestão.");
        }
    });

    async function carregarSugestoes() {
        const container = document.getElementById("cardsSugestoes");
        container.innerHTML = "Carregando...";

        try {
            let queryRef = portalDB.collection("suporteSugestoes").orderBy("data", "desc");

            if (!isAdmin && userLogado) {
                queryRef = queryRef.where("matricula", "==", userLogado.email);
            }

            const snapshot = await queryRef.get();
            container.innerHTML = "";

            snapshot.forEach(doc => {
                const d = doc.data();
                const card = document.createElement("div");
                card.className = "cardSugestao";

                card.innerHTML = `
                    <p><b>De:</b> ${d.nome}</p>
                    <p>${d.sugestao}</p>
                    <p><b>Status:</b> <span class="status ${d.status.replace(" ", "").toLowerCase()}">${d.status}</span></p>
                    ${d.respostaAdmin ? `<p><b>Resposta do Admin:</b> ${d.respostaAdmin}</p>` : ""}
                `;

                if (isAdmin) {
                    const btnAprovar = document.createElement("button");
                    btnAprovar.textContent = "Aprovar";
                    btnAprovar.style.background = "green";
                    btnAprovar.addEventListener("click", () => atualizarStatus(doc.id, "aprovado"));

                    const btnReprovar = document.createElement("button");
                    btnReprovar.textContent = "Reprovar";
                    btnReprovar.style.background = "red";
                    btnReprovar.addEventListener("click", () => atualizarStatus(doc.id, "reprovado"));

                    const btnAnalise = document.createElement("button");
                    btnAnalise.textContent = "Em Análise";
                    btnAnalise.style.background = "gold";
                    btnAnalise.addEventListener("click", () => atualizarStatus(doc.id, "em analise"));

                    const divBotoes = document.createElement("div");
                    divBotoes.style.marginTop = "5px";
                    divBotoes.append(btnAprovar, btnReprovar, btnAnalise);
                    card.appendChild(divBotoes);
                }

                container.appendChild(card);
            });

        } catch(e) {
            console.error("Erro ao carregar sugestões:", e);
            container.innerHTML = "Erro ao carregar sugestões.";
        }
    }

    async function atualizarStatus(docId, status) {
        try {
            await portalDB.collection("suporteSugestoes").doc(docId).update({ status });
            carregarSugestoes();
        } catch(e) {
            console.error("Erro ao atualizar status:", e);
        }
    }

});
