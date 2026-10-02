# Fluxos dentro das casas — da proposição ao voto, da emenda ao pagamento

> PL78, pedido do autor: "fluxos dentro das casas, porque vou precisar entender tudo isso".
> Cada passo diz **onde aparece na nossa base**, e o que fica de fora dela. Os termos estão
> no [`glossario.md`](glossario.md); as contagens medidas, lá e em
> [`04-contratos.md`](04-contratos.md).
>
> ATENÇÃO: as regras abaixo são da Constituição e dos regimentos internos (RICD na Câmara,
> RISF no Senado), citadas pelo artigo. **Não são medidas nossas.** Onde o texto diz
> "na base", o número vem do banco e tem data.

---

## 1. O caminho de uma proposição

```
apresentação ─► comissões ─► plenário da casa iniciadora ─► casa revisora ─► sanção ou veto
                  │                │                             │
                  │                ├─ votação simbólica           └─ se mudar o texto,
                  │                │   (ninguém fica registrado)       volta à iniciadora
                  │                └─ votação nominal
                  │                    (cada voto registrado: É ISTO que a base tem)
                  └─ parecer; em alguns casos a comissão decide sozinha
                     (poder conclusivo, RICD art. 24, II)
```

| Passo | O que acontece | Na base |
|---|---|---|
| **Apresentação** | Deputado, senador, comissão, Presidente da República, STF, tribunais, PGR ou cidadãos (iniciativa popular) apresentam o texto (CF art. 61). Recebe sigla, número e ano: PL 2.630/2020 | `proposicoes` (sigla, número, ano, ementa) |
| **Comissões** | O texto passa pelas comissões de mérito e pela de constituição e justiça. Cada uma dá parecer e pode propor **substitutivo** (um texto inteiro novo) | Votação em comissão entra quando é nominal; `votacoes.plenario = false` |
| **Urgência** | Um requerimento aprovado pula prazos e leva o texto direto ao plenário | Votação **procedimental** (`categoria`), peso reduzido |
| **Plenário** | Todos os membros da casa. Primeiro o texto principal (ou o substitutivo), depois os **destaques** | A maior parte das votações da base. `votacoes.plenario = true` |
| **Casa revisora** | Projeto que começou na Câmara vai ao Senado, e vice-versa (CF art. 65). Se a revisora muda o texto, ele volta à iniciadora, que só aceita ou recusa a mudança | A mesma proposição aparece votada nas duas casas, em grafos separados: as casas nunca entram na mesma matriz |
| **Sanção ou veto** | O Presidente tem 15 dias úteis para sancionar ou vetar (CF art. 66, §1º). O veto volta ao Congresso, em sessão conjunta, e cai com maioria absoluta de deputados e de senadores (CF art. 66, §4º) | Não está na base: sessão do Congresso não é votação de uma casa |

### Quórum: quantos votos cada tipo de proposição pede

| Tipo | Quórum para aprovar | Votações | Fonte |
|---|---|---|---|
| **PL** (lei ordinária) | Maioria dos votos, presente a maioria absoluta da casa | Um turno | CF art. 47 |
| **PLP** (lei complementar) | Maioria absoluta: 257 deputados, 41 senadores | Um turno | CF art. 69 |
| **PEC** (emenda à Constituição) | Três quintos: 308 deputados, 49 senadores | **Dois turnos em cada casa** | CF art. 60, §2º |
| **MPV** (medida provisória) | Como lei ordinária. Vale desde a edição, por 60 dias prorrogáveis por mais 60; depois de 45 dias sem votação, tranca a pauta da casa em que estiver | Comissão mista e depois cada casa | CF art. 62, §§ 3º e 6º |
| **PDL** (decreto legislativo) | Maioria simples. Não vai à sanção: é competência exclusiva do Congresso (CF art. 49) | Um turno | CF art. 49 |

ATENÇÃO: a PEC votada em dois turnos aparece como **duas votações** do mesmo texto. As duas
estão na base, com descrição diferente ("em primeiro turno", "em segundo turno"). É por isso
que contar votações não é contar proposições.

---

## 2. A votação em plenário, por dentro

