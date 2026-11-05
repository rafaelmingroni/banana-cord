# Mingrx 3.1.5: operação e escopo

## Publicação

O workflow `Mingrx Windows Release` só publica depois de concluir testes, build, verificação de SHA-512, upload em rascunho e deploy de regras. Configurações necessárias no repositório:

- Secret `BANANA_FIREBASE_CONFIG_JSON`: configuração web do projeto, incluindo `projectId` correto. Nunca adicionar chave privada Admin ao instalador.
- Secret `FIREBASE_TOKEN`: credencial de deploy já usada no pipeline histórico. Ausência ou falha bloqueia publicação. Migrar futuramente para identidade de serviço com privilégios mínimos/OIDC.
- Para assinatura, os secrets `CSC_LINK` e `CSC_KEY_PASSWORD` aceitos por electron-builder. Sem certificado não há assinatura Authenticode; isso deve permanecer declarado.
- Opcional: variável `MINGRX_TURN_CREDENTIALS_URL`, com URL HTTPS de um serviço que valide Firebase ID tokens e emita credenciais TURN temporárias. Resposta: `{ "ttl": 300, "iceServers": [{ "urls": ["turns:relay.example.org:443?transport=tcp"], "username": "temporário", "credential": "temporária" }] }`. O exemplo não é um serviço operacional. Não empacotar senha TURN permanente.

A versão exige coordenação do aplicativo e do backend. Não publicar o instalador novo com regras antigas. A migração encerra os caminhos inseguros anteriores; todos os participantes devem atualizar.

## Sessões e quotas

As salas usam cinco slots em comunidades e dois em chamadas privadas. A admissão é transacional; o backend rejeita IDs de slot fora desse conjunto. Cada entrada tem lease de 90 segundos, renovado em chamadas ativas. A interface remove entradas expiradas; entradas abandonadas não concedem autorização para sinalização. Presença é por conexão, com expiração, em caminhos próprios ou de comunidade. Ela não é um diretório global de usuários.

Sinalização usa IDs de sessão e usuário do destinatário: reutilizar um slot não concede acesso a sinais da sessão anterior. A aplicação acompanha somente salas/canais autorizados e consulta o diretório recebido para enviar sinais, evitando reler a sala a cada candidato ICE.

Expiração não apaga automaticamente subcoleções do Firestore. Configurar limpeza administrativa de documentos antigos e medir uso real. Controles Firestore podem consumir cotas relevantes em chamadas longas: ajustar o orçamento de sessões ao plano contratado. Nenhum teste executado aqui estabelece um SLA ou capacidade comercial.

## Achados acompanhados

| Auditoria | Estado nesta versão |
|---|---|
| 01–03: sessão, sala e sinalização | Corrigidos no novo transporte e nas regras; caminhos RTDB anteriores fechados |
| 04: renderer e IPC | Isolamento, sandbox e allowlist implementados |
| 05–08: bloqueio, reações, edição, flood/schema | Corrigidos nos caminhos de mensagem; abuso de outros recursos ainda exige monitoramento |
| 09–11: runtime Firebase, primeira DM, paginação | Corrigidos |
| 12: teto de histórico | Substituído por páginas por cursor |
| 13: cargos | Política explícita alinhada |
| 14–16: logout/reconexão/presença | Mídia e estado limpos; presença por conexão e leases; testar redes/Windows reais |
| 17: TURN | Integração pronta; depende do serviço externo configurado |
| 18: malha P2P/SFU | Slots limitados; SFU e benchmark real continuam pendentes |
| 19–20: captura/PTT | Escolha de fonte e proteção de tecla implementadas; PTT global depende de validação com jogos no Windows |
| 21–22: E2EE | Cofre/identidade protegidos contra substituição silenciosa; ratchet, verificação completa e recuperação continuam pendentes |
| 23–24: custo | Cache de perfis, menções locais, cursores e listeners limitados; orçamento/carga ainda devem ser medidos |
| 25: exclusão e concorrência | Exclusão sinalizada e retomável, convites limpos e proteção do dono; limpeza administrativa e parte da concorrência histórica permanecem |
| 26–27: atualizador/publicação | Serviço único e publicação após build/deploy; verificar operação no CI |
| 28: dependências/assinatura | Zero alertas de produção na verificação local; assinatura requer certificado |
| 29: arquitetura/testes | Novo módulo de transporte, teste de IPC e paginação de 361 mensagens; migração integral dos reparos históricos pendente |
| 30: acessibilidade/dados/diagnóstico | Região viva do chat adicionada; leitor de tela real, exportação/exclusão de conta e diagnóstico completo pendentes |

O relatório original em `auditoria-2026-11-04` descreve o commit 3.1.4. Suas reproduções demonstram o comportamento anterior e não devem ser interpretadas como testes de aprovação da 3.1.5. Os testes corretivos ficam em `desktop/scripts`.
