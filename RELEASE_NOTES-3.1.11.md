# Mingrx 3.1.11

- Protege a sessão de login com criptografia do sistema operacional, mantendo a migração automática de sessões antigas do navegador. Se o armazenamento seguro não estiver disponível, a sessão fica somente na memória, sem arquivo em texto puro.
- Impede solicitações simultâneas de autenticação e aplica espera progressiva após falhas de login, além de intervalos para cadastro, recuperação de senha e reenvio da verificação. As proteções do Firebase Authentication continuam sendo aplicadas no servidor.
- A recuperação de senha apresenta uma confirmação que não revela se uma conta existe. Erros externos de autenticação e do Firebase não são mostrados diretamente ao usuário.
- Restringe os campos graváveis de perfis privados, comunidades, membros, canais, convites, amizades e referências de comunidades. Rejeita URLs e formatos ativos em fotos e limita consultas de busca de perfis públicos.
- Mantém mensagens privadas novas compatíveis com criptografia ponta a ponta, controle de acesso das chamadas, atualização automática e permissões por comunidade/canal.
- Fixa versões das dependências diretas e verifica origem HTTPS, integridade do lockfile e padrões de credenciais privadas no código/histórico durante a publicação.
- Verifica as regras efetivamente publicadas no Firebase antes de disponibilizar o instalador e registra o resultado da conferência das configurações de privacidade da autenticação.

As senhas continuam sendo gerenciadas pelo Firebase Authentication e não são armazenadas em documentos do aplicativo. Mensagens de canais e metadados não recebem criptografia ponta a ponta nesta versão.
