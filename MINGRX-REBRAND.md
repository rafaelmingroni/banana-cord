# Mingrx 3.0 — Rebrand e migração

Mingrx 3.0 transforma a experiência pública do antigo Banana Cord em uma identidade própria, sem jogar fora a base técnica já amadurecida nas versões anteriores.

## Objetivo

O rebrand precisa entregar duas coisas ao mesmo tempo:

1. **para o usuário:** um produto chamado Mingrx, com identidade, instalador, convites, documentação e experiência visual consistentes;
2. **para a instalação existente:** continuidade técnica suficiente para que usuários do Banana Cord possam receber a V3 como atualização, sem criar um aplicativo paralelo no Windows.

## Direção visual

- superfícies grafite, limpas e discretas;
- violeta como cor de destaque, sem glow excessivo;
- tipografia compacta;
- transições curtas;
- comunidades em navegação horizontal;
- membros em drawer contextual;
- menos colunas permanentes e menos ruído visual;
- suporte a múltiplos temas;
- identidade Mingrx consistente em app, tray, updater, instalador e documentação.

## Compatibilidade de atualização

O produto visível passa a se chamar **Mingrx**, mas o `appId` de produção permanece:

```text
com.bananacord.app
```

Esse identificador é preservado de propósito. Alterá-lo faria o Windows tratar o Mingrx como outro aplicativo e poderia quebrar a migração automática de instalações antigas.

O instalador público da V3 usa:

```text
Mingrx-Setup-3.0.0-x64.exe
```

O updater passa a publicar e consultar o repositório `rafaelmingroni/mingrx-app`.

## Compatibilidade de convites

Novos links usam:

```text
mingrx://join/CODIGO
```

O esquema antigo continua registrado por compatibilidade:

```text
bananacord://join/CODIGO
```

## Cloud e mídia

A V3 mantém a arquitetura Cloud construída na V2:

- Firebase Authentication para contas;
- Firestore para comunidades, canais, mensagens e DMs;
- Realtime Database para presença e sinalização;
- Firebase Storage para fotos de comunidades e anexos;
- WebRTC para voz, webcam e compartilhamento de tela.

Uploads de imagem usam a mesma instância Firebase autenticada pelo aplicativo, evitando inconsistência entre Authentication e Storage.

## GitHub e documentação

O lançamento da V3 inclui a migração do próprio repositório:

- nome público do repositório: `mingrx-app`;
- README totalmente refeito;
- banner e identidade visual próprios;
- landing pública de convites rebatizada;
- documentação Cloud atualizada;
- workflows com nomes Mingrx;
- releases chamadas `Mingrx Vx.x.x`;
- artefatos `Mingrx-Setup-*`;
- documentação histórica mantendo Banana Cord apenas quando necessário para explicar migração e compatibilidade.

## Regra de compatibilidade

Identificadores internos antigos podem permanecer quando removê-los trouxer risco técnico sem benefício para o usuário. Tudo que for público ou visível deve usar Mingrx, salvo referências históricas ou de compatibilidade claramente explicadas.