```
anúncio da matéria ─► orientação das bancadas ─► votação do texto principal ─► destaques, um a um
                            │                          │                             │
                            └─ `orientacoes`           └─ SUBSTANTIVA, peso 1,0       └─ DESTAQUE, peso 0,7
                                                                                         RISCO: em 14% das nominais,
                                                                                         "Sim" é rejeitar o trecho
```

### Simbólica e nominal

| | Simbólica | Nominal |
|---|---|---|
| Como se vota | O presidente pede que os favoráveis permaneçam como estão e proclama o resultado | Cada parlamentar registra Sim, Não, abstenção ou obstrução no painel eletrônico |
| Quando | É a regra geral | Quando o quórum é qualificado (PEC, PLP), quando o regimento exige, ou quando alguém pede **verificação** da simbólica e o pedido é aceito |
| O que fica registrado | Só o resultado | O voto de cada um |
| Na base | **Fica de fora.** Não há voto individual para medir afinidade | É tudo o que a base mede |

RISCO: só uma fração pequena das votações da Câmara é nominal (ver a linha **Nominal** no
glossário). Afinidade medida pelo voto nominal é afinidade **nas votações disputadas o
bastante para alguém pedir o registro** — é um recorte, e o TCC precisa dizê-lo.

### Destaque

O destaque recorta um trecho do texto para votar à parte depois do principal (RICD art. 161;
RISF art. 312). O tipo que mais pesa na base é o **destaque para votação em separado** (DVS):
o plenário decide se aquele trecho **fica** no texto.

RISCO: aí mora a polaridade. Quando o destaque pede para retirar um trecho, a pergunta que
vai ao painel pode ser "mantém o texto?": votar Sim é **manter** o que o destaque queria
tirar. Em 14% das votações nominais da base, "Sim" significa rejeitar (ver
`.claude/CLAUDE.md`, regra 1, e o teste de polaridade API3).

### Orientação

Antes da votação nominal, o líder de cada bancada (partido, bloco, governo, oposição,
maioria, minoria) anuncia como a bancada deve votar. É registrado pela Câmara e vira a tabela
`orientacoes`.

| Na base | Para quê |
|---|---|
| `orientacoes` (votação, bancada, orientação) | Medir **governismo**: quanto o parlamentar votou como o Governo orientou. Ver glossário §5 |

ATENÇÃO: o Senado **não publica** orientação de bancada. O governismo só se mede na Câmara,
e o comando `orientacoes` da ETL sai sem fazer nada no Senado (`orientacoes.py`).

### Abstenção, obstrução e ausência

| Registro | O que significa | `votos.valor` |
|---|---|---|
| Sim | A favor da pergunta posta | +1 |
| Não | Contra | −1 |
| Abstenção | Presente, sem posição | 0 |
| Obstrução | Presente, recusando-se a dar quórum: tática de minoria. ATENÇÃO: não é abstenção | Nulo (fora do cálculo); no Senado, `presenca` = PRESENTE |
| Artigo 17 | O presidente da sessão, que só vota para desempatar | Nulo |
| Ausência | Não votou. Na Câmara **não gera linha**; no Senado vem com a sigla do motivo (licença, missão) | Sem linha, ou `presenca` = AUSENTE / AUSENTE_JUSTIFICADO |

ATENÇÃO: o termo "voto com posição" ainda não é usado do mesmo jeito em toda a tela: a ficha
conta a abstenção, o painel do início não. Ver PL80 em [`PENDENCIAS.md`](PENDENCIAS.md).

---

## 3. O que é diferente no Senado

