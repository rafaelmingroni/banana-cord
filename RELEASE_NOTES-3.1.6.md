# Mingrx 3.1.6 — Correção da entrada no aplicativo

Corrige a regressão da versão 3.1.5 que podia deixar o login parado em “O Mingrx Cloud não terminou de carregar a interface”. Um erro ao registrar a limpeza do listener de conexão interrompia a inicialização do transporte antes das primeiras leituras do Firestore.

- Inicialização e recuperação de conexão usam a sessão correta.
- A saída da conta remove o listener; sessões encerradas não retomam tarefas ao voltar a internet.
- Novos testes cobrem a inicialização do transporte real e o login com os SDKs Firebase em emuladores, incluindo a restauração da sessão após recarregar a interface.

Instale a versão 3.1.6 por cima da atual. Não é necessário apagar os dados locais nem alterar regras manualmente no Firebase. Contas, comunidades, mensagens e chaves locais são preservadas.

As proteções e as limitações descritas nas notas da versão 3.1.5 continuam valendo.
