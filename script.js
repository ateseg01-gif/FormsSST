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
// BANHEIROS (3 SEGMENTOS: FOTO EXTERNA, FOTO INTERNA, OBSERVAÇÃO)
// ======================================

function criarLinhaBanheiro(dados = {}) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
        <td class="campo-arquivo-grande upload-slot">
            <label class="btn-arquivo btn-foto-grande">
                📎
                <input type="file" accept="image/*" capture="environment" hidden>
            </label>
        </td>
        <td class="campo-arquivo-grande upload-slot">
            <label class="btn-arquivo btn-foto-grande">
                📎
                <input type="file" accept="image/*" capture="environment" hidden>
            </label>
        </td>
        <td contenteditable="true">${dados.observacao || ""}</td>
        <td><button onclick="removerLinha(this)">X</button></td>
    `;

    const inputs = tr.querySelectorAll("input[type='file']");
    const tds = tr.querySelectorAll(".campo-arquivo-grande");

    // Compatibilidade: se houver dado antigo (dados.imagem), direciona para foto externa
    const fotoExterna = dados.imagemExterna || dados.imagem || "";
    if (fotoExterna && inputs[0] && tds[0]) {
        inputs[0].dataset.imagem = fotoExterna;

        const img = document.createElement("img");
        img.className = "foto-local";
        img.src = fotoExterna;
        img.title = "Clique para trocar a foto";
        img.onclick = () => inputs[0].click();

        tds[0].insertBefore(img, tds[0].firstChild);
    }

    const fotoInterna = dados.imagemInterna || "";
    if (fotoInterna && inputs[1] && tds[1]) {
        inputs[1].dataset.imagem = fotoInterna;

        const img = document.createElement("img");
        img.className = "foto-local";
        img.src = fotoInterna;
        img.title = "Clique para trocar a foto";
        img.onclick = () => inputs[1].click();

        tds[1].insertBefore(img, tds[1].firstChild);
    }

    return tr;
}

function adicionarBanheiro() {
    tabelaBanheiros.appendChild(criarLinhaBanheiro());
    ativarUploadImagens();
    salvarAutomaticamente();
}

function salvarTabelaBanheiros() {
    const banheiros = [];

    document.querySelectorAll("#tabela-banheiros tr").forEach(linha => {
        const inputs = linha.querySelectorAll("input[type='file']");
        const obsCell = linha.cells[2];

        const fotoExterna = inputs[0]?.dataset.imagem || "";
        const fotoInterna = inputs[1]?.dataset.imagem || "";
        const observacao = obsCell ? obsCell.innerText.trim() : "";

        banheiros.push({
            observacao: observacao,
            imagemExterna: fotoExterna,
            imagemInterna: fotoInterna,
            // Mantém campo legado 'imagem' por compatibilidade
            imagem: fotoExterna
        });
    });

    localStorage.setItem("tabelaBanheiros", JSON.stringify(banheiros));
}

function sanitizarTabelaBanheiros() {
    const linhas = document.querySelectorAll("#tabela-banheiros tr");
    linhas.forEach(linha => {
        const inputs = linha.querySelectorAll("input[type='file']");
        // Se a linha tem apenas 1 input de upload (formato legado de 1 foto)
        if (inputs.length === 1) {
            const tdFotoInterna = document.createElement("td");
            tdFotoInterna.className = "campo-arquivo-grande upload-slot";
            tdFotoInterna.innerHTML = `
                <label class="btn-arquivo btn-foto-grande">
                    📎
                    <input type="file" accept="image/*" capture="environment" hidden>
                </label>
            `;
            linha.cells[0].insertAdjacentElement("afterend", tdFotoInterna);
        }
    });
}

function restaurarTabelaBanheiros() {
    const dados = JSON.parse(localStorage.getItem("tabelaBanheiros"));
    if (!dados || dados.length === 0) {
        sanitizarTabelaBanheiros();
        return;
    }

    tabelaBanheiros.innerHTML = "";
    dados.forEach(item => {
        tabelaBanheiros.appendChild(criarLinhaBanheiro(item));
    });

    sanitizarTabelaBanheiros();
    ativarUploadImagens();
}

// ======================================
// TABELAS SIMPLES (BEBEDOUROS)
// Estrutura: foto + observação + remover
// ======================================

function criarLinhaSimples(dados = {}) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
        <td class="campo-arquivo-grande upload-slot">
            <label class="btn-arquivo btn-foto-grande">
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
            observacao: linha.cells[1].innerText.trim(),
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
// SUBSTITUIÇÃO TEMPORÁRIA DE TEXTAREA POR DIV (SÓ NA GERAÇÃO DO PDF)
// ======================================

// Cria uma <div> "gêmea" de cada <textarea>, com o mesmo texto e o
// mesmo visual (fonte, espaçamento, borda), e a coloca no lugar da
// textarea antes da captura do html2canvas.
function substituirTextareasPorDivs(container) {
    const substituicoes = [];

    container.querySelectorAll("textarea").forEach(textarea => {
        const estilo = window.getComputedStyle(textarea);
        const div = document.createElement("div");

        // pre-wrap preserva as quebras de linha que o usuário digitou
        // e ainda quebra automaticamente linhas compridas, igual a textarea
        div.style.whiteSpace = "pre-wrap";
        div.style.wordBreak = "break-word";
        div.style.boxSizing = estilo.boxSizing;
        div.style.width = estilo.width;
        div.style.minHeight = estilo.minHeight;
        div.style.padding = estilo.padding;
        div.style.border = estilo.border;
        div.style.borderRadius = estilo.borderRadius;
        div.style.fontFamily = estilo.fontFamily;
        div.style.fontSize = estilo.fontSize;
        div.style.lineHeight = estilo.lineHeight;
        div.style.color = estilo.color;
        div.style.backgroundColor = estilo.backgroundColor;

        div.textContent = textarea.value || "";

        textarea.insertAdjacentElement("afterend", div);
        textarea.style.display = "none";

        substituicoes.push({ textarea, div });
    });

    return substituicoes;
}

// Remove as divs temporárias e devolve as textareas editáveis ao normal
function restaurarTextareas(substituicoes) {
    substituicoes.forEach(({ textarea, div }) => {
        div.remove();
        textarea.style.display = "";
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

    // Salva a posição de rolagem e posiciona a página no topo para
    // que a captura do html2canvas e as coordenadas do DOM fiquem 100% alinhadas
    const scrollAnteriorX = window.scrollX || window.pageXOffset || 0;
    const scrollAnteriorY = window.scrollY || window.pageYOffset || 0;
    window.scrollTo(0, 0);

    // Esconde botões e ícones de anexo removendo-os de verdade do
    // layout (display:none) só durante a geração, para não sobrar
    // espaço vazio nem "fantasma" no cálculo de altura do PDF
    const elementosOcultos = areaPDF.querySelectorAll("button, .btn-arquivo, .btn-foto-grande, .btn-remover-foto");
    const estilosOriginais = [];

    elementosOcultos.forEach(el => {
        estilosOriginais.push(el.style.display);
        el.style.display = "none";
    });

    // Se a tela for menor que a largura padrão de impressão/desktop (1024px),
    // ajusta temporariamente para largura desktop para que o PDF gerado em
    // celulares e tablets fique idêntico, estruturado e com a mesma qualidade do PC
    const larguraDesktop = 1024;
    const isMobile = window.innerWidth < larguraDesktop;
    const larguraOriginalArea = areaPDF.style.width;
    const maxLarguraOriginalArea = areaPDF.style.maxWidth;

    if (isMobile) {
        areaPDF.style.width = larguraDesktop + "px";
        areaPDF.style.maxWidth = larguraDesktop + "px";
    }

    // O html2canvas não desenha corretamente o texto de <textarea>
    // (usa seu próprio cálculo de quebra de linha, diferente do
    // navegador). Solução: trocar temporariamente cada textarea por uma
    // <div> com o mesmo texto e mesmo estilo — divs são renderizadas com fidelidade.
    const substituicoesTextarea = substituirTextareasPorDivs(areaPDF);

    const restaurar = () => {
        elementosOcultos.forEach((el, indice) => {
            el.style.display = estilosOriginais[indice];
        });

        restaurarTextareas(substituicoesTextarea);

        if (isMobile) {
            areaPDF.style.width = larguraOriginalArea;
            areaPDF.style.maxWidth = maxLarguraOriginalArea;
        }

        window.scrollTo(scrollAnteriorX, scrollAnteriorY);

        if (botao) {
            botao.disabled = false;
            botao.textContent = textoOriginal;
        }
    };

    // Dá tempo do navegador aplicar o display:none acima (reflow) antes
    // de "tirar a foto" da tela
    requestAnimationFrame(() => requestAnimationFrame(() => {
        const escala = 2; // resolução da captura (mantém o PDF nítido)

        html2canvas(areaPDF, {
            scale: escala,
            useCORS: true,
            logging: false,
            scrollX: 0,
            scrollY: 0,
            width: isMobile ? larguraDesktop : areaPDF.offsetWidth,
            windowWidth: isMobile ? larguraDesktop : (document.documentElement.clientWidth || areaPDF.scrollWidth)
        })
            .then((canvas) => {
                montarPdfComQuebrasSeguras(canvas);
                restaurar();
            })
            .catch((erro) => {
                console.error("Erro ao gerar PDF:", erro);
                restaurar();
                alert("Não foi possível gerar o PDF. Tente novamente.");
            });
    }));
}

// Fatiamento do canvas em páginas A4 com cálculo de quebra segura baseado
// nas posições reais dos elementos no DOM, impedindo que linhas de tabelas,
// blocos de fotos e observações sejam cortados horizontalmente ao meio.
function montarPdfComQuebrasSeguras(canvas) {
    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });

    const margem = 10;
    const larguraUtil = 210 - margem * 2;
    const alturaUtilMm = 297 - margem * 2;

    const pxPorMm = canvas.width / larguraUtil;
    const alturaPaginaPx = alturaUtilMm * pxPorMm;

    // Fator de escala vertical real entre a altura capturada no canvas e a altura do elemento no DOM
    const alturaDom = areaPDF.getBoundingClientRect().height || areaPDF.offsetHeight;
    const fatorEscalaY = alturaDom > 0 ? (canvas.height / alturaDom) : 2;

    const quebrasSeguras = calcularQuebrasSeguras(areaPDF, fatorEscalaY);

    let yAtual = 0;
    let primeiraPagina = true;

    while (yAtual < canvas.height - 1) {
        let limitePagina = Math.min(yAtual + alturaPaginaPx, canvas.height);

        if (limitePagina < canvas.height) {
            // Procura o ponto de corte seguro mais próximo do limite da página, sem ultrapassá-lo.
            // Exige que o ponto avance pelo menos 30px em relação a yAtual para evitar páginas vazias ou loops.
            const candidatos = quebrasSeguras.filter(q => q > yAtual + 30 && q <= limitePagina);
            if (candidatos.length > 0) {
                limitePagina = candidatos[candidatos.length - 1];
            }
        }

        const alturaFatiaPx = Math.max(1, Math.round(limitePagina - yAtual));

        const canvasFatia = document.createElement("canvas");
        canvasFatia.width = canvas.width;
        canvasFatia.height = alturaFatiaPx;

        canvasFatia.getContext("2d").drawImage(
            canvas,
            0, yAtual, canvas.width, alturaFatiaPx,
            0, 0, canvas.width, alturaFatiaPx
        );

        const imagemFatia = canvasFatia.toDataURL("image/jpeg", 0.90);
        const alturaFatiaMm = alturaFatiaPx / pxPorMm;

        if (!primeiraPagina) pdf.addPage();
        pdf.addImage(imagemFatia, "JPEG", margem, margem, larguraUtil, alturaFatiaMm);

        primeiraPagina = false;
        yAtual = limitePagina;
    }

    pdf.save("relatorio_sst.pdf");
}

// Lista, em pixels reais da imagem gerada no canvas, todas as posições
// onde é seguro realizar a quebra de página:
// - Início e fim de seções (.container)
// - Topo de tabelas (para manter cabeçalho junto à primeira linha)
// - Linhas inteiras de tabelas (tbody tr), mantendo fotos e observações sempre juntas
// - Cards individuais de fotos da galeria (.foto-obs-card)
function calcularQuebrasSeguras(container, fatorEscalaY) {
    const topoContainer = container.getBoundingClientRect().top;
    const quebras = new Set([0]);

    // 1. Início e fim de cada seção (.container)
    container.querySelectorAll(".container").forEach(el => {
        const rect = el.getBoundingClientRect();
        const topo = Math.round((rect.top - topoContainer) * fatorEscalaY);
        const fundo = Math.round((rect.bottom - topoContainer) * fatorEscalaY);

        if (topo > 0) quebras.add(topo);
        if (fundo > 0) quebras.add(fundo);
    });

    // 2. Linhas de tabelas (tbody tr): nunca cortar uma linha ou fotografia ao meio
    container.querySelectorAll("table").forEach(tabela => {
        const rectTabela = tabela.getBoundingClientRect();
        const topoTabela = Math.round((rectTabela.top - topoContainer) * fatorEscalaY);
        if (topoTabela > 0) quebras.add(topoTabela);

        const linhasCorpo = tabela.querySelectorAll("tbody tr");
        linhasCorpo.forEach((linha, indice) => {
            const rect = linha.getBoundingClientRect();
            const topoLinha = Math.round((rect.top - topoContainer) * fatorEscalaY);
            const fundoLinha = Math.round((rect.bottom - topoContainer) * fatorEscalaY);

            // Para a primeira linha, preferir quebrar antes da tabela para não deixar
            // o thead isolado no rodapé da página anterior
            if (indice > 0 && topoLinha > 0) {
                quebras.add(topoLinha);
            }
            if (fundoLinha > 0) {
                quebras.add(fundoLinha);
            }
        });
    });

    // 3. Cards individuais da galeria de fotos de observações
    container.querySelectorAll(".foto-obs-card").forEach(card => {
        const rect = card.getBoundingClientRect();
        const topo = Math.round((rect.top - topoContainer) * fatorEscalaY);
        const fundo = Math.round((rect.bottom - topoContainer) * fatorEscalaY);

        if (topo > 0) quebras.add(topo);
        if (fundo > 0) quebras.add(fundo);
    });

    return Array.from(quebras).sort((a, b) => a - b);
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
    sanitizarTabelaBanheiros();
    ativarUploadImagens();
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