document.addEventListener("DOMContentLoaded", () => {

    // ================================================================
    // ✅ PEGAR MATRÍCULA DO USUÁRIO LOGADO NO PORTAL (Firebase Unificado)
    // ================================================================
    console.log("🔍 Buscando dados do portal no localStorage...");

    const campoMatEmp = document.getElementById("matriculaEmpresto");

    // Bloqueia o campo
    campoMatEmp.readOnly = true;
    campoMatEmp.style.background = "#1b1b1b";
    campoMatEmp.style.cursor = "not-allowed";

    try {
        const portalDataStr = localStorage.getItem("usuarioLogado");

        if (!portalDataStr) {
            console.warn("⚠ Nenhum usuário encontrado no portal (localStorage vazio).");
        } else {
            const portalData = JSON.parse(portalDataStr);

            console.log("✅ Dados encontrados no portal:", portalData);

            if (portalData.matricula) {
                campoMatEmp.value = portalData.matricula;
                console.log("✅ Matrícula aplicada:", portalData.matricula);
            } else {
                console.warn("⚠ O portal retornou usuário, mas sem matrícula.");
            }
        }
    } catch (err) {
        console.error("❌ Erro ao ler matrícula do portal:", err);
    }

    // ================================================================
    // ✅ DAQUI PARA BAIXO — SEU CÓDIGO ORIGINAL, SEM ALTERAR NADA
    // ================================================================

    const tipoCartao = document.getElementById("tipoCartao");
    const digiconField = document.getElementById("digiconField");
    const prodataField = document.getElementById("prodataField");
    const meiaViagemField = document.getElementById("meiaViagemField");
    const dataRetirada = document.getElementById("dataRetirada");
    const form = document.getElementById("emprestimoForm");
    const matriculaMotorista = document.getElementById("matriculaMotorista");
    const nomeMotorista = document.getElementById("nomeMotorista");

    const numBordoDigiconSelect = document.getElementById("numBordoDigicon");
    const numBordoProdataSelect = document.getElementById("numBordoProdata");
    const numMeiaViagemSelect = document.getElementById("numMeiaViagem");

    const hoje = new Date();
    dataRetirada.value = hoje.toLocaleDateString("pt-BR");

    async function atualizarEstoque() {
        const estoqueDiv = document.getElementById("estoqueConteudo");
        if (!estoqueDiv) return;
        estoqueDiv.innerHTML = "Atualizando...";

        const total = { digicon: 10, prodata: 10, meiaViagem: 10 };
        const emprestados = { digicon: [], prodata: [], meiaViagem: [] };

        try {
            const snapshot = await db.collection("emprestimos")
                .where("status", "==", "em aberto")
                .get();

            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.tipoCartao === "digicon" && data.numBordoDigicon)
                    emprestados.digicon.push(Number(data.numBordoDigicon));
                if (data.tipoCartao === "prodata" && data.numBordoProdata)
                    emprestados.prodata.push(Number(data.numBordoProdata));
                if (data.numMeiaViagem)
                    emprestados.meiaViagem.push(Number(data.numMeiaViagem));
            });
        } catch (err) {
            console.error("Erro ao buscar empréstimos:", err);
            estoqueDiv.innerHTML = "<div style='color:#ffb86b;padding:10px;'>Erro ao carregar estoque.</div>";
            return;
        }

        estoqueDiv.innerHTML = "";

        ["digicon", "prodata", "meiaViagem"].forEach(tipo => {
            const todos = Array.from({ length: total[tipo] }, (_, i) => i + 1);
            const disponiveis = todos.filter(n => !emprestados[tipo].includes(n));

            const card = document.createElement("div");
            card.classList.add("cardEstoque");

            const header = document.createElement("div");
            header.classList.add("cardHeader");
            header.innerHTML = `
                <h3>${tipo === "digicon" ? "Bordo Digicon" :
                        tipo === "prodata" ? "Bordo Prodata" : "Meia Viagem"}</h3>
                <span class="chev">▸</span>
            `;

            const body = document.createElement("div");
            body.classList.add("cardBody");
            body.innerHTML = `
                <p><b>Disponível:</b> ${disponiveis.length}</p>
                <p><b>Emprestado:</b> ${emprestados[tipo].length}</p>
                <p><b>Disponíveis:</b> ${disponiveis.join(", ") || "-"}</p>
                <p><b>Emprestados:</b> ${emprestados[tipo].join(", ") || "-"}</p>
            `;
            body.style.display = "none";

            header.addEventListener("click", () => {
                const expanded = card.classList.toggle("expanded");
                body.style.display = expanded ? "block" : "none";
                header.querySelector(".chev").textContent = expanded ? "▾" : "▸";
            });

            card.appendChild(header);
            card.appendChild(body);
            estoqueDiv.appendChild(card);
        });

        preencherSelects(emprestados, total);
    }

    function preencherSelects(emprestados, total) {
        const selects = [
            { el: numBordoDigiconSelect, tipo: "digicon" },
            { el: numBordoProdataSelect, tipo: "prodata" },
            { el: numMeiaViagemSelect, tipo: "meiaViagem" }
        ];

        selects.forEach(({ el, tipo }) => {
            if (!el) return;
            el.innerHTML = '<option value="">Selecione</option>';
            const todos = Array.from({ length: total[tipo] }, (_, i) => i + 1);
            const disponiveis = todos.filter(n => !emprestados[tipo].includes(n));
            disponiveis.forEach(n => {
                const opt = document.createElement("option");
                opt.value = n;
                opt.textContent = n;
                el.appendChild(opt);
            });
        });
    }

    atualizarEstoque();

    tipoCartao.addEventListener("change", () => {
        digiconField.style.display = "none";
        prodataField.style.display = "none";
        meiaViagemField.style.display = "none";

        if (tipoCartao.value === "digicon") {
            digiconField.style.display = "flex";
            meiaViagemField.style.display = "flex";
        } else if (tipoCartao.value === "prodata") {
            prodataField.style.display = "flex";
            meiaViagemField.style.display = "flex";
        } else if (tipoCartao.value === "meiaViagem") {
            meiaViagemField.style.display = "flex";
        }
    });

    function calcularPrazo(motivo) {
        const prazo = new Date();
        if (motivo === "Perda" || motivo === "Roubo/Furto") prazo.setDate(prazo.getDate() + 3);
        else if (motivo === "Danificado") prazo.setDate(prazo.getDate() + 2);
        else prazo.setDate(prazo.getDate() + 1);
        return prazo.toLocaleDateString("pt-BR");
    }

    matriculaMotorista.addEventListener("input", async () => {
        const matricula = matriculaMotorista.value.trim();
        if (!matricula) {
            nomeMotorista.value = "";
            return;
        }
        try {
            const ref = db.collection("motoristas").doc(matricula);
            const docSnap = await ref.get();
            nomeMotorista.value = docSnap.exists ? (docSnap.data().nome || "") : "";
        } catch (e) {
            console.error("Erro ao buscar motorista:", e);
        }
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const digicon = numBordoDigiconSelect.value.trim();
        const prodata = numBordoProdataSelect.value.trim();
        const meia = numMeiaViagemSelect.value.trim();

        if (!digicon && !prodata && !meia) {
            alert("Por favor, selecione pelo menos um número de cartão.");
            return;
        }

        const dados = {
            nomeMotorista: nomeMotorista.value.trim(),
            matriculaMotorista: matriculaMotorista.value.trim(),
            tipoCartao: tipoCartao.value,
            numBordoDigicon: digicon,
            numBordoProdata: prodata,
            numMeiaViagem: meia,
            motivo: document.getElementById("motivo").value,
            matriculaEmpresto: campoMatEmp.value,
            dataRetirada: dataRetirada.value,
            prazoDevolucao: calcularPrazo(document.getElementById("motivo").value),
            status: "em aberto",
            timestamp: new Date()
        };

        try {
            await db.collection("emprestimos").add(dados);

            if (typeof atualizarEstoque === "function") atualizarEstoque();
            if (typeof gerarPDF_A4 === "function") gerarPDF_A4(dados);
            if (typeof gerarPDF_Termica === "function") gerarPDF_Termica(dados);

            alert("Registro salvo com sucesso!");

            form.reset();
            dataRetirada.value = new Date().toLocaleDateString("pt-BR");

            digiconField.style.display = "none";
            prodataField.style.display = "none";
            meiaViagemField.style.display = "none";

            atualizarEstoque();
        } catch (err) {
            console.error("Erro ao salvar:", err);
            alert("Erro ao salvar registro.");
        }
    });

    document.getElementById("relatorioBtn").addEventListener("click", () => {
        window.location.href = "relatorio.html";
    });

});
