# Câmara dos Deputados — como a casa funciona

> **Para quem é este documento:** para quem vai modelar os dados da Câmara sem ter
> formação em ciência política. Cada seção termina ligando o conceito ao **campo
> concreto que aparece na API** — porque quase toda estranheza do dado tem uma
> explicação institucional.
> **Status:** v1.0 — 2026-08-22
> Ver também: [02-senado-federal.md](02-senado-federal.md),
> [10-api-camara.md](10-api-camara.md), [00-discovery.md](00-discovery.md)

---

## 1. O que é a Câmara

O Congresso Nacional brasileiro é **bicameral**: duas casas que precisam concordar para
que uma lei exista.

| | Câmara dos Deputados | Senado Federal |
|---|---|---|
| Representa | **o povo** | **os estados** |
| Membros | **513** | 81 |
| Mandato | 4 anos | 8 anos |
| Eleição | proporcional | majoritária |
| Apelido | "casa baixa" | "casa alta" |

A Câmara é onde a maior parte da produção legislativa **começa**. É também a casa mais
barulhenta, mais fragmentada e — para o nosso projeto — de longe a mais rica em dados.

---

## 2. Composição: por que 513, e por que isso importa

Os 513 deputados são distribuídos entre os 26 estados e o DF **proporcionalmente à
população**, mas com dois limites constitucionais (CF art. 45, §1º):

- **mínimo de 8** deputados por estado;
- **máximo de 70** deputados por estado.

Na prática: São Paulo tem 70; Acre, Roraima, Amapá, Rondônia, Tocantins e DF têm 8.

⚠️ **Consequência para a análise:** a representação é **desproporcional de propósito**.
Um deputado de Roraima representa muito menos eleitores que um de São Paulo. Se em algum
momento você for ponderar algo por "representatividade populacional", esse viés precisa
ser dito no texto — ele é constitucional, não é erro de dado.

### 2.1 Como um deputado é eleito (e por que isso gera nomes estranhos)

A eleição é **proporcional de lista aberta**, o que é pouco intuitivo:

1. Somam-se os votos válidos e divide-se pelo número de cadeiras do estado → **quociente
   eleitoral**.
2. Os votos de cada partido/federação (nominais + de legenda) são divididos pelo
   quociente → quantas cadeiras aquele partido ganhou (**quociente partidário**).
3. **Só então** olha-se quem, dentro do partido, teve mais votos.

Ou seja: **você vota primeiro no partido, mesmo votando em uma pessoa.** É por isso que
existe o fenômeno do "puxador de votos" — um candidato muito votado (o caso clássico é o
Tiririca) elege colegas de partido com votação baixíssima.

Desde 2020 há um piso: o candidato precisa de **10% do quociente eleitoral** para ser
eleito, o que reduziu (mas não eliminou) o efeito.

**Coligações proporcionais foram proibidas** a partir de 2020 (EC 97/2017). O substituto
são as **federações partidárias** (seção 4.3).

→ *No dado:* nada disso aparece diretamente na API da Câmara — aparece no **TSE**
(votação nominal recebida por candidato). É o principal motivo para o enriquecimento
via TSE na F7.

---

## 3. O calendário: legislatura, sessão legislativa, recesso

Três palavras que parecem sinônimos e não são:

| Termo | O que é | Duração |
|---|---|---|
| **Legislatura** | O período de mandato de uma composição inteira da Câmara | 4 anos |
| **Sessão legislativa** | Um ano de trabalho dentro da legislatura | 1 ano |
| **Sessão** | Uma reunião (deliberativa, solene, etc.) | 1 dia |

A **57ª legislatura** é a atual — confirmado pela API
(`GET /legislaturas/57` → `dataInicio: 2023-02-01`, `dataFim: 2027-01-31`).

A sessão legislativa ordinária vai de **2 de fevereiro a 22 de dezembro**, com recesso de
**18 a 31 de julho** (CF art. 57).

⚠️ **Consequência para o dado:** a atividade legislativa é **sazonal**. Dezembro é
atipicamente intenso (pauta acumulada, orçamento); julho e janeiro são vazios; e anos
eleitorais têm o segundo semestre esvaziado porque os deputados estão em campanha. Se
você plotar votações por mês, vai ver isso. **Não é bug.**

