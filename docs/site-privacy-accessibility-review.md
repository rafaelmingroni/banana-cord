# Revisão dos 17 pontos do site

Revisão técnica de 6 de novembro de 2026. Escopo: mingrx.site. O tema escuro e os ajustes visuais anteriores foram preservados.

| Ponto | Resultado |
| --- | --- |
| Política de privacidade | Atualizada com responsável confirmado, canal atual, e-mail de suporte e privacidade confirmado pelo responsável, minimização e ausência de formulários no site. |
| Termos de serviço | Mantidos com condições de uso gratuito, marcas e direitos autorais, sem regras de uma oferta paga inexistente. |
| Aviso de cookies | Informação simples na Política de Privacidade; não há cookies opcionais ou analytics nos scripts, portanto não foi mantido banner de consentimento ou aviso repetitivo no rodapé. |
| Política de reembolso | Não se aplica à oferta atual: não há vendas, assinaturas ou pagamentos no site. Removida da navegação e do sitemap; a URL antiga encaminha aos termos, que informam apenas a gratuidade. |
| Formulários na LGPD | O site não contém formulários. Não foi criado um formulário que recolha dados sem um canal de processamento adequado. |
| Só dados necessários | Sem newsletter, cadastro no site, cartão, CPF ou documentos; requisições técnicas e consulta de versão documentadas. |
| Rastreamento | Sem analytics/pixels; política de conteúdo restringe scripts a arquivos locais e conexões à própria origem/API de releases documentada. |
| Acessibilidade | Estrutura semântica, destinos de navegação focáveis, identificação de idioma, adaptação a telas estreitas e página sobre recursos e limites dos testes. |
| Alt nas imagens | Captura informativa descrita; imagens decorativas com alt vazio e nome textual adjacente. |
| Contraste | Texto principal, secundário e botão verificados no navegador com razão mínima de 4.5:1. |
| Teclado | Testes com eventos nativos de Tab, Enter, Espaço e Escape, link de salto, menu móvel, destino de âncora e FAQ; duplicidade de ID corrigida nos termos. |
| Avaliações falsas | Não há avaliações, depoimentos ou notas inventadas. |
| Promessas falsas | Não declara segurança absoluta, certificação de acessibilidade, conformidade integral com a LGPD ou disponibilidade garantida. |
| Copyright | Página de créditos descreve os arquivos reais e a captura com conta de demonstração, preservando direitos dos titulares e sem inventar licenças abertas. |
| Dados do responsável | Rafael Mingroni, informado pelo titular. Não se presume uma empresa registrada: nenhum dado empresarial foi inventado. |
| LGPD | Medidas técnicas e informações complementadas; conformidade integral depende também dos procedimentos e da operação do responsável. |
| Riscos jurídicos | Reduzidas ambiguidades de cobrança, finalidade, cookies, conteúdo e direitos; pendências operacionais reais documentadas abaixo. |

## Contato confirmado

O responsável confirmou que criou `mingrxapp@gmail.com` e autorizou o recebimento de mensagens. O endereço está publicado com link mailto para suporte e pedidos de privacidade. O GitHub permanece como canal público para problemas técnicos sem dados pessoais.

## Pendências do responsável

- Acompanhar o e-mail de atendimento e responder aos pedidos de suporte e de direitos dos titulares. Chamados no GitHub são públicos e não devem receber documentos, conversas ou identificadores de conta. Não solicitar dados pessoais nesse meio.
- Fornecer razão social, CNPJ e endereço comercial se houver empresa a identificar. Esta revisão não presume constituição de pessoa jurídica.
- Manter procedimentos de recebimento de pedidos, verificação proporcional de identidade, registro de tratamentos, retenção/exclusão, segurança e incidentes alinhados à operação real do aplicativo.
- Validar os textos e a operação com orientação jurídica adequada antes de afirmar conformidade integral. Uma mudança no site não certifica a operação inteira.

## Evidências e referências

- `node site/validate.mjs`: páginas, âncoras únicas, links, identificação, contato confirmado e link de e-mail, política de conteúdo e ausência de formulários/coleta extra.
- `node site/test-invites.mjs`: download oficial, API indisponível, convites e rejeição de códigos inválidos.
- `site/test-browser.cjs`: navegador real em 320 a 1440 px, eventos nativos de teclado, zoom de 200%, contraste, imagens, novos documentos, armazenamento sem identificadores e erros de console.
- [Orientações da ANPD sobre cookies](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais).
- [Direitos dos titulares](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares).
- [Perguntas frequentes da ANPD](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes).
- [Código de Defesa do Consumidor](https://www2.camara.leg.br/legin/fed/lei/1990/lei-8078-11-setembro-1990-365086-normaatualizada-pl.html).
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

## Aplicabilidade ao cenário atual

O site apresenta um aplicativo gratuito e oferece links de download e convite. Comércio eletrônico, reembolso de compra, pagamento e marketing por formulários não são fluxos existentes. A ausência de cookies opcionais é explicada na privacidade, sem banner de consentimento. Identificação do responsável, informações sobre os dados realmente usados, termos, acessibilidade e direitos das imagens continuam pertinentes. As URLs antigas de cookies e reembolso apenas encaminham ao trecho correspondente dos documentos atuais.
