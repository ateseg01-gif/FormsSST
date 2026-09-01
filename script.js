// ======================================
// LEVANTAMENTO AMBIENTAL SST
// Desenvolvido por Izabelly
// Versão 1.4 (imagens migradas para IndexedDB)
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

    // Evita deixar imagens órfãs no IndexedDB/localStorage quando a
    // linha (e as fotos associadas a ela) são removidas.
    linha.querySelectorAll("input[type='file']").forEach(input => {
        if (input.dataset.imgId) removerImagem(input.dataset.imgId);
    });

    linha.remove();
    atualizarNumeracao();
    salvarAutomaticamente();
}

function campoIgnoravel(campo) {
    return campo.type === "file" || campo.type === "button" || campo.type === "submit";
}

// ======================================
// ARMAZENAMENTO DE IMAGENS (IndexedDB, com fallback em localStorage)
// Cada foto é identificada por um ID estável (data-img-id no input),
// gerado uma única vez e reaproveitado enquanto a foto existir.
// Isso evita depender da posição do campo na página para restaurar
// a imagem correta (o que quebrava ao adicionar/remover linhas).
// ======================================

const DB_NOME = "levantamentoSST";
const DB_VERSAO = 1;
const STORE_IMAGENS = "imagens";
const CHAVE_FALLBACK_IMAGENS = "imagensFallbackSST";
const CHAVE_LEGADO_POSICIONAL = "imagensSST";

let indexedDBDisponivel = "indexedDB" in window;
let dbPromise = null;

function gerarIdImagem() {
    if (window.crypto && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return "img-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}

function abrirBanco() {
    if (!indexedDBDisponivel) {
        return Promise.reject(new Error("IndexedDB indisponível neste navegador."));
    }

    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        let requisicao;

        try {
            requisicao = indexedDB.open(DB_NOME, DB_VERSAO);
        } catch (erro) {
            indexedDBDisponivel = false;
            reject(erro);
            return;
        }

        requisicao.onupgradeneeded = () => {
            const db = requisicao.result;
            if (!db.objectStoreNames.contains(STORE_IMAGENS)) {
                db.createObjectStore(STORE_IMAGENS);
            }
        };

        requisicao.onsuccess = () => resolve(requisicao.result);

        requisicao.onerror = () => {
            indexedDBDisponivel = false;
            reject(requisicao.error);
        };

        requisicao.onblocked = () => {
            console.warn("Abertura do IndexedDB bloqueada (outra aba pode estar usando uma versão antiga do banco).");
        };
    });

    return dbPromise;
}

function salvarImagemIDB(id, blob) {
    return abrirBanco().then(db => new Promise((resolve, reject) => {
        const transacao = db.transaction(STORE_IMAGENS, "readwrite");
        transacao.objectStore(STORE_IMAGENS).put(blob, id);
        transacao.oncomplete = () => resolve();
        transacao.onerror = () => reject(transacao.error);
    }));
}

function obterImagemIDB(id) {
    return abrirBanco().then(db => new Promise((resolve, reject) => {
        const transacao = db.transaction(STORE_IMAGENS, "readonly");
        const requisicao = transacao.objectStore(STORE_IMAGENS).get(id);
        requisicao.onsuccess = () => resolve(requisicao.result || null);
        requisicao.onerror = () => reject(requisicao.error);
    }));
}

function removerImagemIDB(id) {
    return abrirBanco().then(db => new Promise((resolve, reject) => {
        const transacao = db.transaction(STORE_IMAGENS, "readwrite");
        transacao.objectStore(STORE_IMAGENS).delete(id);
        transacao.oncomplete = () => resolve();
        transacao.onerror = () => reject(transacao.error);
    }));
}