→ *No dado:* o campo `idLegislatura` aparece em quase todo endpoint. **Sempre filtre por
ele** ao montar a matriz de votos — misturar legislaturas mistura populações diferentes.

---

## 4. Quem manda de verdade

Esta é a seção mais importante para entender por que os dados de votação têm a cara que
têm.

### 4.1 A Mesa Diretora

Órgão que administra a casa: **Presidente**, 1º e 2º Vice-Presidentes, 4 Secretários e
4 Suplentes. Mandato de **2 anos**, vedada a recondução para o mesmo cargo na eleição
imediatamente subsequente dentro da mesma legislatura (CF art. 57, §4º).

O **Presidente da Câmara** é provavelmente o cargo mais poderoso do Brasil depois da
Presidência da República, por três razões:

1. **Define a pauta.** Nada é votado no plenário sem que ele queira. Um projeto pode
   ficar anos "engavetado" sem nenhuma decisão formal de rejeição.
2. **Decide sobre admissibilidade de pedidos de impeachment** contra o Presidente da
   República. Sozinho.
3. É o **segundo na linha de sucessão presidencial** (depois do Vice-Presidente).

→ *No dado:* a Mesa é `codTipoOrgao = 1` ("Comissão Diretora"). E o voto
**`"Artigo 17"`** que aparece no CSV (401 ocorrências em 2025) é justamente o do
Presidente da sessão: ele só vota em casos específicos, e o registro marca isso.

### 4.2 O Colégio de Líderes

Cada partido com bancada elege um **Líder**. Os líderes, somados ao **Líder do Governo**,
formam o **Colégio de Líderes** — que é onde a pauta é de fato negociada.

O líder tem dois poderes concretos que aparecem no dado:

- pode **requerer votação nominal** (o que gera o registro individual que usamos);
- **orienta a bancada**: antes da votação, anuncia "o partido X vota Sim".

→ *No dado, e isso é ouro para o projeto:* `GET /votacoes/{id}/orientacoes` devolve a
orientação oficial por bancada. E ela inclui **pseudo-bancadas** que não são partidos:

```
Governo    → Sim
Maioria    → Sim
Minoria    → Não
Oposição   → Não
NOVO       → Obstrução
Fdr PSOL-REDE → Sim
```

Isso significa que **você tem um rótulo oficial de governo × oposição por votação**, sem
precisar inferir nada. Combinado com o voto individual, dá para medir **disciplina
partidária** (quantos % da bancada seguiram a orientação) e **governismo** de cada
deputado diretamente. É a melhor resposta disponível para a pergunta *"o partido explica
o voto?"* do discovery.

### 4.3 Partidos, blocos e federações — três coisas diferentes

| Conceito | O que é | Dura |
|---|---|---|
| **Partido** | A legenda em si (PT, PL, PSD...) | — |
| **Bloco parlamentar** | União informal de partidos para ganhar tempo de fala e cargos | Pode desfazer a qualquer momento |
| **Federação partidária** | União **formal**, registrada no TSE; agem como um partido só | **Obrigatoriamente 4 anos** |

As federações são recentes (Lei 14.208/2021, valendo desde 2022) e são a resposta ao fim
das coligações. Exemplos que aparecem no dado: *Federação Brasil da Esperança (PT, PCdoB,
PV)*, *Federação PSDB-Cidadania*, *Federação PSOL-REDE*.

⚠️ **Isso quebra a normalização ingênua.** No campo `siglaPartidoBloco` das orientações
aparecem strings como `"Bl PlFdrPTUniPp..."` — nomes de bloco truncados e ilegíveis. Não
tente tratar isso como chave. **Use `siglaPartido` do voto individual** (que é limpo) e
trate bloco/federação como atributo separado.

### 4.4 Cláusula de desempenho e janela partidária

- **Cláusula de desempenho** (EC 97/2017): partidos que não atingem um patamar mínimo de
  votos perdem acesso ao fundo partidário e ao tempo de TV. É progressiva até 2030.
  Efeito: ondas de fusões e incorporações — partidos **desaparecem entre eleições**.
- **Janela partidária**: existe um período legal em que o deputado pode trocar de partido
  **sem perder o mandato**.

