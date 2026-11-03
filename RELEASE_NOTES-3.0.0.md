# Mingrx 3.0.0

Mingrx 3.0 é a maior mudança de identidade do projeto até agora. O antigo Banana Cord evolui para um produto com marca própria, interface mais limpa e uma base preparada para continuar recebendo melhorias sem abandonar usuários das versões anteriores.

## Destaques

### Mingrx, de ponta a ponta

- nova marca **Mingrx**;
- novo ícone e identidade visual;
- instalador `Mingrx-Setup-3.0.0-x64.exe`;
- novo protocolo `mingrx://`;
- compatibilidade mantida com links antigos `bananacord://`;
- tray, updater, janelas, textos e documentação migrados para a nova identidade.

### Interface redesenhada

- superfícies grafite e violeta mais discretas;
- comunidades em navegação horizontal;
- painel de membros contextual;
- redução de ruído visual e efeitos desnecessários;
- temas System, Midnight, Pearl, Crimson, Ocean, Forest e Mono;
- melhorias de contraste e acessibilidade;
- validações de layout em múltiplas resoluções.

### Imagens no chat

- envio de imagens em canais de texto;
- envio de imagens em mensagens privadas;
- suporte a colar screenshots pelo clipboard;
- compactação automática antes do upload;
- visualização ampliada;
- Firebase Storage com regras próprias de autenticação, MIME e tamanho.

### Foto de comunidade

Administradores podem definir uma imagem para a comunidade. O Mingrx compacta o arquivo antes do envio e mantém fallback seguro quando necessário.

### Convites

O fluxo de convite foi revisado para abrir o modal imediatamente e evitar travamentos durante operações assíncronas. Novos links usam `mingrx://join/...` e a landing pública recebeu a mesma identidade visual do aplicativo.

### Firebase mais consistente

Uploads de mídia agora reutilizam a mesma instância Firebase já autenticada pelo aplicativo. Isso evita misturar runtimes e elimina uma classe de falhas envolvendo Storage e o app `[DEFAULT]`.

## Migração do Banana Cord

Apesar do novo nome, a V3 preserva o identificador interno de produção:

```text
com.bananacord.app
```

Isso é intencional. O objetivo é permitir que uma instalação existente do Banana Cord seja atualizada para Mingrx em vez de o Windows tratar a V3 como um segundo aplicativo independente.

A marca visível passa a ser Mingrx; o identificador legado permanece apenas por compatibilidade técnica.

## GitHub e documentação

A V3 também reorganiza a presença pública do projeto:

- README totalmente refeito;
- banners oficiais do Mingrx;
- logo no README;
- arquitetura documentada;
- guia Mingrx Cloud atualizado;
- landing de convites rebatizada;
- workflows atualizados para Mingrx;
- pipeline de release preparado para artefatos `Mingrx-Setup-*`;
- repositório preparado para ser renomeado de `banana-cord` para `mingrx`.

## Arquitetura

Mingrx continua usando:

- Electron no desktop;
- Firebase Authentication para contas;
- Firestore para dados persistentes;
- Realtime Database para presença e sinalização;
- Firebase Storage para imagens;
- WebRTC para voz, webcam e compartilhamento de tela;
- GitHub Releases + `electron-updater` para atualizações.

## Qualidade e testes

O lançamento da V3 passa por:

- auditoria de dependências críticas;
- validação de JavaScript;
- smoke tests Mingrx;
- regressões Cloud e UI;
- testes de regras Firebase, incluindo Storage;
- testes de chat, social, mídia e convite;
- testes Electron E2E;
- validação do instalador final;
- proteção contra alteração acidental do `appId` de migração.

## Observações

- foco atual: Windows x64;
- o instalador ainda não possui assinatura digital;
- redes muito restritivas podem exigir TURN para alguns cenários WebRTC;
- qualidade de voz, vídeo e compartilhamento depende da conexão entre os participantes.

---

**Mingrx 3.0**  
Built to stay light while you play.
