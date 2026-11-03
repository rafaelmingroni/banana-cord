# Mingrx Cloud

Mingrx usa Firebase para contas e persistência, mantendo a mídia de voz/câmera/tela em WebRTC.

## Serviços

- **Firebase Authentication** — conta, login, recuperação de senha e verificação de e-mail.
- **Cloud Firestore** — comunidades, membros, canais, mensagens, amizades, DMs e metadados E2EE.
- **Realtime Database** — presença, signaling e estado de voz em tempo real.
- **Firebase Storage** — fotos de comunidades e imagens/prints enviados no chat.
- **WebRTC** — voz, webcam e compartilhamento de tela entre participantes.

O projeto Firebase mantém o ID técnico histórico durante a migração 3.0. Isso não altera a identidade pública do produto, que é Mingrx.

## Configuração esperada

O build oficial injeta `desktop/cloud/firebase-config.js` pelo secret `BANANA_FIREBASE_CONFIG_JSON` já usado pela esteira de CI. O objeto precisa conter:

```js
{
  apiKey,
  authDomain,
  projectId,
  databaseURL,
  storageBucket,
  messagingSenderId,
  appId
}
```

## Authentication

Em **Authentication > Sign-in method**, habilite **Email/Password**.

Mingrx exige e-mail verificado para operações Cloud protegidas.

## Firestore

As regras oficiais estão em:

`firebase/firestore.rules`

Principais coleções:

```text
users/{uid}
publicProfiles/{uid}
e2eeKeys/{uid}
relationships/{relationshipId}
servers/{serverId}
servers/{serverId}/members/{uid}
servers/{serverId}/channels/{channelId}
servers/{serverId}/channels/{channelId}/messages/{messageId}
invites/{code}
dmThreads/{threadId}
dmThreads/{threadId}/messages/{messageId}
```

## Realtime Database

As regras oficiais estão em:

`firebase/database.rules.json`

O Realtime Database é usado para presença e signaling de mídia/voz. O `databaseURL` precisa apontar para a instância do projeto.

## Storage

As regras oficiais estão em:

`firebase/storage.rules`

Caminhos usados pelo Mingrx:

```text
mingrx/community-icons/{uid}/...
mingrx/chat-media/{uid}/...
```

O app compacta imagens antes do upload. Arquivos originais podem ter até 40 MB; o cliente reduz resolução/qualidade antes de enviar. O Storage aceita apenas o resultado compactado, com até 2 MB e MIME `image/png`, `image/jpeg` ou `image/webp`.

A versão 3.0 corrige um problema importante do preview: o Storage agora é carregado dentro do mesmo bundle Firebase que inicializa Authentication/Firestore. Isso evita criar um segundo registro de SDK sem app `[DEFAULT]`.

## Publicação das regras

Com Firebase CLI autenticada:

```bash
firebase deploy --project banana-cord --config firebase/firebase.json --only firestore:rules,database,storage
```

O workflow oficial faz a mesma publicação automaticamente quando o secret `FIREBASE_TOKEN` está configurado. Sem esse secret, a Release continua validando as regras em emuladores, mas o deploy precisa ser feito manualmente no Firebase Console/CLI antes de considerar o backend atualizado.

## Segurança

- e-mail verificado para acesso protegido
- memberships/cargos validados no Firestore
- uploads limitados ao UID autenticado
- MIME e tamanho verificados no Storage
- chaves privadas E2EE nunca são gravadas no Firebase
- DMs protegidas usam X25519 + AES-256-GCM

## Compatibilidade

Nomes internos como `BananaCloud`, eventos `banana:*` e o ID técnico do projeto permanecem temporariamente porque fazem parte do protocolo e do armazenamento legado. Eles não são apresentados como marca ao usuário e não devem ser renomeados durante a migração 3.0 sem um plano de dados compatível.