⚠️ **Consequência direta para o modelo:** por causa dessas duas regras, a sigla de um
deputado **muda dentro da legislatura**, e a sigla em si pode deixar de existir. Foi
exatamente o que medimos: **14 deputados trocaram de partido em 2025**. É a justificativa
institucional para a regra da seção 6.1 do discovery — guardar `partido_no_voto`
desnormalizado na linha do voto.

⚠️ Detalhe jurídico que importa: para cargos **proporcionais** (deputado), o mandato
pertence ao **partido** — trocar fora da janela pode custar a cadeira. Para cargos
**majoritários** (senador), o mandato pertence **à pessoa**. As duas casas se comportam
de forma diferente nesse ponto.

### 4.5 As bancadas que não existem no papel

Grupos informais, sem registro, mas que explicam padrões de voto melhor que o partido:

- **Bancada ruralista** (agronegócio) — a mais organizada, articulada pela Frente
  Parlamentar da Agropecuária.
- **Bancada evangélica** — pauta de costumes.
- **Bancada da bala** — segurança pública, policiais e militares eleitos.
- **Bancada sindical** — ligada a centrais de trabalhadores.
- **Centrão** — bloco pragmático de partidos de centro-direita que negocia apoio ao
  governo de turno em troca de cargos e emendas. Não é ideológico; é fisiológico.
- **"Baixo clero"** — apelido para a massa de deputados sem projeção nacional.

→ *Por que isso importa:* se a detecção de comunidades do seu grafo (seção 8 do
discovery) encontrar clusters que **não** coincidem com partidos, é bem provável que
esteja encontrando **estes** grupos. Esse é potencialmente o resultado mais interessante
do TCC — e você precisa dessa seção para interpretá-lo.

### 4.6 Frentes parlamentares

Versão **formal** das bancadas temáticas: precisam de assinaturas de **1/3 da casa (171
deputados)** para serem registradas.

⚠️ **Sinal inútil como aresta — e a medição é pior do que se imaginava.** Justamente
porque exigem 171 assinaturas, os deputados assinam frentes por cortesia. Medido na API:

| Deputado | Frentes | Comissões (órgãos) |
|---|---|---|
| 204528 | **273** | 12 |
| 204455 | **317** | — |
| 221328 | **102** | — |

Não são "dezenas": são **centenas**. Um deputado com 317 frentes está em boa parte de
todas as frentes existentes. Como aresta de grafo, isso produz densidade quase total e
**poder discriminante nulo**.

→ *Decisão:* **frentes não entram no grafo.** Viram atributo do nó, se tanto.

→ *O substituto é comissão em comum* (`/deputados/{id}/orgaos`,
`/orgaos/{id}/membros`): escassa, disputada, e com **vigência temporal**
(`titulo`, `dataInicio`, `dataFim`). É o inverso da frente em tudo que importa.

---

## 5. As comissões

Antes de ir ao plenário, um projeto passa por comissões. São **30 comissões
permanentes** na 57ª legislatura (lista obtida da API):

| Sigla | Comissão |
|---|---|
| CCJC | Constituição e Justiça e de Cidadania |
| CFT | Finanças e Tributação |
| CAPADR | Agricultura, Pecuária, Abastecimento e Desenvolvimento Rural |
| CSPCCO | Segurança Pública e Combate ao Crime Organizado |
| CMADS | Meio Ambiente e Desenvolvimento Sustentável |
| CE | Educação |
| CSAUDE | Saúde |
| CTRAB | Trabalho |
| CREDN | Relações Exteriores e de Defesa Nacional |
| CDHMIR | Direitos Humanos, Minorias e Igualdade Racial |
| CFFC | Fiscalização Financeira e Controle |
| CDC | Defesa do Consumidor |
| CVT | Viação e Transportes |
| CME | Minas e Energia |
| CCTI | Ciência, Tecnologia e Inovação |
| CDE | Desenvolvimento Econômico |
| CICS | Indústria, Comércio e Serviços |
| CCULT | Cultura |
| CESPO | Esporte |
| CTUR | Turismo |
| CDU | Desenvolvimento Urbano |
| CINDRE | Integração Nacional e Desenvolvimento Regional |
| CPASF | Previdência, Assistência Social, Infância, Adolescência e Família |
| CMULHER | Defesa dos Direitos da Mulher |
| CIDOSO | Defesa dos Direitos da Pessoa Idosa |
| CPD | Defesa dos Direitos das Pessoas com Deficiência |
| CPOVOS | Amazônia e dos Povos Originários e Tradicionais |
| CCOM | Comunicação |
| CASP | Administração e Serviço Público |
| CLP | Legislação Participativa |

