# Publicação do mingrx.site

Arquitetura planejada: domínio na Hostinger + hospedagem GitHub Pages + releases do GitHub. **Nenhum serviço pago adicional é necessário.**

> Registros e fluxo conferidos na documentação oficial do GitHub Pages em 03/11/2026. Revalidar antes de qualquer mudança futura de DNS.

## Ordem segura de publicação

1. Manter a PR do site em draft enquanto o domínio ainda aponta para a página estacionada da Hostinger.
2. **Verificar o domínio na conta pessoal do GitHub**: `Profile Settings > Pages > Add a domain`, informar `mingrx.site` e copiar o registro TXT de verificação que o GitHub gerar.
3. Adicionar esse TXT no editor DNS da Hostinger e concluir `Verify` no GitHub. Manter o TXT permanentemente.
4. Em `Settings > Pages` do repositório `rafaelmingroni/mingrx-app`, definir o domínio personalizado como `mingrx.site`.
5. No editor de DNS da Hostinger, remover registros de estacionamento conflitantes para `@`/`www` e criar os registros abaixo.
6. Aguardar o GitHub reconhecer a configuração DNS.
7. Tornar a PR do site pronta e fazer o merge em `main`.
8. Confirmar o workflow `Deploy Mingrx site` concluído com sucesso.
9. Validar `https://mingrx.site`, `https://www.mingrx.site`, download da versão mais recente e links `?invite=`.
10. Ativar `Enforce HTTPS` no GitHub Pages quando a opção estiver disponível.

A verificação no nível da conta é recomendada pelo GitHub para impedir que outra conta tente usar seu domínio em outro site GitHub Pages.

## DNS do domínio raiz

Criar quatro registros `A`, todos com nome/host `@`:

| Tipo | Nome | Valor |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |

O GitHub também suporta registros AAAA para IPv6. Eles são opcionais para o primeiro corte; se usados, manter também os registros A.

## www

Criar:

| Tipo | Nome | Valor |
| --- | --- | --- |
| CNAME | www | rafaelmingroni.github.io |

Com `mingrx.site` configurado como domínio personalizado, o GitHub Pages pode redirecionar `www.mingrx.site` para o domínio raiz quando ambos os DNS estiverem corretos.

## Observações

- Não usar registro curinga `*` para o domínio.
- Não contratar hospedagem da Hostinger para este site.
- O arquivo `site/CNAME` é mantido como documentação do domínio, mas o deploy usa GitHub Actions; portanto o domínio personalizado também precisa ser configurado em `Settings > Pages`.
- Alterações de DNS podem levar até 24 horas para propagação, embora muitas ocorram antes.
- Não remover a página atual nem alterar o fluxo de convites antes de verificar o domínio.
- Os links de download da home consultam a release mais recente do GitHub e caem para `/releases/latest` se a API não responder.

## Revisão de 6 de novembro de 2026

O domínio já está configurado com HTTPS obrigatório. A home usa styles.css, capturas reais do aplicativo e fontes locais. As páginas auxiliares também usam legal.css. O pipeline valida arquivos, links, convites e o navegador em 320 a 1440 px antes da publicação.

## Reformulação de 7 de novembro de 2026

- Capturas reais do Mingrx 3.2, com contas de demonstração e dados sintéticos, incluindo conversa e chamada com WebRTC conectado. A origem e os recortes estão registrados em assets/mingrx-captures.provenance.json e nos metadados XMP dos WebP.
- Fonte Manrope hospedada localmente com sua licença OFL. Não há dependência de Google Fonts no navegador.
- Cenas selecionáveis por teclado, recortes próprios para celular, cópia de link com alternativa quando a permissão é negada e informação de versão pública sem o patch técnico zero.
- Convites preservam os códigos de 8 e 12 caracteres e o protocolo. Links malformados orientam a pedir um novo convite; validade e autorização continuam verificadas pelo aplicativo.
- O suporte começa pelos assuntos. O contato confirmado é mingrxapp@gmail.com; chamados no GitHub são públicos.
- Não há mudança de domínio, DNS, backend ou versão do aplicativo nesta publicação do site.
