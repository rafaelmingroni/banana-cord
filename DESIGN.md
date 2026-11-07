---
name: Mingrx — mingrx.site
description: Sistema visual escuro do site público, baseado no aplicativo real.
colors:
  primary: "#c3acff"
  primary-hover: "#d4c3ff"
  action-ink: "#20152f"
  canvas: "#0c0d12"
  surface: "#161720"
  ink: "#f6f3ff"
  muted: "#b3b0c1"
  border: "#30303e"
  surface-hover: "#242330"
  border-hover: "#666174"
  scene-hover: "#23222e"
  scene-selected: "#33283f"
  scene-selected-ink: "#f0e6ff"
  violet-field: "#21192f"
typography:
  display:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "clamp(44px, 6.2vw, 88px)"
    fontWeight: 750
    lineHeight: 1.08
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "clamp(34px, 4vw, 54px)"
    fontWeight: 750
    lineHeight: 1.08
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 720
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 750
    lineHeight: 1.5
rounded:
  control: "6px"
  image: "12px"
  frame: "14px"
spacing:
  control-gap: "12px"
  compact: "20px"
  content: "24px"
  section-gap: "35px"
  wide-gap: "48px"
  story-gap: "80px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.action-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "13px 23px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "13px 23px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-hover}"
  button-text:
    textColor: "{colors.ink}"
    padding: "7px 0"
  scene-tab:
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  scene-tab-selected:
    backgroundColor: "{colors.scene-selected}"
    textColor: "{colors.scene-selected-ink}"
  utility-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.frame}"
    padding: "42px"
---

# Design System: Mingrx — mingrx.site

## Overview

**Creative North Star: "Seu grupo de amigos, em cena"**

O sistema de mingrx.site coloca o uso social real em primeiro plano: fundo quase preto, tipografia clara e generosa, violeta sólido nas ações e capturas autênticas do produto. A apresentação é expressiva, direta e sem ornamentação em movimento.

Este documento governa somente o site público, incluindo início, convites, suporte e páginas de leitura. Não substitui o CSS nem a identidade de componentes do aplicativo Windows. A direção escrita já foi aprovada; os tokens registram a implementação concluída.

**Key Characteristics:**
- Fundo escuro com limites finos e campos tonais.
- Manrope de peso substancial e controles de cantos curtos.
- Demonstrações reais identificadas e interações deliberadas.

## Colors

O violeta claro conduz a ação; a base neutra sustenta imagens, navegação e leitura prolongada. O frontmatter é a referência normativa dos valores.

### Primary

O violeta de marca aparece no download, nos destaques tipográficos, nos links de leitura e no foco. O estado hover clareia o preenchimento; a tinta escura mantém a legibilidade do botão. O campo violeta profundo contextualiza a passagem de chamadas.

### Neutral

Canvas e surface distinguem página e contêiner. Ink identifica títulos e ações; muted organiza descrições. Border delimita navegação, sumários e conteúdo sem sombras. As cenas selecionadas têm seu próprio par tonal.

**The Solid Action Rule.** A ação principal usa violeta sólido; nunca um gradiente.

## Typography

Manrope variável é auto-hospedada em `site/assets/fonts/manrope-variable.ttf`, com licença OFL preservada ao lado. O arquivo cobre pesos 200–800; Arial e sans-serif são os fallbacks.

Display serve à abertura; headline às passagens principais; title aos passos; body ao texto corrente; label ao botão padrão. A navegação usa texto de 13px com peso 650, e notas/captions usam 12–13px. Textos legais usam 15px com entrelinha 1.95, reduzindo a 14px no telefone; a coluna de artigo limita-se a 74ch.

Títulos têm quebra balanceada. Em telas até 540px, o título inicial usa 42px com entrelinha 1.13; títulos de seção usam 36px. Não simular outra família tipográfica com peso ou espaçamento.

## Layout

