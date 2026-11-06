# Validação da instalação automática 3.1.7

## Correções

O serviço principal passa a instalar automaticamente depois de concluir o download. A primeira tentativa ocorre em 8 segundos; atividade em andamento adia a tentativa e é verificada novamente a cada 5 segundos. Chamadas, captura, chamadas recebidas, mensagens em edição e respostas desconhecidas da interface impedem o reinício em segundo plano. Há um limite de 2 segundos para consultar a interface.

O instalador usa `quitAndInstall(true, true)` com o encerramento de sessão existente. A opção `autoInstallOnAppQuit` foi reativada. A ação “Depois” adia até a saída real do aplicativo. Erros, encerramento e cancelamento invalidam tentativas antigas de instalação, inclusive a chamada final agendada.

O cartão de atualização fica acima da tela de autenticação. O estado `available`, usado quando o download automático está desativado, agora possui um botão de download.

## Evidências específicas

- `node scripts/test-automatic-update.js`: executa o serviço real com SDK e relógio controlados. Confirma instalação sem login ou clique, argumentos de silêncio e reabertura, proteção de chamadas/captura/rascunhos, espera por interface travada, adiamento explícito, cancelamentos e preferências do usuário.
- `electron scripts/e2e-updater-auth-gate.js`: usa preload, sandbox e isolamento de produção. Verifica o elemento que realmente recebe o clique com a tela de login visível; testa verificar, progresso, tentar novamente, download opcional, instalação e sobreposição de reinício.
- O teste de interface passou com a correção. Ao restaurar a ordem de sobreposição anterior somente no teste temporário, ele falhou porque o clique atingia `cloudGate`.
- Os testes Cloud estáticos e os testes de isolamento, histórico e ciclo de vida passaram localmente. A validação completa de instalação de um binário em uma máquina Windows de usuário depende do ambiente desse usuário; os testes não devem ser apresentados como uma instalação real em todos os dispositivos.

## Limite de recuperação dos clientes antigos

O código 3.1.5/3.1.6 já instalado tem `autoInstallOnAppQuit=false` e só aplica a atualização após um evento de instalação local. Não existe uma opção remota no Firebase ou em `latest.yml` que altere essa política embutida.

Um teste temporário carregou o renderer exato da 3.1.5 (`19577ca`) com uma atualização já baixada. Clique nativo no título Mingrx, Shift+Tab duas vezes e Enter acionaram o botão coberto “Atualizar agora” e enviaram o IPC de instalação. Isso confirma uma recuperação dentro do próprio app, sem baixar instalador externamente. **Não é migração automática nem uma sequência segura para recomendar sem confirmar o estado `ready`**: antes do download terminar, as mesmas teclas alcançam outros controles.

A 3.1.7 corrige o comportamento das próximas atualizações. Não prometer que publicar uma versão nova faz todos os binários antigos instalarem sem nenhuma ação local. As falhas de asserção antigas da interface continuam acompanhadas separadamente no PR #37; esta correção não representa aprovação integral daquela suíte.
