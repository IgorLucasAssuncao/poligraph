# API de Dados Abertos do Senado Federal — referência

> **Status:** v1.2 — payloads capturados ao vivo em **2026-08-22**.
> **v1.1:** corrige a estrutura do `/votacao` (é **aninhada**, não plana — a v1.0 estava
> errada); achado #17 — **56% das votações do Senado são secretas**; pendências P1 e P3
> resolvidas; endpoints por parlamentar (relatoria, lideranças) documentados.
> **v1.2:** §2.5 — a matriz do Senado É viável apesar da escassez: 88% dos pares têm
> ≥20 votações em comum (média 33). O custo é precisão (IC ±17pp), não viabilidade.
> Ver também: [02-senado-federal.md](02-senado-federal.md),
> [13-correlacao-entre-fontes.md](13-correlacao-entre-fontes.md).

---

## 1. Informações gerais

| Item | Valor |
|---|---|
| Base | `https://legis.senado.leg.br/dadosabertos` |
| Docs | `https://legis.senado.leg.br/dadosabertos/docs/` |
| Autenticação | **Nenhuma** |
| Formato nativo | **XML**. JSON é uma conversão — daí os envelopes estranhos |
| Header | `accept: application/json` |

### 1.1 ⚠️ A característica que mais atrapalha: envelopes de XML

O Senado publica XML e converte para JSON mecanicamente. O resultado são **envelopes
aninhados sem valor semântico**:

```json
{"ListaParlamentarEmExercicio":{
   "noNamespaceSchemaLocation":"…/ListaParlamentarEmExerciciov4.xsd",
   "Metadados":{"Versao":"…","VersaoServico":"4","DescricaoDataSet":"…"},
   "Parlamentares":{
      "Parlamentar":[
         {"IdentificacaoParlamentar":{ … }}
      ]}}}
```

Para chegar em um senador: `ListaParlamentarEmExercicio → Parlamentares → Parlamentar[] →
IdentificacaoParlamentar`. Quatro níveis de invólucro.

**Convenções que decorrem disso:**

- Campos em **PascalCase** (`CodigoParlamentar`), diferente da Câmara (camelCase).
- **Tudo é string**, inclusive números: `"CodigoParlamentar":"5672"`. Converta na borda.
- Uma lista com **um único elemento pode vir como objeto**, não como array — patologia
  clássica de conversão XML→JSON. **Sempre normalize para array antes de iterar**, ou o
  parser quebra em dias de pouca atividade.
- Todo payload traz um bloco `Metadados` com `Versao`, `VersaoServico` e — importante —
  **`Descontinuacao`** quando o serviço está depreciado. **Logue esse bloco**: é o aviso
  antecipado de quebra.

### 1.2 ⚠️ Endpoint depreciado

| Endpoint | Situação |
|---|---|
| `/plenario/lista/votacao/{AAAAMMDD}` | ⛔ **Depreciado.** `DataDepreciacao: 2025-03-18`, desativação completa anunciada para **2026-02-01** |
| `/votacao` | ✅ **O substituto.** Use este |

O payload do endpoint velho literalmente informa o substituto:

```json
"Descontinuacao":{
  "DataDepreciacao":"2025-03-18",
  "DataDesativacaoCompleta":"2026-02-01",
  "UrlServicoSubstituto":"https://legis.senado.leg.br/dadosabertos/votacao"}
```

⚠️ A maior parte dos tutoriais, notebooks e TCCs anteriores na internet usa o endpoint
antigo. **Não copie código de exemplo sem verificar isso.**

---

## 2. `GET /votacao` — ⭐ o endpoint principal

Traz o ano inteiro em **uma chamada** — ingestão barata. ⚠️ Mas leia o achado #17 (§2.3)
antes de dimensionar o que dá para fazer com esse dado: **mais da metade é inaproveitável**.

**Entrada**

| Param | Formato | Nota |
|---|---|---|
| `dataInicio` | `YYYY-MM-DD` ou `YYYYMMDD` | Ambos funcionam |
| `dataFim` | idem | |
| `siglaCasa` | `SF` | Aceito, mas redundante |

```
GET /dadosabertos/votacao?dataInicio=2025-01-01&dataFim=2025-12-31
```

**Custo medido:** ano de 2025 inteiro = **2,4 MB**, uma requisição, 128 votações, 84
senadores, ~10.400 registros de voto.

⚠️ `?data=YYYYMMDD` também retorna 200, mas devolveu **dados de outra data** no teste
(pedimos 2025-04-29 e veio uma sessão de 2025-09-02). **Use `dataInicio`/`dataFim`.**

