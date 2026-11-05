# Validação da correção de login 3.1.6

## Causa e reprodução

`patch(socket)` em `cloud-v315-transport.js` usava `this.cleanup` sem uma instância vinculada. A chamada por `attachSocket` lançava `TypeError: Cannot read properties of undefined (reading 'push')` antes de iniciar as leituras do Cloud. O listener `online` também capturava a instância errada.

Os testes de interface existentes injetavam um socket sem `db` e emitiam `auth:ready` manualmente; por isso não percorriam a inicialização que falhou em produção.

## Testes específicos

- `node scripts/test-cloud-transport-lifecycle.js`: usa a classe real do socket e toda a sequência de patches do transporte. Falha com o código publicado da 3.1.5 e passa com a correção. Verifica entrada, presença, instalação do histórico, reconexão, revogação de lease, remoção imediata de listeners/timers e descarte de eventos da conta encerrada.
- `npm run smoke:cloud-boot`: Electron com preload, sandbox e isolamento de produção; Firebase Auth e Firestore reais apontados exclusivamente para emuladores do projeto `demo-banana-cord`. Verifica login pela interface com e-mail confirmado, escrita autorizada de presença, sessão persistida após recarregar, logout e novo login. Bloqueia requisições a backends externos.
- Os testes acima passaram localmente. No Linux sem armazenamento seguro, a inicialização de E2EE segue o tratamento de indisponibilidade existente; a validação com armazenamento seguro continua na suíte Windows.

Ambos os testes são obrigatórios no pipeline de publicação do Windows antes de gerar e publicar o instalador. O pipeline mantém os testes de regras, auditoria de dependências, interações da interface e verificação SHA-512 dos artefatos.

## Escopo

Correção do cliente; nenhuma regra de autorização foi relaxada. A configuração adicionada em `firebase/firebase.json` apenas habilita o emulador local de Auth para o teste. Não apague o diretório de dados do usuário: ele contém as chaves locais das mensagens privadas.
