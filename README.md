<p align="center">
  <img src="docs/assets/mingrx-readme-banner.svg" alt="Mingrx — voice, chat and screen sharing" width="100%">
</p>

<p align="center">
  <a href="https://github.com/rafaelmingroni/mingrx-app/releases/latest"><img alt="Release" src="https://img.shields.io/badge/release-3.0.0-7c5cff?style=flat-square"></a>
  <img alt="Windows" src="https://img.shields.io/badge/Windows-x64-20232a?style=flat-square&logo=windows11&logoColor=white">
  <img alt="Electron" src="https://img.shields.io/badge/Electron-45-20232a?style=flat-square&logo=electron&logoColor=9feaf9">
  <img alt="Firebase" src="https://img.shields.io/badge/Firebase-Cloud-20232a?style=flat-square&logo=firebase&logoColor=ffca28">
  <img alt="WebRTC" src="https://img.shields.io/badge/WebRTC-voice%20%7C%20video%20%7C%20screen-20232a?style=flat-square">
</p>

# Mingrx

**Mingrx é um aplicativo desktop de comunicação para amigos e pequenos grupos, criado para ser bonito, direto e leve enquanto você joga.**

Ele reúne comunidades, canais de texto e voz, mensagens privadas, webcam, compartilhamento de tela, presença e perfis em um único aplicativo para Windows. A V3 marca a transformação completa do antigo **Banana Cord** em Mingrx, preservando a base técnica e o caminho de atualização dos usuários existentes.

> **Versão em preparação: Mingrx 3.0.0**  
> Projeto pessoal de **Rafael Mingroni**.

## Por que o Mingrx existe

A proposta é simples: oferecer a experiência essencial de um app de comunidade e call sem carregar o jogo com uma interface desnecessariamente pesada.

O Mingrx prioriza:

- **baixo impacto durante jogos**;
- **interface rápida e limpa**;
- **comunidades persistentes**;
- **voz, câmera e compartilhamento de tela no mesmo lugar**;
- **configuração simples para quem só quer entrar e usar**;
- **atualizações automáticas** sem reinstalações manuais a cada versão.

## Mingrx 3.0

A V3 não é apenas uma troca de nome. É uma nova identidade construída sobre a base amadurecida nas versões anteriores.

### Nova identidade

- marca **Mingrx** em toda a experiência visível;
- novo símbolo e novo ícone do aplicativo;
- direção visual em grafite, violeta e superfícies discretas;
- temas de aparência;
- layout de comunidades mais horizontal e compacto;
- painel de membros contextual;
- menos ruído visual, menos efeitos decorativos e mais foco no conteúdo.

### Mídia e comunidades

- foto personalizada para comunidades;
- anexos de imagem em canais e mensagens privadas;
- colar screenshots diretamente pelo clipboard;
- compactação automática das imagens antes do envio;
- visualização ampliada das imagens;
- armazenamento protegido por regras do Firebase Storage.

### Continuidade com o Banana Cord

A identidade visual muda, mas a migração foi desenhada para não abandonar quem já usa o aplicativo.

O identificador interno do Windows permanece compatível com a instalação histórica do Banana Cord. Assim, a V3 pode assumir a instalação existente e continuar o fluxo de atualização automática em vez de aparecer como um aplicativo totalmente separado.

O protocolo antigo `bananacord://` também continua aceito por compatibilidade, enquanto novos convites passam a usar `mingrx://`.

## Recursos

### Conta e perfil

- cadastro por e-mail e senha;
- verificação de e-mail;
- login persistente;
- recuperação de senha;
- nome, avatar e status;
- presença online.

### Comunidades

- comunidades persistentes na nuvem;
- criação e entrada por convite;
- foto personalizada;
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
- anexos de imagem;
- suporte a screenshot via copiar/colar.

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

- tema do sistema;
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

O Mingrx separa dados persistentes de mídia em tempo real:

