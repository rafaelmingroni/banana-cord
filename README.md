<p align="center">
  <img src="docs/assets/mingrx-readme-banner.svg" alt="Mingrx — voice, chat and screen sharing" width="100%">
</p>

<p align="center">
  <a href="https://github.com/rafaelmingroni/mingrx-app/releases/latest"><img alt="Release" src="https://img.shields.io/github/v/release/rafaelmingroni/mingrx-app?style=flat-square&color=7c5cff"></a>
  <img alt="Windows" src="https://img.shields.io/badge/Windows-x64-20232a?style=flat-square&logo=windows11&logoColor=white">
  <img alt="Electron" src="https://img.shields.io/badge/Electron-45-20232a?style=flat-square&logo=electron&logoColor=9feaf9">
  <img alt="Firebase" src="https://img.shields.io/badge/Firebase-Spark-20232a?style=flat-square&logo=firebase&logoColor=ffca28">
  <img alt="WebRTC" src="https://img.shields.io/badge/WebRTC-voice%20%7C%20video%20%7C%20screen-20232a?style=flat-square">
</p>

# Mingrx

**Mingrx é um aplicativo desktop de comunicação para amigos e pequenos grupos, criado para ser bonito, direto e leve enquanto você joga.**

Ele reúne comunidades, canais de texto e voz, mensagens privadas, webcam, compartilhamento de tela, presença e perfis em um único aplicativo para Windows. O projeto nasceu como Banana Cord e evoluiu para Mingrx preservando o caminho de atualização dos usuários existentes.

