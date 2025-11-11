document.addEventListener("DOMContentLoaded", () => {

    // ================================================================
    // ✅ BOTÃO UPLOAD MOTORISTAS — SEM RESTRIÇÃO (VISÍVEL PARA TODOS)
    // ================================================================
    const uploadBtn = document.getElementById("uploadMotoristasBtn");
    if (uploadBtn) {
        uploadBtn.addEventListener("click", () => {
            window.location.href = "uploadMotoristas.html";
        });
    }

    // ================================================================
    // ✅ PEGAR MATRÍCULA DO USUÁRIO LOGADO NO PORTAL (localStorage)
    // ================================================================
    console.log("🔍 Buscando dados do portal no localStorage...");

    const campoMatEmp = document.getElementById("matriculaEmpresto");

    campoMatEmp.readOnly = true;
    campoMatEmp.style.background = "#1b1b1b";
    campoMatEmp.style.cursor = "not-allowed";

    try {
        const portalStr = localStorage.getItem("usuarioLogado");

        if (portalStr) {
            const portal = JSON.parse(portalStr);
            console.log("✅ Dados do portal:", portal);

            if (portal.matricula) {
                campoMatEmp.value = portal.matricula;
                console.log("✅ Matrícula aplicada:", portal.matricula);
            }
        }
    } catch (e) {
        console.error("❌ Erro ao carregar dados do portal:", e);
    }

    // ================================================================
    // ✅ DAQUI PRA BAIXO — SEU CÓDIGO ORIGINAL (NÃO ALTERADO)
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
        const div = document.getElementById("estoqueConteudo");
        if (!div) return;
        div.innerHTML = "Atualizando...";

        const total = { digicon: 10, prodata: 10, meiaViagem: 10 };
        const emprestados = { digicon: [], prodata: [], meiaViagem: [] };

        try {
            const snap = await db.collection("emprestimos")
                .where("status", "==", "em aberto")
                .get();

            snap.forEach(d => {
                const x = d.data();
                if (x.tipoCartao === "digicon" && x.numBordoDigicon)
                    emprestados.digicon.push(Number(x.numBordoDigicon));
                if (x.tipoCartao === "prodata" && x.numBordoProdata)
                    emprestados.prodata.push(Number(x.numBordoProdata));
                if (x.numMeiaViagem)
                    emprestados.meiaViagem.push(Number(x.numMeiaViagem));
            });
        } catch (e) {
            console.error("Erro no estoque:", e);
            div.innerHTML = "Erro ao carregar estoque.";
            return;
        }

        div.innerHTML = "";

        ["digicon", "prodata", "meiaViagem"].forEach(tipo => {
            const todos = Array.from({ length: total[tipo] }, (_, i) => i + 1);
            const disp = todos.filter(x => !emprestados[tipo].includes(x));

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
                <p><b>Disponível:</b> ${disp.length}</p>
                <p><b>Emprestado:</b> ${emprestados[tipo].length}</p>
                <p><b>N° Disponíveis:</b> ${disp.join(", ") || "-"}</p>
                <p><b>N° Emprestados:</b> ${emprestados[tipo].join(", ") || "-"}</p>
            `;
            body.style.display = "none";

            header.addEventListener("click", () => {
                const expanded = card.classList.toggle("expanded");
                body.style.display = expanded ? "block" : "none";
                header.querySelector(".chev").textContent = expanded ? "▾" : "▸";
            });

            card.appendChild(header);
            card.appendChild(body);
            div.appendChild(card);
        });

        preencherSelects(emprestados, total);
    }

    function preencherSelects(emprestados, total) {
        [
            { el: numBordoDigiconSelect, tipo: "digicon" },
            { el: numBordoProdataSelect, tipo: "prodata" },
            { el: numMeiaViagemSelect, tipo: "meiaViagem" }
        ].forEach(({ el, tipo }) => {
            el.innerHTML = '<option value="">Selecione</option>';
            const todos = Array.from({ length: total[tipo] }, (_, i) => i + 1);
            const disp = todos.filter(n => !emprestados[tipo].includes(n));
            disp.forEach(n => {
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
        const p = new Date();
        if (motivo === "Perda" || motivo === "Roubo/Furto") p.setDate(p.getDate() + 3);
        else if (motivo === "Danificado") p.setDate(p.getDate() + 2);
        else p.setDate(p.getDate() + 1);
        return p.toLocaleDateString("pt-BR");
    }

    matriculaMotorista.addEventListener("input", async () => {
        const mat = matriculaMotorista.value.trim();
        if (!mat) { nomeMotorista.value = ""; return; }

        try {
            const snap = await db.collection("motoristas").doc(mat).get();
            nomeMotorista.value = snap.exists ? snap.data().nome : "";
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
            alert("Selecione pelo menos um número de cartão.");
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

            alert("Registro salvo!");

            form.reset();
            dataRetirada.value = new Date().toLocaleDateString("pt-BR");

            digiconField.style.display = "none";
            prodataField.style.display = "none";
            meiaViagemField.style.display = "none";

            atualizarEstoque();
        } catch (e) {
            console.error("Erro ao salvar:", e);
            alert("Erro ao salvar registro.");
        }
    });
});