### 5.1 Duas comissões mandam mais que as outras

- **CCJC** — analisa **constitucionalidade e admissibilidade** de tudo. Um parecer pela
  inconstitucionalidade mata o projeto. É a comissão mais disputada da casa.
- **CFT** — analisa **adequação orçamentária e financeira**. Segundo filtro geral.

→ *No dado:* isso explica por que a CCJC aparece com **49 votações nominais em 2025** —
muito acima de qualquer outra comissão, e atrás só do plenário (410).

### 5.2 Poder conclusivo — comissão que aprova lei sozinha

Regra pouco conhecida e importante: certas comissões podem aprovar um projeto **em
caráter conclusivo**, sem que ele passe pelo plenário (art. 24, II do Regimento Interno).

→ *Consequência:* **nem toda lei aprovada aparece em votação de plenário.** Analisando só
`siglaOrgao = PLEN`, perde-se parte da produção legislativa.

⚠️ **E não há como compensar isso com as votações de comissão.** Elas existem (116
nominais em 2025), mas registram a mediana de **29 votos** — só os membros daquela
comissão. Como a composição das comissões é distribuída pelos líderes por
proporcionalidade partidária, incluí-las na matriz **inflaria a similaridade entre
correligionários por um mecanismo que não é o voto**, contaminando a pergunta central do
trabalho. Ver achado #15, seção 4.1.5 do discovery.

→ A cobertura é de **comportamento em votação de plenário registrada**, e essa limitação
é declarada, não contornada.

### 5.3 Outros colegiados

| Tipo | `codTipoOrgao` | O que é |
|---|---|---|
| Comissão Diretora (Mesa) | 1 | Administra a casa |
| Comissão Permanente | 2 | As 30 acima |
| Comissão Especial | 3 | Criada para uma PEC ou projeto que toca muitas áreas |
| **CPI** | 4 | Investigação. Exige **1/3 da casa (171 assinaturas)**, fato determinado e prazo certo. Tem poderes de investigação próprios de autoridade judicial |
| Comissão Externa | 5 | Acompanha algo fora de Brasília |
| Comissão Mista Permanente | 6 | Com o Senado |
| Comissão de Medida Provisória | 9 | Mista, para analisar MPs |
| Comissão Representativa do CN | 8 | Funciona durante o recesso |

---

## 6. Os tipos de proposição

O que aparece no campo `siglaTipo`:

| Sigla | Nome | O que faz | Quórum |
|---|---|---|---|
| **PL** | Projeto de Lei (ordinária) | O caso comum | Maioria simples |
| **PLP** | Projeto de Lei Complementar | Matérias que a Constituição exige lei complementar | **Maioria absoluta (257)** |
| **PEC** | Proposta de Emenda à Constituição | Muda a Constituição | **3/5 (308), em 2 turnos, nas 2 casas** |
| **MPV** | Medida Provisória | Editada pelo Presidente, já com força de lei; o Congresso confirma ou derruba | Maioria simples |
| **PDL** | Projeto de Decreto Legislativo | Competência exclusiva do Congresso (ex.: sustar ato do Executivo, tratados) | Maioria simples |
| **PRC** | Projeto de Resolução | Assuntos internos da casa | Varia |
| **REQ** | Requerimento | **Procedimental** — urgência, retirada de pauta, adiamento, convite | Varia |
| **RIC** | Requerimento de Informação | Pergunta formal a ministro | — |
| **INC** | Indicação | Sugestão ao Executivo, sem força | — |
| **PPP** | Parecer Proferido em Plenário | Registro do parecer do relator | — |
| **RPD**, **DTQ**, **EMP** | Requerimento de destaque, destaque, emenda de plenário | Incidentes de votação | — |

⚠️ **PPP é uma armadilha do dado.** É o "achado #8" do discovery: o campo
`uriProposicaoCitada` de uma votação frequentemente aponta para um **PPP**, não para o
projeto. PPP não é uma matéria — é o registro de que alguém leu um parecer. Use
`proposicoesAfetadas`.

