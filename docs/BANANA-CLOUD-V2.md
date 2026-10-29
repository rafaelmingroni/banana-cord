# Banana Cord V2 Cloud

Esta branch é uma migração isolada. A versão estável atual continua na `main`.

## Objetivo

Eliminar a necessidade de um amigo hospedar o servidor para que o Banana Cord exista.

A V2 separa o sistema em três camadas:

- **Firebase Authentication** — conta, login, senha, confirmação de e-mail e recuperação de senha.
- **Cloud Firestore** — servidores, canais, histórico e mensagens privadas persistentes.
- **Realtime Database** — presença online/offline e, nas próximas etapas, sinalização de voz.

Áudio, webcam e compartilhamento de tela continuam em **WebRTC**, evitando enviar mídia pesada pelo banco de dados.

## O que já existe nesta foundation

- Tela Entrar / Criar conta.
- Sessão persistente no PC.
- Envio de e-mail de verificação.
- Recuperação de senha.
- Bloqueio da interface cloud enquanto o e-mail não estiver verificado.
- Perfil básico persistente.
- Presença online/offline.
- Criação de servidor permanente na nuvem.
- Canal `# geral` criado automaticamente.
- Histórico de mensagens no Firestore.
- API de mensagens privadas persistentes.
- Cache local do Firestore quando suportado pelo Chromium/Electron.
- Regras iniciais de segurança para Firestore e Realtime Database.
- CI separado que não publica a V2 para usuários da versão estável.

## Configuração do Firebase

### 1. Criar o projeto

No Firebase Console, crie um projeto chamado, por exemplo, `banana-cord`.

Não é necessário publicar a V2 enquanto a configuração não estiver concluída.

### 2. Criar um Web App

Em **Project settings > Your apps**, adicione um Web App.

Copie os campos da configuração para:

`desktop/cloud/firebase-config.js`

O arquivo já contém os campos esperados:

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

### 3. Ativar Authentication

Em **Authentication > Sign-in method**, habilite:

- Email/Password

O Banana Cord já chama o fluxo de verificação de e-mail após criar a conta.

### 4. Criar Cloud Firestore

Crie o banco Firestore e mantenha-o protegido por regras.

As regras preparadas estão em:

`firebase/firestore.rules`

Elas exigem usuário autenticado com e-mail verificado para dados do Banana Cloud.

### 5. Criar Realtime Database

Crie um Realtime Database e copie o `databaseURL` para `firebase-config.js`.

As regras preparadas estão em:

`firebase/database.rules.json`

### 6. Aplicar as regras

É possível colar as regras pelos consoles do Firestore e Realtime Database ou usar Firebase CLI.

O arquivo `firebase/firebase.json` já referencia ambos os arquivos de regras.

## Estrutura de dados inicial

```text
users/{uid}
users/{uid}/serverRefs/{serverId}

servers/{serverId}
servers/{serverId}/members/{uid}
servers/{serverId}/channels/general
servers/{serverId}/channels/{channelId}/messages/{messageId}

dmThreads/{uidA_uidB}
dmThreads/{uidA_uidB}/messages/{messageId}

Realtime Database:
presence/{uid}
signaling/{roomId}
```

## Próximas etapas da migração

1. Integrar a UI completa atual ao modelo cloud.
2. Migrar amigos, bloqueios, cargos, categorias e permissões para Firestore.
3. Criar convites cloud permanentes/temporários sem depender de host.
4. Migrar DMs existentes do host local para a conta cloud quando possível.
5. Trocar signaling de voz local por Realtime Database.
6. Remover o botão `Hospedar` do fluxo principal.
7. Manter modo legado temporariamente para recuperação/migração.
8. Adicionar TURN como fallback mantendo WebRTC P2P como primeira opção.
9. Só publicar a V2 como `latest` depois de teste com duas contas e dois PCs reais.

## Segurança

A configuração Web do Firebase identifica o projeto, mas não substitui regras de segurança. O acesso aos dados deve ser protegido por Authentication + Firestore/Realtime Database Rules.

Antes da V2 pública, o renderer Electron também deve migrar de `nodeIntegration: true` para uma API limitada via `preload`/`contextBridge`.