⚠️ **CORREÇÃO da v1.0 deste documento.** A versão anterior afirmava que o retorno era um
*"array plano, uma linha por parlamentar por votação"*. **Está errado.** O retorno é um
array de **128 objetos de votação**, cada um com um array aninhado `votos[]`. Contagem no
arquivo de 2025: 128 `codigoSessaoVotacao`, 128 `votos`, **10.368** `siglaVotoParlamentar`.

**Estrutura real:**

```json
[{
  "codigoSessaoVotacao": 6918,
  "descricaoVotacao": "Votação nominal da Emenda nº 1 (Substitutivo) ao PLP nº 22/2025…",
  "ementa": "Dispõe sobre prazo para liquidação de restos a pagar…",
  "identificacao": "PLP 22/2025",
  "votacaoSecreta": "N",                    ← ⭐ campo decisivo, ver §2.3
  "totalVotosSim": null, "totalVotosNao": null, "totalVotosAbstencao": null,
  "votos": [
    { "codigoParlamentar": 5672, "nomeParlamentar": "Alan Rick",
      "siglaPartidoParlamentar": "UNIÃO", "siglaUFParlamentar": "AC",
      "siglaVotoParlamentar": "Sim", "descricaoVotoParlamentar": null }
  ]
}]
```

**Campos de votação** (nível externo):

```json
[{
  "ano":2025,
  "casaSessao":"SF",
  "codigoMateria":167182,
  "codigoSessao":450520,
  "codigoSessaoLegislativa":873,
  "codigoSessaoVotacao":6918,
  "dataApresentacao":"2025-02-11",
  "dataSessao":"2025-02-19",
  "descricaoVotacao":"Votação nominal da Emenda nº 1 (Substitutivo) ao Projeto de Lei
                      Complementar nº 22, de 2025, nos termos do parecer.",
  "ementa":"Dispõe sobre prazo para liquidação de restos a pagar não processados e dá
            outras providências.",
  "identificacao":"PLP 22/2025",
  "idProcesso":8793330,
  "codigoParlamentar":…,
  "nomeParlamentar":"…",
  "siglaVotoParlamentar":"…",
  "siglaPartidoParlamentar":"…",
  "siglaUFParlamentar":"…",
  "sexoParlamentar":"…",
  "resultadoVotacao":"…",
  "informeLegislativo":{
     "casaColegiado":"SF","codigoColegiado":1998,"data":"2025-02-19",
     "nomeColegiado":"Plenário do Senado Federal","siglaColegiado":"PLEN",
     "nomeEnteAdm":"Secretaria de Atas e Diários","siglaEnteAdm":"SEADI",
     "texto":"(Sessão Deliberativa Ordinária – realizada em 19/02/2025)\r\n
              Encaminhado à publicação – e aprovado – o Requerimento nº 104, de 2025,
              por meio do qual se solicita urgência para a matéria. […]
              Aprovado a Emenda nº 1 (substitutivo), em votação nominal, após o
              seguinte resultado: sim – 65; não – 1, Presidente – 1; abstenç…"}
}]
```

### 2.3 🔴 Achado crítico #17 — 56% das votações do Senado são SECRETAS

**Este é o achado mais grave sobre o Senado.** Medido nas 128 votações nominais de 2025:

| `votacaoSecreta` | Votações | Registros `Sim`/`Não` | Registros `"Votou"` |
|---|---|---|---|
| **`"S"` (secreta)** | **72 (56 %)** | **0** | 3.774 |
| `"N"` (aberta) | 56 (44 %) | 3.572 | 0 |

Em votação secreta, `siglaVotoParlamentar` registra literalmente **`"Votou"`** — informa
que o senador votou, **não como votou**. É informação de presença, não de posição.

**Consequência direta:** o Senado não tem 128 votações aproveitáveis por ano. Tem **56**.

| | Votações utilizáveis / ano |
|---|---|
| Câmara (plenário) | **410** |
| Senado (abertas) | **56** |

Sete vezes menos. Isso **não invalida** a análise do Senado — 56 votações sobre 81
senadores ainda formam uma matriz —, mas a torna **bem mais frágil** do que este documento
sugeria, e o corte mínimo de 20 votações em comum passa a ser restritivo de verdade.

