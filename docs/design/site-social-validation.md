# Validação da reformulação do mingrx.site

Data: 7 de novembro de 2026. Escopo: site completo, sem alteração da versão do aplicativo ou das regras Firebase.

## Resultado

Direção aprovada pelo usuário: aplicativo em uso, tema escuro, composição mais expressiva e apresentação coerente de início, convites, suporte e documentos. Implementação em HTML/CSS/JavaScript estático; fontes e imagens hospedadas localmente.

Uma revisão independente conferiu desktop e celular, além de suporte, convite inválido e privacidade. O parecer inicial foi **fix**, com dois problemas materiais nos recortes móveis. Após a correção e a segunda rodada de capturas, o revisor marcou ambos como resolvidos e retornou **ship no escopo dessa lista de correções**. Não se trata de certificação integral de acessibilidade ou segurança.

| Problema da revisão | Correção verificada |
| --- | --- |
| Conversa pequena demais no celular | Recorte autêntico430×164 com três mensagens completas e nomes, preservando a proporção e o acesso à captura inteira. |
| Recorte da chamada mostrava um único avatar ampliado | Recorte900×350 com os dois participantes, título do canal e controles, sem corte destrutivo em telas estreitas. |

## Verificações

- `node site/validate.mjs`: metadados, domínio, links/âncoras, fonte/licença, hashes de proveniência das capturas, conteúdo factual e restrições visuais.
- `node site/test-invites.mjs`: download oficial, API indisponível, origem não confiável rejeitada na home e no convite, códigos de8/12caracteres e protocolo preservado.
- `site/test-browser.cjs` em Electron: larguras1440/1024/768/390/320, imagens, ausência de rolagem horizontal, contraste de texto/botão, menu nativo de teclado, link de salto, FAQ, abas com setas/Home, estados de cópia permitida/negada, zoom real200%, títulos e layouts auxiliares, ausência de cookies/identificadores de tracking e de requisições inesperadas.
- Inspeção visual em Chromium155: uma rodada conjunta de desktop/celular/páginas representativas e uma rodada de confirmação. As fontes estavam prontas e imagens visíveis decodificadas antes das capturas.
- `npm run release:check`: README e versão do aplicativo3.2 permanecem sincronizados. A publicação do site não cria uma nova versão do instalador.

## Origem dos materiais

As telas são capturas do renderer real do Mingrx3.2, com contas e mensagens fictícias em emuladores locais. A conexão WebRTC da chamada foi verificada com áudio recebido. Não foi fabricada uma cena de compartilhamento de tela: o recurso é descrito e seus controles reais aparecem na captura. Fontes/recortes/hashes/XMP estão em `site/assets/mingrx-captures.provenance.json`; a licença da Manrope acompanha os arquivos.

Os utilitários CLI do Impeccable não estão instalados: tentativas reais de contexto, seed e detector retornaram127. Não foi inventado resultado de detector, seed ou imagem aprovada. A execução segue a direção escrita confirmada pelo usuário. `PRODUCT.md`, `DESIGN.md`, o contrato em `docs/design/site-social-brief.md` e `.impeccable/design.json` preservam o contexto para manutenção.

Capturas de revisão estão em `.impeccable/review/` (ignoradas no Git). Navegadores e o servidor temporário de prévia foram encerrados. Não foram realizados testes com todos os leitores de tela ou abertura nativa do aplicativo no Windows nesta revisão do site.
