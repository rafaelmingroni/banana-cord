# 🍌 Banana Cord

**Projeto pessoal de Rafael Mingroni.**

Banana Cord é um aplicativo leve de comunicação para grupos pequenos de amigos, com servidores, canais de texto e voz, mensagens privadas, webcam e compartilhamento de tela. A prioridade continua sendo **baixo consumo durante jogos**, visual simples e uso direto.

> **Versão atual: v2.0.0**

## 🚀 O que mudou na V2

A V1 dependia de um usuário hospedar a sessão. Na V2 isso mudou: o Banana Cord passa a usar **contas e servidores persistentes no Banana Cloud**.

Agora o fluxo é:
1. abrir o Banana Cord;
2. criar uma conta com e-mail e senha;
3. verificar o e-mail;
4. entrar na conta;
5. criar um servidor ou entrar por convite;
6. usar texto, voz, câmera e compartilhamento sem depender de um host específico ficar online.

A mídia das calls continua em **WebRTC entre os participantes**, enquanto autenticação, servidores, mensagens, presença e sinalização usam Firebase.

## ✨ Recursos

### Conta e perfil
- Cadastro por e-mail e senha
- Verificação de e-mail
- Login persistente
- Logout e novo login
- Recuperação/troca de senha pelo fluxo de conta
- Nome, avatar e status

### Servidores e canais
- Servidores persistentes
- Convites por código/link
- Cargos: Dono, Administrador, Moderador e Membro
- Categorias e canais
- Canais de texto e voz
- Permissões de acesso

### Chat e privado
- Mensagens persistentes
- Editar e excluir mensagens
- Respostas, reações e @menções
- Indicadores de não lidas
- Mensagens privadas
- Amigos, bloqueio e status

### Voz, câmera e tela
- Voz WebRTC para grupos pequenos
- Indicador de fala
- Mute, deafen e push-to-talk
- Volume individual
- Seleção e teste de microfone
- Seleção de saída de áudio
- Webcam
- Compartilhamento 720p/1080p e 30/60 FPS
- Perfis de qualidade, fluidez e economia
- RTT WebRTC exibido durante calls
- Prévia local segura ao compartilhar a própria tela, evitando efeito espelho recursivo

### Notificações e sons
- Sons de entrada/saída da chamada
- Sons de pessoas entrando/saindo
- Sons de mute/desmute
- Sons de deafen/undeafen
- Alerta de mensagem privada
- Volume configurável e botão de teste

### Configurações
- Perfil
- Áudio
- Vídeo e tela
- Geral
- Diagnóstico
- Notificações
- Atualizações

## 🚀 Instalação

Baixe a versão mais recente em **Releases**:

https://github.com/rafaelmingroni/banana-cord/releases/latest

O instalador do Windows ainda não possui assinatura digital, então o SmartScreen pode exibir um aviso.

O instalador oficial segue o padrão:

`Banana-Cord-Setup-x.x.x-x64.exe`

## 🔄 Atualizações automáticas

O Banana Cord usa GitHub Releases + `electron-updater`.

Quem já tem uma versão instalada recebe novas versões automaticamente. Quando uma Release nova é publicada, o aplicativo verifica a atualização, baixa em segundo plano e oferece **Reiniciar e instalar**.

Cada Release oficial publica:
- `Banana-Cord-Setup-x.x.x-x64.exe`
- `Banana-Cord-Setup-x.x.x-x64.exe.blockmap`
- `latest.yml`

Isso permite migrar da linha 1.2.x para a V2 e, depois, receber futuras versões 2.1, 2.2 e assim por diante sem precisar baixar manualmente um instalador novo toda vez.

## 🔗 Convites

O instalador registra o protocolo `bananacord://`, permitindo que links de convite abram o aplicativo instalado.

A página pública de entrada continua em:

`https://rafaelmingroni.github.io/banana-cord/?invite=CODIGO`

## ⚙️ Arquitetura V2

- Electron no desktop
- Firebase Authentication para contas
- Firestore para servidores, membros, canais, mensagens e DMs
- Firebase Realtime Database para presença e sinalização em tempo real
- WebRTC para voz, webcam e compartilhamento de tela
- GitHub Releases + `electron-updater` para atualizações automáticas
- GitHub Actions para testes e publicação

O workflow de lançamento executa testes de Cloud, regras de segurança Firebase, regressões de UI/convites e um teste real do renderer Electron antes de publicar o instalador.

## ⚠️ Limitações atuais

- Calls foram projetadas para grupos pequenos; a interface atual trabalha com até 5 participantes por sala
- Redes com NAT/firewall muito restritivo podem exigir infraestrutura TURN dedicada no futuro
- O instalador ainda não é assinado digitalmente
- Qualidade e latência de voz/tela dependem da conexão entre os participantes

## 📁 Estrutura

- `desktop/` — aplicativo Electron
- `desktop/src/` — interface e camada Cloud
- `firebase/` — regras de segurança e configuração dos emuladores
- `docs/` — página pública de convite e documentação
- `.github/workflows/` — validação, build e Releases

---

Banana Cord é um projeto pessoal em desenvolvimento contínuo, criado para comunicação entre amigos com foco em leveza e simplicidade.
