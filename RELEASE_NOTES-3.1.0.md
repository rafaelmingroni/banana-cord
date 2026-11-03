# Mingrx 3.1.0

Mingrx 3.1 ajusta a camada de mídia para manter o projeto compatível com o plano gratuito **Firebase Spark**, sem exigir billing para os recursos principais, e corrige pontos de uso encontrados logo após a estreia da V3.

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

### Foto da comunidade corrigida e mantida no plano gratuito

A foto da comunidade continua disponível sem Storage. A imagem é compactada e salva como um data URL pequeno no documento já usado pela comunidade no Firestore.

A tela de configurações da comunidade também foi corrigida:

- painel mais largo e confortável;
- prévia da foto visível;
- botão **Escolher foto / Trocar foto** visível;
- card da foto posicionado corretamente abaixo do cabeçalho, em vez de ficar preso dentro da área de título;
- layout responsivo para janelas menores.

### Identidade correta na sala de voz

A lista de participantes da call agora resolve o nome atual diretamente pelo perfil/membro da comunidade, em vez de depender apenas do nome que ficou cacheado na sessão de voz.

Isso corrige casos em que participantes apareciam com rótulos incorretos, como **“Comunidade”**, no lugar do próprio nome.

### Parar de assistir a uma transmissão

Ao escolher **Assistir transmissão**, a transmissão focada agora recebe um botão visível **✕ Parar de assistir**.

Ao clicar nele:

- o foco exclusivo da transmissão é encerrado;
- a grade normal da call volta a aparecer;
- o usuário continua na sala de voz;
- não é necessário sair da call para parar de assistir.

### Compartilhamento encerrado não congela mais o último frame

Quando o transmissor encerra a tela, o cliente remoto agora limpa explicitamente o player caso `screen` e `camera` estejam desligados.

Isso evita o comportamento em que o último frame da transmissão permanecia parado, parecendo uma live travada. O card volta imediatamente para o avatar do participante.

### Firebase e CI simplificados

- `firebase.json` agora declara apenas Firestore e Realtime Database;
- testes de regras usam somente os emuladores desses dois serviços;
- `storage.rules` foi removido da configuração atual;
- os testes garantem que `firebase/storage`, `getStorage`, `uploadBytes` e `getDownloadURL` não voltem ao runtime Spark;
- a validação da configuração de produção não exige mais `storageBucket`;
- E2E verifica o posicionamento/visibilidade da foto da comunidade, nomes corretos na call, o fluxo **Parar de assistir** e a limpeza de vídeo após o fim de uma transmissão.

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