| Camada | Responsabilidade |
| --- | --- |
| **Electron** | aplicativo desktop, interface, captura, áudio, integração com Windows e auto-update |
| **Firebase Authentication** | contas e verificação de identidade |
| **Cloud Firestore** | comunidades, membros, canais, mensagens e DMs |
| **Realtime Database** | presença e sinalização em tempo real |
| **Firebase Storage** | fotos de comunidades e anexos de imagem |
| **WebRTC** | voz, webcam e compartilhamento de tela entre participantes |
| **GitHub Actions** | regressões, testes, build e pipeline de release |
| **electron-updater** | atualização automática do aplicativo |

## Segurança e privacidade

O projeto usa autenticação Firebase com e-mail verificado e regras específicas para restringir o acesso aos dados e uploads. O Firebase Storage valida usuário, propriedade do caminho, tipo de arquivo e tamanho antes de aceitar imagens.

A mídia das chamadas utiliza WebRTC. Isso evita transformar o Firebase em servidor de áudio ou vídeo e mantém a arquitetura mais adequada para grupos pequenos.

Antes de uma versão oficial ser publicada, o CI executa regressões de interface, Cloud, Firebase Rules, mídia, convites e fluxos reais do renderer Electron.

## Instalação

A versão oficial para Windows será disponibilizada em **GitHub Releases**:

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

O `latest.yml` informa ao aplicativo qual é a versão disponível. O blockmap permite atualização diferencial quando suportada pelo updater.

Quem estiver numa versão compatível do Banana Cord poderá migrar para Mingrx mantendo a mesma identidade interna de instalação usada pelo Windows.

## Convites

Novos links usam:

```text
mingrx://join/CODIGO
```

Por compatibilidade, links antigos continuam podendo usar:

```text
bananacord://join/CODIGO
```

A página pública de convite acompanha a nova identidade do Mingrx e direciona o usuário para o aplicativo ou para a release mais recente.

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
├─ storage.rules
└─ firebase.json

docs/
├─ assets/              # identidade visual usada na documentação
└─ index.html           # landing pública de convites

.github/workflows/      # CI, validações e release para Windows
```

## Qualidade antes de publicar

A branch de lançamento precisa passar por uma suíte que inclui:

- validação JavaScript;
- auditoria de dependências críticas;
- regressão do rebrand Mingrx;
- regressão de layout em múltiplas resoluções;
- testes de chat e social;
- testes de mídia e convites;
- regras de segurança do Firestore, Realtime Database e Storage;
- interação real via Electron;
- geração do instalador do Windows;
- verificação de identidade do aplicativo e do artefato final.

## Limitações atuais

- o foco atual é Windows x64;
- chamadas foram desenhadas prioritariamente para grupos pequenos;
- redes com NAT ou firewall muito restritivo podem exigir infraestrutura TURN dedicada;
- qualidade e latência de voz e tela dependem da conexão entre os participantes;
- o instalador ainda não é assinado digitalmente.

## Roadmap

A evolução da V3 continua focada em quatro frentes:

1. **experiência** — polimento visual e consistência de todas as telas;
2. **leveza** — reduzir trabalho desnecessário no renderer e durante calls;
3. **confiabilidade** — fortalecer testes de voz, tela, chat e auto-update;
4. **produto** — tornar entrada, convite, comunidade e atualização cada vez mais simples para novos usuários.

## Histórico

O projeto começou como **Banana Cord**, inicialmente com sessões dependentes de um host. A V2 trouxe contas, comunidades e persistência Cloud. A V3 transforma essa base em **Mingrx**, com identidade própria e uma experiência muito mais próxima do produto que o projeto pretende ser.

---

<p align="center">
  <img src="desktop/assets/mingrx.svg" alt="Mingrx logo" width="72">
</p>
<p align="center"><strong>Mingrx</strong><br>Built to stay light while you play.</p>