---

## 7. Como um projeto vira lei

```
  Apresentação (deputado, senador, Executivo, cidadão via iniciativa popular…)
        ↓
  Despacho do Presidente da Câmara  ──► define por quais comissões passa
        ↓
  Comissões de mérito (temáticas)
        ↓
  CFT  (adequação financeira)
        ↓
  CCJC (constitucionalidade)          ──► pode morrer aqui
        ↓
  ┌─────────────────────────────┐
  │ conclusivo? → vira lei sem  │
  │ passar pelo plenário        │
  └─────────────────────────────┘
        ↓ (se não for conclusivo)
  PLENÁRIO da Câmara
        ↓
  SENADO  (casa revisora)
        ↓  se o Senado emendar, VOLTA para a Câmara
        ↓  (a casa iniciadora dá a palavra final)
  Sanção ou VETO do Presidente da República
        ↓
  Veto é analisado em SESSÃO CONJUNTA do Congresso
```

**Conceito-chave — casa iniciadora × casa revisora:** quem começa dá a última palavra. Um
PL que nasce na Câmara vai ao Senado; se o Senado alterar, volta à Câmara, que decide se
aceita a alteração. O Senado **não** pode impor sua versão.

---

## 8. Regimes de tramitação — e por que há tanto requerimento

Três velocidades: **ordinário**, **prioridade** e **urgência**.

O **requerimento de urgência** (art. 155 do Regimento) é o instrumento central da política
brasileira real: aprovado por **maioria absoluta**, ele **pula todas as comissões** e leva
o projeto direto ao plenário.

→ **Isto explica o achado #11 do discovery**: 58% das votações nominais de 2025 são
requerimentos. Não é ruído do dado — é como a casa funciona. A disputa política de
verdade muitas vezes é *sobre pautar*, não sobre o mérito.

⚠️ E é por isso que a recomendação do discovery é assimétrica: **filtrar requerimentos
do questionário** (ninguém tem opinião sobre "urgência para o PL 3469/2024") mas
**mantê-los na matriz de similaridade** (são o sinal mais limpo de governo × oposição
que existe).

---

## 9. Como se vota — e por que só 3,5% das votações têm nome

### 9.1 Simbólica × nominal

- **Votação simbólica** (padrão): o presidente pede que os favoráveis permaneçam sentados,
  observa o plenário e anuncia o resultado. **Não há registro individual.**
- **Votação nominal**: cada deputado registra o voto no painel eletrônico. Há registro
  individual.

A votação nominal é obrigatória em alguns casos (PEC, PLP) e, fora deles, **precisa ser
requerida** — por um líder ou por um percentual da casa.

→ **Isto é a explicação institucional do achado #1**: das 15.037 votações de 2025, só
**526 (3,5%)** foram nominais. Não é falha da API. A casa simplesmente decide a maior
parte das coisas sem registrar quem votou o quê — o que, aliás, é em si um achado
defensável no TCC.

### 9.2 Os valores de voto que você vai encontrar

| Valor | Significado |
|---|---|
| `Sim` / `Não` | Voto de mérito |
| `Abstenção` | Presente, opta por não tomar posição |
| **`Obstrução`** | **Manobra regimental** — ver abaixo |
| `Artigo 17` | Voto do Presidente da sessão, que só vota em hipóteses específicas |
| *(vazio)* | 421 casos em 2025, não documentado. Tratar como `null` |

**Obstrução** merece explicação: é uma tática da minoria. O líder declara obstrução e a
bancada **não vota, mas está presente** — a intenção é derrubar o quórum e travar a
sessão. Politicamente é "sou contra e quero impedir", mas tecnicamente **não é um voto
contrário ao mérito**. Foi por isso que o discovery hesitou em como codificá-la — e a
medição resolveu: são só 375 casos em 167 mil (0,2%), então mandar para `null` não muda
nada.

### 9.3 Destaque (DVS) — a origem do problema de polaridade

Um **destaque** separa um trecho do projeto para ser votado à parte. Tipicamente, a
oposição destaca um artigo que quer derrubar.

