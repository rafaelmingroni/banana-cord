# Mingrx 3.1.0

Mingrx 3.1 ajusta a camada de mídia para manter o projeto compatível com o plano gratuito **Firebase Spark**, sem exigir billing para os recursos principais.

## Destaques

### Firebase Spark como base oficial

A arquitetura de produção da 3.1 usa somente serviços disponíveis no plano gratuito adotado pelo projeto:

- Firebase Authentication;
- Cloud Firestore;
- Realtime Database.

O aplicativo não inicializa nem depende mais do Firebase Storage.

### Imagens em chat e DM removidas

O botão de anexo de imagem e o envio de screenshots pelo clipboard foram removidos do chat e das mensagens privadas, porque esse fluxo dependia de Firebase Storage.

Mensagens de imagem eventualmente criadas pela 3.0 continuam podendo ser exibidas para preservar compatibilidade, mas a 3.1 não oferece novo upload de imagens.

### Foto da comunidade continua gratuita

A foto da comunidade continua disponível. A imagem é compactada de forma agressiva e salva como um data URL pequeno no documento já usado pela comunidade no Firestore, sem Firebase Storage.

### Firebase e CI simplificados

- `firebase.json` agora declara apenas Firestore e Realtime Database;
- testes de regras usam somente os emuladores desses dois serviços;
- `storage.rules` foi removido da configuração atual;
- os testes garantem que `firebase/storage`, `getStorage`, `uploadBytes` e `getDownloadURL` não voltem ao runtime Spark;
- a validação da configuração de produção não exige mais `storageBucket`.

## Compatibilidade

A 3.1 preserva:

- `appId` histórico `com.bananacord.app`;
- atualização automática pela mesma instalação;
- protocolos `mingrx://` e `bananacord://`;
- comunidades, chat de texto, DMs, presença e perfis;
- voz, webcam e compartilhamento de tela;
- E2EE de mensagens privadas;
- identidade visual e temas Mingrx.

## Atualização

Usuários da Mingrx 3.0.0 e versões anteriores compatíveis recebem a 3.1.0 pelo updater normal do aplicativo.

---

**Mingrx 3.1.0**  
Spark-first. Built to stay light while you play.
