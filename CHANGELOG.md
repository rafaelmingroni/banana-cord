# Changelog

## 1.2.1
- Corrige o congelamento ao clicar no botão de convite do servidor.
- Torna a atualização do texto do modal idempotente para impedir loops do `MutationObserver`.
- Agrupa alterações do modal em microtasks para evitar tempestades de mutações no renderer.
- Remove um guard antigo que ainda prendia alguns rótulos de versão em `v1.1.1` após atualizações.
- Adiciona teste de regressão específico para o congelamento do modal de convite.

## 1.2.0
- Reequilibra a tipografia e o espaçamento do modal de convite para um visual mais compacto e proporcional.
- Remove o overflow horizontal do modal em janelas menores.
- Adiciona link público de convite para servidores e convites temporários.
- Registra o protocolo `bananacord://` no instalador do Windows.
- Um link de convite pode abrir o Banana Cord já instalado, carregar o código e conectar ao servidor.
- Se o usuário ainda não tiver o aplicativo, a página pública oferece/redireciona para o instalador mais recente.
- Mantém o código curto como alternativa e conserva compatibilidade com convites completos antigos.
- A página de convite é estática e não transporta voz, vídeo, chat ou compartilhamento de tela.
- Ajusta o workflow de Release para impedir publicações duplicadas no GitHub.

## 1.1.1
- Criptografa o registro de rendezvous dos convites curtos com AES-256-GCM.
- O endereço do host, código interno e nome do servidor deixam de ficar em texto aberto nos relays.
- O índice público do convite passa a usar somente um hash derivado do código curto.
- Mantém o código fixo simples e os convites temporários da v1.1.0.

## 1.1.0
- Nova identidade visual com banana reconhecível, fundo transparente e ícone multi-resolução para Windows.
- Ícone dedicado para a bandeja do Windows, sem o fundo preto que fazia a banana desaparecer.
- Tela inicial e modal de convite com acabamento mais limpo e leve.
- Cada servidor hospedado passa a ter um código curto e estável no formato `ABCD-EFGH`.
- Códigos curtos resolvem automaticamente o endereço atual do host, mesmo quando o Quick Tunnel muda.
- Convites temporários com expiração em 30 minutos, 1 hora, 24 horas ou 7 dias.
- Convites completos antigos continuam compatíveis.
- Rendezvous assinado e de baixo tráfego, sem polling pesado durante jogos.
- Seus amigos continuam sem precisar instalar Node.js para hospedar.
- Adiciona smoke test específico para estabilidade dos códigos de convite.

## 1.0.1
- Corrige o congelamento ao abrir Configurações do servidor e Configurações gerais.
- Remove o rótulo “pós-beta” da interface e documentação.
- Melhora a visibilidade do ícone da banana na bandeja do Windows.
- Mantém o host ativo ao fechar a janela e deixa a versão visível no menu da bandeja.
- Adiciona smoke test de regressão da interface para evitar o retorno do bug do modal.
- Mantém todas as funções da v1.0.0.

## 1.0.0
- Mensagens de servidor podem ser editadas e apagadas; mensagens editadas exibem `editado`.
- Respostas a mensagens com prévia da mensagem original.
- Reações rápidas: 👍 ❤️ 😂 👎.
- `@menções` com sugestão de membros e indicador de menção não lida.
- Indicadores de não lidas por canal e por servidor.
- Mensagens privadas também suportam editar, apagar, responder e reagir.
- Sistema de amigos com solicitações, aceitar/recusar, remover, bloquear e desbloquear.
- Lista rápida de amigos na área de mensagens privadas.
- DMs podem ser fixadas no topo.
- Menu de contexto em membros: DM, amizade, volume, mute local, perfil, bloqueio e moderação quando permitida.
- Menu de contexto no ícone do servidor: copiar convite, foto, renomear, configurações, sair e excluir quando permitido.
- Foto personalizada do servidor.
- Servidores podem ser reordenados por arrastar e soltar.
- Categorias de canais e canais privados por cargo.
- Status personalizado no perfil.
- Duplo clique em canal de voz entra imediatamente na call.
- Fechar a janela com X mantém o Banana Cord na bandeja.
- Instância única do aplicativo.

## 0.10.1
- Updater mais visível e confiável.
- Janela nativa ao detectar versão nova e quando a atualização termina de baixar.
- Verificação adicional ao voltar o foco para o app e periodicamente.

## 0.10.0
- Configurações redesenhadas com navegação lateral e cartões mais limpos.
- Teste de microfone grava até 8 segundos e permite ouvir a própria gravação.
- Mensagens privadas entre membros que compartilham ao menos um servidor.
- Lista de conversas recentes e indicador leve de mensagens não lidas.
- Atalho para iniciar DM a partir do perfil de um membro.
- Ícone oficial da banana aplicado ao instalador, executável, atalho e janela.

## 0.9.0
- Atualizador automático com `electron-updater`.
- Verificação de novas versões ao iniciar.
- Download automático opcional com progresso.
- Botão para reiniciar e instalar a atualização.
- Aba `Atualizações` nas configurações.

## 0.8.0
- Cargos e permissões reais.
- Sidebar de voz com avatar, fala, mute, câmera, tela e ping.
- Reordenação/edição de canais.
- Perfis de compartilhamento e otimização de tela.
- Push-to-talk, atalhos globais, reconexão e diagnóstico.
