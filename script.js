// ======================================
// LEVANTAMENTO AMBIENTAL SST
// Desenvolvido por Izabelly
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


    const elementosOcultos = areaPDF.querySelectorAll("button, .btn-arquivo");
    const estilosOriginais = [];

    elementosOcultos.forEach(el => {
        estilosOriginais.push(el.style.display);
        el.style.display = "none";
    });


    const substituicoesTextarea = substituirTextareasPorDivs(areaPDF);

    const restaurar = () => {
        elementosOcultos.forEach((el, indice) => {
            el.style.display = estilosOriginais[indice];
        });

        restaurarTextareas(substituicoesTextarea);

        if (botao) {
            botao.disabled = false;
            botao.textContent = textoOriginal;
        }
    };


    requestAnimationFrame(() => requestAnimationFrame(() => {
        const escala = 2; // resolução da captura (mantém o PDF nítido)

        html2canvas(areaPDF, {
            scale: escala,
            useCORS: true,
            windowWidth: areaPDF.scrollWidth
        })
            .then((canvas) => {
                montarPdfComQuebrasSeguras(canvas, escala);
                restaurar();
            })
            .catch((erro) => {
                console.error("Erro ao gerar PDF:", erro);
                restaurar();
                alert("Não foi possível gerar o PDF. Tente novamente.");
            });
    }));
}


function montarPdfComQuebrasSeguras(canvas, escala) {
    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });

    const margem = 10;
    const larguraUtil = 210 - margem * 2;
    const alturaUtilMm = 297 - margem * 2;

    const pxPorMm = canvas.width / larguraUtil;
    const alturaPaginaPx = alturaUtilMm * pxPorMm;

    const quebrasSeguras = calcularQuebrasSeguras(areaPDF, escala);

    let yAtual = 0;
    let primeiraPagina = true;

    while (yAtual < canvas.height - 1) {
        let limitePagina = Math.min(yAtual + alturaPaginaPx, canvas.height);

        if (limitePagina < canvas.height) {
            // Procura o ponto de corte seguro mais próximo do limite da
            // página, sem ultrapassá-lo. Se não achar nenhum (ex: uma
            // seção maior que uma página inteira), corta no limite mesmo.
            const candidatos = quebrasSeguras.filter(q => q > yAtual + 5 && q <= limitePagina);
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

        const imagemFatia = canvasFatia.toDataURL("image/jpeg", 0.85);
        const alturaFatiaMm = alturaFatiaPx / pxPorMm;

        if (!primeiraPagina) pdf.addPage();
        pdf.addImage(imagemFatia, "JPEG", margem, margem, larguraUtil, alturaFatiaMm);

        primeiraPagina = false;
        yAtual = limitePagina;
    }

    pdf.save("relatorio_sst.pdf");
}


function calcularQuebrasSeguras(container, fatorEscala) {
    const elementos = container.querySelectorAll(".container, tr, .foto-obs-card");
    const topoContainer = container.getBoundingClientRect().top;

    const quebras = new Set([0]);

    elementos.forEach(el => {
        const rect = el.getBoundingClientRect();
        quebras.add(Math.round((rect.top - topoContainer) * fatorEscala));
        quebras.add(Math.round((rect.bottom - topoContainer) * fatorEscala));
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
