# Auditoria técnica do Mingrx 3.1.4

Data: 4 de novembro de 2026. Base: `main`, commit `b01394677573cf306e4435a0ac4aaf012ce89a52`.

## Parecer

O Mingrx já reúne uma quantidade relevante de recursos e tem uma suíte de regressão, regras de backend e cuidados reais com compatibilidade. Entretanto, **eu não recomendo ampliar a distribuição pública antes de corrigir a autorização das chamadas, as falhas de DMs e a limpeza de sessão**. A prioridade deve ser confiabilidade e proteção dos usuários.

Os problemas principais estão nas fronteiras entre camadas: interface versus regras; bundle Firebase versus SDK Node; transporte versus mídia; e sucessivos reparos que substituem funções anteriores. Mais ajustes visuais isolados tendem a aumentar esse custo.

Esta auditoria combina inspeção estática, execução de testes, reproduções locais e pesquisa em documentação primária. Nenhuma auditoria garante encontrar todas as falhas. Não foi feita exploração contra contas reais, alteração de Firebase de produção, publicação de release ou mudança do código funcional do aplicativo. As reproduções usam dados sintéticos.

## Como interpretar os resultados

- **P0 — bloqueador:** corrigir antes de ampliar a distribuição. Inclui autorização fundamental de chamadas.
- **P1 — alta:** próximo ciclo de estabilização; afeta privacidade, uso principal ou disponibilidade.
- **P2 — média:** robustez, manutenção ou expansão do produto.
- **Reproduzido:** comportamento executado com resultado registrado; não significa exploração em produção.
- **Confirmado no código:** caminho identificado, mas efeitos em Windows, redes e computadores reais ainda precisam ser medidos.
- **Risco/limitação:** consequência condicionada ao crescimento, à rede, à configuração ou a uma ameaça específica.

As prioridades são avaliação técnica do projeto, não pontuações CVSS oficiais. Os códigos A01–A15 e R01–R06 identificam verificações, e não 21 vulnerabilidades independentes.

## Evidências executáveis

Os arquivos [resultado-regras.json](resultado-regras.json) e [resultado-runtime.json](resultado-runtime.json) registram respectivamente 15 verificações no Firebase Emulator Suite e seis verificações isoladas de runtime. Os scripts [reproduzir-regras.cjs](reproduzir-regras.cjs) e [reproduzir-runtime.cjs](reproduzir-runtime.cjs) permitem repetir a análise. Eles demonstram o estado defeituoso atual; após correções, devem ser convertidos em testes que exijam a proteção esperada.

Os links de código abaixo apontam para o commit auditado, para que continuem válidos depois de futuras alterações.

## Falhas de segurança e de privacidade prioritárias

### 01. Uma conta verificada consegue tomar uma sessão de outra conta — P0, reproduzido

