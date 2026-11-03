# Mingrx Cloud

A camada Cloud do Mingrx existe para que comunidades, contas e mensagens continuem disponíveis sem depender de um usuário específico hospedar a sessão.

## Arquitetura

O sistema é dividido em quatro blocos principais:

- **Firebase Authentication** — conta, login, verificação de e-mail e recuperação de senha;
- **Cloud Firestore** — comunidades, membros, canais, mensagens, DMs e dados persistentes;
- **Realtime Database** — presença e sinalização em tempo real;
- **Firebase Storage** — fotos de comunidades e anexos de imagem.

Áudio, webcam e compartilhamento de tela continuam em **WebRTC**. O Firebase não é usado como transporte de mídia pesada das calls.

## Fluxo de conta

1. o usuário cria uma conta com e-mail e senha;
2. o Mingrx envia a verificação por e-mail;
3. a interface Cloud permanece bloqueada até a confirmação;
4. após a verificação, o perfil é criado/atualizado no Firestore;
5. presença online é registrada no Realtime Database.

## Dados persistentes

Estrutura resumida:

```text
users/{uid}
users/{uid}/serverRefs/{serverId}

servers/{serverId}
servers/{serverId}/members/{uid}
servers/{serverId}/channels/{channelId}
servers/{serverId}/channels/{channelId}/messages/{messageId}

dmThreads/{uidA_uidB}
dmThreads/{uidA_uidB}/messages/{messageId}

Realtime Database:
presence/{uid}
signaling/{roomId}

Firebase Storage:
mingrx/community-icons/{uid}/...
mingrx/chat-media/{uid}/...
```

## Firebase Storage

A V3 usa Storage para dois tipos de mídia:

- fotos de comunidade;
- imagens enviadas em canais ou DMs.

Antes do upload, o cliente compacta a imagem. As regras de Storage exigem:

- usuário autenticado;
- e-mail verificado;
- UID do usuário compatível com o caminho do objeto;
- MIME permitido (`png`, `jpeg` ou `webp`);
- tamanho dentro do limite configurado.

As regras ficam em:

```text
firebase/storage.rules
```

## Firestore e Realtime Database

As regras estão em:

```text
firebase/firestore.rules
firebase/database.rules.json
```

O arquivo principal do Firebase referencia todos os conjuntos de regras:

```text
firebase/firebase.json
```

## Configuração do aplicativo

O build injeta a configuração pública do projeto Firebase em:

```text
desktop/cloud/firebase-config.js
```

Campos esperados:

```js
module.exports = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  databaseURL: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};
```

A configuração identifica o projeto, mas **não substitui regras de segurança**. Proteção real depende de Authentication + Rules.

## CI e validação

Antes de uma release oficial, a pipeline valida:

- sintaxe e build do cliente;
- regras do Firestore;
- regras do Realtime Database;
- regras do Storage;
- fluxos Cloud principais;
- mídia e convites;
- regressões de UI;
- interação real via Electron.

Quando a credencial de deploy estiver configurada, o workflow oficial também publica as regras validadas no projeto Firebase de produção.

## WebRTC

A mídia em tempo real continua separada do banco de dados:

- voz;
- webcam;
- compartilhamento de tela.

O Realtime Database participa da sinalização, mas não carrega o fluxo bruto de áudio ou vídeo.

## Compatibilidade histórica

O Mingrx nasceu da evolução do Banana Cord V2 Cloud. Alguns identificadores internos podem continuar usando nomes antigos quando isso reduz risco de migração. Novas interfaces, documentação e recursos públicos devem usar a marca Mingrx.