// Converte a dataURL (base64) já comprimida em Blob, para não guardar
// a imagem como uma string enorme dentro do IndexedDB.
function dataURLParaBlob(dataUrl) {
    const [cabecalho, base64] = dataUrl.split(",");
    const mimeEncontrado = cabecalho.match(/:(.*?);/);
    const mime = mimeEncontrado ? mimeEncontrado[1] : "image/jpeg";

    const binario = atob(base64);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) {
        bytes[i] = binario.charCodeAt(i);
    }

    return new Blob([bytes], { type: mime });
}

function obterMapaFallback() {
    try {
        return JSON.parse(localStorage.getItem(CHAVE_FALLBACK_IMAGENS)) || {};
    } catch (erro) {
        return {};
    }
}

function salvarImagemFallback(id, dataUrl) {
    const mapa = obterMapaFallback();
    mapa[id] = dataUrl;

    try {
        localStorage.setItem(CHAVE_FALLBACK_IMAGENS, JSON.stringify(mapa));
    } catch (erro) {
        console.warn("Não foi possível salvar a imagem no localStorage (reserva):", erro);
    }
}

function removerImagemFallback(id) {
    const mapa = obterMapaFallback();
    if (id in mapa) {
        delete mapa[id];
        try {
            localStorage.setItem(CHAVE_FALLBACK_IMAGENS, JSON.stringify(mapa));
        } catch (erro) {
            console.warn("Não foi possível atualizar o localStorage (reserva):", erro);
        }
    }
}

function obterImagemFallback(id) {
    return obterMapaFallback()[id] || null;
}

// Salva a imagem (dataURL já comprimida) usando o IndexedDB; se ele
// não existir ou falhar, usa o localStorage como reserva.
async function salvarImagem(id, dataUrl) {
    if (!indexedDBDisponivel) {
        salvarImagemFallback(id, dataUrl);
        return;
    }

    try {
        const blob = dataURLParaBlob(dataUrl);
        await salvarImagemIDB(id, blob);
    } catch (erro) {
        console.warn("Falha ao salvar imagem no IndexedDB, usando localStorage como reserva:", erro);
        salvarImagemFallback(id, dataUrl);
    }
}

// Retorna uma URL utilizável em <img src>: tenta o IndexedDB primeiro
// (via URL.createObjectURL) e cai para o localStorage se necessário.
async function obterImagemPorId(id) {
    if (indexedDBDisponivel) {
        try {
            const blob = await obterImagemIDB(id);
            if (blob) return URL.createObjectURL(blob);
        } catch (erro) {
            console.warn("Falha ao ler imagem do IndexedDB, tentando reserva:", erro);
        }
    }

    return obterImagemFallback(id);
}

function removerImagem(id) {
    if (indexedDBDisponivel) {
        removerImagemIDB(id).catch(erro =>
            console.warn("Falha ao remover imagem do IndexedDB:", erro)
        );
    }
    removerImagemFallback(id);
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

// Exibe a imagem no container e prepara o clique para trocar a foto.
// Libera a URL temporária anterior (blob:) antes de trocar, para não
// acumular URLs penduradas na memória da página.
function exibirImagemNoContainer(container, src, input) {
    const img = criarOuObterImagem(container);

    if (img.src && img.src.startsWith("blob:")) {
        URL.revokeObjectURL(img.src);
    }

    img.src = src;
    img.title = "Clique para trocar a foto";
    img.onclick = () => input.click();
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

                const container = this.closest(".upload-slot");
                if (!container) return;

                // Mostra a imagem imediatamente na tela, como antes.
                exibirImagemNoContainer(container, imagemBase64, this);

                // Mantém o mesmo ID se já existir (troca de foto no mesmo
                // campo) para não deixar a versão antiga órfã no banco.
                const imgId = this.dataset.imgId || gerarIdImagem();
                this.dataset.imgId = imgId;

                try {
                    await salvarImagem(imgId, imagemBase64);
                } catch (erro) {
                    console.warn("Falha ao salvar imagem:", erro);
                }

                salvarAutomaticamente();
            };

            leitor.readAsDataURL(arquivo);
        });
    });
}