A largura principal é limitada a 1240px, com 40px de margem lateral no desktop. Os pontos de adaptação são 1100px, 850px e 540px: margens laterais passam a 32px, 24px e 20px. A navegação fixa ocupa 82px no desktop e 74px até 850px.

Passagens de produto alternam imagem e texto em duas colunas; tornam-se uma coluna até 850px. O ritmo das seções passa de 112px para 75px e 65px. Passos e tópicos de suporte tornam-se uma coluna até 540px. Não transformar todas as passagens em cartões iguais.

As páginas legais usam largura máxima de 1100px, sumário de 200px e artigo em coluna fluida, com intervalo de 75px. Até 850px, o sumário entra no fluxo antes do artigo; o título permanece fora do disclosure. Convites usam um contêiner de até 660px.

As capturas mantêm acesso à imagem completa. No telefone, a regra final usa altura automática e `object-fit: contain` nas cenas e figuras de história, preservando todo o conteúdo após a revisão dos recortes.

## Elevation & Depth

Não há sombras, halos ou animação de entrada. Profundidade vem do contraste entre canvas, superfícies, campos violetas e bordas finas. Hover e abertura de disclosures mudam estado imediatamente; não há autoplay. A preferência por movimento reduzido desativa transições e preserva rolagem automática padrão.

## Shapes

Controles usam cantos curtos; figuras e blocos de contato usam o raio image, e a moldura principal e o convite usam frame. A moldura principal passa a image no telefone. Bordas estruturais têm 1px. Botões não têm formato de cápsula.

## Components

**Botões.** Primary destaca download ou abertura do aplicativo; secondary oferece o caminho alternativo. Ambos têm altura mínima de 52px; a variante compacta tem 44px. O link textual sublinhado tem alvo mínimo de 44px. Hover altera cor/preenchimento; botões em operação ficam desabilitados, com opacidade .7 e cursor de espera.

**Foco e seleção.** O foco visível usa contorno violeta de 3px e afastamento de 5px. A seleção de texto usa o mesmo violeta com tinta escura. O skip link aparece ao receber foco; alvos de navegação programática não recebem contorno artificial.

**Navegação.** Links discretos clareiam em hover. Até 850px, o botão Menu alterna `aria-expanded` e abre links em coluna. Escape fecha e devolve foco ao botão; clique externo, navegação e retorno ao desktop fecham o menu.

**Cenas.** Duas abas, Conversas e Em chamada, controlam um painel visível com imagem e legenda. `aria-selected`, `tabindex` itinerante e `hidden` representam o estado; setas, Home e End selecionam e movem foco. Não há rotação automática. As capturas são do renderer real 3.2 com conteúdo demonstrativo; a proveniência está em `site/assets/mingrx-captures.provenance.json`.

**Leitura e disclosure.** FAQ usa `details/summary` nativos, divisórias e símbolo de mais que gira ao abrir. O sumário legal é outro disclosure real: abre inicialmente em larguras acima de 850px; em telas menores inicia recolhido. Os tópicos de suporte são links de tarefa com divisórias, sem campos de formulário.

**Convite e retorno de estado.** O cartão mostra código e mensagem em região de status. Código malformado oculta a abertura e pede outro convite; instalação continua secundária. Código de formato válido tenta o protocolo e oferece recuperação, sem afirmar validade ou autorização da comunidade. Cópia anuncia sucesso somente após confirmação da API; falha revela texto selecionável. Downloads têm fallback oficial disponível antes da consulta de versão.

## Do's and Don'ts

### Do:
- Do preservar tema escuro, marca reconhecível e foco visível.
- Do usar capturas reais com conteúdo demonstrativo identificado e proveniência.
- Do manter download, convite e leitura compreensíveis também no telefone.

### Don't:
- Don't usar gradientes, cápsulas, halos ou animações decorativas.
- Don't inventar depoimentos, métricas, retratos ou diferenciação do produto.
- Don't aplicar estes tokens ao aplicativo Windows como se fossem seu sistema existente.
