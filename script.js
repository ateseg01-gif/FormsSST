// ======================================
// LEVANTAMENTO AMBIENTAL SST
// Desenvolvido por Izabelly
// Versão 1.3 (galeria de fotos em observações)
// ======================================

"use strict";

// ======================================
// ELEMENTOS PRINCIPAIS
// ======================================

const tabelaSetores = document.getElementById("tabela-setores");
const tabelaExtintores = document.getElementById("tabela-extintores");
const tabelaBanheiros = document.getElementById("tabela-banheiros");
const tabelaBebedouros = document.getElementById("tabela-bebedouros");
const areaPDF = document.getElementById("areaPDF");

// ======================================
// UTILIDADES GERAIS
// ======================================

function atualizarNumeracao() {
    [tabelaSetores, tabelaExtintores].forEach(tabela => {
        if (!tabela) return;

        tabela.querySelectorAll("tr").forEach((linha, indice) => {
            linha.cells[0].textContent = indice + 1;
        });
    });
}

function removerLinha(botao) {
    const linha = botao.closest("tr");
    if (!linha) return;

    linha.remove();
    atualizarNumeracao();
    salvarAutomaticamente();
}

function campoIgnoravel(campo) {
    return campo.type === "file" || campo.type === "button" || campo.type === "submit";
}

// ======================================
// UPLOAD DE IMAGENS (ÚNICO)
// Funciona em qualquer container marcado com a classe "upload-slot"
// (células de tabela ou os cards da galeria de observações)
// ======================================

function criarOuObterImagem(container) {
    let img = container.querySelector("img");

    if (!img) {
        img = document.createElement("img");

        if (container.classList.contains("campo-arquivo-grande")) {
            img.className = "foto-local";
        } else if (container.classList.contains("foto-obs-card")) {
            img.className = "foto-obs";
        } else {
            img.className = "imagem-medicao";
        }

        container.insertBefore(img, container.firstChild);
    }

    return img;
}

// Redimensiona e comprime a imagem antes de guardar, para reduzir
// o tamanho salvo no navegador e, consequentemente, do PDF gerado.
function comprimirImagem(base64Original, larguraMaxima = 1000, qualidade = 0.7) {
    return new Promise((resolve) => {
        const imagem = new Image();

        imagem.onload = () => {
            let largura = imagem.width;
            let altura = imagem.height;

            if (largura > larguraMaxima) {
                altura = Math.round((altura * larguraMaxima) / largura);
                largura = larguraMaxima;
            }

            const canvas = document.createElement("canvas");
            canvas.width = largura;
            canvas.height = altura;

            canvas.getContext("2d").drawImage(imagem, 0, 0, largura, altura);

            resolve(canvas.toDataURL("image/jpeg", qualidade));
        };

        // Se a imagem não puder ser processada, usa a original como fallback
        imagem.onerror = () => resolve(base64Original);

        imagem.src = base64Original;
    });
}

function ativarUploadImagens() {
    document.querySelectorAll("input[type='file']").forEach(input => {
        if (input.dataset.ativo) return;
        input.dataset.ativo = "true";

        input.addEventListener("change", function () {
            const arquivo = this.files[0];
            if (!arquivo) return;

            const leitor = new FileReader();

            leitor.onload = async (evento) => {
                const imagemOriginal = evento.target.result;
                const imagemBase64 = await comprimirImagem(imagemOriginal);

                this.dataset.imagem = imagemBase64;

                const container = this.closest(".upload-slot");
                if (!container) return;

                const img = criarOuObterImagem(container);
                img.src = imagemBase64;
                img.title = "Clique para trocar a foto";
                img.onclick = () => this.click();

                salvarAutomaticamente();
            };

            leitor.readAsDataURL(arquivo);
        });
    });
}

function restaurarImagens() {
    const imagens = JSON.parse(localStorage.getItem("imagensSST")) || [];

    document.querySelectorAll("input[type='file']").forEach((input, indice) => {
        const imagem = imagens[indice];
        if (!imagem) return;

        input.dataset.imagem = imagem;

        const container = input.closest(".upload-slot");
        if (!container) return;

        const img = criarOuObterImagem(container);
        img.src = imagem;
        img.title = "Clique para trocar a foto";
        img.onclick = () => input.click();
    });
}

// ======================================
// CAMPO DE ARQUIVO (usado por setores e extintores)
// ======================================

function campoComArquivo(valor) {
    return `
        <div contenteditable="true" class="editavel">${valor || ""}</div>
        <label class="btn-arquivo">
            📎
            <input type="file" accept="image/*" capture="environment" hidden>
        </label>
    `;
}

// ======================================
// EXTINTORES
// ======================================

