# 🍌 Banana Cord

**Projeto pessoal de Rafael Mingroni.**

Banana Cord é um aplicativo leve e privado de comunicação para grupos pequenos de amigos. Ele reúne servidores, canais de texto e voz, webcam, compartilhamento de tela e mensagens privadas, com foco em simplicidade, baixo consumo de recursos e boa experiência durante jogos.

> **Versão atual: v1.0.1**

## ✨ Recursos

### Servidores e canais
- Servidores privados por convite
- Foto e nome personalizados do servidor
- Menu de contexto do servidor
- Cargos: Dono, Administrador, Moderador e Membro
- Permissões reais no backend
- Canais de texto e voz
- Categorias recolhíveis
- Canais privados por cargo
- Reorganização de servidores e canais
- Duplo clique em canal de voz para entrar na call

### Chat
- Editar mensagens com indicação de edição
- Excluir mensagens
- Responder mensagens
- Reações rápidas
- @menções
- Indicadores de mensagens não lidas e menções
- Moderação de mensagens conforme permissões

### Amigos e mensagens privadas
- Solicitações de amizade
- Aceitar, recusar e remover amigos
- Bloquear e desbloquear usuários
- DMs entre amigos e membros de servidores em comum
- Conversas recentes
- DMs fixadas
- Indicadores de mensagens não lidas
- Status personalizado

### Voz, câmera e compartilhamento
- Voz WebRTC para até 5 pessoas por sala
- Indicador verde de quem está falando
- Volume individual
- Mute e deafen
- Push-to-talk
- Webcam
- Compartilhamento em 720p/1080p e 30/60 FPS
- Perfis Automático, Qualidade, Fluidez e Economia
- Prioridade para compartilhamento de tela durante jogos
- Tela cheia, stream fixado e foco no compartilhamento
- Reconexão de voz e diagnóstico WebRTC

### Áudio e configurações
- Seleção de microfone, saída de áudio e câmera
- Teste de microfone por gravação e reprodução da própria voz
- Cancelamento de eco, redução de ruído e ganho automático
- Atalhos de mute, deafen e compartilhamento
- Atualizações automáticas pelo GitHub Releases

### Bandeja do Windows
Clicar no **X** esconde a janela, mas não encerra o Banana Cord. O aplicativo continua na bandeja do Windows — inclusive o servidor de quem estiver hospedando.

Para encerrar completamente, use **Sair do Banana Cord** no menu da bandeja.

## 🚀 Instalação

Baixe a versão mais recente em **Releases**:

https://github.com/rafaelmingroni/banana-cord/releases/latest

O instalador ainda não possui assinatura digital, então o Windows SmartScreen pode exibir um aviso.

## 🔄 Atualizações automáticas

O Banana Cord consulta este próprio repositório:

`https://github.com/rafaelmingroni/banana-cord`

Quando uma nova versão é publicada, o aplicativo detecta, baixa em segundo plano e oferece **Reiniciar e instalar**.

Os arquivos de update publicados em cada Release são:

- `Banana-Cord-Setup-x.x.x-x64.exe`
- `Banana-Cord-Setup-x.x.x-x64.exe.blockmap`
- `latest.yml`

## 🛠️ Gerar o instalador no Windows

1. Instale o Node.js.
2. Entre na pasta `desktop`.
3. Execute `GERAR-EXE.bat`.

Ou:

```bash
cd desktop
npm install
npm run dist:win
```

O instalador será criado em `desktop/dist`.

## 🌐 Como funciona o host

Um usuário hospeda a sessão. O Banana Cord inicia o backend local e abre automaticamente um Cloudflare Quick Tunnel.

O host precisa manter o **aplicativo em execução**, mas pode fechar a janela normalmente: o Banana Cord continua na bandeja.

## ⚙️ Arquitetura

- Electron no desktop
- Node.js + Express + Socket.IO no backend embutido
- WebRTC para voz, webcam e compartilhamento
- Cloudflare Quick Tunnel para acesso ao servidor
- GitHub Releases + `electron-updater` para atualizações

## ⚠️ Limitações atuais

- Até 5 participantes por sala de voz
- Redes com NAT/firewall muito restritivo podem exigir TURN no futuro
- O host precisa permanecer com o Banana Cord em execução
- O instalador ainda não é assinado digitalmente

## 📁 Estrutura

- `desktop/` — aplicativo Electron para Windows
- `desktop/server/` — backend embutido
- `desktop/src/` — interface
- `server/` — backend standalone para desenvolvimento/testes
- `.github/workflows/` — build e publicação de Releases

---

Banana Cord é um projeto pessoal em desenvolvimento, criado para comunicação privada entre amigos.
