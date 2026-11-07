# Revisão de segurança do Mingrx 3.1.11

Data: 7 de novembro de 2026. Escopo: aplicativo Windows, regras Firebase, publicação e site estático mingrx.site.

Esta revisão documenta as proteções implementadas e seus limites. Não constitui garantia de ausência de vulnerabilidades ou certificação de segurança.

| Item | Aplicação no projeto |
| --- | --- |
| 1. Segredos fora do cliente | IPC restrito, configuração Firebase pública validada por allowlist; arquivos de credenciais administrativas são rejeitados pelo injetor de configuração. Segredos de publicação ficam no GitHub Actions. A chave web Firebase é um identificador público e não substitui autorização. |
| 2. Histórico do Git | Varredura com saída redigida cobre padrões de chaves privadas, tokens de provedores e credenciais administrativas. Não encontrou esses padrões no histórico revisado. Isso não prova ausência de todo segredo possível. Credenciais descobertas futuramente devem ser revogadas, além da limpeza do histórico. |
| 3. Chaves administrativas | Não são expostas pelo preload ou pelos arquivos públicos. Verificação do backend usa a credencial existente apenas no ambiente de publicação. |
| 4. Chaves públicas | O acesso real depende da identidade verificada e das regras do Firebase, testadas com requisições permitidas e negadas. |
| 5. RLS | O projeto usa regras Firestore, sem tabelas SQL. O Realtime Database legado permanece com leitura e escrita negadas. |
| 6. Isolamento | Perfis privados são exclusivos do titular. Comunidades, canais restritos, conversas privadas e sinalização de chamadas verificam participação e permissões. |
| 7. Papéis | Regras verificam proprietário, administrador, moderador e membro. Nenhum cargo informado apenas pelo cliente concede acesso. |
| 8. Campos permitidos | Allowlist de campos em perfis, comunidades, membros, canais, convites, amizades e referências. Proprietário da comunidade e tipo de canal permanecem imutáveis nas atualizações. |
| 9. SQL parametrizado | Não se aplica: não há banco SQL nem consulta SQL construída por concatenação. O SDK Firebase e as regras validam as operações existentes. |
| 10. Entradas | Validação de tipos, comprimentos, enums e campos nas regras e nas fronteiras IPC. Metadados de mensagens, envelopes cifrados e sinalização já possuem validação específica. |
| 11. Dados privados | Autenticação com e-mail verificado exigida no servidor, além da tela de login. O site de apresentação é público e não contém painel privado. |
| 12. APIs | Firestore é a API usada pelo app e valida tokens e regras no servidor. Não foi criada uma rota pública com credenciais administrativas. O endpoint opcional de TURN, quando configurado, deve verificar o token e emitir credenciais curtas; nenhum emissor novo foi provisionado nesta revisão. O servidor local legado não é iniciado pelo produto Cloud nem exposto pelo preload. |
| 13. Sessão | O app usa tokens Firebase, sem cookies próprios de sessão. A nova persistência usa safeStorage do Electron, vincula o arquivo à partição e ao usuário do sistema, remove a sessão antiga após migrar e não grava fallback em texto puro. Sem criptografia segura, a sessão dura apenas no processo. |
| 14. Senhas | Gerenciadas pelo Firebase Authentication. Não se implementa criptografia reversível nem uma segunda tabela de senhas no app. As regras rejeitam a inclusão de senhas e tokens nos campos dos documentos de perfil. |
| 15. HTTPS | Site com HTTPS imposto pelo GitHub Pages; Firebase usa TLS. HTTP de loopback é mantido para emuladores/testes, sem desabilitar verificação TLS dos serviços remotos. |
| 16. Cabeçalhos | CSP no site e no renderer, scripts locais, bloqueio de objetos e formulários no site. O hosting estático do GitHub Pages não permite todos os cabeçalhos HTTP personalizados; não se declara que X-Frame-Options ou frame-ancestors em cabeçalho foram instalados. O site não contém operações autenticadas. |
| 17. Limites | Mensagens exigem permissão de envio com intervalo validado pelo servidor. Buscas públicas autenticadas exigem limite de até 50 resultados. Firebase aplica as próprias quotas de autenticação. Login, cadastro e e-mails também têm contenção local para duplicidade e repetição. Limite local não é proteção contra um cliente alterado. |
| 18. Bots | E-mail verificado, autorização e quotas do provedor já reduzem abuso. Não foi ativado enforcement de App Check/reCAPTCHA sem um fluxo compatível com Electron e com versões instaladas; isso exigiria integração e implantação gradual, não apenas um botão na interface. O site não possui formulário público ou login. |
| 19. Imagens | O app decodifica e reencoda imagens em canvas, limita dimensões/tamanho e as regras aceitam somente representações PNG/JPEG/WebP em base64, com limite de tamanho. SVG, HTML e URLs de terceiros são rejeitados nas gravações novas. Não há endpoint de upload de arquivos arbitrários. O prefixo MIME nas regras não é uma análise antivírus do conteúdo. |
| 20. Respostas mínimas | Busca usa perfil público sem e-mail/credenciais e resultados limitados. Perfis privados e mensagens de terceiros são negados no servidor. |
| 21. Erros e logs | Erros externos de autenticação e códigos desconhecidos do Firebase recebem mensagens genéricas. Relatórios de publicação expõem apenas resultados e hashes, sem usuários, tokens ou corpos de configuração. Console local de diagnóstico não equivale a um serviço central de logs; não foi implantada coleta extra de dados. |
| 22. Dependências | Dependências diretas fixadas nas versões do lockfile, instalação com npm ci, origem registry.npmjs.org via HTTPS, integridade SHA-512 e npm audit. Não se usa npm audit fix --force para impor versões incompatíveis. |
| 23. Criptografia | Novas DMs compatíveis já usam X25519/AES-256-GCM com chaves privadas locais protegidas. Sessões recebem a nova proteção do sistema. Firestore fornece criptografia de infraestrutura em repouso e TLS, o que não equivale a E2EE: perfis públicos, metadados e canais não foram tornados opacos ao provedor. Não se anuncia criptografia ponta a ponta universal. |
| 24. Auditoria de acesso | Testes em emuladores cobrem acessos anônimos, e-mail não verificado, outras contas, promoção indevida, canal restrito e payloads inválidos. A publicação confere o hash das regras efetivamente ativas antes de promover o instalador. |
| 25. Login | Requisições simultâneas são rejeitadas; após cinco falhas há espera progressiva, preservando a proteção do Firebase no servidor. Recuperação tem intervalo e confirmação genérica; não se bloqueia permanentemente uma conta pelo e-mail informado por terceiros. |

