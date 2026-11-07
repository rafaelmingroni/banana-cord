# Tipografia Satoshi — 7 de novembro de 2026

Rafael pediu Satoshi para o site. A substituição preserva a composição, o tema escuro, a escala tipográfica e as funcionalidades já aprovadas. `DESIGN.md`, `PRODUCT.md`, o catálogo visual e o README refletem a escolha.

Foi usado o WOFF2 variável oficial (pesos 300–900), sem modificar o arquivo. A licença ITF Free Font License permite auto-hospedagem no próprio site, mas restringe redistribuição em repositórios; por isso o build obtém o binário oficial e verifica seu SHA-256. O navegador carrega a fonte pelo próprio domínio, com `font-display: swap`, e a home faz preload. O arquivo tem 42.588 bytes. Manrope permanece disponível apenas para compatibilidade com CSS antigo em cache.

Verificação: validação estática, convites/downloads, sincronização da versão do README e testes do navegador Electron aprovados. O teste confirma que Satoshi carregou, sem usar apenas a declaração CSS como evidência. Foram verificados 320, 390, 768, 1024 e 1440 px, zoom de 200%, teclado, contraste e ausência de requisições externas inesperadas.

Inspeção visual adicional em Chromium: início em desktop/celular, suporte, convite inválido e privacidade em desktop/celular, com fontes prontas e imagens decodificadas. Nenhuma página apresentou overflow horizontal; títulos, botões e textos legais continuaram legíveis. Sem alteração da versão 3.2 do aplicativo, do backend ou do atualizador.
