# API de Dados Abertos do Senado Federal — referência

> **Status:** v1.0 — payloads capturados ao vivo em **2026-08-22**.
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

O melhor endpoint das três fontes do projeto: traz o ano inteiro em uma chamada, já
achatado.

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

**Retorno** — array plano, **uma linha por parlamentar por votação**, sem envelope:

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

### 2.1 Por que este formato é melhor que o da Câmara

| Aspecto | Câmara | Senado |
|---|---|---|
| Chamadas para um ano | 1 CSV de 58 MB (ou N+1 na API) | **1 requisição de 2,4 MB** |
| Ementa da matéria | Exige join com `proposicoes` | ✅ **Já vem em `ementa`** |
| Identificação legível | Exige montar | ✅ **`identificacao: "PLP 22/2025"`** |
| Contexto da sessão | Ausente | ✅ `informeLegislativo.texto` |

→ **Consequência prática:** o extrator do Senado é significativamente mais simples que o
da Câmara. É o argumento que derrubou a justificativa original da decisão D3.

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
| **P1** | Mapear o **domínio completo de `siglaVotoParlamentar`** (equivalente ao `tipoVoto` da Câmara). Ainda não medido | Normalização do voto no Senado |
| **P2** | Confirmar se `/votacao` cobre **votações de comissão** ou só plenário | Volume disponível |
| **P3** | Verificar se existe endpoint de **orientação de bancada** no Senado (equivalente ao `/orientacoes` da Câmara) | Sem ele, não há rótulo governo/oposição no Senado |
| **P4** | Descobrir a **janela máxima** aceita por `dataInicio`/`dataFim` | Estratégia de particionamento |
| **P5** | Verificar se há **arquivos consolidados** por ano, como na Câmara | Provavelmente desnecessário — 2,4 MB/ano já é trivial |
| **P6** | Confirmar cobertura histórica: `/votacao` funciona para 2023 e 2024? | Tamanho da matriz do Senado |