| | Câmara | Senado |
|---|---|---|
| Cadeiras | 513, proporcional à população do estado | 81, três por estado |
| Mandato | 4 anos: uma legislatura | **8 anos: duas legislaturas.** A renovação alterna um terço e dois terços a cada eleição |
| Suplente | O próximo mais votado da coligação ou federação | **Dois suplentes por senador**, eleitos na mesma chapa. Assumem sem eleição própria |
| Orientação de bancada | Publicada: `orientacoes` | **Não publicada** |
| Votação secreta | Rara | Obrigatória na aprovação de autoridades: ministros de tribunais superiores, embaixadores, diretores de agências, PGR (CF art. 52, III e IV). Por isso tantas votações secretas no Senado (achado #17) |
| Papel exclusivo | Autorizar processo contra o Presidente (CF art. 51, I) | Julgar o Presidente no impeachment; aprovar autoridades (CF art. 52) |
| Na base | `votacoes` com `casa = CAMARA`, um grafo por legislatura | `casa = SENADO`, grafo próprio. O senador de 8 anos aparece nas duas legislaturas do mandato |

RISCO: a legislatura é **do Congresso** e vale para as duas casas: a 57ª vai de fevereiro de
2023 a janeiro de 2027 na Câmara **e** no Senado. O senador eleito em 2018 está na 56ª e na
57ª. Ver `Legislaturas.cs`.

---

## 4. Da emenda ao pagamento

A palavra "emenda" tem dois sentidos (glossário §3). Aqui é a **emenda ao Orçamento**: o
parlamentar indica para onde vai parte do dinheiro da lei orçamentária.

```
apresentação na LOA ─► aprovação na CMO e no plenário do Congresso ─► empenho ─► liquidação ─► pagamento
     (ano anterior)                                                     │            │              │
                                                                        promessa     entrega        o dinheiro
                                                                        de pagar     conferida      sai
                                                                                                    │
                                                         o que não for pago no ano ─────────────────┴─► restos a pagar
```

| Passo | O que é | Na base |
|---|---|---|
| **Apresentação** | No ano anterior, na Comissão Mista de Orçamento (CMO). A emenda de 2025 foi apresentada em 2024 pelo mandato que estava lá (achado #24) | `emendas.ano` é o ano do orçamento; `Legislaturas.AnosDeEmenda` faz a conta |
| **Empenho** | O governo reserva o dinheiro e promete pagar. RISCO: empenhado **não é** pago | `emendas.valor_empenhado` |
| **Liquidação** | O governo confere que a obra ou o serviço foi entregue | `emendas.valor_liquidado` |
| **Pagamento** | O dinheiro sai | `emendas.valor_pago`; quem recebeu, em `emendas_favorecidos` |
| **Restos a pagar** | O empenhado de um ano que só é pago nos anos seguintes | `emendas.valor_resto_pago`. ATENÇÃO: somá-lo ao pago do ano inflaria o número da ficha |

### Os tipos de emenda

| Tipo | Quem indica | Obrigatória? | Fonte |
|---|---|---|---|
| **Individual** | Cada deputado e senador | Sim: o governo tem de executar, até 2% da receita corrente líquida, metade para a saúde | CF art. 166, §§ 9º e 11 |
| **Transferência especial** ("emenda Pix") | Individual, mandada direto a estado ou município, sem convênio | Sim, dentro da individual | CF art. 166-A (EC 105/2019) |
| **De bancada** | A bancada de cada estado | Sim, até 1% da receita corrente líquida | CF art. 166, §12 (EC 100/2019) |
| **De comissão** | Comissões da Câmara, do Senado ou mistas | Não | Lei de Diretrizes Orçamentárias de cada ano |
| **De relator** (RP9) | O relator-geral do orçamento | Extinta: o STF a julgou inconstitucional em dezembro de 2022 | STF, ADPF 850, 851, 854 e 1014 |

RISCO: só a emenda **individual** tem autor que é uma pessoa. A de bancada, de comissão e de
relator entram na base sem `pessoa_id`, e a ficha não as atribui a ninguém: atribuí-las por
semelhança de nome seria inventar autoria (ver `ServicoEmendas`).

---

## 5. Onde cada fluxo cruza a base

| Pergunta do TCC | O passo que a responde | Tabela |
|---|---|---|
| Quem vota junto? | Votação nominal, texto principal e destaques | `votos`, `votacoes` |
| Quem segue o governo? | Orientação do Governo × voto | `orientacoes`, `votos` |
| O que o parlamentar fez com o dinheiro do gabinete? | Cota (não é emenda: é verba do mandato) | `despesas` |
| Para onde mandou o dinheiro do orçamento? | Emenda individual, do empenho ao pagamento | `emendas`, `emendas_favorecidos` |
| Quem pagou a campanha? | Prestação de contas ao TSE | `receitas_de_campanha` |
| De que arquivo veio cada linha? | PL72: a carga de cada download | `cargas`, `carga_id` |
