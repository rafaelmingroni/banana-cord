# Mingrx 3.1.1

Hotfix focado em estabilidade de comunidades, chamadas e compartilhamento de tela.

## Correções principais

- Corrige a troca de foto da comunidade/servidor com confirmação real de persistência antes de mostrar sucesso.
- Mantém a foto da comunidade funcionando no plano Spark, sem depender do Firebase Storage.
- Melhora o Espaço Privado, organizando Amigos, Mensagem e Adicionar amigo em uma navegação mais clara.
- Corrige casos em que a presença da call podia desaparecer mesmo com o usuário ainda conectado.
- Remove sessões fantasma de voz quando um usuário fecha ou reinicia o Mingrx durante uma atualização.
- Corrige o modo de assistir em tela cheia: ao terminar uma transmissão, o Mingrx sai do modo de assistir em vez de deixar o usuário preso no avatar.
- Preserva compatibilidade com o fluxo de atualização das versões anteriores.

## Validação

A versão 3.1.1 passou pela suíte completa de validação do Mingrx, incluindo testes de UI, Firebase Rules, Electron, persistência de foto de servidor, presença de voz, atualização/reinício e encerramento de transmissão.
