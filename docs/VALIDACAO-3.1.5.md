# Validação do hotfix 3.1.5

Execução local em Linux, Node 24 e Electron 45, em 5 de novembro de 2026:

- Suíte Firebase: 62 verificações de autorização aprovadas, incluindo tomada de sessão, sala alheia, sinalização forjada, bloqueio, reações, limite de envio e fechamento do RTDB legado.
- Suíte adicional das regras E2EE aprovada.
- Teste de IPC rejeitando frames/canais não autorizados, sem repasse do evento privilegiado ao renderer, aprovado.
- Teste de paginação de 361 mensagens por cursor aprovado, com encerramento da assinatura anterior.
- Teste da configuração efetiva do atualizador aprovado: instalação ao sair desativada e estados legados/atuais compartilhando a mesma fonte.
- Smoke tests de marca, interface e Cloud aprovados.
- Auditoria das dependências de produção: zero vulnerabilidades reportadas pelo npm.
- 18 testes de interação do Electron aprovados com isolamento e preload de produção. O teste de safeStorage não pôde ser aprovado no Linux sem serviço de cofre; deve passar no CI Windows.
- Layout validado de 980×660 até 3440×1440, incluindo redimensionamento de volta a uma janela pequena.

Os testes headless locais usam diretórios de perfil isolados, idioma pt-BR e resolução virtual. A utilização de `--no-sandbox` é uma necessidade do container de testes, não configuração do aplicativo: o BrowserWindow de produção configura sandbox e context isolation e desativa nodeIntegration.

A validação de UI usa mocks para determinados transportes. Ela não substitui chamada real entre dois PCs, testes com jogos, captura de hardware, TURN operacional, assinatura Authenticode ou atualização real de uma instalação Windows. A publicação depende do CI Windows e do deploy das regras, conforme `release-windows.yml`.
