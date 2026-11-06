# Mingrx 3.1.10

Corrige o bloqueio de entrada em chamadas quando o relógio do computador está fora de sincronia e reorganiza o Privado e a tela de Amigos.

- Presença e sessões de voz usam a hora do Firebase e um relógio monotônico, inclusive após mudanças no horário do Windows. A autorização continua exigindo conta verificada, vínculo com a comunidade e acesso ao canal.
- Sinalização confirma que as duas sessões ainda existem; mensagens atrasadas para uma sessão encerrada não geram falsos avisos de permissão. A criação de conexões WebRTC evita duplicações durante entrada e reconexão.
- Leituras de uma nova comunidade aguardam a confirmação do vínculo no Firebase.
- O Privado deixa de mostrar o quadro roxo de resumo e o atalho lateral redundante de adicionar amigo. A busca continua disponível dentro de Amigos.
- Amigos tem abas horizontais, linhas com espaçamento consistente, ações alinhadas e o ID copiável da conta para distinguir nomes iguais.
- A tela inicial do Privado oferece um caminho curto para encontrar amigos, abrir conversas recentes e consultar solicitações, inclusive em contas novas.
- Atualização automática preservada; as regras necessárias são publicadas antes da disponibilização do instalador.

Validação: 73 verificações de autorização e testes de criptografia no Firebase Emulator; duas janelas Electron isoladas com SDK e regras reais, relógios simulados em -117 e +300 segundos, recebimento de pacotes de áudio, canais públicos/restritos, dono/administrador, entrada, saída, reentrada e reconexão. Também foram verificados o salto de um dia no relógio durante a chamada, os indicadores após sair, a navegação do Privado, contas com nomes iguais e a apresentação nos temas claro e escuro. O pipeline de publicação executa novamente os testes no Windows e verifica a integridade do instalador.
