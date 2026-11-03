# Publicação do mingrx.site

Arquitetura planejada: domínio na Hostinger + hospedagem GitHub Pages + releases do GitHub. **Nenhum serviço pago adicional é necessário.**

> Registros do GitHub Pages conferidos na documentação oficial em 03/11/2026. Revalidar antes de qualquer mudança futura de DNS.

## Ordem segura de publicação

1. Manter a PR do site em draft enquanto o domínio ainda aponta para a página estacionada da Hostinger.
2. Em `Settings > Pages` do repositório `rafaelmingroni/mingrx-app`, definir o domínio personalizado como `mingrx.site`.
3. No editor de DNS da Hostinger, remover registros de estacionamento conflitantes para `@`/`www` e criar os registros abaixo.
4. Aguardar o GitHub reconhecer a configuração DNS.
5. Tornar a PR do site pronta e fazer o merge em `main`.
6. Confirmar o workflow `Deploy Mingrx site` concluído com sucesso.
7. Validar `https://mingrx.site`, `https://www.mingrx.site`, download da versão mais recente e links `?invite=`.
8. Ativar `Enforce HTTPS` no GitHub Pages quando a opção estiver disponível.

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
- Alterações de DNS podem levar tempo para propagar; não remover a página atual nem alterar o fluxo de convites antes de verificar o domínio.
- Os links de download da home consultam a release mais recente do GitHub e caem para `/releases/latest` se a API não responder.