**Evidência:** [database.rules.json:12–16](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/firebase/database.rules.json#L12), A03–A04.

A regra exige que o valor novo em `sessionOwners/{sessionId}` seja o UID de quem escreve. Ela não exige que o valor anterior esteja vazio ou pertença ao mesmo usuário. No emulador, um terceiro substituiu `alice` por `outsider` e passou a ler a caixa `signals/{sessionId}` da vítima.

**Impacto:** acesso à sinalização e possibilidade de interrupção/alteração do controle da chamada. É preciso conhecer o ID da sessão; as salas de voz expõem IDs aos leitores autorizados pelas regras atuais. Isso não demonstra descriptografia retroativa de áudio WebRTC.

**Correção:** permitir criação apenas se a sessão não existe, exigir o proprietário atual em atualização/exclusão e vincular sessões aos registros de voz. Testar explicitamente criação, tomada, atualização e remoção por terceiro.

### 02. As salas de voz não autorizam associação à comunidade, cargo ou par privado — P0, reproduzido

**Evidência:** [database.rules.json:19](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/firebase/database.rules.json#L19), A05–A07; [chamadas privadas](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/cloud-v2-v212-fix.js#L136).

Qualquer conta verificada pode ler uma sala cujo caminho conhece e escrever uma entrada com o próprio UID, mesmo sem ser membro. Também pode substituir uma entrada alheia escrevendo o próprio UID no mesmo caminho. Os caminhos de chamadas privadas usam `dm_{uidA}_{uidB}/direct`, mas as regras não validam esse par.

**Impacto:** exposição de participantes e estados de mídia; registros indevidos de participantes; risco de conexão com participantes não autorizados. A aceitação e transmissão de mídia dependem também dos filtros do cliente, portanto ouvir uma chamada real não foi demonstrado.

**Correção:** autorização verificável pelo serviço que hospeda a sala, incluindo membros, cargo, bloqueios e propriedade da sessão. RTDB Rules não pode consultar documentos do Firestore como Firestore Rules faz. É necessário desenhar uma fonte confiável de permissões no RTDB ou um serviço de autorização; copiar permissões pelo próprio cliente sem prova confiável não resolve. Revogação de membro deve revogar voz e sinalização também.

### 03. A sinalização aceita identidade de socket sem comprovação — P1, reproduzido

**Evidência:** [database.rules.json:31](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/firebase/database.rules.json#L31), A08.

A regra confere `fromUserId`, mas só exige que `fromSocketId` seja string. Não exige que o socket pertença ao remetente, que ambos estejam na mesma sala ou que possam manter uma chamada. A estrutura e o tamanho de `data` também são pouco restritos.

**Correção:** validar dono do socket, contexto da chamada, autorização entre as partes, tipos/tamanhos de SDP e ICE e validade temporal. Mensagens antigas devem expirar; não depender apenas da remoção feita pelo destinatário.

### 04. Interface privilegiada no Electron — P1, confirmado no código

**Evidência:** [main.js:177](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/main.js#L177).

O renderer usa `nodeIntegration: true` e `contextIsolation: false`. Isso também elimina a sandbox efetiva do renderer. Há CSP, bloqueio de navegação e popups e escape de texto em vários pontos: são proteções úteis, mas não substituem a separação de privilégios. Uma futura injeção de JavaScript nessa janela teria impacto muito maior por acessar Node e APIs locais.

**Correção:** preload pequeno com `contextBridge`, `nodeIntegration: false`, `contextIsolation: true`, sandbox e API explícita por operação. Validar origem/frame e conteúdo de todo IPC privilegiado. Handlers como `host:start`, atualização e clipboard não aplicam a mesma verificação usada no módulo de criptografia. Não foi demonstrada uma cadeia XSS→execução remota nesta auditoria. [Referência oficial Electron](https://www.electronjs.org/docs/latest/tutorial/security).

### 05. Bloqueio pode ser apagado pela pessoa bloqueada — P1, reproduzido

**Evidência:** [firestore.rules:201](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/firebase/firestore.rules#L201), A12–A13.

O relacionamento, incluindo seu estado de bloqueio, pode ser excluído por qualquer participante. O bloqueado conseguiu apagar o documento e recriar uma solicitação. Isso não o tornou amigo automaticamente, mas contornou a persistência do bloqueio.

**Correção:** bloqueios com propriedade unilateral, separados do relacionamento compartilhado. Conferir os bloqueios de ambas as partes nos caminhos de convite social, chamada e mensagem.

### 06. Reações podem ser atribuídas a outras pessoas — P1, reproduzido

**Evidência:** [firestore.rules:157](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/firebase/firestore.rules#L157) e regras de DM, A09.

O backend permite trocar todo o mapa `reactions`. Um membro gravou uma reação com IDs alheios/inventados e emoji fora da lista da interface.

**Correção:** reação por documento/chave do próprio UID, ou validação de uma alteração restrita ao usuário autenticado. Limitar tamanho, conjunto de emojis e quantidade. A UI não deve ser a autoridade sobre quem reagiu.

### 07. Moderador altera texto alheio por acesso direto — P1, reproduzido

**Evidência:** [firestore.rules:153](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/firebase/firestore.rules#L153), [restrição no cliente](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/cloud-v2-v21-social.js#L94), A10.

A interface atual restringe edição ao autor, enquanto a regra ainda permite ao moderador alterar texto alheio. Assim, o comportamento anunciado pelo cliente não é garantido pelo backend.

**Correção:** restringir edição ao autor. Para moderação, manter exclusão ou ação identificada com motivo, sem fazer parecer que o autor escreveu outra coisa.

### 08. Anti-flood é apenas local; schemas permitem conteúdo de controle malformado — P1, confirmado/reproduzido parcialmente

**Evidência:** [token bucket do cliente](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/cloud-v2-v220-chat-stability.js#L44), [schemas](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/firebase/firestore.rules#L149), A11.

O limite de envio pode ser ignorado acessando o SDK diretamente. As regras não validam rigorosamente datas, respostas, menções, previews e estados de chamada; aceitam `createdAt` arbitrário, incluindo 2099. Mensagens futuras podem permanecer na janela de últimas mensagens. Dados grandes ou malformados aumentam custo e risco de erros no cliente.

**Correção:** timestamps de servidor para novas mensagens, campos obrigatórios e tipos/tamanhos explícitos. Projetar controle de abuso verificável no backend e por conta. App Check pode ajudar contra determinados clientes não legítimos, mas não substitui autorização nem rate limiting. Em Electron, um provedor customizado exige desenho e backend confiáveis; não inserir um segredo compartilhado no instalador. [App Check customizado](https://firebase.google.com/docs/app-check/custom-provider).

## DMs, sessão e consistência funcional

### 09. O reparo 3.1.2 mistura SDK Firebase Node com o bundle de browser — P1, reproduzido

**Evidência:** [mingrx-312-private-fix.js:6](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/mingrx-312-private-fix.js#L6), [bundle](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/scripts/build-cloud-browser.js#L13), R04.

O socket recebe `db` de uma instância do SDK empacotada por esbuild. O reparo posterior importa `firebase/firestore` pelo `require` do Node e usa esse `doc()` com o objeto do bundle. A reprodução com duas cópias do mesmo SDK gera `invalid-argument: Expected first argument to doc()...`.

O mesmo padrão está em [v219-details.js:15](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/v219-details.js#L15), nos fluxos de observar/salvar cores de cargos. Nesse caso um `catch {}` também esconde o erro de observação.

**Correção:** operações de dados em um único módulo empacotado; a UI chama métodos desse módulo. Testar com o socket real e os módulos reais, não apenas conferir que o texto da função contém `getDoc`/`setDoc`.

### 10. A primeira DM continua bloqueada pela leitura do pai inexistente — P1, reproduzido

**Evidência:** [ensureFriendThread:177](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/mingrx-312-private-fix.js#L177), [dmThreads read](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/firebase/firestore.rules#L205), A01–A02.

Mesmo resolvendo o SDK duplicado, `getDoc(threadRef)` é negado quando o documento não existe: a regra depende de `resource.data.participants`. O código não chega ao `if (!existing.exists())` que criaria o pai. Para os mesmos amigos, criar diretamente um pai autorizado funciona no emulador.

**Correção:** criação/merge idempotente autorizada antes do listener, com invariantes para participantes. Alternativamente desenhar leitura de ausência segura. Teste obrigatório: duas contas amigas, nenhuma DM anterior, abrir e enviar a primeira mensagem sem semear o pai previamente.

### 11. Paginação de DM é anulada pelo wrapper 3.1.2 — P2, reproduzido

**Evidência:** [watchDmMingrx312:205](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/mingrx-312-private-fix.js#L205), R01–R02.

O paginador chama `watchDm(peerId, 120)`, mas o wrapper aceita/repassa apenas `peerId`. A função seguinte volta ao padrão de 60. A reprodução chamou o código real do wrapper e observou limite 60 e contador voltando para 60.

**Correção:** preservar argumentos e retorno; preferir cursor de histórico em uma implementação única. Testar paginação após carregar todos os reparos, e não só o módulo da paginação isolado.

### 12. Histórico para em 240 mensagens — P2, limitação confirmada

**Evidência:** [MAX = 240](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/cloud-v2-v220-chat-stability.js#L11).

O cliente não oferece caminho para mensagens mais antigas que essa janela. Aumentar o listener de 60 para 120/180/240 também refaz leituras de mensagens já recebidas.

**Correção:** manter um listener pequeno para novidades e usar páginas históricas por cursor (`startAfter`), com deduplicação e âncora de rolagem. Mensagens que saem da janela de um listener limitado não devem ser tratadas automaticamente como exclusões definitivas do histórico local.

### 13. Semântica de cargo diverge entre interface e Firestore — P2, reproduzido

**Evidência:** [roleCanAccessChannel:33](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/cloud-v2-v212-fix.js#L33), [channelAccess:18](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/firebase/firestore.rules#L18), R03.

O cliente interpreta `allowedRoles` como nível mínimo. A regra usa inclusão exata, com exceção de owner/admin. Um moderador vê um canal permitido a `member`, mas a leitura das mensagens pode ser negada pelo backend.

**Correção:** decidir se a política é hierárquica ou uma lista explícita e aplicar a mesma matriz em todas as camadas. Testar todas as combinações de cargo, canal, leitura, envio e voz.

### 14. Logout não limpa a sessão inteira nem encerra explicitamente a mídia local — P1, reproduzido em isolamento

**Evidência:** [cloudLogout:85](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/cloud-v2-legacy-bridge.js#L85), [disconnect:572](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/cloud-v2-socket.js#L572), R05.

O logout limpa algumas estruturas, mas deixa `dmMessages`, `dmConversations` e estado de voz. `disconnect()` remove registros/listeners do transporte, porém não chama a limpeza de `MediaStream`/`RTCPeerConnection` do renderer. O teste da função real de logout manteve DM descriptografada em memória e não chamou `track.stop()`.

**Impacto:** retenção de dados da conta anterior e risco de dispositivos/peers permanecerem ativos durante a saída. Não foi demonstrada exibição de DMs para outra conta em Windows; isso exige teste de troca de conta completo.

**Correção:** um único encerramento de sessão: parar todas as tracks, fechar peers, cancelar timers/listeners, limpar caches e estado por UID e só então sair do Auth. Testar logout durante mic/câmera/tela ativos e login de outra conta no mesmo processo.

### 15. Sessões de voz não têm ciclo completo de reconexão — P1, confirmado no código

**Evidência:** [startSession:142](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/cloud-v2-socket.js#L142), entrada/saída de voz no mesmo módulo e [presença](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/cloud-v2.js#L183).

`sessionOwners` e a entrada de voz são criados uma vez, com `onDisconnect` registrado depois da gravação. A presença possui listener de `.info/connected`, mas essas duas estruturas não têm recuperação equivalente. Após queda, as remoções podem apagar a sessão sem sua recriação no retorno. Ao sair, cancelar `onDisconnect` antes de confirmar a remoção também reduz a proteção em caso de falha.

**Correção:** registrar remoções antes de anunciar presença; rearmá-las e republicar a sessão em cada reconexão; coordenar reentrada de voz e ICE. A documentação esclarece que `onDisconnect` executa uma vez e precisa ser registrado novamente. [Firebase offline/reconexão](https://firebase.google.com/docs/database/web/offline-capabilities), [API onDisconnect](https://firebase.google.com/docs/reference/js/database.ondisconnect).

### 16. Presença é global e não representa adequadamente vários dispositivos — P1/P2, confirmado/risco

**Evidência:** [watchPresence:47](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/cloud-v2-v21-social.js#L47), `presence/{uid}` e respectiva regra.

Toda conta verificada pode ler a raiz de presença, incluindo status/atividade de contas fora de seus contatos. Cada cliente recebe alterações de todos. Dois dispositivos escrevem no mesmo registro; um desconectar pode marcar o usuário offline mesmo com o outro conectado. O logout não faz uma transição explícita e completa de presença nessa implementação.

**Correção:** presença por conexão/dispositivo, agregação por usuário e leituras restritas aos contatos/comunidades relevantes. Separar atividade de jogo e consentimento de compartilhamento. Testar duas instâncias e desconectar apenas uma.

## Chamadas, captura e criptografia

### 17. Somente STUN, sem fallback TURN — P1, limitação confirmada

**Evidência:** [createPeer](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/app.js#L231).

As conexões configuram apenas dois STUN públicos do Google. Redes com NAT/firewall restritivo podem impedir mídia mesmo com login/chat funcionando. `restartIce()` não cria um caminho relay inexistente.

**Correção:** TURN autenticado com credenciais temporárias; testar UDP, TCP e TLS/443 em redes diferentes. Exibir diagnóstico que diferencie permissão de microfone, sinalização e falha de ICE. TURN tem custo de banda; isso deve entrar no plano financeiro. [WebRTC: TURN server](https://webrtc.org/getting-started/turn-server).

### 18. Malha P2P limita upload e previsibilidade de desempenho — P2, risco de escala

**Evidência:** um `RTCPeerConnection` por participante, tracks adicionadas por peer e bitrate definido por sender em `app.js`.

Com N participantes, cada pessoa mantém até N−1 conexões e envia mídia para os demais. Exemplo puramente ilustrativo: uma tela de 4 Mb/s enviada a quatro peers pode exigir aproximadamente 16 Mb/s de upload, mais overhead. Isso não é benchmark medido do Mingrx. A limitação de participantes é feita pelo cliente e leitura seguida de escrita, sem reserva atômica de vaga.

**Correção:** para grupos pequenos, declarar e testar o limite suportado; controlar admissão de forma confiável. Avaliar SFU quando crescer, preservando as garantias de criptografia desejadas. Não é necessário adotar uma infraestrutura grande antes de medir. [Arquitetura SFU do LiveKit](https://docs.livekit.io/reference/internals/livekit-sfu/).

### 19. Captura escolhe a primeira tela sem escolha explícita da fonte — P1, confirmado no código

**Evidência:** [screen-share-main-fix.js:11](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/screen-share-main-fix.js#L11) e [requestDisplayStream](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/screen-share-fix.js#L25).

O handler lista telas/janelas, mas escolhe a primeira tela e configura `useSystemPicker: false`. O clique para compartilhar é uma intenção do usuário, porém não permite escolher qual monitor/janela nessa rota. O README anuncia captura de tela e janelas.

**Correção:** seletor com miniaturas, identificação da tela/janela e prévia antes de transmitir. Áudio do sistema deve ser uma escolha clara. Validar a origem/frame da solicitação de captura. Testar dois monitores e janela com conteúdo privado.

### 20. Push-to-talk depende do foco e não limpa tecla no blur — P1, confirmado no código

**Evidência:** [app.js:268](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/app.js#L268).

PTT é tratado por `window.keydown/keyup`. Não há captura global de pressionar/soltar essa tecla; os atalhos globais existentes servem para mute/deafen/tela. Assim, PTT não oferece a experiência esperada durante o jogo em primeiro plano. Perder foco entre keydown e keyup pode deixar `pttHeld` incorreto.

**Correção:** limpar PTT em blur, suspensão e desconexão. Para PTT global, projetar integração nativa que detecte pressionar e soltar e libere recursos no encerramento. Testar com jogo em foco, Alt+Tab, troca de teclado e suspensão do Windows.

### 21. E2EE não oferece sigilo futuro por mensagem — P2, limitação criptográfica

**Evidência:** [deriveAesKey:155](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/e2ee-main.js#L155).

Há escolhas positivas: X25519, HKDF, AES-GCM, IV aleatório e autenticação do contexto. Porém a chave é derivada de identidades estáticas e permanece equivalente para o mesmo par/contexto de chaves. Não há ratchet com descarte de segredos por mensagem. O comprometimento da chave privada permite derivar chaves de mensagens antigas associadas a ela, se o atacante possuir os ciphertexts e metadados.

**Correção:** documentar exatamente as garantias e avaliar protocolo/libraries revisados com ratchet. Não criar um protocolo novo apenas para dizer que é E2EE. [Especificação Double Ratchet](https://signal.org/docs/specifications/doubleratchet/).

### 22. Identidade criptográfica, troca de dispositivo e recuperação estão incompletas — P1/P2, confirmado/risco

**Evidência:** [ensureE2EEIdentity:45](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/cloud-v2-v216-e2ee.js#L45), [vault local](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/e2ee-main.js#L44).

Uma chave local por conta/dispositivo é publicada como `currentKeyId` da conta. Outro computador pode publicar outra chave; o primeiro não possui a chave privada desse computador. Não há distribuição por dispositivo nem backup/transferência de chaves no código inspecionado. `readVault()` trata falhas de leitura/corrupção como cofre vazio, permitindo gerar uma nova identidade sem distinguir perda de dados.

O hash do material público verifica consistência entre chave e ID, mas não comprova a identidade humana do contato. Faltam confirmação fora de banda e aviso/consentimento claro de mudança de chave. O backend é a fonte de confiança da chave atual.

**Correção:** definir se o produto é de dispositivo único ou multi-dispositivo. Adicionar aviso de perda/mudança de chave, verificação de contato e um plano de recuperação que mantenha a confidencialidade. Não prometer recuperação de histórico que o projeto não pode fornecer. O uso de `safeStorage` é positivo; sua disponibilidade deve ser tratada sem quebrar a experiência inteira.

## Disponibilidade, custo e manutenção

### 23. Leituras redundantes crescem com membros, mensagens e comunidades — P1, confirmado no código

**Evidência:** [watchServer:241](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/cloud-v2-socket.js#L241), [emitMembers:300](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/cloud-v2-socket.js#L300), [mentionIds:535](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/cloud-v2-socket.js#L535).

Listeners de servidor/canais/membros disparam recarga que consulta novamente esses documentos e chama `emitMembers()`. Esta volta a ler membros e busca cada perfil sequencialmente. Cada envio de mensagem também consulta todos os membros e cada perfil para detectar menções, inclusive quando o texto não contém `@`. A presença global pode gerar mais buscas de perfil. Listeners de canais/DMs visitados são guardados em mapas e sua quantidade pode crescer até o disconnect.

**Impacto:** latência antes do envio, inicialização lenta e consumo de cota. O debounce por microtask não elimina callbacks assíncronos sobrepostos ou consultas redundantes.

**Correção:** usar dados do próprio snapshot e um cache de perfis com invalidação; detectar menções por tokens/IDs, usando o diretório já carregado; limitar listeners ativos; medir leituras por sessão e mensagem. Só paralelizar buscas sem eliminar redundância não resolve a cota.

### 24. Spark impõe um teto operacional que precisa virar requisito de produto — P1, limitação externa

O RTDB no Spark tem limite de **100 conexões simultâneas**; conexão não é o mesmo que conta cadastrada. O Firestore tem cota gratuita de leituras e escritas, e listeners/releituras consomem operações. O projeto não tem um orçamento demonstrado de operações por usuário/canal, e o item anterior amplifica o consumo.

**Correção:** estabelecer público esperado, concorrência suportada, orçamento de leituras/escritas/banda e forma de acompanhar utilização. Planejar degradação e mensagem clara para indisponibilidade por cota. Permanecer gratuito é uma decisão válida para pequenos grupos, mas não é garantia de escala. [Limites RTDB](https://firebase.google.com/docs/database/usage/limits), [cobrança Firestore/listeners](https://firebase.google.com/docs/firestore/pricing).

### 25. Exclusão e edição de coleções não são operações recuperáveis — P2, confirmado/risco

**Evidência:** [deleteServer:447](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/cloud-v2-socket.js#L447), [reparo de exclusão](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/src/cloud-v2-server-delete-fix.js#L13), A14–A15.

Excluir servidor/canal envolve leituras completas e múltiplos batches, sem checkpoint persistente. Uma interrupção pode deixar exclusão parcial. Só o convite principal é removido na rotina base; não há limpeza abrangente dos convites temporários. Categorias são editadas por leitura/modificação/escrita de um array, sujeita a perda de atualização concorrente.

A regra também permite ao dono remover a própria associação. Depois disso ele perde a permissão necessária para apagar canais pelo fluxo normal. Isso foi reproduzido diretamente; a interface tenta impedir a saída normal do dono.

**Correção:** bloquear a remoção indevida do último proprietário; operações idempotentes com estado de exclusão e retomada; limpar descendentes e convites; transações para alterações concorrentes. Não confiar que apagar o documento pai apaga suas subcoleções. [Firebase: exclusão de dados](https://firebase.google.com/docs/firestore/manage-data/delete-data).

### 26. Atualizador tem duas fontes de estado e configuração conflitante — P1, reproduzido

**Evidência:** [main.js:95](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/main.js#L95), [updater-prompt.js:8](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/desktop/updater-prompt.js#L8), R06.

`updater-prompt.js` desativa instalação ao sair. Mais tarde, `main.js` configura o mesmo singleton e ativa `autoInstallOnAppQuit = true`. A reprodução executou `configureUpdater()` e observou a propriedade voltar a `true`. Existem ainda dois conjuntos de eventos, estados e comandos IPC para o mesmo atualizador.

**Correção:** um serviço único de atualização, uma máquina de estados e uma política de instalação/reabertura. Manter o redirecionamento de repositório legado que já existe e a identidade `com.bananacord.app`. Testar a configuração efetiva e atualização real no Windows; verificar apenas se uma string aparece no arquivo não detecta esse conflito.

### 27. Pipeline pode publicar sem comprovar regras de produção e expõe release antes de concluir uploads — P1, confirmado no workflow

**Evidência:** [release-windows.yml:90](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/.github/workflows/release-windows.yml#L90), [publicação:208](https://github.com/rafaelmingroni/mingrx-app/blob/b01394677573cf306e4435a0ac4aaf012ce89a52/.github/workflows/release-windows.yml#L208).

Na ausência de `FIREBASE_TOKEN`, o deploy das regras termina com aviso e sucesso. Portanto validar o arquivo do repositório não comprova que ele está implantado. O workflow também cria/marca a release como latest antes de enviar todos os artefatos, e não tem grupo de concorrência protegendo publicações simultâneas. O fluxo de recuperação de release incompleta apaga assets antes de gerar a substituição.

**Correção:** verificar projeto e revisão das regras implantadas, com autenticação adequada ao CI; publicar rascunho, fazer upload/verificação dos artefatos e só então promover para latest; serializar releases. Conferir a relação entre versão, tag e commit sem alterar uma release já distribuída. Não foi acessado o estado real das credenciais/regras implantadas.

### 28. Assinatura de Windows e triagem de dependências precisam melhorar — P1/P2, confirmado/risco

**Evidência:** README informa instalador não assinado; configuração de build não define política obrigatória de assinatura. `npm audit --omit=dev --json` retornou **4 entradas de severidade alta e zero críticas**, referentes à cadeia Firebase/Firestore/`@grpc/grpc-js`; duas causas reportadas: [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j) e [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4). A árvore completa retornou 33 entradas: 5 altas e 28 moderadas. Esses totais são registros por dependência, não 33 ataques distintos.

O impacto efetivo dos avisos gRPC no renderer browser pode ser baixo ou ausente, pois o bundle usa o transporte web; o Node SDK também é empacotado/importado por reparos. Não foi comprovada exploração dessas dependências no Mingrx. O comando de CI só falha em severidade crítica, portanto deixa passar os avisos altos atuais.

**Correção:** corrigir/atualizar a cadeia com triagem de alcançabilidade e testes; não executar cegamente `npm audit fix --force` nem aceitar o downgrade antigo sugerido pelo npm como plano de correção. Assinar instalador/executáveis e verificar o editor nas atualizações. Hash do artefato e HTTPS não substituem a autenticação do editor se o canal de distribuição for comprometido. A documentação atual de electron-builder contém mudanças da v27; o projeto usa a v26, então aplicar as opções compatíveis com ela. [Referência v26](https://www.electron.build/v26/docs/win/).

### 29. Arquitetura de reparos sobrepostos e testes estáticos escondem regressões — P1/P2, confirmado

O HTML carrega **49 scripts diretos e 26 folhas de estilo**, além dos módulos internos do bundle Cloud. Há sucessivas redefinições globais de funções, wrappers de `attachSocket`, vários MutationObservers e rotinas periódicas para reparar a UI. `v101-fix.js` redefine até `Node.prototype.textContent`. O renderer principal também usa `backgroundThrottling: false`.

Isso não prova que o aplicativo é lento em todos os PCs. Porém explica o risco de ordem de carregamento: o reparo da DM apaga um argumento do paginador; a mesma função passa por várias versões; um teste que isola um módulo pode passar enquanto a combinação final falha.

**Correção:** migrar incrementalmente para módulos de domínio com interfaces explícitas e um estado de sessão. Remover reparos à medida que a lógica equivalente entra no módulo principal. Atualizar DOM por eventos/estado, limitando observadores e timers. Medir CPU/RAM em repouso, minimizado, voz e tela antes de afirmar ganho de desempenho.

Os smoke tests atuais têm valor, mas vários verificam apenas `source.includes(...)`. A suíte de regras original passou mesmo com A01–A15 presentes. Acrescentar testes negativos de autorização e testes de integração com bundle, socket e UI reais. CI de validação usa `npm install` em um workflow e `npm ci` no release: uniformizar a instalação reproduzível.

### 30. Acessibilidade, diagnóstico e gestão de dados não estão completos — P2, confirmado/validação pendente

O contêiner principal de mensagens não tem `role="log"`/região viva; há muitos controles dinâmicos e modais que precisam de navegação por teclado, foco inicial/retorno e testes com leitor de tela. O site já tem cuidados de foco e reduced motion: aproveitar essa direção no desktop. [W3C: chat com role log](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA23.html).

Há política de privacidade e suporte, portanto esses documentos não estão ausentes. Porém a exclusão depende de pedido manual por GitHub Issues, não há fluxo automatizado de exportação/exclusão no app e várias coleções negam exclusão ao cliente. Pedidos envolvendo dados de conta precisam de canal privado e procedimento interno; não orientar o usuário a publicar informações pessoais em uma issue. Retenção e tratamento de chaves/histórico precisam ficar claros. Isto é recomendação de produto/engenharia, não conclusão jurídica de conformidade.

O diagnóstico disponível é majoritariamente console e UI. Implementar logs locais estruturados com rotação, versão, etapa de boot e códigos de erro, com exportação consentida e remoção de tokens, SDP/IPs e conteúdo de mensagens. Não adicionar telemetria que colete conteúdo sem necessidade.

## O que a pesquisa sobre apps desse tipo muda nas decisões

1. **Confiabilidade de conexão vem antes de mais opções de chamada.** STUN descobre caminhos; TURN fornece relay quando o caminho direto falha. São funções diferentes. O objetivo de permanecer no Spark não elimina essa necessidade nem o custo de banda de mídia.
2. **Permissões devem existir no backend que autoriza cada ação.** Um canal oculto no HTML não protege sua sala RTDB. Amizade, bloqueio, associação e identidade da sessão precisam formar uma política verificável e coerente.
3. **Criptografia é um conjunto de garantias.** Sigilo de conteúdo, verificação de participantes, mudança de dispositivo, recuperação e sigilo futuro são decisões distintas. A referência do Signal ajuda no desenho de DMs; não torna adequada uma implementação caseira por associação de nomes de algoritmos.
4. **Se futuramente houver SFU, revisar a proteção de mídia.** A existência de DTLS-SRTP até um servidor de mídia não implica, sozinha, E2EE entre usuários. O [DAVE do Discord](https://discord.com/blog/meet-dave-e2ee-for-audio-video) exemplifica criptografia adicional e verificação de participantes. Isso não significa que o Mingrx precisa copiar o protocolo ou que sua mídia P2P atual trafega em claro.
5. **Uma promessa de leveza precisa de orçamento e medição.** Medir uma chamada de dois participantes não valida tela 1080p60 para cinco usuários durante um jogo. A topologia e o número de envios importam mais que uma comparação superficial do tamanho do app.
6. **Sem estabilizar sessões, os reparos se multiplicam.** Login, boot, reconexão, troca de conta, logout e atualização precisam compartilhar invariantes: uma conta ativa, listeners dessa conta, mídia autorizada e encerramento garantido.

## Ordem recomendada de correção

| Etapa | Entrega | Critério para encerrar |
|---|---|---|
| 1 — proteção | Corrigir propriedade de sessões, autorização de sala/sinais, bloqueio, reações e edição | Testes negativos negam terceiros, inclusive acessando o SDK diretamente; validar regras implantadas |
| 2 — uso principal | Unificar Firebase, corrigir primeira DM e paginação, limpar logout/reconexão, unificar updater | Duas contas novas conversam; histórico avança; troca de conta não retém mídia/dados; queda e retorno funcionam |
| 3 — conexão e distribuição | TURN, seletor de captura, PTT confiável, assinatura e release em rascunho | Testes reais em Windows e redes distintas; fonte correta de tela; atualização/reabertura verificadas |
| 4 — custo e manutenção | Eliminar consultas redundantes, paginação por cursor, modularizar reparos, observabilidade | Orçamento medido por sessão; regressões de comportamento; menos listeners/timers sem perda de recursos |
| 5 — evolução | Dispositivos/chaves, recuperação, acessibilidade e gestão de dados | Garantias documentadas e testes correspondentes; então avaliar novos recursos/SFU |

Não há base para dar um prazo confiável sem definir recursos disponíveis e executar a primeira etapa. Algumas correções são locais; autorização entre Firestore e RTDB, PTT global e criptografia multi-dispositivo exigem decisões de arquitetura.

## Testes essenciais antes da próxima versão pública

- Duas contas novas: cadastro, verificação, primeira amizade, primeira DM, edição, reação, bloqueio e tentativa de burlar bloqueio.
- Cargos: todos os cargos contra todos os tipos de canal, incluindo acesso direto ao SDK e revogação durante chamada.
- Rede: desconectar/reconectar internet, troca de Wi-Fi, suspensão/retorno, NAT restritivo e TURN forçado.
- Mídia: mic/câmera/tela ativos durante logout, troca de conta, fechar para bandeja e instalar atualização; dois monitores e áudio loopback.
- Windows: PTT com jogo em foco, headset USB/Bluetooth, mudança de dispositivo padrão, 100%/125%/150% de escala, resoluções pequenas e 1080p.
- Carga: 2/3/5 participantes; voz, câmera e tela 720p30/1080p60; CPU/RAM/upload/frames/jitter/perda/latência; quotas por sessão.
- E2EE: conta em dois computadores, perda/corrupção de cofre, troca de chave, mensagens antigas e contato offline.
- Distribuição: instalação limpa, atualização da versão anterior, falha no download, editor/assinatura e reabertura preservando dados.

Os resultados executados e suas limitações estão em [VALIDACAO.md](VALIDACAO.md).
