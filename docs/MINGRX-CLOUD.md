# Mingrx Cloud

A camada Cloud do Mingrx existe para que contas, comunidades e mensagens continuem disponíveis sem depender de um usuário específico hospedar a sessão.

## Arquitetura Spark-first

A Mingrx 3.1 usa três serviços Firebase na produção:

- **Firebase Authentication** — conta, login, verificação de e-mail e recuperação de senha;
- **Cloud Firestore** — comunidades, membros, canais, mensagens, DMs, perfis e fotos compactadas de comunidade;
- **Realtime Database** — presença e sinalização em tempo real.

O projeto permanece no plano **Firebase Spark**. A Mingrx 3.1 não inicializa nem depende de Firebase Storage.

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
sessionOwners/{sessionId}
voiceRooms/{roomId}/{channelId}/{sessionId}
signals/{targetSession}/{signalId}
```

## Fotos de comunidade

A foto da comunidade continua disponível na 3.1 sem Firebase Storage.

O cliente:

1. valida PNG, JPG ou WebP;
2. reduz a dimensão da imagem;
3. compacta para WebP/JPEG;
4. converte o resultado em um data URL pequeno;
5. salva esse valor no documento já usado pela comunidade no Firestore.

O limite é propositalmente conservador para não aproximar o documento do limite máximo do Firestore.

## Imagens em chat e DM

Novos uploads de imagem em canais e mensagens privadas foram removidos na 3.1 porque exigiriam uma camada de armazenamento de objetos. Como o projeto adota Spark, esse recurso não faz parte da arquitetura atual.

A camada de compatibilidade ainda sabe renderizar marcadores de imagem da 3.0 caso algum exista, mas a 3.1 não cria novos uploads.

## Firestore e Realtime Database

As regras oficiais estão em:

```text
firebase/firestore.rules
firebase/database.rules.json
```

O arquivo principal referencia apenas esses dois serviços:

```text
firebase/firebase.json
```

## Configuração do aplicativo

O build injeta a configuração pública do projeto Firebase em:

```text
desktop/cloud/firebase-config.js
```

Campos usados pelos serviços atuais incluem:

```js
module.exports = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  databaseURL: '',
  messagingSenderId: '',
  appId: ''
};
```

A configuração identifica o projeto, mas **não substitui regras de segurança**. A proteção real depende de Authentication + Rules.

## CI e validação

Antes de uma release oficial, a pipeline valida:

- sintaxe e build do cliente;
- regras do Firestore;
- regras do Realtime Database;
- ausência de dependência de Firebase Storage no runtime Spark;
- fluxos Cloud principais;
- convites e social;
- regressões de UI;
- interação real via Electron;
- geração do instalador.

## WebRTC

A mídia em tempo real continua separada do banco de dados:

- voz;
- webcam;
- compartilhamento de tela.

O Realtime Database participa da sinalização, mas não carrega o fluxo bruto de áudio ou vídeo.

## Compatibilidade histórica

O Mingrx nasceu da evolução do Banana Cord V2 Cloud. Alguns identificadores internos continuam usando nomes antigos para preservar atualização, dados e compatibilidade. Novas interfaces, documentação e recursos públicos usam a marca Mingrx.