function criarLinhaExtintor(dados = {}) {
    return `
        <tr>
            <td>${dados.numero || tabelaExtintores.rows.length + 1}</td>
            <td class="campo-arquivo upload-slot">${campoComArquivo(dados.local)}</td>
            <td contenteditable="true">${dados.tipo || ""}</td>
            <td contenteditable="true">${dados.quantidade || ""}</td>
            <td contenteditable="true">${dados.vencimento || ""}</td>
            <td contenteditable="true">${dados.observacao || ""}</td>
            <td><button onclick="removerLinha(this)">X</button></td>
        </tr>
    `;
}

function adicionarExtintor() {
    tabelaExtintores.insertAdjacentHTML("beforeend", criarLinhaExtintor());
    atualizarNumeracao();
    ativarUploadImagens();
    salvarAutomaticamente();
}

function salvarTabelaExtintores() {
    const extintores = [];

    tabelaExtintores.querySelectorAll("tr").forEach(linha => {
        const colunas = linha.querySelectorAll("td");

        extintores.push({
            numero: colunas[0].textContent.trim(),
            local: colunas[1].querySelector(".editavel").innerText,
            tipo: colunas[2].innerText,
            quantidade: colunas[3].innerText,
            vencimento: colunas[4].innerText,
            observacao: colunas[5].innerText
        });
    });

    localStorage.setItem("tabelaExtintores", JSON.stringify(extintores));
}

function restaurarTabelaExtintores() {
    const extintores = JSON.parse(localStorage.getItem("tabelaExtintores"));
    if (!extintores || extintores.length === 0) return;

    tabelaExtintores.innerHTML = "";
    extintores.forEach(extintor => {
        tabelaExtintores.insertAdjacentHTML("beforeend", criarLinhaExtintor(extintor));
    });

    ativarUploadImagens();
    atualizarNumeracao();
}

// ======================================
// SETORES
// ======================================

function criarLinhaSetor(dados = {}) {
    return `
        <tr>
            <td>${dados.numero || tabelaSetores.rows.length + 1}</td>
            <td contenteditable="true">${dados.setor || ""}</td>
            <td contenteditable="true">${dados.descricao || ""}</td>
            <td class="campo-arquivo upload-slot">${campoComArquivo(dados.lux)}</td>
            <td class="campo-arquivo upload-slot">${campoComArquivo(dados.ruido)}</td>
            <td class="campo-arquivo upload-slot">${campoComArquivo(dados.temperatura)}</td>
            <td contenteditable="true">${dados.observacao || ""}</td>
            <td><button onclick="removerLinha(this)">X</button></td>
        </tr>
    `;
}

function adicionarSetor() {
    tabelaSetores.insertAdjacentHTML("beforeend", criarLinhaSetor());
    atualizarNumeracao();
    ativarUploadImagens();
    salvarAutomaticamente();
}

function salvarTabelaSetores() {
    const setores = [];

    document.querySelectorAll("#tabela-setores tr").forEach(linha => {
        const colunas = linha.querySelectorAll("td");

        setores.push({
            numero: colunas[0].textContent.trim(),
            setor: colunas[1].textContent.trim(),
            descricao: colunas[2].textContent.trim(),
            lux: colunas[3].querySelector(".editavel").innerText,
            ruido: colunas[4].querySelector(".editavel").innerText,
            temperatura: colunas[5].querySelector(".editavel").innerText,
            observacao: colunas[6].innerText
        });
    });

    localStorage.setItem("tabelaSetores", JSON.stringify(setores));
}

function restaurarTabelaSetores() {
    const setores = JSON.parse(localStorage.getItem("tabelaSetores"));
    if (!setores || setores.length === 0) return;

    tabelaSetores.innerHTML = "";
    setores.forEach(setor => {
        tabelaSetores.insertAdjacentHTML("beforeend", criarLinhaSetor(setor));
    });

    ativarUploadImagens();
    atualizarNumeracao();
}

// ======================================
// TABELAS SIMPLES (BANHEIROS E BEBEDOUROS)
// Estrutura idêntica: foto + observação + remover
// ======================================

