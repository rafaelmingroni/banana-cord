# 🍌 Banana Cord

**Projeto pessoal de Rafael Mingroni.**

Banana Cord é um aplicativo leve e privado para um grupo pequeno de amigos, inspirado na simplicidade do Discord: servidores privados, canais de texto, canais de voz, webcam e compartilhamento de tela, sem recursos pesados que não fazem falta para um grupo pequeno.

Versão atual: **0.10.0**.

## Recursos

- Servidores privados por convite
- Canais de texto e voz
- Voz WebRTC para até 5 pessoas por sala
- Webcam
- Compartilhamento de tela em 720p/1080p e 30/60 FPS
- Perfis de transmissão: Automático, Qualidade, Fluidez e Economia
- Prioridade para o compartilhamento de tela durante jogos
- Perfis com nome, avatar e status
- Cargos: Dono, Administrador, Moderador e Membro
- Permissões reais para gerenciar canais e membros
- Indicador verde de quem está falando
- Volume individual, mute, deafen e push-to-talk
- Reconexão de voz e diagnóstico WebRTC
- Host local com Cloudflare Quick Tunnel automático
- Atualização automática pelo GitHub Releases
- Mensagens privadas entre membros que compartilham um servidor
- Lista de conversas recentes e badge leve de não lidas
- Configurações redesenhadas com layout mais limpo
- Teste de microfone por gravação e reprodução da própria voz
- Identidade visual da banana aplicada ao executável, instalador, atalho e janela

## Atualizações automáticas

A partir da v0.9 o Banana Cord consulta este próprio repositório para procurar novas versões. O endereço padrão já vem configurado no aplicativo:

`https://github.com/rafaelmingroni/banana-cord`

Quando uma nova versão é publicada em **Releases**, o app pode baixar a atualização em segundo plano e oferecer **Reiniciar e instalar**.

Usuários de versões anteriores à v0.9 precisam instalar a v0.9 manualmente uma vez.

## Gerar o instalador no Windows

1. Instale o Node.js LTS.
2. Entre na pasta `desktop`.
3. Execute `GERAR-EXE.bat`.
4. O instalador será criado em `desktop/dist`.

Ou execute manualmente:

```bash
cd desktop
npm install
npm run dist:win
```

## Releases automáticos

O workflow em `.github/workflows/release-windows.yml` compila o instalador Windows e publica os arquivos usados pelo auto-updater sempre que uma nova versão do código desktop é enviada para `main`. Antes de publicar uma nova versão, atualize o campo `version` em `desktop/package.json`.

## Modelo de uso

Um dos amigos funciona como host da sessão. O Banana Cord inicia o backend local e abre um Cloudflare Quick Tunnel automaticamente. Enquanto o host mantém o aplicativo aberto, os convidados podem entrar pelo código de convite.

## Limitações atuais

- Até 5 participantes por sala de voz.
- Redes muito restritas podem precisar de um servidor TURN no futuro.
- O instalador ainda não possui assinatura digital; o Windows SmartScreen pode exibir um aviso.
- O host precisa manter o Banana Cord aberto para o grupo ficar online.

## Estrutura

- `desktop/` — aplicativo Electron para Windows
- `desktop/server/` — backend embutido usado pelo host
- `server/` — backend standalone para testes/desenvolvimento

---

Banana Cord é um projeto pessoal em desenvolvimento, feito para uso privado entre amigos.
