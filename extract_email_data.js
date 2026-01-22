// Email Data Extractor - Extrai dados de resumo/email do Salesforce
// Para criar o bookmarklet, copie o conteúdo de bookmarklet_email.txt

javascript: (function () {
    // === 1. ARMAZENAMENTO PREVENTIVO DE DADOS DO EMAIL ===
    // Capturamos o HTML agora caso a navegação esconda o resumo do email
    const initialHtml = document.body.innerHTML;

    // === 2. FUNÇÕES DE AUTOMAÇÃO (Solicitado pelo usuário) ===
    function findTargetDeep(selector, root = document) {
        let el = root.querySelector(selector);
        if (el) return el;

        let all = root.querySelectorAll('*');
        for (let node of all) {
            if (node.shadowRoot) {
                let found = findTargetDeep(selector, node.shadowRoot);
                if (found) return found;
            }
        }
        return null;
    }

    function clickElement(selector, nomeAmigavel) {
        let target = findTargetDeep(selector);
        if (target) {
            console.log(`[${nomeAmigavel}] Elemento encontrado. Clicando...`);
            target.click();
            return true;
        } else {
            console.warn(`[${nomeAmigavel}] Elemento não encontrado (${selector})`);
            return false;
        }
    }

    function runAutoScroll(onComplete) {
        console.log('>> Iniciando Scroll Down...');
        let noChangeCount = 0;
        const scrollInterval = setInterval(() => {
            const previousScrollTop = document.documentElement.scrollTop || document.body.scrollTop;
            window.scrollBy(0, 500);
            const currentScrollTop = document.documentElement.scrollTop || document.body.scrollTop;

            if (Math.abs(currentScrollTop - previousScrollTop) < 1) {
                noChangeCount++;
                if (noChangeCount >= 3) {
                    clearInterval(scrollInterval);
                    console.log('✅ Scroll finalizado! Chegou ao final da página.');
                    if (onComplete) onComplete();
                }
            } else {
                noChangeCount = 0;
            }
        }, 800); // 
    }

    // Função Principal de Extração (código original encapsulado)
    function runExtraction() {
        // Remove painel anterior se existir
        const oldPanel = document.getElementById('email-extractor-panel');
        if (oldPanel) { oldPanel.remove(); return; }

        // === ESTRATÉGIA: BUSCAR O BLOCO DO EMAIL DO CONSUMIDOR ===
        let htmlToSearch = initialHtml || document.body.innerHTML;

        // Limpa tags HTML primeiro para facilitar a busca
        let cleanedHtml = htmlToSearch.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

        // Padrões para encontrar início do email do consumidor
        // Emails externos sempre começam com este marcador
        const startPatterns = [
            /This message is from an EXTERNAL SENDER/i,
            /Olá,?\s*\w+\.?\s*Conforme solicitado/i,
            /Conforme solicitado,?\s*seguem/i,
            /Informações sobre o bebê:/i,
            /Informações sobre o produto:/i,
            /Possui o produto afetado/i,
            /Você ainda possui o produto afetado/i
        ];

        // Padrões para encontrar fim do email
        const endPatterns = [
            /Atenciosamente,?\s*[\w\s]+$/i,
            /Fico à disposição[^]*?$/i,
            /Aguardo[^]*?orientações[^]*?$/i,
            /Chave Pix \(se disponível\)[^]*?$/i, // Stop no último campo se não tiver despedida
            /Divisão General/i, // UI Salesforce
            /Modificado pela última vez/i // UI Salesforce
        ];

        let emailStart = -1;
        let emailEnd = cleanedHtml.length;

        // Encontra o início
        for (const pattern of startPatterns) {
            const match = cleanedHtml.match(pattern);
            if (match) {
                emailStart = cleanedHtml.indexOf(match[0]);
                break;
            }
        }

        // Se não encontrou início específico, tenta buscar por dados estruturados
        if (emailStart === -1) {
            // Fallback: busca por padrão de dados pessoais do consumidor
            const dataMatch = cleanedHtml.match(/(?:CPF|Data de nascimento)[^:]*:\s*\d/i);
            if (dataMatch) {
                // Volta um pouco para pegar contexto
                emailStart = Math.max(0, cleanedHtml.indexOf(dataMatch[0]) - 500);
            }
        }

        // Encontra o fim
        for (const pattern of endPatterns) {
            const match = cleanedHtml.substring(emailStart > 0 ? emailStart : 0).match(pattern);
            if (match) {
                emailEnd = (emailStart > 0 ? emailStart : 0) + cleanedHtml.substring(emailStart > 0 ? emailStart : 0).indexOf(match[0]) + match[0].length;
                break;
            }
        }

        let text = '';
        if (emailStart >= 0) {
            text = cleanedHtml.substring(emailStart, emailEnd).trim();
        }

        if (!text || text.length < 50) {
            alert('❌ Bloco de email do consumidor não encontrado.\n\nCertifique-se de estar na página correta com o resumo do email.');
            return;
        }

        console.log('📧 Texto extraído do email:', text.substring(0, 200) + '...');

        // Função de extração básica
        const extract = (pattern) => {
            const m = text.match(pattern);
            return m && m[1] ? m[1].trim() : '';
        };

        // Função extract que aceita o texto fonte
        const extractFrom = (source, pattern) => {
            const m = source.match(pattern);
            return m && m[1] ? m[1].trim() : '';
        };

        // === EXTRAÇÃO DOS DADOS ===
        // Regex genérico para parar quando encontrar outro campo conhecido ou quebra de linha dupla
        // Lista de labels conhecidos para lookahead (ambos formatos)
        const labels = [
            // Formato 2 - Seções estruturadas
            'Informações sobre o bebê', 'Idade do bebê', 'Atendimento médico',
            'Informações sobre o produto', 'Possui o produto afetado', 'Produto e peso', 'Quantidade', 'Local da compra', 'Endereço', 'Valor pago',
            'Imagens anexadas', 'Dados pessoais', 'Data de nascimento', 'CPF',
            'Dados bancários', 'Nome', 'Instituição', 'Agência', 'Conta', 'Tipo de conta',
            'Chaves Pix', 'Celular', 'Chave aleatória', 'Chave Pix',
            // Formato 1 - Campos diretos
            'Você ainda possui o produto afetado', 'Qual o produto', 'Qual a quantidade',
            'Qual o local da compra', 'Qual foi o valor pago', 'Nome completo',
            'Telefone com', 'Banco', 'Tipo de conta \\(corrente ou poupança\\)',
            'Atenciosamente', 'Fico à disposição',
            'Divisão', 'Modificado pela', 'Marca', 'Origem do caso', 'Fonte do site',
            'Abaixo segue', 'Segue as fotos', 'Imagens anexadas', 'Em .* escreveu'
        ].join('|');

        const stopPattern = `(?=\\s*(?:${labels})|\\s*\\n\\s*\\n|$)`;

        // === DETECÇÃO DE FORMATO ===
        // Formato 1: Campos com "Qual" e perguntas diretas
        // Formato 2: Seções como "Informações sobre o produto:"
        const isFormato1 = /Você ainda possui o produto afetado|Qual o produto e peso|Nome completo:/i.test(text);
        const isFormato2 = /Informações sobre o bebê:|Informações sobre o produto:|Chaves Pix disponíveis:/i.test(text);

        console.log(`📋 Formato detectado: ${isFormato1 ? 'Formato 1 (direto)' : ''} ${isFormato2 ? 'Formato 2 (estruturado)' : ''}`);

        // === SCOPED EXTRACTION (Formato 2) ===
        // Define escopos de texto para evitar conflitos com UI (ex: "Quantidade" fora do email)
        let produtoText = text;
        let pessoaisText = text;
        let bancariosText = text;
        let bebeText = text;

        if (isFormato2) {
            // Helper para extrair bloco
            const getBlock = (startRegex, endRegex) => {
                const startMatch = text.match(startRegex);
                if (!startMatch) return text; // Fallback
                const startIndex = startMatch.index;
                const rest = text.substring(startIndex);
                const endMatch = rest.match(endRegex);
                return endMatch ? rest.substring(0, endMatch.index) : rest;
            };

            bebeText = getBlock(/Informações sobre o bebê:/i, /Informações sobre o produto:|Dados pessoais:|$/i);
            produtoText = getBlock(/Informações sobre o produto:/i, /Imagens anexadas:|Dados pessoais:|Dados bancários:|$/i);
            pessoaisText = getBlock(/Dados pessoais:/i, /Dados bancários:|Chaves Pix|$/i);
            bancariosText = getBlock(/Dados bancários|Chaves Pix/i, /Atenciosamente|Fico à disposição|$/i);

            // Debug
            // console.log('📦 Escopo Produto:', produtoText);
        }

        // === DADOS DO BEBÊ (Formato 2 apenas) ===
        const dadosBebe = {};
        if (isFormato2) {
            dadosBebe['Idade Bebê'] = extractFrom(bebeText, new RegExp(`Idade do bebê[^:]*:\\s*([\\s\\S]+?)${stopPattern}`, 'i'));
            dadosBebe['Atend. Médico'] = extractFrom(bebeText, new RegExp(`Atendimento médico[^:]*:\\s*([\\s\\S]+?)${stopPattern}`, 'i'));
        }

        // === DADOS DO PRODUTO (ambos formatos) ===
        const dadosProduto = {};

        // Formato 1: "Você ainda possui o produto afetado?"
        // Formato 2: "Possui o produto afetado:"
        dadosProduto['Possui Produto'] = extractFrom(produtoText, new RegExp(`(?:Você ainda possui o produto afetado|Possui o produto afetado)[^:]*[?:]?\\s*(SIM|NÃO|NAO|Sim|Não|sim|não)`, 'i'));

        // Formato 1: "Qual o produto e peso da embalagem?"
        // Formato 2: "Produto e peso da embalagem:"
        // Ajuste Formato 1: Para antes da próxima pergunta "Qual a quantidade"
        if (isFormato1) {
            dadosProduto['Produto/Peso'] = extractFrom(produtoText, new RegExp(`Qual o produto e peso da embalagem[^?]*[?:]?\\s*([\\s\\S]+?)(?:Qual a quantidade|$)`, 'i'));
        } else {
            dadosProduto['Produto/Peso'] = extractFrom(produtoText, new RegExp(`Produto e peso da embalagem[^:]*[?:]?\\s*([\\s\\S]+?)${stopPattern}`, 'i'));
        }

        // Formato 1: "Qual a quantidade que possui aberta e/ou fechada?"
        // Formato 2: "Quantidade:"
        // Estratégia Blindada: Captura tudo até o próximo label/stop, depois limpa agressivamente
        const matchQtd = produtoText.match(new RegExp(`(?:Qual a quantidade[^?]*\\?|Quantidade[^:]*):?\\s*([\\s\\S]+?)${stopPattern}`, 'i'));
        if (matchQtd) {
            let rawQtd = matchQtd[1].trim();
            // Pega apenas a primeira linha não vazia
            const lines = rawQtd.split(/\r?\n/).map(l => l.trim()).filter(l => l);
            if (lines.length > 0) {
                let firstLine = lines[0];
                // Remove lixo comum de UI se estiver na mesma linha (ex: "1 lata Divisão")
                const junkIndex = firstLine.search(/(Divisão|Modificado|Marca|Origem|Fonte|Abrir visualização)/i);
                if (junkIndex !== -1) {
                    firstLine = firstLine.substring(0, junkIndex).trim();
                }
                dadosProduto['Quantidade'] = firstLine;
            } else {
                dadosProduto['Quantidade'] = '';
            }
        } else {
            dadosProduto['Quantidade'] = '';
        }

        // Formato 1: "Qual o local da compra?"
        // Formato 2: "Local da compra:"
        // Ajuste Formato 1: Para antes de "Qual foi o valor"
        if (isFormato1) {
            dadosProduto['Local Compra'] = extractFrom(produtoText, new RegExp(`Qual o local da compra[^?]*[?:]?\\s*([\\s\\S]+?)(?:Qual foi o valor|$)`, 'i'));
        } else {
            dadosProduto['Local Compra'] = extractFrom(produtoText, new RegExp(`(?:Qual o local da compra|Local da compra)[^:]*[?:]?\\s*([\\s\\S]+?)${stopPattern}`, 'i'));
        }

        // Formato 1: "Qual foi o valor pago?"
        // Formato 2: "Valor pago:"
        // Ajuste Formato 1: Para antes de "Nome completo"
        if (isFormato1) {
            dadosProduto['Valor Pago'] = extractFrom(produtoText, new RegExp(`Qual foi o valor pago[^?]*[?:]?\\s*([\\s\\S]+?)(?:Nome completo|$)`, 'i'));
        } else {
            dadosProduto['Valor Pago'] = extractFrom(produtoText, new RegExp(`(?:Qual foi o valor pago|Valor pago)[^:]*[?:]?\\s*(R?\\$?[\\d.,\\s]+)`, 'i'));
        }

        // Endereço do produto (Formato 2 apenas - entre Local da compra e Valor pago)
        dadosProduto['Endereço'] = extractFrom(produtoText, new RegExp(`Local da compra[\\s\\S]*?Endereço[^:]*:\\s*([\\s\\S]+?)${stopPattern}`, 'i'));

        // === DADOS PESSOAIS (ambos formatos) ===
        const dadosPessoais = {};

        // Formato 1: "Nome completo:"
        // Formato 2: "Nome:" (na seção Dados bancários às vezes, ou Pessoais)
        dadosPessoais['Nome'] = extractFrom(pessoaisText, new RegExp(`Nome(?: completo)?[^:]*:\\s*([\\s\\S]+?)${stopPattern}`, 'i'));

        // Ambos: "Data de nascimento:"
        dadosPessoais['Nascimento'] = extractFrom(pessoaisText, new RegExp(`Data de nascimento[^:]*:\\s*(\\d{2}[/.-]\\d{2}[/.-]\\d{4})`, 'i'));

        // Ambos: "CPF:"
        dadosPessoais['CPF'] = extractFrom(pessoaisText, new RegExp(`CPF[^:]*:\\s*(\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2})`, 'i'));

        // Formato 1: "Telefone com (DDD):"
        // Formato 2: "Celular:" (na seção Chaves Pix/Bancários geralmente, mas tentamos Pessoais também)
        // Se isFormato2, celular costuma estar em Bancarios.
        let telSource = isFormato2 ? bancariosText : pessoaisText;
        dadosPessoais['Telefone'] = extractFrom(telSource, new RegExp(`(?:Telefone[^:]*\\(DDD\\)|Telefone|Celular)[^:]*:\\s*([\\d()\\s+-]+)`, 'i'));

        // Endereço pessoal
        // Formato 1: "Endereço (Rua, número, bairro, cidade, estado e CEP):"
        // Formato 2: "Endereço:" na seção Dados pessoais
        if (isFormato1) {
            dadosPessoais['Endereço'] = extractFrom(pessoaisText, new RegExp(`Endereço\\s*\\([^)]+\\)[^:]*:\\s*([\\s\\S]+?)${stopPattern}`, 'i'));
        }
        if (!dadosPessoais['Endereço']) {
            dadosPessoais['Endereço'] = extractFrom(pessoaisText, new RegExp(`Dados pessoais[\\s\\S]*?Endereço[^:]*:\\s*([\\s\\S]+?)${stopPattern}`, 'i'));
        }
        // Fallback genérico em pessoaisText
        if (!dadosPessoais['Endereço']) {
            const allEnderecos = [...pessoaisText.matchAll(new RegExp(`Endereço[^:]*:\\s*([\\s\\S]+?)${stopPattern}`, 'gi'))];
            if (allEnderecos.length > 0) {
                dadosPessoais['Endereço'] = allEnderecos[0][1].trim(); // Pega o primeiro encontrado no escopo pessoal
            }
        }

        // === DADOS BANCÁRIOS (ambos formatos) ===
        const dadosBancarios = {};

        // Formato 1: "Banco:"
        // Formato 2: "Instituição:"
        dadosBancarios['Banco'] = extractFrom(bancariosText, new RegExp(`(?:Banco|Instituição)[^:]*:\\s*([\\s\\S]+?)${stopPattern}`, 'i'));

        // Ambos: "Agência:"
        dadosBancarios['Agência'] = extractFrom(bancariosText, new RegExp(`Agência[^:]*:\\s*([\\d\\s-]+)`, 'i'));

        // Ambos: "Conta:"
        dadosBancarios['Conta'] = extractFrom(bancariosText, new RegExp(`Conta[^:]*:\\s*([\\d.-]+)`, 'i'));

        // Formato 1: "Tipo de conta (corrente ou poupança):"
        // Formato 2: não tem explícito
        dadosBancarios['Tipo Conta'] = extractFrom(bancariosText, new RegExp(`Tipo de conta[^:]*:\\s*([\\s\\S]+?)${stopPattern}`, 'i'));

        // === CHAVES PIX ===
        // Formato 1: "Chave Pix (se disponível):"
        // Formato 2: "Chaves Pix disponíveis:" com "Celular:" e "Chave aleatória:"
        const chavePix1Raw = extractFrom(bancariosText, new RegExp(`Chave Pix[^:]*:\\s*([\\s\\S]+?)${stopPattern}`, 'i'));
        let chavePix1 = chavePix1Raw;

        // Limpeza extra para Chave Pix (evitar pegar rodapé)
        if (chavePix1) {
            const lines = chavePix1.split(/\r?\n/).map(l => l.trim()).filter(l => l);
            if (lines.length > 0) {
                chavePix1 = lines[0];
                // Remove sufixos comuns se pegou na mesma linha
                const junkIndex = chavePix1.search(/(Abaixo segue|Em \d+ de|Envio de|Segue fotos|Para darmos início)/i);
                if (junkIndex !== -1) {
                    chavePix1 = chavePix1.substring(0, junkIndex).trim();
                }
            }
        }
        const chavePix2_celular = extractFrom(bancariosText, new RegExp(`Chaves Pix[\\s\\S]*?Celular[^:]*:\\s*([\\d()\\s+-]+)`, 'i'));
        const chavePix2_aleatoria = extractFrom(bancariosText, new RegExp(`Chave aleatória[^:]*:\\s*([\\w-]+)`, 'i'));

        // Combina chaves Pix encontradas
        const chavesPix = [];
        if (chavePix1) chavesPix.push(chavePix1);
        if (chavePix2_celular) chavesPix.push(`Cel: ${chavePix2_celular}`);
        if (chavePix2_aleatoria) chavesPix.push(`Aleatória: ${chavePix2_aleatoria}`);
        dadosBancarios['Chave Pix'] = chavesPix.join(' | ') || '';

        // === EXTRAÇÃO DE ARQUIVOS (Busca no DOM ATUAL, pois foi atualizado pela automação) ===
        const rows = document.querySelectorAll('table.uiVirtualDataTable tbody tr');
        const arquivos = [];

        rows.forEach((row) => {
            const titleSpan = row.querySelector('span.itemTitle[title]');
            const nome = titleSpan?.getAttribute('title') || '';
            const tipoSpan = row.querySelector('.slds-assistive-text');
            const tipo = tipoSpan?.textContent?.replace('Arquivo de ', '') || '';
            const dataSpan = row.querySelector('.uiOutputDateTime');
            const data = dataSpan?.textContent?.trim() || '';
            const sizeAmount = row.querySelector('.fileSizeAmount')?.textContent?.trim() || '';
            const sizeUnits = row.querySelector('.fileSizeUnits')?.textContent?.trim() || '';
            const tamanho = sizeAmount && sizeUnits ? `${sizeAmount} ${sizeUnits}` : '';
            // Extrair link do ContentDocument para preview
            const docLink = row.querySelector('a[href*="ContentDocument"]');
            const docId = docLink?.href?.match(/ContentDocument\/([^/]+)/)?.[1] || '';
            const previewUrl = docId ? `/sfc/servlet.shepherd/version/renditionDownload?rendition=THUMB720BY480&versionId=${docId}` : '';

            if (nome) {
                arquivos.push({ nome, tipo, data, tamanho, docId, previewUrl });
            }
        });

        // === INTERFACE ===
        const panel = document.createElement('div');
        panel.id = 'email-extractor-panel';
        panel.innerHTML = `
            <style>
                #email-extractor-panel { position: fixed; top: 20px; right: 20px; width: 400px; max-height: 90vh; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); font-family: 'Segoe UI', system-ui, sans-serif; z-index: 2147483647; overflow: hidden; }
                #email-extractor-panel .header { background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; }
                #email-extractor-panel .header h2 { margin: 0; font-size: 16px; font-weight: 600; }
                #email-extractor-panel .close-btn { background: rgba(255,255,255,0.2); border: none; color: #fff; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 18px; line-height: 1; }
                #email-extractor-panel .close-btn:hover { background: rgba(255,255,255,0.3); }
                #email-extractor-panel .content { padding: 16px; max-height: 70vh; overflow-y: auto; }
                #email-extractor-panel .section { background: rgba(255,255,255,0.05); border-radius: 12px; padding: 14px; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.1); }
                #email-extractor-panel .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
                #email-extractor-panel .section-title { font-size: 13px; font-weight: 600; color: #667eea; text-transform: uppercase; letter-spacing: 0.5px; }
                #email-extractor-panel .copy-btn { background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); border: none; color: #fff; padding: 6px 14px; border-radius: 20px; cursor: pointer; font-size: 12px; font-weight: 500; transition: transform 0.2s, box-shadow 0.2s; }
                #email-extractor-panel .copy-btn:hover { transform: scale(1.05); box-shadow: 0 4px 15px rgba(102,126,234,0.4); }
                #email-extractor-panel .copy-btn.copied { background: linear-gradient(90deg, #00c853 0%, #69f0ae 100%); }
                #email-extractor-panel .field { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 13px; }
                #email-extractor-panel .field:last-child { border-bottom: none; }
                #email-extractor-panel .field-label { color: #8892b0; min-width: 100px; }
                #email-extractor-panel .field-value { color: #ccd6f6; text-align: right; word-break: break-word; max-width: 220px; }
                #email-extractor-panel .field-value.empty { color: #4a5568; font-style: italic; }
                #email-extractor-panel .field-value.alert { color: #ff5252; font-weight: bold; }
                #email-extractor-panel .copy-all { width: 100%; padding: 14px; background: linear-gradient(90deg, #f093fb 0%, #f5576c 100%); border: none; color: #fff; border-radius: 12px; cursor: pointer; font-size: 14px; font-weight: 600; transition: transform 0.2s, box-shadow 0.2s; }
                #email-extractor-panel .copy-all:hover { transform: scale(1.02); box-shadow: 0 6px 20px rgba(245,87,108,0.4); }
                #email-extractor-panel .copy-all.copied { background: linear-gradient(90deg, #00c853 0%, #69f0ae 100%); }
                #email-extractor-panel .preview-btn { background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); border: none; color: #fff; padding: 4px 10px; border-radius: 12px; cursor: pointer; font-size: 11px; font-weight: 500; transition: transform 0.2s; }
                #email-extractor-panel .preview-btn:hover { transform: scale(1.1); }
                #image-gallery-popup { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 2147483648; display: flex; flex-direction: column; align-items: center; justify-content: center; }
                #image-gallery-popup .gallery-header { position: absolute; top: 20px; left: 0; right: 0; display: flex; justify-content: center; align-items: center; gap: 20px; color: #fff; font-family: 'Segoe UI', sans-serif; }
                #image-gallery-popup .gallery-title { font-size: 16px; font-weight: 600; }
                #image-gallery-popup .gallery-counter { font-size: 14px; color: #8892b0; }
                #image-gallery-popup .gallery-close { position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.2); border: none; color: #fff; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; font-size: 24px; }
                #image-gallery-popup .gallery-close:hover { background: rgba(255,255,255,0.3); }
                #image-gallery-popup .gallery-image { max-width: 80%; max-height: 70%; object-fit: contain; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
                #image-gallery-popup .gallery-nav { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.2); border: none; color: #fff; width: 50px; height: 50px; border-radius: 50%; cursor: pointer; font-size: 24px; transition: background 0.2s; }
                #image-gallery-popup .gallery-nav:hover { background: rgba(255,255,255,0.4); }
                #image-gallery-popup .gallery-nav.prev { left: 20px; }
                #image-gallery-popup .gallery-nav.next { right: 20px; }
                #image-gallery-popup .gallery-nav:disabled { opacity: 0.3; cursor: not-allowed; }
                #image-gallery-popup .gallery-media-container { display: flex; align-items: center; justify-content: center; max-width: 80%; max-height: 70%; }
                #image-gallery-popup .gallery-loading { color: #fff; font-size: 18px; font-family: 'Segoe UI', sans-serif; }
                #image-gallery-popup .gallery-video { max-width: 100%; max-height: 70vh; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
            </style>
            <div class="header">
                <h2>📧 Email Data Extractor</h2>
                <button class="close-btn" id="email-close-btn">×</button>
            </div>
            <div class="content">
                <div class="section" id="sec-bebe" style="display: none;">
                    <div class="section-header">
                        <span class="section-title">👶 Bebê</span>
                        <button class="copy-btn" data-section="bebe">Copiar</button>
                    </div>
                    <div class="fields"></div>
                </div>
                <div class="section" id="sec-produto">
                    <div class="section-header">
                        <span class="section-title">📦 Produto</span>
                        <button class="copy-btn" data-section="produto">Copiar</button>
                    </div>
                    <div class="fields"></div>
                </div>
                <div class="section" id="sec-pessoais">
                    <div class="section-header">
                        <span class="section-title">👤 Dados Pessoais</span>
                        <button class="copy-btn" data-section="pessoais">Copiar</button>
                    </div>
                    <div class="fields"></div>
                </div>
                <div class="section" id="sec-bancarios">
                    <div class="section-header">
                        <span class="section-title">🏦 Dados Bancários</span>
                        <button class="copy-btn" data-section="bancarios">Copiar</button>
                    </div>
                    <div class="fields"></div>
                </div>
                <div class="section" id="sec-arquivos">
                    <div class="section-header">
                        <span class="section-title">📁 Arquivos (${arquivos.length})</span>
                    </div>
                    <div class="fields"></div>
                </div>
                <button class="copy-all">📋 Copiar Tudo</button>
            </div>
        `;
        document.body.appendChild(panel);

        // Renderiza campos
        function renderFields(containerId, data) {
            const container = panel.querySelector(`#${containerId} .fields`);
            Object.entries(data).forEach(([key, value]) => {
                const div = document.createElement('div');
                div.className = 'field';
                const valueClass = value ? '' : 'empty';
                const displayValue = value || '(vazio)';
                div.innerHTML = `<span class="field-label">${key}</span><span class="field-value ${valueClass}">${displayValue}</span>`;
                container.appendChild(div);
            });
        }

        // Renderiza seção Bebê (apenas se houver dados - Formato 2)
        if (Object.values(dadosBebe).some(v => v)) {
            const secBebe = panel.querySelector('#sec-bebe');
            secBebe.style.display = 'block';
            renderFields('sec-bebe', dadosBebe);
        }

        renderFields('sec-produto', dadosProduto);
        renderFields('sec-pessoais', dadosPessoais);
        renderFields('sec-bancarios', dadosBancarios);

        // Renderiza arquivos com botão de preview
        const arquivosContainer = panel.querySelector('#sec-arquivos .fields');
        if (arquivos.length === 0) {
            arquivosContainer.innerHTML = '<div class="field"><span class="field-value empty">(nenhum arquivo)</span></div>';
        } else {
            arquivos.forEach((arq, i) => {
                const div = document.createElement('div');
                div.className = 'field';
                const isImage = arq.tipo.toLowerCase().includes('imagem') || /\.(jpg|jpeg|png|gif|webp)$/i.test(arq.nome);
                const isVideo = arq.tipo.toLowerCase().includes('vídeo') || arq.tipo.toLowerCase().includes('video') || /\.(mov|mp4|avi|webm|mkv)$/i.test(arq.nome);
                const hasPreview = isImage || isVideo;
                const previewBtn = hasPreview ? `<button class="preview-btn" data-index="${i}">👁 Preview</button>` : `<span class="field-value">${arq.tamanho}</span>`;
                div.innerHTML = `<span class="field-label">${i + 1}. ${arq.nome}</span>${previewBtn}`;
                arquivosContainer.appendChild(div);
            });
        }

        // === GALERIA DE MÍDIA (Imagens e Vídeos) ===
        let currentMediaIndex = 0;
        const mediaFiles = arquivos.filter(a => {
            const isImage = a.tipo.toLowerCase().includes('imagem') || /\.(jpg|jpeg|png|gif|webp)$/i.test(a.nome);
            const isVideo = a.tipo.toLowerCase().includes('vídeo') || a.tipo.toLowerCase().includes('video') || /\.(mov|mp4|avi|webm|mkv)$/i.test(a.nome);
            return isImage || isVideo;
        });

        // Cache de mídias pré-carregadas
        const mediaCache = {};

        function preloadMedia(index) {
            if (index < 0 || index >= mediaFiles.length) return;
            const file = mediaFiles[index];
            if (mediaCache[file.docId]) return;

            const isVideo = file.tipo.toLowerCase().includes('vídeo') || file.tipo.toLowerCase().includes('video') || /\.(mov|mp4|avi|webm|mkv)$/i.test(file.nome);
            const url = `/sfc/servlet.shepherd/document/download/${file.docId}`;

            if (isVideo) {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.src = url;
                mediaCache[file.docId] = { type: 'video', element: video };
            } else {
                const img = new Image();
                img.src = url;
                mediaCache[file.docId] = { type: 'image', element: img };
            }
        }

        function openGallery(startIndex) {
            const mediaIndex = mediaFiles.findIndex(m => arquivos.indexOf(m) === startIndex);
            if (mediaIndex === -1) return;
            currentMediaIndex = mediaIndex;

            const popup = document.createElement('div');
            popup.id = 'image-gallery-popup';
            popup.innerHTML = `
                <div class="gallery-header">
                    <span class="gallery-title">${mediaFiles[currentMediaIndex].nome}</span>
                    <span class="gallery-counter">${currentMediaIndex + 1} / ${mediaFiles.length}</span>
                </div>
                <button class="gallery-close">×</button>
                <button class="gallery-nav prev" ${currentMediaIndex === 0 ? 'disabled' : ''}>◀</button>
                <div class="gallery-media-container">
                    <div class="gallery-loading">⏳ Carregando...</div>
                </div>
                <button class="gallery-nav next" ${currentMediaIndex === mediaFiles.length - 1 ? 'disabled' : ''}>▶</button>
            `;
            document.body.appendChild(popup);

            // Pré-carregar adjacentes
            preloadMedia(currentMediaIndex);
            preloadMedia(currentMediaIndex + 1);
            preloadMedia(currentMediaIndex - 1);

            function updateMedia() {
                const container = popup.querySelector('.gallery-media-container');
                const title = popup.querySelector('.gallery-title');
                const counter = popup.querySelector('.gallery-counter');
                const prevBtn = popup.querySelector('.gallery-nav.prev');
                const nextBtn = popup.querySelector('.gallery-nav.next');
                const file = mediaFiles[currentMediaIndex];
                const isVideo = file.tipo.toLowerCase().includes('vídeo') || file.tipo.toLowerCase().includes('video') || /\.(mov|mp4|avi|webm|mkv)$/i.test(file.nome);
                const url = `/sfc/servlet.shepherd/document/download/${file.docId}`;

                // Mostrar loading
                container.innerHTML = '<div class="gallery-loading">⏳ Carregando...</div>';

                title.textContent = file.nome;
                counter.textContent = `${currentMediaIndex + 1} / ${mediaFiles.length}`;
                prevBtn.disabled = currentMediaIndex === 0;
                nextBtn.disabled = currentMediaIndex === mediaFiles.length - 1;

                if (isVideo) {
                    const video = document.createElement('video');
                    video.className = 'gallery-video';
                    video.controls = true;
                    video.autoplay = false;
                    video.src = url;
                    video.onloadeddata = () => { container.innerHTML = ''; container.appendChild(video); };
                    video.onerror = () => { container.innerHTML = '<div class="gallery-loading">❌ Erro ao carregar vídeo</div>'; };
                } else {
                    const img = document.createElement('img');
                    img.className = 'gallery-image';
                    img.alt = file.nome;
                    img.src = url;
                    img.onload = () => { container.innerHTML = ''; container.appendChild(img); };
                    img.onerror = () => { container.innerHTML = '<div class="gallery-loading">❌ Erro ao carregar imagem</div>'; };
                }

                // Pré-carregar adjacentes
                preloadMedia(currentMediaIndex + 1);
                preloadMedia(currentMediaIndex - 1);
            }

            updateMedia();

            popup.querySelector('.gallery-close').addEventListener('click', () => popup.remove());
            popup.querySelector('.gallery-nav.prev').addEventListener('click', () => {
                if (currentMediaIndex > 0) { currentMediaIndex--; updateMedia(); }
            });
            popup.querySelector('.gallery-nav.next').addEventListener('click', () => {
                if (currentMediaIndex < mediaFiles.length - 1) { currentMediaIndex++; updateMedia(); }
            });
            popup.addEventListener('click', (e) => { if (e.target === popup) popup.remove(); });
            document.addEventListener('keydown', function handleKey(e) {
                if (!document.getElementById('image-gallery-popup')) { document.removeEventListener('keydown', handleKey); return; }
                if (e.key === 'Escape') popup.remove();
                if (e.key === 'ArrowLeft' && currentMediaIndex > 0) { currentMediaIndex--; updateMedia(); }
                if (e.key === 'ArrowRight' && currentMediaIndex < mediaFiles.length - 1) { currentMediaIndex++; updateMedia(); }
            });
        }

        panel.querySelectorAll('.preview-btn').forEach(btn => {
            btn.addEventListener('click', () => openGallery(parseInt(btn.dataset.index)));
        });

        // Função de cópia
        function formatData(data) {
            return Object.entries(data).filter(([k, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
        }

        function copyWithFeedback(btn, text) {
            navigator.clipboard.writeText(text).then(() => {
                const original = btn.textContent;
                btn.textContent = '✓ Copiado!';
                btn.classList.add('copied');
                setTimeout(() => { btn.textContent = original; btn.classList.remove('copied'); }, 1500);
            });
        }

        // Event listeners
        panel.querySelector('#email-close-btn').addEventListener('click', () => panel.remove());

        panel.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const section = btn.dataset.section;
                let data;
                if (section === 'bebe') data = dadosBebe;
                else if (section === 'produto') data = dadosProduto;
                else if (section === 'pessoais') data = dadosPessoais;
                else data = dadosBancarios;
                copyWithFeedback(btn, formatData(data));
            });
        });

        panel.querySelector('.copy-all').addEventListener('click', function () {
            const allData = { ...dadosBebe, ...dadosProduto, ...dadosPessoais, ...dadosBancarios };
            copyWithFeedback(this, formatData(allData));
        });
    }

    // === 3. EXECUÇÃO DO FLUXO (Solicitado pelo usuário) ===

    // Passo 1: Clicar em Atividade
    clickElement('#activityTab__item, a[data-label="Atividade"]', 'Atividade');

    // Passo 2: Aguardar e Rodar Scroll
    setTimeout(() => {
        runAutoScroll(() => {
            // Passo 3: Callback - Executar após o scroll terminar
            console.log('>> Indo para Arquivos...');
            setTimeout(() => {
                clickElement('a[href*="AttachedContentDocuments"]', 'Arquivos');

                // Passo 4: Executar Extração de Dados FINAL
                setTimeout(() => {
                    console.log('>> Executando Extração de Dados...');
                    runExtraction();
                }, 2000); // Aguarda arquivos renderizarem
            }, 1000);
        });
    }, 1000); // Aguarda um pouco antes de iniciar o scroll

})();