function criarLinhaSimples(dados = {}) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
        <td class="campo-arquivo-grande upload-slot">
            <label class="btn-arquivo">
                📎
                <input type="file" accept="image/*" capture="environment" hidden>
            </label>
        </td>
        <td contenteditable="true">${dados.observacao || ""}</td>
        <td><button onclick="removerLinha(this)">X</button></td>
    `;

    if (dados.imagem) {
        const input = tr.querySelector("input[type='file']");
        const td = tr.querySelector(".campo-arquivo-grande");

        input.dataset.imagem = dados.imagem;

        const img = document.createElement("img");
        img.className = "foto-local";
        img.src = dados.imagem;
        img.title = "Clique para trocar a foto";
        img.onclick = () => input.click();

        td.insertBefore(img, td.firstChild);
    }

    return tr;
}

function adicionarLinhaSimples(tabelaId) {
    const tbody = document.getElementById(tabelaId);
    tbody.appendChild(criarLinhaSimples());

    ativarUploadImagens();
    salvarAutomaticamente();
}

function salvarTabelaSimples(tabelaId, storageKey) {
    const dados = [];

    document.querySelectorAll(`#${tabelaId} tr`).forEach(linha => {
        dados.push({
            observacao: linha.cells[1].textContent.trim(),
            imagem: linha.querySelector("input[type='file']")?.dataset.imagem || ""
        });
    });

    localStorage.setItem(storageKey, JSON.stringify(dados));
}

function restaurarTabelaSimples(tabelaId, storageKey) {
    const dados = JSON.parse(localStorage.getItem(storageKey));
    if (!dados || dados.length === 0) return;

    const tbody = document.getElementById(tabelaId);
    tbody.innerHTML = "";

    dados.forEach(item => tbody.appendChild(criarLinhaSimples(item)));

    ativarUploadImagens();
}

// -- Banheiros (funções nomeadas mantidas para compatibilidade com o HTML) --
function criarLinhaBanheiro(dados) { return criarLinhaSimples(dados); }
function adicionarBanheiro() { adicionarLinhaSimples("tabela-banheiros"); }
function salvarTabelaBanheiros() { salvarTabelaSimples("tabela-banheiros", "tabelaBanheiros"); }
function restaurarTabelaBanheiros() { restaurarTabelaSimples("tabela-banheiros", "tabelaBanheiros"); }

// -- Bebedouros --
function criarLinhaBebedouro(dados) { return criarLinhaSimples(dados); }
function adicionarBebedouro() { adicionarLinhaSimples("tabela-bebedouros"); }
function salvarTabelaBebedouros() { salvarTabelaSimples("tabela-bebedouros", "tabelaBebedouros"); }
function restaurarTabelaBebedouros() { restaurarTabelaSimples("tabela-bebedouros", "tabelaBebedouros"); }

// ======================================
// GALERIA DE FOTOS - OBSERVAÇÕES GERAIS
// Cards em grade, sem numeração/observação individual,
// tamanho padronizado via CSS (.foto-obs)
// ======================================

function criarCardFotoObservacao(imagemBase64 = "") {
    const card = document.createElement("div");
    card.className = "foto-obs-card upload-slot";

    card.innerHTML = `
        <button type="button" class="btn-remover-foto" onclick="removerFotoObservacao(this)" title="Remover foto">×</button>
        <label class="btn-arquivo">
            📎
            <input type="file" accept="image/*" capture="environment" hidden>
        </label>
    `;

    if (imagemBase64) {
        const input = card.querySelector("input[type='file']");
        input.dataset.imagem = imagemBase64;

        const img = document.createElement("img");
        img.className = "foto-obs";
        img.src = imagemBase64;
        img.title = "Clique para trocar a foto";
        img.onclick = () => input.click();

        card.insertBefore(img, card.firstChild);
    }

    return card;
}

function adicionarFotoObservacao() {
    const galeria = document.getElementById("galeria-observacoes");
    galeria.appendChild(criarCardFotoObservacao());

    ativarUploadImagens();
    salvarAutomaticamente();
}

function removerFotoObservacao(botao) {
    const card = botao.closest(".foto-obs-card");
    if (!card) return;

    card.remove();
    salvarAutomaticamente();
}

function salvarFotosObservacoes() {
    const fotos = [];

    document
        .querySelectorAll("#galeria-observacoes .foto-obs-card input[type='file']")
        .forEach(input => {
            if (input.dataset.imagem) fotos.push(input.dataset.imagem);
        });

    localStorage.setItem("fotosObservacoes", JSON.stringify(fotos));
}

function restaurarFotosObservacoes() {
    const fotos = JSON.parse(localStorage.getItem("fotosObservacoes")) || [];

    const galeria = document.getElementById("galeria-observacoes");
    if (!galeria) return;

    galeria.innerHTML = "";
    fotos.forEach(foto => galeria.appendChild(criarCardFotoObservacao(foto)));

    ativarUploadImagens();
}

// ======================================
// AUTO-AJUSTE DE ALTURA DO TEXTAREA
// Garante que o texto digitado nunca fique escondido dentro da
// caixa (nem na tela, nem na hora de imprimir/gerar o PDF)
// ======================================

function autoAjustarTextarea(campo) {
    campo.style.height = "auto";
    campo.style.height = campo.scrollHeight + "px";
}