O resultado é registrado como **"Mantido o texto"** ou **"Suprimido o texto"**. Ou seja:
votar **`Sim` significa manter o dispositivo**, o que na prática é **rejeitar** o destaque.

→ **Este é o achado #12 do discovery**, e agora com a explicação institucional: em 74 das
526 votações nominais de 2025 (14%), o sentido político de "Sim" está invertido em relação
à intenção de quem provocou a votação. Por isso cada votação usada no questionário precisa
de um campo `polaridade` atribuído à mão.

### 9.4 Quóruns — tabela de referência

| Situação | Quórum na Câmara |
|---|---|
| Abrir sessão deliberativa | maioria absoluta presente (257) |
| Aprovar PL ordinário | maioria simples dos presentes |
| Aprovar PLP | **257** (maioria absoluta) |
| Aprovar PEC | **308** (3/5), em **dois turnos** |
| Autorizar processo contra o Presidente da República | **342** (2/3) |
| Abrir CPI | **171 assinaturas** (1/3) |
| Derrubar veto presidencial | maioria absoluta — em sessão conjunta, contada por casa |

⚠️ PEC exige **dois turnos** na mesma casa. Você vai ver a **mesma PEC votada duas
vezes**, com resultados quase idênticos. Isso **infla artificialmente a similaridade**
entre parlamentares se você tratar os dois turnos como votações independentes.
→ *Recomendação:* detectar turnos duplicados (mesma proposição, descrição com "primeiro/
segundo turno") e considerar deduplicar, ou ao menos reportar o efeito.

---

## 10. Glossário rápido

| Termo | Significado |
|---|---|
| **Ementa** | Resumo oficial do que a proposição faz. É o campo que serve para o questionário |
| **Relator** | Deputado designado para dar parecer. Cargo de enorme poder: o relator reescreve o texto |
| **Parecer** | Opinião formal da comissão, redigida pelo relator |
| **Substitutivo** | Texto alternativo **inteiro** proposto pelo relator. Quando aprovado, substitui o projeto original |
| **Emenda** | Alteração pontual |
| **Subemenda** | Emenda a uma emenda |
| **Redação final** | Ajuste de forma após aprovação do mérito. Quase sempre unânime → **inútil para o questionário** |
| **Pauta** | Lista do que será votado |
| **Sanção** | Presidente aprova o projeto |
| **Veto** | Presidente rejeita — total ou parcial. Volta ao Congresso |
| **Promulgação** | Ato que dá existência formal à lei |
| **Suplente** | Próximo da lista partidária; assume se o titular licencia, morre ou vira ministro |
| **Licença** | Afastamento temporário (para assumir cargo no Executivo, por saúde etc.) |
| **Legenda (voto de)** | Voto no partido, sem escolher candidato |
| **Quórum** | Número mínimo para deliberar |

---

## 11. Resumo: como a instituição explica cada estranheza do dado

| Estranheza no dado | Causa institucional | Seção |
|---|---|---|
| Só 3,5% das votações são nominais | Votação simbólica é o padrão | 9.1 |
| 58% das nominais são requerimentos | Requerimento de urgência é o instrumento central | 8 |
| "Sim" às vezes significa rejeitar | Destaque: "Mantido o texto" | 9.3 |
| Existe voto `"Obstrução"` | Tática regimental da minoria | 9.2 |
| Existe voto `"Artigo 17"` | Presidente da sessão só vota em hipóteses específicas | 4.1 |
| 552 deputados em 513 cadeiras | Suplentes, licenças, ministérios | 12 (glossário) |
| Deputado troca de sigla no meio do ano | Janela partidária + fusões por cláusula de desempenho | 4.4 |
| Nomes de bloco truncados e ilegíveis | Blocos e federações são entidades distintas de partido | 4.3 |
| CCJC domina as votações de comissão | Faz o controle de constitucionalidade de tudo | 5.1 |
| Deputado pertence a dezenas de frentes | Frente exige 171 assinaturas; assina-se por cortesia | 4.6 |
| Mesma PEC votada duas vezes | Exigência de dois turnos | 9.4 |
| Votações somem em julho e janeiro | Recesso constitucional | 3 |
| `uriProposicaoCitada` aponta para um "PPP" | PPP é registro de leitura de parecer, não matéria | 6 |
