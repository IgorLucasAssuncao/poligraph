# poligraph

> **Arquitetura ETL e Modelagem em Grafos: Mensuração de Afinidade Política em Redes Sociais
> e Análise de Dados Financeiros de Políticos** — TCC, Sistemas de Informação, PUC Minas.

Publicado como **Registro Aberto**, em https://registroaberto.org.

O site compara as respostas de um questionário com o **voto registrado em plenário** de
deputados federais e senadores: a afinidade sai do que cada parlamentar votou, e não do que
ele declara. Ao lado do voto, cada parlamentar tem um **perfil financeiro**: a cota parlamentar,
as emendas que destinou e quem as recebeu, e o financiamento da campanha.

> **Ferramenta acadêmica. Não é recomendação de voto.**

---

## O que o site mostra

| Tela | O que tem |
|---|---|
| **Início** | O tamanho da base, o grafo da Câmara e, para quem segue alguém, o "O que mudou" |
| **Compare seu voto** | O questionário: 24 perguntas tiradas de votações reais, e com quem você mais concordou em cada casa |
| **Parlamentares** | A lista, com filtro por casa, partido e estado, e o grafo de quem vota parecido |
| **Página do parlamentar** | Como vota, quem vota parecido, cota, emendas, campanha, patrimônio e redes |
| **Dinheiro público** | Emendas por município e por quem recebeu, e as contas do governo federal |
| **Seguir** | Acompanhar parlamentares, com o sininho do cabeçalho e avisos opcionais no navegador |
| **Modo Auditoria** | Clicar num número e ver de que arquivo oficial ele saiu, com o hash do arquivo |

## A base — medido em 2026-10-18

No banco local, cópia do de produção de 2026-10-15. A 57ª legislatura vai até 31 de janeiro
de 2027: os números da legislatura corrente ainda crescem.

| 57ª legislatura (2023–2027) | Câmara | Senado |
|---|---:|---:|
| Votações de plenário | 1.125 | 423 |
| Votos individuais | 471.978 | 34.263 |
| Parlamentares com voto | 643 | 104 |
| Perguntas ativas no questionário | 40 | 9 |

| Toda a base | Total |
|---|---:|
| Votações, de 2001 a 2026 | 12.436 |
| Votos individuais | 2.179.300 |
| Pessoas (deputados e senadores de todas as legislaturas) | 8.319 |
| Despesas de cota, de 2009 a 2026 | 5.600.360 |
| Emendas, de 2015 a 2026 | 78.074 |
| Receitas de campanha | 193.301 |
| Arquivos baixados com procedência registrada | 1.740 |

## Fontes

Só fonte pública e periódica, que a ETL baixa de novo sozinha. Nenhuma pede chave.

| Fonte | O que vem dela |
|---|---|
| **Câmara dos Deputados** | Deputados, votações, votos, orientação de bancada, proposições e cota parlamentar (CEAP), por arquivos anuais; o CPF (só para o hash) e as redes, pela API |
| **Senado Federal** | Senadores, votações nominais de plenário, matérias e a cota do Senado (CEAPS) |
| **TSE** | Candidaturas, receitas de campanha (com fundo eleitoral e partidário), bens declarados e redes de senadores |
| **Portal da Transparência** | Emendas, quem recebeu cada pagamento e os convênios; e as contas do governo federal: orçamento, receitas, cartões, viagens, compras e sanções. Download público, sem chave |
| **Receita Federal** | Cadastro de CNPJ: o município da sede de quem recebeu emenda |
| **IBGE** | População estimada de cada município, para o mapa por habitante |
| **BrasilAPI** | Sede dos CNPJs que o arquivo da Receita não resolveu |

Formato, armadilhas e o que fica de fora de cada uma estão no
[mapa do sistema](mapa_do_sistema.html), aba de fontes.

## Como é feito