// Restaura todas as fotos da página a partir do IndexedDB (ou da
// reserva em localStorage), usando o ID estável de cada campo.
// Também migra, de forma automática e silenciosa, dados salvos no
// formato antigo (antes desta versão):
//   - setores/extintores: array posicional "imagensSST";
//   - banheiros/bebedouros/observações: base64 embutido no próprio
//     item (dataset "legado", preenchido por criarLinhaSimples /
//     criarCardFotoObservacao).
async function restaurarImagens() {
    let legadoPosicional = [];
    try {
        legadoPosicional = JSON.parse(localStorage.getItem(CHAVE_LEGADO_POSICIONAL)) || [];
    } catch (erro) {
        legadoPosicional = [];
    }

    const inputs = document.querySelectorAll("input[type='file']");
    let precisaResalvar = false;

    for (let indice = 0; indice < inputs.length; indice++) {
        const input = inputs[indice];
        const container = input.closest(".upload-slot");
        if (!container) continue;

        if (input.dataset.imgId) {
            try {
                const src = await obterImagemPorId(input.dataset.imgId);
                if (src) exibirImagemNoContainer(container, src, input);
            } catch (erro) {
                console.warn("Erro ao restaurar imagem:", erro);
            }
            continue;
        }

        // Sem ID ainda: pode ser um dado salvo no formato antigo.
        let imagemParaMigrar = null;

        if (input.dataset.legado) {
            imagemParaMigrar = input.dataset.legado;
            delete input.dataset.legado;
        } else if (legadoPosicional[indice]) {
            imagemParaMigrar = legadoPosicional[indice];
        }

        if (!imagemParaMigrar) continue;

        const novoId = gerarIdImagem();
        input.dataset.imgId = novoId;
        exibirImagemNoContainer(container, imagemParaMigrar, input);

        try {
            await salvarImagem(novoId, imagemParaMigrar);
            precisaResalvar = true;
        } catch (erro) {
            console.warn("Falha ao migrar imagem antiga:", erro);
        }
    }

    if (precisaResalvar) {
        // Depois de migrar, a chave antiga não é mais necessária e as
        // tabelas são regravadas já no formato novo (por ID).
        localStorage.removeItem(CHAVE_LEGADO_POSICIONAL);
        salvarAutomaticamente();
    }
}

// ======================================
// CAMPO DE ARQUIVO (usado por setores e extintores)
// ======================================