⚠️ **Por que tantas secretas:** o Senado aprova autoridades por escrutínio secreto
(sabatinas de ministros do STF, diretores do Banco Central, embaixadores — art. 52 da CF).
Como essa é uma competência privativa e frequente, as sabatinas dominam as votações
nominais da casa. Ver [02-senado-federal.md §3](02-senado-federal.md).

→ **Regra de ETL:** filtrar `votacaoSecreta == "S"` **antes** de montar a matriz. E tratar
`"Votou"` como `null` de posição — nunca como voto.

### 2.4 ✅ Pendência P1 resolvida — domínio de `siglaVotoParlamentar`

Medido nos 10.368 registros de 2025. **Muito mais sujo que o da Câmara:**

| Valor | Ocorrências | Significado | Entra no cálculo? |
|---|---|---|---|
| `Votou` | 3.774 | Votação **secreta** — posição não revelada | ⛔ Não |
| `Sim` | 3.023 | Voto favorável | ✅ |
| `P-NRV` | 1.544 | Presente, não registrou voto | ⛔ |
| `AP` | 761 | Ausência justificada / atividade parlamentar | ⛔ |
| `Não` | 549 | Voto contrário | ✅ |
| `MIS` | 251 | Em missão oficial | ⛔ |
| `LS` | 251 | Licença saúde | ⛔ |
| `LP` | 89 | Licença particular | ⛔ |
| `Presidente (art. 51 RISF)` | 59 | Presidente da sessão | ⛔ |
| `NCom` | 37 | Não compareceu | ⛔ |
| `NA` | 15 | Não aplicável | ⛔ |
| `Abstenção` | 15 | Absteve-se | 🟡 peso menor |

⚠️ **Só 3.572 de 10.368 registros (34%) são posição de voto utilizável.** O restante é
presença, ausência ou sigilo.

⚠️ Contraste com a Câmara, onde `Sim`+`Não` são **99,3%** dos registros. **As duas casas
exigem normalizações completamente diferentes** — não reaproveite o mapeamento.

### 2.5 ✅ "Ainda dá para usar?" — sim. Medido.

O achado #17 é ruim, mas **escassez não é inviabilidade**. A pergunta certa não é *"o
Senado tem menos dado que a Câmara?"* (tem), e sim *"o que sobra sustenta a análise?"*.

Matriz construída com as **56 votações abertas** de 2025:

| | Valor |
|---|---|
| Votações abertas | 56 |
| Senadores distintos | 83 |
| Registros `Sim`/`Não` | 3.572 |
| Senadores votando por votação | mediana **64** de 81 |

**Sobreposição entre pares** — o número que de fato decide (3.403 pares):

| Métrica | Valor |
|---|---|
| Sobreposição média | **33 votações** |
| Mínimo / máximo | 3 / 54 |
| Pares com **≥ 20** em comum (corte da RN-02) | **2.980 — 88 %** |
| Pares com ≥ 30 | 2.296 — 67 % |
| Pares com ≥ 40 | 1.100 — 32 % |

→ **88% dos pares sobrevivem ao corte**, com média de 33 votações em comum. A matriz do
Senado é **utilizável**.

#### O que muda: a precisão, não a viabilidade

O custo da escassez é **estatístico**, e é quantificável. Erro-padrão de uma proporção de
concordância, no pior caso (p = 0,5):

| Casa | n típico por par | Erro-padrão | IC 95% aprox. |
|---|---|---|---|
| Câmara | 329 | ± 2,8 pp | **± 5,5 pp** |
| **Senado** | **33** | **± 8,7 pp** | **± 17 pp** |

**Tradução prática:**

| Afirmação | Câmara | Senado |
|---|---|---|
| "A concorda mais com B do que com C" (diferença grande, >20 pp) | ✅ | ✅ |
| "A e B concordam em ~70%" | ✅ | 🟡 com IC declarado |
| "A está 3 pp mais próximo de B que de C" | 🟡 | ⛔ **Não afirmar** |

- **Detecção de comunidades:** ✅ funciona. Louvain usa ordenação relativa de pesos, e o
  sinal forte (blocos de governo e oposição) sobrevive a ±17 pp.
- **Projeção em 2 eixos (SVD):** ✅ funciona. Uma matriz 83 × 56 com 3.572 observações para
  estimar ~278 parâmetros é uma razão confortável. Análises de *roll-call* na literatura
  rodam em câmaras deste porte rotineiramente.
- **Gradações finas entre parlamentares:** ⛔ não sustentadas.

#### Regra: declarar a precisão em vez de esconder a escassez