<!-- mingrx-version:begin -->
> **Mingrx 3.2** · Versão técnica: `3.2.0`
>
> [Notas desta versão](RELEASE_NOTES-3.2.0.md) · [Última versão publicada](https://github.com/rafaelmingroni/mingrx-app/releases/latest)
>
> Projeto pessoal de **Rafael Mingroni**.
<!-- mingrx-version:end -->

## Por que o Mingrx existe

A proposta é simples: oferecer a experiência essencial de um app de comunidade e call sem carregar o jogo com uma interface desnecessariamente pesada.

O Mingrx prioriza:

- **baixo impacto durante jogos**;
- **interface rápida e limpa**;
- **comunidades persistentes**;
- **voz, câmera e compartilhamento de tela no mesmo lugar**;
- **configuração simples para quem só quer entrar e usar**;
- **atualizações automáticas** sem reinstalações manuais a cada versão;
- **backend compatível com Firebase Spark**, sem exigir billing para os recursos principais.

## Novidades desta versão

- sessão de login protegida pelo cofre do sistema, com migração automática das sessões antigas;
- controle de solicitações repetidas de login, cadastro e recuperação de senha;
- validação mais restrita de perfis, imagens, comunidades, canais e permissões no Firebase;
- testes reais de migração de sessão, recuperação de senha, chamadas e atualização automática antes de publicar;
- conferência das regras ativas no backend e documentação da revisão de segurança.

Veja a [revisão de segurança](docs/SECURITY-3.2.md) para conhecer o alcance e os limites dessas proteções.

## Base Firebase gratuita

### Firebase gratuito como base oficial

A produção usa:

- Firebase Authentication para contas e verificação de e-mail;
- Cloud Firestore para comunidades, canais, chat, DMs e perfis;
- Cloud Firestore também para presença e sinalização autorizada das chamadas;
- Realtime Database legado fechado para leitura e escrita;
- WebRTC para voz, webcam e compartilhamento de tela.

O aplicativo **não depende de Firebase Storage**.

### Mídia e comunidades

- foto personalizada para comunidades;
- compactação automática da foto da comunidade;
- a foto é salva como um data URL pequeno no próprio documento do Firestore;
- envio de imagem em chat/DM foi removido para manter o projeto no plano Spark;
- marcadores de imagem eventualmente criados pela 3.0 continuam sendo renderizados por compatibilidade.

### Identidade Mingrx

- marca **Mingrx** em toda a experiência visível;
- símbolo e ícone próprios;
- direção visual em grafite, violeta e superfícies discretas;
- temas de aparência;
- layout de comunidades horizontal e compacto;
- painel de membros contextual;
- menos ruído visual e mais foco no conteúdo.

### Continuidade com o Banana Cord

A identidade visual mudou, mas a migração foi desenhada para não abandonar quem já usava o aplicativo.

O identificador interno do Windows permanece `com.bananacord.app`. Isso é intencional: a Mingrx atualiza a instalação existente em vez de aparecer como um segundo aplicativo independente.

O protocolo antigo `bananacord://` também continua aceito por compatibilidade, enquanto novos convites usam `mingrx://`.

## Recursos

### Conta e perfil

- cadastro por e-mail e senha;
- verificação de e-mail;
- sessão persistente protegida pelo sistema operacional quando disponível;
- recuperação de senha;
- nome, avatar e status;
- presença online.

### Comunidades

- comunidades persistentes na nuvem;
- criação e entrada por convite;
- foto personalizada no modo Spark;
- cargos e permissões;
- categorias;
- canais de texto;
- canais de voz;
- gerenciamento de membros.

### Chat

- mensagens persistentes;
- mensagens privadas;
- edição e exclusão;
- respostas;
- reações;
- menções;
- indicadores de não lidas;
- E2EE em mensagens privadas compatíveis.

### Voz e vídeo

- voz por WebRTC;
- indicador de fala;
- mute e deafen;
- push-to-talk;
- volume individual;
- escolha e teste de microfone;
- seleção de saída de áudio;
- webcam;
- chamadas privadas e em comunidade.

### Compartilhamento de tela

- captura de tela e janelas;
- 720p e 1080p;
- 30 e 60 FPS;
- perfis de qualidade, fluidez e economia;
- prévia local protegida contra efeito espelho recursivo;
- monitoramento de RTT durante chamadas.

### Personalização

- System;
- Midnight;
- Pearl;
- Crimson;
- Ocean;
- Forest;
- Mono.

## Arquitetura

<p align="center">
  <img src="docs/assets/mingrx-cloud-banner.svg" alt="Arquitetura do Mingrx" width="100%">
</p>

| Camada | Responsabilidade |
| --- | --- |
| **Electron** | aplicativo desktop, interface, captura, áudio, integração com Windows e auto-update |
| **Firebase Authentication** | contas e verificação de identidade |
| **Cloud Firestore** | comunidades, membros, canais, mensagens, DMs, perfis, presença e sinalização autorizada |
| **Realtime Database** | legado desativado, com leitura e escrita negadas |
| **WebRTC** | voz, webcam e compartilhamento de tela entre participantes |
| **GitHub Actions** | regressões, testes, build e pipeline de release |
| **electron-updater** | atualização automática do aplicativo |

## Segurança e privacidade

O projeto usa autenticação Firebase com e-mail verificado e regras específicas para Firestore e Realtime Database. A mídia das chamadas utiliza WebRTC, evitando transformar o Firebase em servidor de áudio ou vídeo.

O Mingrx não inicializa Firebase Storage e não oferece upload de imagens em chat/DM. Isso mantém a arquitetura de produção compatível com o plano Spark adotado pelo projeto.

Antes de uma versão oficial ser publicada, o CI executa regressões de interface, Cloud, Firebase Rules, convites, social e fluxos reais do renderer Electron.

## Site oficial

O [mingrx.site](https://mingrx.site/) apresenta o aplicativo com capturas reais da versão 3.2, usando contas de demonstração, com tema escuro e fonte Satoshi hospedada no próprio site. A página permite alternar entre conversa e chamada, oferece um link para continuar no PC a partir do celular e organiza o suporte por tarefa. Convites sem formato válido orientam a pedir um novo link.

## Instalação

A versão oficial para Windows é disponibilizada em **GitHub Releases**:

**[Baixar a versão mais recente](https://github.com/rafaelmingroni/mingrx-app/releases/latest)**

O instalador segue o padrão:

```text
Mingrx-Setup-x.x.x-x64.exe
```

O instalador ainda não possui assinatura digital de código. Por isso, o Windows SmartScreen pode exibir um aviso nas primeiras execuções.

## Atualizações automáticas

O Mingrx usa GitHub Releases + `electron-updater`.

Cada release oficial publica:

```text
Mingrx-Setup-x.x.x-x64.exe
Mingrx-Setup-x.x.x-x64.exe.blockmap
latest.yml
```

O `latest.yml` informa ao aplicativo qual versão está disponível. O blockmap permite atualização diferencial quando suportada pelo updater.

Quem estiver numa versão compatível do Banana Cord ou Mingrx recebe a atualização mantendo a mesma identidade interna de instalação usada pelo Windows.

## Convites

Novos links públicos usam o domínio oficial:

```text
https://mingrx.site/invite.html?invite=CODIGO
```

A página oferece a abertura do aplicativo pelo protocolo `mingrx://join/CODIGO` e o download para quem ainda não instalou.

Por compatibilidade, links antigos continuam podendo usar:

```text
bananacord://join/CODIGO
```

A página pública de convite acompanha a identidade Mingrx e direciona o usuário para o aplicativo ou para a release mais recente.

## Estrutura do repositório

```text
desktop/
├─ assets/              # ícones e identidade do aplicativo
├─ cloud/               # configuração Firebase injetada no build
├─ scripts/             # smoke tests, E2E, build helpers e validações
├─ server/              # camada local/legada de servidor
└─ src/                 # renderer, UI, Cloud e camadas Mingrx

firebase/
├─ firestore.rules
├─ database.rules.json
└─ firebase.json

site/                   # site oficial, convites, suporte e documentos de privacidade
docs/                   # documentação, identidade visual e relatórios de validação

.github/workflows/      # CI, validações e release para Windows
```

## Numeração e documentação de versões

A sequência pública é **3.2, 3.2.1 até 3.2.9, depois 3.3**. Para o instalador e o atualizador, a primeira versão de cada série usa SemVer completo, como `3.2.0`.

Use `npm run release:next` em `desktop/` para avançar a versão e sincronizar o README e o lockfile. Atualize também as novidades e as notas da versão. O CI bloqueia a publicação se o README, as notas e o pacote estiverem divergentes. O selo no topo consulta a última release publicada no GitHub.

Site oficial: [mingrx.site](https://mingrx.site). Suporte e privacidade: [mingrxapp@gmail.com](mailto:mingrxapp@gmail.com).

## Qualidade antes de publicar

A branch de lançamento precisa passar por uma suíte que inclui:

- validação JavaScript;
- auditoria de dependências de produção, integridade do lockfile e padrões de segredos;
- consistência do README e das notas com a versão do pacote;
- regressão da identidade Mingrx;
- regressão de layout em múltiplas resoluções;
- testes de chat e social;
- teste específico garantindo que Storage não volte ao runtime Spark;
- regras de segurança do Firestore e Realtime Database;
- interação real via Electron;
- geração do instalador do Windows;
- verificação da identidade do aplicativo e do artefato final.

## Limitações atuais

- foco atual em Windows x64;
- o plano oficial do backend é Firebase Spark;
- upload de imagem em chat/DM não está disponível;
- chamadas foram desenhadas prioritariamente para grupos pequenos;
- redes com NAT ou firewall muito restritivo podem exigir infraestrutura TURN dedicada;
- qualidade e latência de voz e tela dependem da conexão entre os participantes;
- o instalador ainda não é assinado digitalmente.

## Roadmap

A evolução continua focada em quatro frentes:

1. **experiência** — polimento visual e consistência de todas as telas;
2. **leveza** — reduzir trabalho desnecessário no renderer e durante calls;
3. **confiabilidade** — fortalecer testes de voz, tela, chat e auto-update;
4. **produto** — evoluir recursos sem abandonar a proposta gratuita e simples do projeto.

## Histórico

O projeto começou como **Banana Cord**, inicialmente com sessões dependentes de um host. A V2 trouxe contas, comunidades e persistência Cloud. A V3 transformou essa base em **Mingrx**. A 3.1 consolidou a base Spark-first. A série 3.2 reforça sessão, validação dos dados e verificações da publicação.

---

<p align="center">
  <img src="desktop/assets/mingrx.svg" alt="Mingrx logo" width="72">
</p>
<p align="center"><strong>Mingrx</strong><br>Built to stay light while you play.</p>