function campoComArquivo(valor, imgId) {
    return `
        <div contenteditable="true" class="editavel">${valor || ""}</div>
        <label class="btn-arquivo">
            📎
            <input type="file" accept="image/*" capture="environment" hidden${imgId ? ` data-img-id="${imgId}"` : ""}>
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
            <td class="campo-arquivo upload-slot">${campoComArquivo(dados.local, dados.imgIdLocal)}</td>
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
            observacao: colunas[5].innerText,
            imgIdLocal: colunas[1].querySelector("input[type='file']")?.dataset.imgId || ""
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
            <td class="campo-arquivo upload-slot">${campoComArquivo(dados.lux, dados.imgIdLux)}</td>
            <td class="campo-arquivo upload-slot">${campoComArquivo(dados.ruido, dados.imgIdRuido)}</td>
            <td class="campo-arquivo upload-slot">${campoComArquivo(dados.temperatura, dados.imgIdTemperatura)}</td>
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
            observacao: colunas[6].innerText,
            imgIdLux: colunas[3].querySelector("input[type='file']")?.dataset.imgId || "",
            imgIdRuido: colunas[4].querySelector("input[type='file']")?.dataset.imgId || "",
            imgIdTemperatura: colunas[5].querySelector("input[type='file']")?.dataset.imgId || ""
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

    const input = tr.querySelector("input[type='file']");

    if (dados.imgId) {
        // Formato novo: apenas o ID estável, a imagem é restaurada
        // depois via restaurarImagens().
        input.dataset.imgId = dados.imgId;
    } else if (dados.imagem) {
        // Formato antigo (base64 embutido no item). Guardamos
        // temporariamente para restaurarImagens() migrar para o
        // IndexedDB e trocar pelo ID estável.
        input.dataset.legado = dados.imagem;
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
            imgId: linha.querySelector("input[type='file']")?.dataset.imgId || ""
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

function criarCardFotoObservacao(valor = "") {
    const card = document.createElement("div");
    card.className = "foto-obs-card upload-slot";

    card.innerHTML = `
        <button type="button" class="btn-remover-foto" onclick="removerFotoObservacao(this)" title="Remover foto">×</button>
        <label class="btn-arquivo">
            📎
            <input type="file" accept="image/*" capture="environment" hidden>
        </label>
    `;

    const input = card.querySelector("input[type='file']");

    if (valor) {
        if (String(valor).startsWith("data:")) {
            // Formato antigo (base64 direto) - migrado por restaurarImagens().
            input.dataset.legado = valor;
        } else {
            // Formato novo: ID estável.
            input.dataset.imgId = valor;
        }
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

    const input = card.querySelector("input[type='file']");
    if (input?.dataset.imgId) removerImagem(input.dataset.imgId);

    card.remove();
    salvarAutomaticamente();
}

function salvarFotosObservacoes() {
    const fotos = [];

    document
        .querySelectorAll("#galeria-observacoes .foto-obs-card input[type='file']")
        .forEach(input => {
            if (input.dataset.imgId) fotos.push(input.dataset.imgId);
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

    // As imagens não são mais salvas aqui: cada uma vai para o
    // IndexedDB (ou reserva em localStorage) no momento do upload,
    // e cada tabela guarda apenas o ID estável da foto.
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

    // Esconde botões e ícones de anexo removendo-os de verdade do
    // layout (display:none) só durante a geração, para não sobrar
    // espaço vazio nem "fantasma" no cálculo de altura do PDF
    const elementosOcultos = areaPDF.querySelectorAll("button, .btn-arquivo");
    const estilosOriginais = [];

    elementosOcultos.forEach(el => {
        estilosOriginais.push(el.style.display);
        el.style.display = "none";
    });

    // O html2canvas não desenha corretamente o texto de <textarea>
    // (usa seu próprio cálculo de quebra de linha, diferente do
    // navegador), o que fazia trechos das Observações Gerais sumirem
    // ou saírem cortados no PDF. Solução: trocar temporariamente cada
    // textarea por uma <div> com o mesmo texto e mesmo estilo — divs
    // são renderizadas com fidelidade — e desfazer a troca depois.
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

    // Dá tempo do navegador aplicar o display:none acima (reflow) antes
    // de "tirar a foto" da tela. Sem isso, em telas mais lentas o
    // html2canvas às vezes captura o layout no meio da troca de estilo,
    // e o ícone 📎 (que a fonte do PDF não sabe desenhar) aparece
    // corrompido como "Ø=ÜÎ" no relatório final.
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

// Em vez de deixar o jsPDF "reconstruir" o texto página a página
// (autoPaging: "text" — a causa das colunas desalinhadas e cabeçalhos
// bugados em relatórios maiores), tiramos UMA captura fiel do relatório
// inteiro e fatiamos essa imagem em páginas A4, sempre cortando em um
// ponto seguro: nunca no meio de uma linha de tabela, de uma foto ou
// de uma seção.
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

// Lista, em pixels da captura (canvas), todas as posições onde é seguro
// cortar a página: início e fim de cada seção (.container), de cada
// linha de tabela (tr) e de cada foto da galeria de observações
// (.foto-obs-card). Assim o corte de página nunca cai no meio desses
// elementos.
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
    restaurarTabelaBanheiros();
    restaurarTabelaBebedouros();
    restaurarFotosObservacoes();
    ativarUploadImagens();

    // Executa por último, depois que todas as linhas/cards já existem
    // no DOM, para poder restaurar (e, se necessário, migrar) a foto
    // de cada campo pelo seu ID estável.
    restaurarImagens();

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
