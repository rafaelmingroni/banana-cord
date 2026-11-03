# Mingrx

**Comunicação leve para jogar, conversar e compartilhar.**

Mingrx é um aplicativo desktop para grupos de amigos, criado por Rafael Mingroni com foco em **baixo consumo durante jogos**, interface rápida e comunicação direta. Ele reúne comunidades, chat, mensagens privadas, voz, câmera e compartilhamento de tela em um único app.

> **Versão pública atual: 3.0.0**

## O que é o Mingrx 3.0

O Mingrx 3.0 marca a evolução pública do projeto que começou como Banana Cord. A identidade visual, o aplicativo e a experiência agora são Mingrx, mantendo compatibilidade de atualização para quem já usava versões anteriores.

Quem já possui Banana Cord instalado recebe o Mingrx pelo **atualizador automático**. Conta, comunidades, preferências locais e chaves de criptografia são preservadas durante a migração.

## Recursos

### Conta e perfil
- Conta persistente com e-mail e senha
- Verificação de e-mail
- Recuperação de senha
- Avatar, nome, presença e status personalizado
- Migração automática de dados locais das versões anteriores

### Comunidades
- Comunidades persistentes
- Foto personalizada com compactação automática
- Convites permanentes e temporários
- Cargos: Dono, Administrador, Moderador e Membro
- Categorias e canais de texto/voz
- Canais com restrição por cargo
- Lista de membros e presença em tempo real

### Chat e mensagens privadas
- Mensagens persistentes
- Edição, exclusão, respostas, reações e menções
- Indicadores de não lidas
- Amigos, solicitações e bloqueio
- Mensagens privadas com criptografia ponta a ponta
- Envio de imagens e prints em comunidades e DMs
- Ctrl+V para colar screenshots diretamente no chat
- Visualização ampliada de imagens

### Voz, câmera e compartilhamento
- Voz WebRTC para grupos pequenos
- Chamada privada 1:1
- Mute, deafen e push-to-talk
- Volume individual por participante
- Seleção e teste de microfone/saída de áudio
- Webcam
- Compartilhamento de tela 720p/1080p, 30/60 FPS
- Perfis de qualidade, fluidez e economia
- Diagnóstico de conexão e RTT
- Prévia local protegida contra efeito espelho recursivo

### Interface
- Identidade visual Mingrx
- Temas Sistema, Midnight, Pearl, Crimson, Ocean, Forest e Mono
- Layout responsivo para diferentes resoluções e ultrawide
- Interface de amigos/privado integrada ao shell principal
- Atualizador visual em segundo plano

## Instalação

Baixe a versão mais recente em **Releases**:

https://github.com/rafaelmingroni/banana-cord/releases/latest

O instalador oficial segue o padrão:

`Mingrx-Setup-x.x.x-x64.exe`

O instalador ainda não possui assinatura digital, então o Windows SmartScreen pode exibir um aviso na primeira execução.

## Atualizações automáticas e migração

Mingrx usa GitHub Releases + `electron-updater`.

A versão 3.0 mantém deliberadamente a identidade técnica de instalação das versões Banana Cord para permitir uma atualização **no mesmo aplicativo**, sem criar uma instalação paralela. Isso inclui o mesmo App ID e suporte temporário ao protocolo antigo de convite.

Após atualizar para a linha 3.x, o usuário vê um aviso dentro do app explicando que o projeto ganhou um novo nome e identidade, enquanto sua conta e configurações continuam preservadas.

Cada Release oficial publica:
- `Mingrx-Setup-x.x.x-x64.exe`
- `Mingrx-Setup-x.x.x-x64.exe.blockmap`
- `latest.yml`

> O slug técnico deste repositório permanece `banana-cord` durante a migração para garantir que instalações antigas encontrem a Release 3.0 automaticamente. O produto público é Mingrx.

## Convites

O protocolo principal é:

`mingrx://join/CODIGO`

Durante a migração, `bananacord://` continua aceito para não invalidar links antigos.

A página pública de convite permanece temporariamente no endereço técnico do repositório:

`https://rafaelmingroni.github.io/banana-cord/?invite=CODIGO`

## Arquitetura

- Electron no desktop
- Firebase Authentication para contas
- Firestore para comunidades, canais, mensagens, relações sociais e DMs
- Firebase Realtime Database para presença, sinalização e estado de voz
- Firebase Storage para fotos de comunidades e imagens do chat
- WebRTC para voz, câmera e compartilhamento de tela
- Criptografia X25519 + AES-256-GCM nas mensagens privadas protegidas
- GitHub Releases + `electron-updater` para distribuição e atualizações
- GitHub Actions para testes, validação de regras, build e publicação

## Segurança

- E-mail verificado obrigatório para operações Cloud
- Regras de Firestore/Realtime Database/Storage validadas em emuladores no CI
- Chaves privadas E2EE permanecem no dispositivo
- Uploads de imagem são compactados no cliente e validados por tipo/tamanho no Storage
- Navegação externa e permissões do Electron são limitadas pelo processo principal

## Limitações atuais

- Calls são otimizadas para grupos pequenos
- Redes com NAT/firewall extremamente restritivo podem exigir TURN dedicado no futuro
- O instalador ainda não é assinado digitalmente
- Qualidade de voz/tela depende da conexão entre os participantes

## Estrutura do projeto

- `desktop/` — aplicativo Electron Mingrx
- `desktop/src/` — interface e runtime Cloud
- `firebase/` — regras e configuração dos emuladores
- `docs/` — página pública de convite e documentação
- `.github/workflows/` — validação, build e publicação

---

Mingrx é um projeto em desenvolvimento contínuo. Bugs encontrados após o lançamento são tratados por atualizações incrementais distribuídas pelo próprio aplicativo.
