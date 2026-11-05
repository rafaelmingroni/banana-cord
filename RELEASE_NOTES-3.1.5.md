# Mingrx 3.1.5 — Hotfix de segurança e estabilidade

Atualização obrigatória para usar o novo controle de chamadas e envio de mensagens. Contas, comunidades e mensagens existentes são preservadas. A identidade Windows `com.bananacord.app` e os convites legados continuam válidos.

## Segurança

- Interface isolada do Node.js, com sandbox e uma ponte de operações permitidas.
- Autorização central de IPC, incluindo verificação do arquivo e frame solicitantes.
- Controle das salas, presença e sinalização migrado para caminhos do Firestore que verificam membros, cargos, amizade e propriedade de sessão. Áudio e vídeo continuam em WebRTC entre participantes.
- Transporte legado do Realtime Database fechado para impedir caminhos alternativos de acesso.
- Bloqueios não podem mais ser removidos ou substituídos pela pessoa bloqueada.
- Reações só podem alterar a participação do próprio usuário. Edição de texto limitada ao autor.
- Datas de novas mensagens e intervalo de envio validados pelo backend, com novas DMs exigindo envelope cifrado.
- Correção da cadeia de dependências gRPC; auditoria de produção passa com limite de severidade alta.

## Estabilidade

- Correção da primeira DM e uso de uma única instância do SDK Firebase.
- Histórico por cursor, com listener de 60 mensagens separado das páginas antigas, sem teto de 240.
- Logout encerra mídia e limpa mensagens, composição e caches da conta, sem aguardar indefinidamente a rede.
- Sessões de voz usam expiração e renovação; o encerramento de um dispositivo não encerra a presença de todos os dispositivos.
- Atualizador unificado, com instalação explícita e reabertura preservadas.
- Seleção explícita da tela ou janela e opção de áudio do sistema antes de compartilhar.
- Push-to-talk libera a tecla na perda de foco e inclui observação da tecla selecionada no Windows durante chamadas.
- Cofres danificados ou chaves de outro dispositivo não são substituídos silenciosamente.
- Ajustes de acessibilidade do chat e navegação privada em janelas menores.

## Distribuição e configuração

O pipeline valida regras, testes e hashes, prepara todos os artefatos em rascunho, implanta as regras do backend e só então publica como versão mais recente. Se não houver credencial Firebase ou o deploy falhar, a versão permanece em rascunho.

Os dois participantes precisam atualizar para 3.1.5. Clientes anteriores não podem continuar usando os caminhos de controle e envio desativados por segurança.

## Limitações explícitas

- O fallback TURN está preparado para um emissor HTTPS de credenciais temporárias configurado por `MINGRX_TURN_CREDENTIALS_URL`. Sem esse serviço externo, redes restritivas ainda podem impedir chamadas.
- A assinatura Authenticode depende de certificado configurado no CI. Este hotfix não fornece nem compra um certificado.
- Não foi introduzido um novo protocolo criptográfico: ratchet, transferência/recuperação de chaves e sincronização E2EE entre dispositivos continuam exigindo uma evolução específica. O hotfix evita troca silenciosa da identidade existente.
- O plano Firebase Spark continua sujeito a cotas; a migração do controle de chamadas exige acompanhar o orçamento de leituras/escritas do Firestore. Não há promessa de escala ilimitada.
- SFU, exportação/exclusão completa de conta, limpeza administrativa de documentos expirados e a remoção de todas as camadas históricas não são entregas deste hotfix.

Consulte `docs/HOTFIX-3.1.5.md` para configuração e acompanhamento dos achados da auditoria. A versão não deve ser descrita como resolução integral dos 30 itens.
