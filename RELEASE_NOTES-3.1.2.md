# Mingrx 3.1.2

Atualização focada em mensagens privadas e refinamento da experiência do Espaço Privado.

## Correções principais

- Corrige o erro de permissão ao abrir uma conversa privada nova antes da primeira mensagem existir.
- Mantém as regras atuais do Firebase sem afrouxar a segurança: o Mingrx prepara a conversa autorizada antes de iniciar a escuta das mensagens.
- Reorganiza o Espaço Privado com navegação vertical para Mensagens privadas, Amigos e Adicionar amigo.
- Adiciona um visual mais limpo e próximo do restante da identidade premium do Mingrx.
- Adiciona um botão X nas conversas Recentes para ocultar atalhos sem apagar o histórico de mensagens.
- Faz uma conversa ocultada voltar automaticamente aos Recentes quando chega uma nova mensagem.
- Preserva a criptografia ponta a ponta e a compatibilidade com o updater das versões anteriores.

## Validação

A versão 3.1.2 passou pela suíte completa Mingrx V3 Validation, incluindo testes de identidade de release, JavaScript, regressões de UI/cloud, Firebase Rules, Electron e geração/verificação do instalador Windows release-candidate.