function ativarAutoAjusteTextareas() {
    document.querySelectorAll("textarea").forEach(campo => {
        autoAjustarTextarea(campo);

        if (campo.dataset.autoAjusteAtivo) return;
        campo.dataset.autoAjusteAtivo = "true";

        campo.addEventListener("input", () => autoAjustarTextarea(campo));
    });
}

// ======================================
// SALVAMENTO E RESTAURAÇÃO DOS CAMPOS DO FORMULÁRIO
// ======================================

function salvarAutomaticamente() {
    const dados = {};

    document.querySelectorAll("input, textarea").forEach(campo => {
        if (campoIgnoravel(campo)) return;

        if (campo.type === "radio") {
            if (campo.checked) dados[campo.name] = campo.value;
            return;
        }

        if (campo.type === "checkbox") {
            dados[campo.id] = campo.checked;
            return;
        }

        if (!campo.id) return;
        dados[campo.id] = campo.value;
    });

    localStorage.setItem("sstAutoSave", JSON.stringify(dados));

    const imagens = [];
    document.querySelectorAll("input[type='file']").forEach(input => {
        imagens.push(input.dataset.imagem || "");
    });
    localStorage.setItem("imagensSST", JSON.stringify(imagens));

    salvarTabelaSetores();
    salvarTabelaExtintores();
    salvarTabelaBanheiros();
    salvarTabelaBebedouros();
    salvarFotosObservacoes();
}

function restaurarDados() {
    const dados = JSON.parse(localStorage.getItem("sstAutoSave"));
    if (!dados) return;

    document.querySelectorAll("input, textarea").forEach(campo => {
        if (campoIgnoravel(campo)) return;

        if (campo.type === "radio") {
            campo.checked = dados[campo.name] === campo.value;
            return;
        }

        if (campo.type === "checkbox") {
            campo.checked = dados[campo.id] || false;
            return;
        }

        if (!campo.id) return;
        campo.value = dados[campo.id] || "";
    });
}

// ======================================
// PDF
// ======================================

function gerarPDF() {
    const botao = document.getElementById("btnGerarPdf");
    const textoOriginal = botao ? botao.textContent : "";

    if (botao) {
        botao.disabled = true;
        botao.textContent = "⏳ Gerando PDF...";
    }

    // Esconde botões e ícones de anexo removendo-os de verdade do
    // layout (display:none) só durante a geração, para não sobrar
    // espaço vazio nem "fantasma" no cálculo de altura do PDF
    const elementosOcultos = areaPDF.querySelectorAll("button, .btn-arquivo");
    const estilosOriginais = [];

    elementosOcultos.forEach(el => {
        estilosOriginais.push(el.style.display);
        el.style.display = "none";
    });

    const restaurar = () => {
        elementosOcultos.forEach((el, indice) => {
            el.style.display = estilosOriginais[indice];
        });

        if (botao) {
            botao.disabled = false;
            botao.textContent = textoOriginal;
        }
    };

    try {
        const { jsPDF } = window.jspdf;

        const documentoPdf = new jsPDF({
            unit: "mm",
            format: "a4",
            orientation: "portrait",
            compress: true
        });

        const larguraPagina = 190; // 210mm (A4) menos 10mm de margem de cada lado

        documentoPdf
            .html(areaPDF, {
                margin: [10, 10, 10, 10],
                autoPaging: "text",
                width: larguraPagina,
                windowWidth: areaPDF.scrollWidth,
                html2canvas: { useCORS: true }
            })
            .then(() => {
                documentoPdf.save("relatorio_sst.pdf");
                restaurar();
            })
            .catch((erro) => {
                console.error("Erro ao gerar PDF:", erro);
                restaurar();
                alert("Não foi possível gerar o PDF. Tente novamente.");
            });
    } catch (erro) {
        console.error("Erro ao gerar PDF:", erro);
        restaurar();
        alert("Não foi possível gerar o PDF. Tente novamente.");
    }
}

// ======================================
// INICIALIZAÇÃO
// ======================================

document.addEventListener("DOMContentLoaded", () => {
    restaurarDados();
    restaurarTabelaSetores();
    restaurarTabelaExtintores();
    ativarUploadImagens();
    restaurarImagens();
    restaurarTabelaBanheiros();
    restaurarTabelaBebedouros();
    restaurarFotosObservacoes();
    ativarAutoAjusteTextareas();

    document.addEventListener("input", salvarAutomaticamente);
    document.addEventListener("change", salvarAutomaticamente);

    document.addEventListener("keyup", (e) => {
        if (e.target.isContentEditable) {
            salvarAutomaticamente();
        }

        if (e.target.matches("#tabela-banheiros td[contenteditable]")) {
            salvarTabelaBanheiros();
        }

        if (e.target.matches("#tabela-bebedouros td[contenteditable]")) {
            salvarTabelaBebedouros();
        }
    });
});