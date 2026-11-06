# Mingrx 3.1.7 — Instalação automática das atualizações

O Mingrx passa a baixar e aplicar atualizações automaticamente, inclusive na tela de login, sem depender do botão de instalação. Com as preferências automáticas padrão, após o download ele aguarda alguns segundos, encerra a sessão e reabre atualizado. Chamadas, captura ativa, chamadas recebidas e mensagens ainda em edição adiam o reinício até a atividade terminar. “Depois” adia até a saída efetiva do aplicativo.

- Instalação automática na saída reativada como alternativa.
- Avisos, progresso, tentativas e instalação visíveis acima da tela de login.
- Botão de download para quem desativou o download automático nas preferências.
- Testes do serviço cobrem instalação sem clique, atividade em andamento, indisponibilidade da interface, cancelamento e reinício silencioso.
- Teste real de interface verifica qual elemento recebe o clique antes do login, detectando o problema de sobreposição anterior.

A correção de login da 3.1.6 está incluída. Não é necessário alterar regras do Firebase nem apagar os dados locais.

## Clientes anteriores já instalados

Esta publicação não pode alterar a política de instalação dentro dos binários 3.1.5/3.1.6 já instalados. Eles podem baixar o pacote pelo atualizador existente, mas ainda precisam acionar sua instalação uma vez. A instalação automática sem esse clique vale depois de alcançar a 3.1.7. Não há um comando no Firebase ou no GitHub que force os clientes antigos a executar código novo.

As preferências explícitas de desativar verificação ou download automático continuam respeitadas. As limitações gerais da 3.1.5 continuam valendo.
