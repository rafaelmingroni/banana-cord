# 🍌 Banana Cord

**Projeto pessoal de Rafael Mingroni.**

Banana Cord é um aplicativo leve e privado de comunicação para grupos pequenos de amigos. A proposta é reunir o essencial de um app como Discord — servidores, texto, voz, webcam, compartilhamento de tela e mensagens privadas — priorizando simplicidade, baixo consumo de recursos e boa experiência durante jogos.

> **Versão atual: v1.0.0 — primeira versão pós-beta.**

## ✨ Principais recursos

### Servidores e canais

- Servidores privados por convite
- Foto e nome personalizados do servidor
- Menu de contexto no servidor para convite, configurações, renomear, alterar foto, sair ou excluir
- Exclusão de servidor restrita ao dono
- Canais de texto e voz
- Categorias de canais recolhíveis
- Canais privados por cargo
- Reorganização de servidores
- Cargos: Dono, Administrador, Moderador e Membro
- Permissões para gerenciamento de canais e membros

### Chat

- Envio de mensagens em canais de texto
- Editar mensagens com indicador **editado**
- Excluir mensagens
- Responder mensagens
- Reações rápidas
- Menções com `@usuário`
- Indicadores de mensagens não lidas e menções
- Moderação de mensagens de acordo com permissões

### Amigos e mensagens privadas

- Solicitações de amizade
- Aceitar, recusar e remover amigos
- Bloquear e desbloquear usuários
- Mensagens privadas entre usuários permitidos
- Lista de conversas recentes
- Conversas privadas fixadas
- Indicadores de mensagens não lidas
- Edição, exclusão, resposta e reações também em DMs
- Status personalizado

### Voz, vídeo e compartilhamento

- Voz via WebRTC para até 5 pessoas por sala
- Duplo clique no canal de voz para entrar imediatamente
- Indicador verde de quem está falando
- Volume individual por usuário
- Mute, deafen e push-to-talk
- Webcam
- Compartilhamento de tela em 720p/1080p e 30/60 FPS
- Perfis de transmissão voltados a qualidade, fluidez ou economia
- Prioridade para manter o compartilhamento leve durante jogos
- Reconexão de voz e diagnóstico WebRTC

### Áudio e configurações

- Seleção de microfone, saída de áudio e câmera
- Medidor de entrada do microfone
- Teste de microfone por **gravação e reprodução da própria voz**
- Cancelamento de eco, supressão de ruído e ganho automático
- Interface de configurações redesenhada

### Windows e experiência desktop

- Aplicativo Electron para Windows
- Identidade visual da banana no aplicativo e instalador
- Ícone na bandeja do Windows
- Fechar a janela pelo **X não encerra o Banana Cord**
- O aplicativo continua rodando em segundo plano, inclusive quando o usuário é o host
- Menu da bandeja para reabrir, mutar/desmutar e sair do aplicativo
- Somente **Sair do Banana Cord** encerra o processo de verdade

## 🔄 Atualizações automáticas

O Banana Cord usa **GitHub Releases** como fonte oficial de atualizações.

Quando uma nova versão é publicada, versões compatíveis consultam automaticamente:

`https://github.com/rafaelmingroni/banana-cord`

O aplicativo pode detectar a nova versão, baixar os arquivos em segundo plano e oferecer **Reiniciar e instalar**.

A partir da linha **v0.10.1+**, a experiência do updater também inclui avisos mais claros de nova versão e atualização pronta.

A Release precisa conter os três arquivos usados pelo updater:

- `Banana-Cord-Setup-<versão>-x64.exe`
- `Banana-Cord-Setup-<versão>-x64.exe.blockmap`
- `latest.yml`

## ⬇️ Instalação

Baixe sempre a versão mais recente em:

**[GitHub Releases](https://github.com/rafaelmingroni/banana-cord/releases/latest)**

Execute o instalador `Banana-Cord-Setup-<versão>-x64.exe`.

> O aplicativo ainda não possui assinatura digital de código. Por isso, o Windows SmartScreen pode exibir um aviso ao executar uma versão recém-baixada.

## 🖥️ Como funciona o host

Um dos amigos inicia o Banana Cord como host. O aplicativo sobe o backend local e abre automaticamente um **Cloudflare Quick Tunnel**, gerando o endereço usado pelos demais participantes.

O host pode minimizar ou fechar a janela pelo **X**: o Banana Cord continua ativo na bandeja e o servidor permanece funcionando.

O servidor só fica offline quando o processo do Banana Cord é realmente encerrado ou o computador do host é desligado/desconectado.

## 🛠️ Desenvolvimento

### Gerar o instalador no Windows

1. Instale o Node.js.
2. Entre na pasta `desktop`.
3. Instale as dependências.
4. Gere o instalador.

```bash
cd desktop
npm install
npm run dist:win
```

O instalador é criado em `desktop/dist`.

### Testes da v1

O projeto inclui validação de sintaxe e um smoke test automatizado do fluxo principal entre dois usuários:

```bash
cd desktop
npm run smoke:v1
```

## 🚀 Pipeline de release

Antes de uma versão pública, o projeto valida o código, monta as fontes necessárias, executa o smoke test e gera o instalador Windows.

A **v1.0.0** foi promovida para `main` somente após o release candidate passar por essas verificações.

As Releases oficiais ficam em:

**https://github.com/rafaelmingroni/banana-cord/releases**

## ⚙️ Estrutura do projeto

- `desktop/` — aplicativo Electron para Windows
- `desktop/src/` — interface do aplicativo
- `desktop/server/` — backend embutido usado pelo host
- `desktop/scripts/` — montagem, testes e ferramentas de release
- `.github/workflows/` — automações de build e publicação

## ⚠️ Limitações atuais

- Até 5 participantes por sala de voz
- A arquitetura de mídia atual usa WebRTC peer-to-peer
- Redes muito restritas podem exigir TURN para conectividade mais confiável
- O instalador ainda não possui assinatura digital
- O funcionamento do grupo depende do computador do host permanecer ligado e conectado

---

**Banana Cord v1.0.0** marca o fim da fase beta e o início da linha pós-beta do projeto. 🍌
