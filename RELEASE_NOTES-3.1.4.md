# Mingrx 3.1.4 — Recuperação de acesso Cloud

Hotfix prioritário para usuários que conseguiam entrar na versão 3.1.1, mas passaram a encontrar a mensagem de que o Mingrx Cloud não terminou de carregar a interface nas versões 3.1.2 e 3.1.3.

## Correções

- Recupera tentativas de inicialização Cloud presas em conexão incompleta, sem exigir a recriação da conta.
- Libera a interface autenticada antes de aguardar leituras adicionais dos detalhes de servidores, evitando que uma leitura lenta impeça a entrada no aplicativo.
- Acrescenta diagnóstico e verificações de regressão para esse fluxo.
- Corrige rotinas de validação de instalador para o nome atual Mingrx.

## Compatibilidade

- Preserva as contas Firebase, servidores, mensagens e o escopo da criptografia ponta a ponta.
- Mantém `com.bananacord.app` para atualização de versões anteriores e o visual Obsidian da 3.1.3.

## Observação

Esta é uma correção de mitigação para falhas de inicialização. Os testes automatizados não substituem a confirmação de acesso nos computadores afetados. Caso o problema persista, registre o erro específico e comunique ao desenvolvedor.
