# Validação da Mingrx 3.2

Versão técnica: `3.2.0`. Código do instalador: `2b67a95f63620b4376ee1bbb34f1de58dbcbfc56`.

- [Pipeline Windows concluído com sucesso](https://github.com/rafaelmingroni/mingrx-app/actions/runs/42337913223).
- [Release pública Mingrx 3.2](https://github.com/rafaelmingroni/mingrx-app/releases/tag/v3.2.0), promovida a latest em 7 de novembro de 2026.
- Instalador, blockmap e `latest.yml` publicados. O pipeline verificou identidade e SHA-512 do instalador antes de publicar.
- Auditoria de produção sem vulnerabilidades conhecidas; limites e avisos das ferramentas de desenvolvimento estão na [revisão dos 25 pontos](SECURITY-3.2.md).
- Testes das regras anteriores e 63 novos testes de autorização, isolamento de contas, esquemas e canais restritos passaram.
- Firebase SDK real em emuladores: migração das sessões de localStorage e IndexedDB para o cofre, remoção dos registros antigos, restauração da sessão no Windows e fallback sem arquivo em texto puro.
- Recuperação de senha gerou a ação real no emulador, mostrou confirmação genérica e bloqueou repetição imediata.
- Duas contas isoladas, relógios em -117s/+300s, proprietário/administrador, chamadas públicas/restritas, pacotes de áudio recebidos, saída, reentrada, reconexão e limpeza dos indicadores passaram.
- Testes do atualizador antes do login, continuidade das atualizações automáticas, convites, membros, E2EE e interações reais do renderer passaram.
- README, pacote e notas foram conferidos no Windows; normalização de CRLF incluída.

## Backend publicado

Conferido pelo job em `2026-11-07T04:24:04.041Z`:

| Verificação | Resultado |
| --- | --- |
| Regras Firestore publicadas iguais às testadas | Verificado |
| SHA-256 normalizado do código das regras | `80388dcbf238705cde5f985958ebcc84ab32cc126d5b8f6a3b406b7828627168` |
| Proteção contra enumeração de e-mails | Ativa e verificada |
| Login por e-mail e senha | Ativo e verificado |
| Enforcement reCAPTCHA de e-mail/senha | Não configurado; não foi declarado como ativo |
| Realtime Database legado | Publicado pelo pipeline com leitura e escrita negadas |

O artefato `Mingrx-Security-2b67a95f63620b4376ee1bbb34f1de58dbcbfc56` do pipeline registra a verificação do backend sem exportar usuários, configurações completas ou credenciais. Não é necessário copiar regras manualmente no console para esta versão.