## Validação e operação

- `npm run smoke:security`: armazenamento de sessão, isolamento por partição, origem IPC, persistência após recriar o módulo, remoção no logout, corrupção, fallback em memória, limites e configuração pública.
- `npm run smoke:rules`: regras anteriores de autorização/E2EE e 63 novos casos de autorização/esquema.
- `npm run smoke:cloud-boot`: SDK Firebase real em emuladores, migração de localStorage e IndexedDB, restauração da sessão, recuperação de senha real no emulador, duas contas em chamadas públicas/restritas, relógios divergentes e logout/reentrada.
- A suíte Windows também mantém os testes de criptografia, interface e atualizador acessível antes do login.
- `diagnostics/firebase-security.cjs`: confere as regras ativas e lê a proteção contra enumeração de e-mails. Com `--apply`, ativa somente essa proteção se estiver desabilitada. Se a identidade não tiver permissão para ler/alterar a configuração Auth, o relatório registra a pendência sem inventar um resultado positivo.

O relatório `Mingrx-Security-<commit>` no GitHub Actions é a evidência da configuração observada na publicação. A criptografia do cofre protege os dados em repouso, não um computador comprometido enquanto o usuário está autenticado. A implementação de persistência usa o contrato interno de persistência do SDK Firebase fixado; atualizações desse SDK precisam manter os testes de migração e restauração.

## Dependências de desenvolvimento

A auditoria inicial desta revisão encontrou zero vulnerabilidades conhecidas nas dependências de produção e 24 avisos moderados na árvore completa, ligados às ferramentas de desenvolvimento: OpenTelemetry Core, glob, minimatch e uuid, incluindo dependentes. Parte não tem correção compatível disponível. Essas bibliotecas não são usadas como endpoints públicos do app; padrões de glob da compilação são definidos pelo repositório. Correções incompatíveis devem ser avaliadas junto com a atualização dos respectivos emissores, sem forçar majors transitivos e quebrar instaladores. O resultado pode mudar conforme novos avisos forem publicados.

## Referências

- [Firebase Authentication: limites](https://firebase.google.com/docs/auth/limits)
- [Proteção contra enumeração de e-mails](https://docs.cloud.google.com/identity-platform/docs/admin/email-enumeration-protection)
- [Regras Firestore](https://firebase.google.com/docs/firestore/security/get-started)
- [Criptografia de dados Firestore](https://cloud.google.com/firestore/native/docs/encryption-at-rest)
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)
