# Validação da auditoria

Base: Mingrx 3.1.4, commit `b01394677573cf306e4435a0ac4aaf012ce89a52`. Execução em Linux, Node 24.22.1, Java 21 e Electron 45.1.0. O CI do projeto usa Windows e Node 22; essa diferença limita conclusões de compatibilidade.

## Resultados

| Verificação | Resultado |
|---|---|
| Instalação pelo lockfile | `npm ci` concluído, com cache em `/tmp` |
| Preparação de fontes, ícones e bundle | Passou |
| Sintaxe dos 130 arquivos `.js` próprios de desktop, sem dependências/bundle gerado | 130 passaram |
| `smoke:mingrx` | Passou |
| `smoke:cloud` | Passou |
| `smoke:ui` | Passou |
| `smoke:rendezvous` | Passou |
| `smoke:v1` | Passou, em servidor local |
| `node site/validate.mjs` | Passou, 24 verificações |
| `smoke-firebase-rules.js` | Passou nos emuladores |
| `smoke-v216-firebase-rules.js` | Passou nos emuladores |
| Reproduções adicionais das regras | 15 comportamentos confirmados |
| Reproduções de runtime | 6 comportamentos confirmados |
| 19 testes da lista `smoke:e2e-v2` | 18 passaram; 1 bloqueado por `safeStorage` indisponível |
| Auditoria de dependências de produção | 4 entradas altas, 0 críticas |
| Auditoria da árvore completa | 33 entradas: 5 altas, 28 moderadas, 0 críticas |

Os testes de Electron foram invocados individualmente a partir da lista do package.json. Os argumentos adicionais de ambiente foram `--no-sandbox --headless --ozone-platform=headless`; a ausência inicial de tamanho de tela adequado produziu falhas de geometria. Os casos afetados foram repetidos com `--ozone-override-screen-size=1920,1080`. Isso corrigiu os testes de viewport e layout. Os testes de chamada privada/branding exigiram ainda idioma `pt-BR` e perfil isolado, para eliminar estado/idioma compartilhado entre execuções. Ambos passaram nessa condição.

O teste `e2e-v216-e2ee.js` foi tentado isoladamente e parou com `safeStorage unavailable in Electron test`. A execução em Linux headless sem serviço de armazenamento seguro não comprova uma falha do cofre no Windows. Não simulamos disponibilidade de armazenamento seguro para declarar esse teste aprovado.

O uso de `--no-sandbox` acima foi exclusivamente para executar os testes no container; não é uma recomendação de configuração de produção. Os testes de UI usam sockets/IPC simulados em vários cenários e não validam uma chamada real entre dois computadores nem o SDK Firebase real de todos os caminhos.

Avisos de D-Bus, notificações, NSS e caches do sistema ocorreram no ambiente Linux. Falhas iniciais de download/cache foram resolvidas com diretórios graváveis e proxy do ambiente. Não foram classificadas como defeitos do Mingrx.

## O que os testes revelam

A suíte existente passa em muitos cenários úteis, mas não cobre integralmente as fronteiras entre os módulos. Exemplos:

- O teste da DM inicial semeia/cria o pai antes da leitura da coleção; não executa o `getDoc()` negado do reparo da UI.
- O teste visual do reparo 3.1.2 verifica inclusive o texto da função, sem conectar o socket Firebase real àquele caminho.
- O teste estático de auto-update procura `autoInstallOnAppQuit = false` em um arquivo; a configuração de outro arquivo volta a ativá-lo.
- Os casos negativos existentes não tentam substituir o proprietário de uma sessão já existente, apagar bloqueio alheio ou atribuir reações a terceiros.

Assim, passar na suíte atual não contradiz as falhas reproduzidas. Novos testes precisam executar as combinações finais e exigir as negações esperadas.

## Repetir as reproduções

Na raiz do repositório, depois de instalar as dependências:

```bash
node docs/auditoria-2026-11-04/reproduzir-runtime.cjs
```

Para as regras, executar em uma instalação local funcional do Firebase Emulator Suite, a partir de `desktop`:

```bash
FIREBASE_EMULATORS_PATH=/tmp/mingrx-emulators XDG_CONFIG_HOME=/tmp/mingrx-firebase-config ./node_modules/.bin/firebase emulators:exec --project demo-banana-cord --config ../firebase/firebase.json --only firestore,database 'node ../docs/auditoria-2026-11-04/reproduzir-regras.cjs'
```

No ambiente desta auditoria, o carregamento inicial de regras pelo CLI falhou com `Request was cancelled`. Os dois emuladores Java foram iniciados diretamente em `127.0.0.1:8080` e `127.0.0.1:9000`, e os testes foram executados com:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000 node docs/auditoria-2026-11-04/reproduzir-regras.cjs
```

O script exige essas variáveis e usa o projeto sintético `demo-banana-cord`. Ele limpa os dados desse projeto nos emuladores; não o execute em um emulador com dados que precise preservar. O SDK RTDB Node não respeita `NO_PROXY` na construção do WebSocket; o script adapta apenas conexões `ws://127.0.0.1:9000/` para o loopback. Proxies e conexões externas permanecem intactos. Os testes originais foram executados com a mesma adaptação local.

Os emuladores foram encerrados ao terminar. Os testes adicionais ficam em `docs`, sem inclusão no pipeline de release do produto.

## Artefatos

- [Relatório principal](RELATORIO.md): achados, evidências, referências e plano de correção.
- [Regras](resultado-regras.json): verificações A01–A15.
- [Runtime](resultado-runtime.json): verificações R01–R06.
- [Electron](resultado-electron.json): logs e tentativas anteriores, preservando falhas iniciais e repetições bem-sucedidas.
- [Sintaxe](resultado-sintaxe.json): quantidade e falhas encontradas.
- [Smoke tests](resumo-testes.json): saídas resumidas; `permission_denied` em casos negativos é esperado.
- [Dependências de produção](dependencias-producao.json) e [árvore completa](dependencias-completas.json): saída original do npm audit.

## Fora do alcance desta execução

Não foram verificados: regras/configurações realmente implantadas no Firebase; limites usados da conta; credenciais e políticas do GitHub; funcionamento do instalador/assinatura no Windows; upgrade real do aplicativo instalado; captura de áudio/vídeo de hardware; redes com NAT/firewall variados; uso durante jogos; restauração de backup real; revisão criptográfica independente; comportamento com leitores de tela reais.

Não houve correção funcional nem publicação. As mudanças adicionadas ao repositório são apenas os documentos e reproduções desta auditoria. Artefatos temporários gerados pelo build foram removidos; para iniciar o app, `npm run prepare:source` os gera novamente.