| Parte | Tecnologia | Papel |
|---|---|---|
| `src/etl` | Python (pandas, scipy, networkx) | Baixa, transforma e carrega as fontes; calcula similaridade, grafo e comunidades |
| `src/api/Poligraph.Data` | EF Core, PostgreSQL | Dono do schema e das migrations; aplica as migrations ao subir |
| `src/api/Poligraph.Api` | ASP.NET Core Minimal API, .NET 10 | Lê o banco e serve o site; login com Google |
| `src/api/Poligraph.Worker` | .NET, Hangfire | Avisos no navegador para quem segue, depois de cada carga |
| `src/web` | React, Vite | O site |
| `src/api/Poligraph.AppHost` | Aspire 13 | Sobe tudo no desenvolvimento |

Produção: VPS com Coolify, atrás de um túnel da Cloudflare; passo a passo em
[`arquitetura.html`](arquitetura.html).

## Como rodar

Precisa de .NET 10, Node 24, Python 3.13 e Docker ou Podman.

```bash
dotnet run --project src/api/Poligraph.AppHost
```

O painel do Aspire sobe o Postgres, aplica as migrations e liga a API, o worker e o site. As
cargas da ETL aparecem no painel e rodam com um clique; a ordem e os comandos estão no
[manual da ETL](src/etl/README.md).

Os segredos ficam no user-secrets do AppHost e da API, nunca em `appsettings.json`:

| Segredo | Para quê | Como |
|---|---|---|
| `Google:ClientId` | Login | `dotnet user-secrets set "Google:ClientId" "…" --project src/api/Poligraph.Api` |
| `Parameters:chave-cpf` | Hash do CPF (HMAC) | `dotnet user-secrets set "Parameters:chave-cpf" "…" --project src/api/Poligraph.AppHost` |
| `Parameters:avisos-chave-publica` e `Parameters:avisos-chave-privada` | Avisos no navegador | O par sai de `dotnet run --project src/api/Poligraph.Worker -- gerar-chaves` |

Sem o `Google:ClientId`, o site funciona e só o login fica desligado. A conta é opcional: só
seguir e a própria conta pedem login.

### Testes

```bash
dotnet test                                                # API e worker, com Postgres real
cd src/etl && py -m pytest -q                              # ETL, com Postgres real
cd src/web && npx vitest run && npx tsc -b && npm run lint # site
```

Os testes de integração usam Testcontainers e são pulados sem Docker. Entre eles está o de
polaridade: em parte das votações nominais "Sim" quer dizer rejeitar a proposta, e nenhuma
mudança no cálculo de afinidade entra sem ele.

## Dados pessoais

- A lista de quem a pessoa segue é dado sensível (LGPD, art. 5º, II): consentimento próprio,
  exclusão física ao deixar de seguir, e a conta inteira se apaga na página da conta.
- O CPF dos parlamentares nunca é gravado nem mostrado: só um HMAC com chave secreta, para
  casar as fontes.
- Nenhum token nem senha no banco. A sessão é um cookie cifrado.

Detalhe na [política de privacidade](src/web/src/nucleo/textos-legais.ts) publicada no site.

## Documentação

| Documento | Para quê |
|---|---|
| [**Mapa do sistema**](mapa_do_sistema.html) | O documento central: fontes, comandos, tabelas e rotas |
| [Arquitetura de produção](arquitetura.html) | Servidor, Coolify, Cloudflare, segredos, rede |
| [Guia técnico](guia-tecnico.html) | O método explicado com exemplos interativos |
| [Pendências](docs/PENDENCIAS.md) | O que está aberto e o histórico do que fechou |
| [Contratos](docs/04-contratos.md) | As cardinalidades medidas de cada fonte |
| [Glossário](docs/glossario.md) | Os termos, e os pares que já viraram bug |
| [Manual da ETL](src/etl/README.md) | Comandos, ordem e carga do zero |
| [Achados](docs/achados/) | O que a medição mostrou e mudou o desenho |
