# 🍌 Banana Cord

**Projeto pessoal de Rafael Mingroni.**

Banana Cord é um aplicativo leve e privado de comunicação para grupos pequenos de amigos. Reúne servidores, canais de texto e voz, webcam, compartilhamento de tela e mensagens privadas, com prioridade para **baixo consumo durante jogos**, visual limpo e uso simples.

> **Versão atual: v1.1.0**

## ✨ Destaques

### Convites simples
- Cada servidor hospedado recebe um **código curto e fixo**, no formato `ABCD-EFGH`.
- O código continua igual mesmo quando o endereço `trycloudflare.com` muda.
- O amigo cola somente o código na tela inicial.
- Convites temporários podem expirar em 30 minutos, 1 hora, 24 horas ou 7 dias.
- O rendezvous usa poucos dados e só trabalha ao hospedar/entrar, sem ficar consumindo CPU durante o jogo.
- Convites completos antigos (`BANANA|https://...|...`) continuam compatíveis.

### Identidade visual
- Nova banana reconhecível em tamanhos pequenos.
- Ícone principal com fundo transparente.
- Ícone exclusivo para a bandeja do Windows.
- Ícone `.ico` multi-resolução para executável, instalador e atalhos.
- Interface de entrada e convite com acabamento mais limpo, mantendo CSS leve e sem framework adicional.

### Servidores e canais
- Servidores privados
- Foto e nome personalizados
- Cargos: Dono, Administrador, Moderador e Membro
- Permissões reais no backend
- Categorias e canais privados por cargo
- Reorganização de servidores e canais
- Duplo clique no canal de voz para entrar

### Chat
- Editar e excluir mensagens
- Respostas e reações
- @menções
- Indicadores de não lidas
- Moderação conforme permissões

### Amigos e privado
- Solicitações de amizade
- Bloquear/desbloquear
- DMs
- Conversas fixadas
- Status personalizado

### Voz, câmera e tela
- Voz WebRTC para até 5 pessoas por sala
- Indicador de fala
- Volume individual, mute, deafen e push-to-talk
- Webcam
- Compartilhamento 720p/1080p e 30/60 FPS
- Perfis Automático, Qualidade, Fluidez e Economia
- Prioridade do compartilhamento durante jogos
- Reconexão e diagnóstico WebRTC

### Bandeja do Windows
Clicar no **X** esconde a janela, mas não encerra o Banana Cord. O aplicativo e o host continuam na bandeja.

Para encerrar completamente, use **Sair do Banana Cord**.

## 🚀 Instalação

Baixe a versão mais recente em **Releases**:

https://github.com/rafaelmingroni/banana-cord/releases/latest

O instalador ainda não possui assinatura digital, então o Windows SmartScreen pode exibir um aviso.

## 🔄 Atualizações automáticas

O Banana Cord usa GitHub Releases. Quando uma nova versão é publicada, o aplicativo detecta, baixa em segundo plano e oferece **Reiniciar e instalar**.

Cada Release publica:
- `Banana-Cord-Setup-x.x.x-x64.exe`
- `Banana-Cord-Setup-x.x.x-x64.exe.blockmap`
- `latest.yml`

## 🌐 Como funciona o host

O aplicativo Electron já leva o runtime necessário: seus amigos **não precisam instalar Node.js para usar ou hospedar**.

Ao hospedar, o Banana Cord:
1. inicia o backend embutido;
2. prepara o `cloudflared.exe` automaticamente quando necessário;
3. cria o acesso público;
4. publica um registro de rendezvous leve para que o código curto encontre o endereço atual.

O host precisa manter o Banana Cord em execução, mas pode fechar a janela: ele continua na bandeja.

## ⚙️ Arquitetura

- Electron no desktop
- Node.js + Express + Socket.IO embutidos no aplicativo
- WebRTC para voz, webcam e compartilhamento
- Cloudflare Quick Tunnel para acesso do host
- Rendezvous descentralizado e assinado para localizar códigos curtos
- GitHub Releases + `electron-updater` para atualização

## ⚠️ Limitações atuais

- Até 5 participantes por sala de voz
- Redes com NAT/firewall muito restritivo podem exigir TURN no futuro
- O host precisa permanecer com o Banana Cord em execução
- Quick Tunnels não têm garantia de disponibilidade
- O instalador ainda não é assinado digitalmente

## 📁 Estrutura

- `desktop/` — aplicativo Electron
- `desktop/server/` — backend embutido
- `desktop/src/` — interface
- `.github/workflows/` — validação, build e Releases

---

Banana Cord é um projeto pessoal em desenvolvimento, criado para comunicação privada entre amigos.