**Trabalhar com dado incompleto e declarar o limite é método, não concessão.** Nenhuma
fonte real entrega tudo — a diferença entre um trabalho sério e um frágil não é ter o dado
completo, é saber e dizer o que o dado suporta.

→ **Requisito derivado:** onde a similaridade do Senado for exibida ou usada em conclusão,
acompanhar do **n** e do intervalo de confiança. Combina com o RF-29 já definido
("concordaram em X de Y"), que expõe o denominador por construção.

⚠️ **O que continua não sendo contornável** não é a escassez, e sim a **ausência de
orientação de bancada** (§4.2). Isso não é questão de precisão — é uma variável que
simplesmente não existe no Senado. Disciplina partidária e governismo permanecem
calculáveis só na Câmara.

### 2.1 Ingestão fácil, dado escasso

| Aspecto | Câmara | Senado |
|---|---|---|
| Chamadas para um ano | 1 CSV de 58 MB (ou N+1 na API) | ✅ **1 requisição de 2,4 MB** |
| Ementa da matéria | Exige join com `proposicoes` | ✅ **Já vem em `ementa`** |
| Identificação legível | Exige montar | ✅ **`identificacao: "PLP 22/2025"`** |
| Contexto da sessão | Ausente | ✅ `informeLegislativo.texto` |
| **Votações utilizáveis/ano** | **410** | 🔴 **56** (achado #17) |
| **Registros que são posição de voto** | **99,3 %** | 🔴 **34 %** (§2.4) |

→ **Duas conclusões que puxam em direções opostas, e as duas valem:**

1. **Ingerir o Senado é barato** — uma chamada, ementa inclusa. É o argumento que derrubou
   a justificativa original da decisão D3 ("o Senado dobra o esforço de ETL").
2. **Mas o que sobra depois de filtrar é pouco.** 56 votações contra 410 da Câmara. A
   facilidade de ingestão não se traduz em riqueza analítica.

### 2.2 Campos-chave

| Campo | Uso |
|---|---|
| `codigoParlamentar` | 🔑 Identificador do senador |
| `siglaVotoParlamentar` | O voto. **Domínio a mapear** — ver pendência P2 |
| `codigoSessaoVotacao` | 🔑 Identificador da votação (128 distintos em 2025) |
| `codigoMateria` | 🔑 Liga à matéria |
| `identificacao` | `"PLP 22/2025"` — legível |
| `ementa` | Texto para o questionário |
| `casaSessao` | `SF` em 100% dos casos de 2025 — ver achado #7 |
| `siglaPartidoParlamentar` | 🔑 Partido **no momento do voto** — desnormalizar no `voto` |

---

## 3. `GET /senador/lista/atual`

```json
{"ListaParlamentarEmExercicio":{
  "Metadados":{…},
  "Parlamentares":{"Parlamentar":[
    {"IdentificacaoParlamentar":{
       "CodigoParlamentar":"5672",
       "CodigoPublicoNaLegAtual":"800",
       "NomeParlamentar":"Alan Rick",
       "NomeCompletoParlamentar":"Alan Rick Miranda",
       "SexoParlamentar":"Masculino",
       "FormaTratamento":"Senador ",
       "UrlFotoParlamentar":"http://www.senado.leg.br/senadores/img/fotos-oficiais/senador5672.jpg",
       "UrlPaginaParlamentar":"http://www25.senado.leg.br/web/senadores/senador/-/perfil/5672"}}
  ]}}}
```

⚠️ **`CodigoParlamentar` ≠ `CodigoPublicoNaLegAtual`.** São dois identificadores
diferentes no mesmo objeto (5672 e 800). O que aparece no `/votacao` é o
**`CodigoParlamentar`**. Escolher o errado quebra o join silenciosamente.

⚠️ `FormaTratamento` vem com **espaço à direita** (`"Senador "`). Sintoma de que os campos
não são higienizados — faça `trim()` em tudo.

---

## 4. `GET /senador/{codigo}` — detalhe

Campos observados (id 5672):

```
IdentificacaoParlamentar: CodigoParlamentar, CodigoPublicoNaLegAtual, NomeParlamentar,
    NomeCompletoParlamentar, SexoParlamentar, SiglaPartidoParlamentar, UfParlamentar,
    UrlFotoParlamentar, UrlPaginaParlamentar, EmailParlamentar
DadosBasicosParlamentar: DataNascimento, Naturalidade, UfNaturalidade
Telefones, EnderecoParlamentar, OutrasInformacoes
```

⛔ **Não há CPF.** Confirmado pela varredura completa das chaves do payload.

🔑 **Chaves disponíveis para conciliação com o TSE:**
`NomeCompletoParlamentar` + `DataNascimento` + `UfParlamentar` (+ `Naturalidade`).

→ É por isso que a integração Senado ↔ TSE é *fuzzy*. Com 81 pessoas, a conciliação
manual é viável e defensável como método.

---

## 4.1 ⭐ Insumos por parlamentar — o Senado é melhor que a Câmara aqui

Endpoints por senador que **não têm equivalente direto na Câmara**. Todos retornaram 200:

| Endpoint | Tamanho (senador 5672) | Conteúdo |
|---|---|---|
| `/senador/{id}/relatorias` | 61 KB | ⚠️ Depreciado → usar `/processo/relatoria` |
| `/senador/{id}/autorias` | 155 KB | Matérias de autoria |
| `/senador/{id}/comissoes` | 20 KB | Participação com `DescricaoParticipacao` |
| `/senador/{id}/votacoes` | **905 KB** | Histórico completo de votos |
| `/senador/{id}/liderancas` | 1,5 KB | ⭐ Cargos de liderança |

### 4.1.1 ⭐ Relatoria — estruturada, e melhor que a da Câmara

`GET /processo/relatoria?codigoParlamentar={id}` — array **plano**:

```json
[{ "id":9285682, "idProcesso":8257786,
   "codigoParlamentar":5672, "nomeParlamentar":"Alan Rick",
   "identificacaoProcesso":"SUG 5/2022",
   "ementaProcesso":"Torna obrigatória a reposição inflacionária anual do salário…",
   "codigoColegiado":834,
   "nomeColegiado":"Comissão de Direitos Humanos e Legislação Participativa",
   "descricaoTipoRelator":"Relator", "idTipoRelator":1,
   "dataDesignacao":"2023-03-14 12:08:16",
   "dataDestituicao":"2023-03-15 14:38:24",
   "descricaoTipoEncerramento":"Alteração na composição da comissão" }]
```

**Vantagem sobre a Câmara:** lá a relatoria só existe como **texto livre** no campo
`despacho` (`"Designado Relator, Dep. Fulano (PT-SP)"`), exigindo regex e casamento por
nome. Aqui vem **estruturada**, com `codigoParlamentar`, colegiado, ementa e **datas de
designação e destituição**.

📊 Volume: **83 relatorias** para um único senador, contra mediana de **7** por deputado.
Faz sentido — 81 senadores absorvem um fluxo de matérias comparável ao de 513 deputados.

⚠️ `/senador/{id}/relatorias` traz bloco `Descontinuacao` (depreciado em 2025-03-18,
desativação anunciada para 2026-02-01). **Usar `/processo/relatoria`.**

### 4.1.2 ⭐ Lideranças — sem equivalente na Câmara

```json
{"Liderancas":{"Lideranca":[
  { "UnidadeLideranca":"Liderança de Partido na CMO",
    "Partido":{"CodigoPartido":"521","SiglaPartido":"REPUBLICANOS"},
    "SiglaCasaLideranca":"CN",
    "DescricaoTipoLideranca":"Líder do Congresso Nacional" },
  { "UnidadeLideranca":"Liderança de Partido no Senado Federal",
    "SiglaCasaLideranca":"SF", … }]}}
```

Dá **poder formal por parlamentar** de graça: quem é líder, de que partido, em qual casa
(`SF` ou `CN`). Excelente atributo de nó — e o líder é justamente quem orienta a bancada.

### 4.1.3 Participação em comissões

`/senador/{id}/comissoes` traz `DescricaoParticipacao` (`Titular` | `Suplente`) e sigla do
colegiado. Para o senador testado: 35 registros como Titular, 47 como Suplente, em CCJ,
CAS, CDR, CE, CRA, CAE, CI e CMO.

⚠️ São **registros de participação ao longo do tempo**, não comissões distintas — a mesma
comissão aparece várias vezes conforme a composição muda. Deduplicar por colegiado.

### 4.2 ⛔ Pendência P3 resolvida (negativamente) — não há orientação de bancada

Testados e todos **HTTP 404**: `/orientacao`, `/votacao/orientacao`,
`/processo/orientacao`. O payload de `/votacao` também não traz nenhum campo de
orientação.

→ **Conclusão: o Senado não expõe orientação de bancada.** O equivalente da Câmara
(`/votacoes/{id}/orientacoes`, que entrega os rótulos `Governo`/`Oposição`/`Maioria`/
`Minoria` prontos) **não existe aqui**.

**Consequência:** a comparação entre casas **não é simétrica**. Disciplina partidária e
governismo são calculáveis diretamente na Câmara e **não** no Senado.

*Mitigação parcial:* `/senador/{id}/liderancas` identifica os líderes, e a posição de
governo pode ser inferida a partir do voto do líder de cada bancada — mas isso é
**inferência do pesquisador**, não rótulo oficial, e precisa ser declarado como tal.

## 5. `GET /comissao/lista/permanente`

```json
{"ListaBasicaComissoes":{"Metadados":{…},"colegiado":{"colegiados":[{"colegiado":[
  {"id":"38","ordem":"1","CodigoColegiado":"38",
   "NomeColegiado":"Comissão de Assuntos Econômicos","SiglaColegiado":"CAE",
   "IndicadorDistrPartidaria":"S","DataInicio":"1900-01-01",
   "CodigoTipoColegiado":"21",
   "tipocolegiado":{"DescricaoTipoColegiado":"Comissão Permanente",
                    "SiglaTipoColegiado":"PERMANENTE","SiglaCasa":"SF",
                    "IndicadorAtivo":"S"}}
]}]}}}
```

Retorna as **16 comissões permanentes** (lista em [02-senado-federal.md](02-senado-federal.md)).

⚠️ Note o aninhamento absurdo: `colegiado → colegiados[] → colegiado[]`. Não é erro de
transcrição.

⚠️ `/comissao/lista/tipos` e `/comissao/lista/mista` retornaram **`Metadados` sem
conteúdo** — 200 com corpo vazio de dados. Trate corpo vazio como caso normal.

⚠️ `DataInicio: "1900-01-01"` é valor sentinela para "sempre existiu". Não é data real.

---

## 6. Correlação com as outras bases

| Alvo | Chave | Força |
|---|---|---|
| **→ TSE** | `NomeCompletoParlamentar` + `DataNascimento` + UF | ⚠️ **Fuzzy** — sem CPF |
| **→ Câmara** | Nenhuma chave comum; e **as casas não votam as mesmas matérias** (achado #7) | ⛔ Não fazer |
| **Interno: voto → votação** | `codigoSessaoVotacao` | ✅ |
| **Interno: votação → matéria** | `codigoMateria` / `identificacao` | ✅ |

Detalhes em [13-correlacao-entre-fontes.md](13-correlacao-entre-fontes.md).

---

## 7. Armadilhas — checklist

| # | Armadilha | Efeito |
|---|---|---|
| 1 | Envelope XML de 4 níveis | Desserialização falha ou vem `null` |
| 2 | Lista de 1 elemento vem como objeto | Crash em dias de pouca atividade |
| 3 | Tudo é string, inclusive números | Comparação numérica errada |
| 4 | `/plenario/lista/votacao` depreciado | Quebra sem aviso após desativação |
| 5 | `?data=` retorna data errada | Dados silenciosamente incorretos |
| 6 | `CodigoParlamentar` ≠ `CodigoPublicoNaLegAtual` | Join vazio |
| 7 | Sem CPF | Integração TSE só por fuzzy |
| 8 | Strings com espaço à direita | Chave de agrupamento duplicada |
| 9 | `DataInicio: 1900-01-01` sentinela | Estatística temporal distorcida |
| 10 | Corpo 200 sem dados | Confundido com erro |

---

## 8. Pendências

| # | Pendência | Impacto |
|---|---|---|
| ~~SE1~~ | ✅ **RESOLVIDA** — domínio medido, ver §2.4. Só 34% dos registros são posição de voto | — |
| **SE2** | Confirmar se `/votacao` cobre **votações de comissão** ou só plenário | Volume disponível |
| ~~SE3~~ | ✅ **RESOLVIDA (negativamente)** — não existe, ver §4.2. A comparação entre casas fica assimétrica | — |
| ~~SE4~~ | ✅ **RESOLVIDA — 2026-08-23.** Janela de um ano inteiro funciona (2,4 MB); nao ha limite pratico | Estratégia de particionamento |
| ~~SE5~~ | ✅ **RESOLVIDA — 2026-08-23.** Desnecessario — 2,4 MB por ano ja e trivial | Provavelmente desnecessário — 2,4 MB/ano já é trivial |
| ~~SE6~~ | ✅ **RESOLVIDA — 2026-08-23.** Cobre 2019 a 2026; legislatura 57 tem 182 votacoes abertas | Tamanho da matriz do Senado |
