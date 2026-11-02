## Banana Cord 2.1 — Social Update

Esta é uma atualização maior do Banana Cord, focada em tornar chat, servidores, presença e uso diário mais completos e consistentes.

### Chat e mensagens
- Corrige o fluxo de editar e excluir mensagens que havia ficado sem controles funcionais na interface.
- Edição inline: `Enter` salva e `Esc` cancela.
- Mensagens editadas recebem indicador discreto `(editada)`.
- Nova barra de ações no hover com responder, reagir, editar e menu de mais ações.
- Clique com botão direito abre um menu de contexto próprio do Banana Cord.
- Exclusão usa confirmação dentro do app, sem o `confirm()` nativo do Windows.
- Moderadores e administradores podem excluir mensagens de terceiros no servidor, mas editar continua restrito ao próprio autor.
- DMs criptografadas continuam sendo recriptografadas quando o autor edita a mensagem; a chave privada permanece local.
- Respostas preservam referência à mensagem original.
- Reações ficam visíveis como pills compactas no próprio chat.
- Links deixam o amarelo repetitivo e passam para azul suave; nomes no Privado ficam neutros e mais legíveis.

### Slash commands
Ao digitar `/`, o Banana Cord mostra uma lista com autocomplete e descrição dos comandos.

- `/clear 20` — limpa mensagens conforme a permissão.
- `/clear mine` — limpa somente mensagens próprias.
- `/clear all` — disponível para moderação no servidor e exige confirmação.
- `/help` — mostra os comandos disponíveis.
- `/call` — inicia/atende chamada na conversa privada aberta.
- `/mute` — muta/desmuta o microfone.
- `/deafen` — ativa/desativa ensurdecer.
- `/status online|away|busy` — altera o status manual.
- Com o campo vazio, seta para cima abre a edição da última mensagem própria.

### Canais e categorias
- Remove a antiga apresentação `+ Texto / + Voz / + Categoria`.
- A lateral passa a ter um único cabeçalho **Canais +**.
- O `+` abre um popover com Canal de texto, Canal de voz e Categoria, cada opção com descrição.
- Categorias podem ser recolhidas/expandidas e lembram seu estado localmente.
- Botões de criar/gerenciar aparecem de forma discreta no hover.
- Canais podem ser movidos para categorias ou retirados delas por drag and drop.
- Criar, renomear, mover e excluir passam por modais/popovers consistentes com o visual do app.

### Cargos
- Remove o dropdown preto nativo do Windows para Membro / Moderador / Administrador.
- Novo seletor próprio do Banana Cord, com cor, descrição e check no cargo atual.
- Mantém as cores configuráveis de cargos da 2.0.19.

### Presença e inicialização
- Online muda automaticamente para **Ausente** depois de 5 minutos sem atividade no computador por padrão.
- Ao voltar a usar mouse/teclado, o status volta para Online.
- `Ocupado` ou `Ausente` escolhidos manualmente não são sobrescritos pela automação.
- O tempo de ausência automática pode ser configurado para 5, 10, 15 ou 30 minutos.
- Banana Cord passa a iniciar com o Windows por padrão na primeira execução da 2.1.
- Inicialização automática abre o app silenciosamente na bandeja, sem jogar a janela na frente do usuário.
- O usuário pode desligar a inicialização nas configurações ou pelo Gerenciador de Tarefas do Windows.
- Se o usuário desligar pelo Windows, o Banana Cord não fica reativando a opção sozinho.

### Idiomas
- Novo seletor de idioma em Configurações.
- Português (Brasil).
- English (US).
- Español.
- Troca de idioma ao vivo e preferência salva no computador.
- Nova base de localização para permitir adicionar mais idiomas sem espalhar novas strings pelo app.

### Status de atividade
- Novo status opcional de jogo: por exemplo `Jogando Rocket League · há 12 min`.
- A atividade aparece na lista/perfil de membros.
- Ativado por padrão e pode ser desligado em Configurações → Idioma e Social.
- A detecção usa somente uma lista conhecida de executáveis de jogos; a lista de processos do computador nunca é publicada.
- Aplicativos genéricos não são classificados como jogo apenas por compartilharem um runtime (por exemplo, `javaw.exe` não é tratado automaticamente como Minecraft).

### Compatibilidade e estabilidade
- Mantém E2EE das mensagens privadas, histórico progressivo, proteção anti-flood, chamadas privadas, compartilhamento, updater silencioso e instalador one-click das versões anteriores.
- A linha oficial passa para `2.1.0` (mostrada na interface como Banana Cord 2.1).
- A release inclui testes estáticos, Firebase Emulator e interações reais em Electron para chat, E2EE, canais, cargos, idiomas, presença, atividade, updater e layout.
