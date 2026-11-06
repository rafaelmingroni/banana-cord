# Mingrx 3.1.9 — Perfis e chamadas

- Perfis mostram o nome da pessoa, sem substituí-lo por “Comunidade”. A adaptação dos formulários de comunidade passa a verificar somente o conteúdo daquele modal. Nomes e textos de perfil não são reescritos pela camada de marca.
- Corrigida a validação de candidatos ICE no Firestore. Uma referência incorreta à propriedade da mensagem rejeitava candidatos de rede válidos com erro de permissão. As verificações de membro, cargo, origem, destino e tamanho continuam ativas.
- A saída da chamada remove imediatamente o indicador local e a própria linha de presença, encerra a captura e atualiza a navegação. Uma entrada recusada desfaz o estado de chamada. Entradas atrasadas não reabrem uma chamada cancelada.
- Eventos atrasados de sessões anteriores não revogam a chamada nova.

Testes com Firebase emulado e interface real cobrem entrada, mídia, fala, renovação da sessão, candidatos ICE, saída, cancelamento e recusa. Os testes de perfil aguardam os observadores da interface e verificam perfil próprio e de contatos, incluindo nomes que coincidem com palavras usadas pela marca.

O pipeline implanta a regra corrigida antes de publicar a versão. Não edite as regras manualmente e não libere o Realtime Database: o controle das chamadas continua no Firestore. A atualização automática permanece ativa, aguardando o encerramento de chamadas e de mensagens em edição.
