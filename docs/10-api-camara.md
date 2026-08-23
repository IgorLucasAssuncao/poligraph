# API de Dados Abertos da Câmara dos Deputados — referência

> **Status:** v1.0 — todos os payloads deste documento foram **capturados ao vivo em
> 2026-08-22**, não copiados da documentação oficial. Onde o payload foi abreviado, está
> marcado com `…`.
> Ver também: [01-camara-dos-deputados.md](01-camara-dos-deputados.md) (o que os campos
> significam), [13-correlacao-entre-fontes.md](13-correlacao-entre-fontes.md).

---

## 1. Informações gerais

| Item | Valor |
|---|---|
| Base REST | `https://dadosabertos.camara.leg.br/api/v2` |
| Base arquivos | `https://dadosabertos.camara.leg.br/arquivos` |
| Swagger | `https://dadosabertos.camara.leg.br/swagger/api.html` |
| Autenticação | **Nenhuma** |
| Formato | JSON (padrão), XML e CSV via `Accept` |
| HTTPS | Obrigatório |
| Rate limit | Não documentado. Observado: sem bloqueio em uso moderado sequencial |

**Header recomendado:** `accept: application/json`

### 1.1 Envelope padrão

Toda resposta REST vem no mesmo formato:

```json
{
  "dados": [ ... ] ou { ... },
  "links": [
    { "rel": "self",  "href": "..." },
    { "rel": "next",  "href": "..." },
    { "rel": "first", "href": "..." },
    { "rel": "last",  "href": "..." }
  ]
}
```

### 1.2 Paginação

| Parâmetro | Efeito |
|---|---|
| `pagina` | Página (1-based) |
| `itens` | Itens por página |
| `ordem` | `ASC` \| `DESC` |
| `ordenarPor` | Campo de ordenação |

**Estratégia de paginação:** seguir `links[rel="next"]` até ele não existir mais. O
`links[rel="last"]` dá o total de páginas de imediato — útil para barra de progresso.

⚠️ **`itens` não funciona em todos os endpoints.** Ver seção 3.5.

### 1.3 Erros

```json
{
  "status": 400,
  "title": "Requisição inválida",
  "detail": "Parâmetro(s) inválido(s).",
  "instance": "itens",
  "code": 5
}
```

`instance` nomeia o parâmetro ofensor — útil para log.

---

## 2. ⭐ Os arquivos CSV consolidados (use isto para carga histórica)

**Esta é a via principal do ETL.** Evita o padrão N+1 de chamar a API votação por votação.

```
https://dadosabertos.camara.leg.br/arquivos/{dataset}/csv/{dataset}-{ano}.csv
```

Alguns datasets não são particionados por ano (ex.: `deputados`, `frentes`) e usam
`{dataset}.csv`.

**Formato:** separador `;`, campos entre `"`, **BOM UTF-8 no início** (o primeiro header
vem como `﻿"idVotacao"` — remova o BOM ou o nome da primeira coluna virá errado).

### 2.1 Catálogo verificado

| Dataset | Tamanho (2025) | Cardinalidade |
|---|---|---|
| `votacoes` | 8,7 MB | 15.037 votações |
| `votacoesVotos` | **58 MB** | 167 mil votos, 526 votações nominais |
| `votacoesObjetos` | 45 MB | N linhas por votação |
| `votacoesOrientacoes` | — | Orientação por bancada |
| `proposicoes` | — | Proposições apresentadas no ano |
| `proposicoesAutores` | — | Autoria (aresta do grafo) |
| `proposicoesTemas` | — | Classificação temática |
| `deputados` | — | Cadastro completo, **com CPF** |
| `frentes` | — | Frentes parlamentares |

### 2.2 Layouts (headers reais)

**`votacoesVotos-{ano}.csv`** — a tabela `voto` do modelo:

```
idVotacao;uriVotacao;dataHoraVoto;voto;deputado_id;deputado_uri;deputado_nome;
deputado_siglaPartido;deputado_uriPartido;deputado_siglaUf;deputado_idLegislatura;
deputado_urlFoto
```

**`votacoes-{ano}.csv`** — a tabela `votacao`:

```
id;uri;data;dataHoraRegistro;idOrgao;uriOrgao;siglaOrgao;idEvento;uriEvento;aprovacao;
votosSim;votosNao;votosOutros;descricao;ultimaAberturaVotacao_dataHoraRegistro;
ultimaAberturaVotacao_descricao;ultimaApresentacaoProposicao_dataHoraRegistro;
ultimaApresentacaoProposicao_descricao;ultimaApresentacaoProposicao_idProposicao;
ultimaApresentacaoProposicao_uriProposicao
```

⚠️ **`descricao` contém `;`** (ex.: `"Mantido o texto. Sim: 266; Não: 118; Total: 384."`).
Use um parser CSV de verdade (`CsvHelper` no .NET, `csv`/`pandas` no Python). `split(';')`
vai quebrar.

**`votacoesOrientacoes-{ano}.csv`** — ⭐ rótulo governo/oposição:

```
idVotacao;uriVotacao;siglaOrgao;descricao;siglaBancada;uriBancada;orientacao
```

**`deputados.csv`** — ⭐ contém o CPF, chave de ligação com o TSE:

```
uri;nome;idLegislaturaInicial;idLegislaturaFinal;nomeCivil;cpf;siglaSexo;urlRedeSocial;
urlWebsite;dataNascimento;dataFalecimento;ufNascimento;municipioNascimento
```

⚠️ **Não há coluna `id`** — o id do deputado precisa ser extraído do final da `uri`.

**`proposicoes-{ano}.csv`** (parcial):

```
id;uri;siglaTipo;numero;ano;codTipo;descricaoTipo;ementa;ementaDetalhada;keywords;
dataApresentacao;uriOrgaoNumerador;uriPropAnterior;uriPropPrincipal;uriPropPosterior;
urlInteiroTeor;urnFinal;ultimoStatus_dataHora;ultimoStatus_sequencia;
ultimoStatus_uriRelator;ultimoStatus_idOrgao;ultimoStatus_siglaOrgao;…
```

**`proposicoesAutores-{ano}.csv`** — aresta de coautoria:

```
idProposicao;uriProposicao;idDeputadoAutor;uriAutor;codTipoAutor;tipoAutor;nomeAutor;
siglaPartidoAutor;uriPartidoAutor;siglaUFAutor;ordemAssinatura;proponente
```

**`proposicoesTemas-{ano}.csv`**:

```
uriProposicao;siglaTipo;numero;ano;codTema;tema;relevancia
```

**`frentes.csv`**:

```
id;uri;titulo;dataCriacao;idLegislatura;telefone;email;keywords;idSituacao;situacao;
urlWebsite;urlDocumento;coordenador_id;…
```

---

## 3. Endpoints REST

### 3.1 `GET /deputados` — lista

**Entrada**

| Param | Tipo | Nota |
|---|---|---|
| `id` | int[] | Múltiplos |
| `idLegislatura` | int[] | **Sempre use** — 57 é a atual |
| `siglaUf` | string[] | |
| `siglaPartido` | string[] | |
| `siglaSexo` | `M`\|`F` | |
| `ordenarPor` | string | ex.: `nome` |

**Retorno** (real, `?siglaUf=SP&itens=2`)

```json
{"dados":[
  {"id":221328,
   "uri":"https://dadosabertos.camara.leg.br/api/v2/deputados/221328",
   "nome":"Adilson Barroso",
   "siglaPartido":"PL",
   "uriPartido":"https://dadosabertos.camara.leg.br/api/v2/partidos/37906",
   "siglaUf":"SP",
   "idLegislatura":57,
   "urlFoto":"https://www.camara.leg.br/internet/deputado/bandep/221328.jpg",
   "email":"dep.adilsonbarroso@camara.leg.br"}
],"links":[…]}
```

### 3.2 `GET /deputados/{id}` — detalhe ⭐

Único lugar da API REST com **CPF**.

**Retorno** (real, id 204528)

```json
{"dados":{
  "id":204528,
  "nomeCivil":"ADRIANA MIGUEL VENTURA",
  "ultimoStatus":{
     "nome":"Adriana Ventura","siglaPartido":"NOVO","siglaUf":"SP",
     "idLegislatura":57,"data":"2023-02-01","nomeEleitoral":"Adriana Ventura",
     "gabinete":{"nome":"802","predio":"4","sala":"802","andar":"8",
                 "telefone":"3215-5802","email":"dep.adrianaventura@camara.leg.br"},
     "situacao":"Exercício","condicaoEleitoral":"Titular"},
  "cpf":"12519851813",
  "sexo":"F",
  "urlWebsite":null,
  "redeSocial":["https://twitter.com/adriventurasp",
                "https://www.facebook.com/adriventurasp",
                "https://www.instagram.com/adriventurasp",
                "https://youtube.com/adrianaventura"],
  "dataNascimento":"…"
}}
```

**Campos-chave**

| Campo | Uso |
|---|---|
| `cpf` | 🔑 **Join com o TSE** (11 dígitos, sem máscara, **com zeros à esquerda preservados** — trate como `string`) |
| `nomeCivil` | Fallback de conciliação |
| `ultimoStatus.situacao` | `Exercício`, `Licenciado`, `Vacância`… |
| `ultimoStatus.condicaoEleitoral` | `Titular` \| `Suplente` |
| `redeSocial[]` | Sementes para o crawler (F8) |

### 3.3 `GET /deputados/{id}/historico`

Histórico de mudanças de status — a versão oficial do "mandato com vigência".

```json
{"dados":[{
  "id":204528,"nome":"Adriana Ventura","nomeEleitoral":"ADRIANA VENTURA",
  "siglaPartido":"NOVO","siglaUf":"SP","idLegislatura":57,
  "dataHora":"2023-02-01T00:00","situacao":"…","condicaoEleitoral":"…"
}]}
```

Só necessário se alguma pergunta de pesquisa exigir recorte por período de exercício —
ver seção 6.1 do discovery.

### 3.4 `GET /votacoes` — lista

**Entrada**

| Param | Nota |
|---|---|
| `dataInicio` / `dataFim` | `YYYY-MM-DD`. **Janela máxima não documentada** — use trimestres |
| `idProposicao` | |
| `idOrgao` | 180 = PLEN |
| `ordenarPor` | ex.: `dataHoraRegistro` |

**Retorno** (real)

```json
{"dados":[{
  "id":"2442848-52",
  "uri":"…/votacoes/2442848-52",
  "data":"2025-03-27",
  "dataHoraRegistro":"2025-03-27T12:52:30",
  "siglaOrgao":"PLEN",
  "uriOrgao":"…/orgaos/180",
  "uriEvento":"…/eventos/75672",
  "proposicaoObjeto":null,
  "uriProposicaoObjeto":null,
  "descricao":"Aprovada a Redação Final assinada pelo relator, Dep. Ricardo Ayres (REPUBLIC-TO).",
  "aprovacao":1
}]}
```

⚠️ `proposicaoObjeto` vem **`null` com frequência** mesmo quando existe uma proposição
associada. Não dependa dele — ver 3.6.

### 3.5 `GET /votacoes/{id}/votos` — voto individual

⛔ **Não aceita `itens`, `pagina` nem `ordem`.** Qualquer um deles → HTTP 400. Retorna a
lista inteira de uma vez (350–400 registros).

**Retorno** (real, votação `2456731-84`)

```json
{"dados":[{
  "tipoVoto":"Sim",
  "dataRegistroVoto":"2025-04-29T21:27:59",
  "deputado_":{
     "id":223128,"uri":"…/deputados/223128","nome":"Rodrigo Estacho",
     "siglaPartido":"PSD","uriPartido":"…/partidos/36834","siglaUf":"PR",
     "idLegislatura":57,"urlFoto":"…","email":null}
}]}
```

⚠️ Note o nome do campo: **`deputado_`**, com underscore final. Não é erro de transcrição.

⚠️ **Votação simbólica devolve `{"dados": []}`** — não é erro. É a regra, não a exceção:
só 3,5% das votações são nominais.

**Domínio de `tipoVoto`** (medido em 167 mil registros de 2025):

| Valor | Ocorrências |
|---|---|
| `Sim` | 96.839 |
| `Não` | 68.923 |
| *(string vazia)* | 421 |
| `Artigo 17` | 401 |
| `Obstrução` | 375 |
| `Abstenção` | 336 |

### 3.6 `GET /votacoes/{id}` — detalhe ⭐ (como achar a matéria)

Três campos apontam para proposições e **não são equivalentes**:

| Campo | Conteúdo | Usar? |
|---|---|---|
| `proposicoesAfetadas` | A proposição real | ✅ **Sim** |
| `objetosPossiveis` | Tudo que estava em pauta, incl. requerimentos | ⚠️ Ruidoso |
| `ultimaApresentacaoProposicao.uriProposicaoCitada` | Último ato processual | ⛔ **Armadilha** |

**Retorno resumido** (real, `2456731-84`)

```json
{"dados":{
  "id":"2456731-84","data":"2025-04-29","siglaOrgao":"PLEN","idOrgao":180,
  "descricao":"Mantido o texto. Sim: 266; Não: 118; Total: 384.",
  "aprovacao":null,
  "descUltimaAberturaVotacao":"Votação do DTQ 4 (…): Destaque para Votação em Separado
     do(a) PRLP 2- art. 11, I, apresentado ao PL 3469/2024 (161, I).",
  "ultimaApresentacaoProposicao":{
     "descricao":"Leitura realizada em Plenário pelo Dep. Carlos Zarattini (PT-SP)…",
     "uriProposicaoCitada":"…/proposicoes/2499908"},     ⛔ isto é um PPP (parecer)
  "objetosPossiveis":[
     {"id":2502742,"siglaTipo":"RPD","numero":58,"ano":0,
      "ementa":"Votação Nominal do Requerimento de Retirada de Pauta - PL 3469/2024…"},
     …],
  "proposicoesAfetadas":[                                 ✅ isto é o projeto
     {"id":2456731,"siglaTipo":"PL","codTipo":139,"numero":3469,"ano":2024,
      "ementa":"Altera a Lei nº 7.565, de 19 de dezembro de 1986 – Código Brasileiro
                de Aeronáutica, … medidas de aumento da capacidade de resposta do Poder
                Público frente às ocorrências de incêndios florestais…",
      "dataApresentacao":"2024-09-05T16:39"}]
}}
```

⭐ **Atalho que dispensa esta chamada:** o `idVotacao` é
`{idProposicao}-{sequencial}`. Em `"2456731-84"`, **`2456731` é o id da proposição**.
Testado em 30 prefixos distintos: **30/30 resolveram** (PL 23, PLP 3, PEC 3, REQ 1). Dá
para ligar votação → matéria direto do CSV, sem chamada extra.

### 3.7 `GET /votacoes/{id}/orientacoes` — ⭐⭐ governo × oposição

O endpoint mais subestimado da API. Devolve a orientação oficial de cada bancada —
incluindo **pseudo-bancadas que não são partidos**.

**Retorno** (real, `2456731-84`)

```json
{"dados":[
  {"orientacaoVoto":"Sim",       "siglaPartidoBloco":"Governo"},
  {"orientacaoVoto":"Não",       "siglaPartidoBloco":"Minoria"},
  {"orientacaoVoto":"Não",       "siglaPartidoBloco":"Oposição"},
  {"orientacaoVoto":"Sim",       "siglaPartidoBloco":"Maioria"},
  {"orientacaoVoto":"Obstrução", "siglaPartidoBloco":"NOVO"},
  {"orientacaoVoto":"Sim",       "siglaPartidoBloco":"Fdr PSOL-REDE"},
  {"orientacaoVoto":"",          "siglaPartidoBloco":"SOLIDARIEDADE"},
  {"orientacaoVoto":"",          "siglaPartidoBloco":"Bl PlFdrPTUniPp..."}
]}
```

**Por que isso importa tanto:**

1. `Governo` / `Oposição` / `Maioria` / `Minoria` são **rótulo oficial por votação** — você
   não precisa inferir alinhamento governista, ele está no dado.
2. Cruzando orientação × voto individual, calcula-se **disciplina partidária** e
   **governismo** por deputado diretamente. É a melhor resposta disponível para *"o partido
   explica o voto?"*.

⚠️ `orientacaoVoto` pode vir **string vazia** (bancada liberou o voto). Trate como `null`.
⚠️ `siglaPartidoBloco` mistura três coisas: partido, bloco (`"Bl PlFdrPTUniPp..."`,
truncado) e pseudo-bancada. **Não use como chave estrangeira.**

### 3.8 `GET /proposicoes/{id}`

```json
{"dados":{
  "id":2456731,"siglaTipo":"PL","codTipo":139,"numero":3469,"ano":2024,
  "ementa":"Altera a Lei nº 7.565…","ementaDetalhada":null,"keywords":null,
  "descricaoTipo":"Projeto de Lei","dataApresentacao":"2024-09-05T16:39",
  "urlInteiroTeor":"…"}}
```

⚠️ `keywords` e `ementaDetalhada` vêm **`null` com muita frequência**. Não construa o
questionário dependendo deles — use `ementa` + `/temas`.

⚠️ Proposições do tipo **PPP** têm `ementa` = texto burocrático da leitura de parecer e
`ano: 0`. `ano: 0` é um bom sinal de que **não** é uma matéria de verdade.

### 3.9 `GET /proposicoes/{id}/temas` — ⭐ classificação temática oficial

```json
{"dados":[
  {"codTema":…, "tema":"Administração Pública",                        "relevancia":0},
  {"codTema":…, "tema":"Meio Ambiente e Desenvolvimento Sustentável",  "relevancia":0},
  {"codTema":…, "tema":"Trabalho e Emprego",                           "relevancia":0},
  {"codTema":…, "tema":"Viação, Transporte e Mobilidade",              "relevancia":0}
]}
```

**Cobertura medida** (25 proposições): 24 têm ao menos um tema — 12 com 1, 9 com 2, 3 com
3, 1 sem nenhum.

**Vocabulário observado:** Educação; Administração Pública; Direitos Humanos e Minorias;
Previdência e Assistência Social; Direito Penal e Processual Penal; Defesa e Segurança;
Trabalho e Emprego; Saúde; Relações Internacionais e Comércio Exterior; Meio Ambiente e
Desenvolvimento Sustentável; Indústria, Comércio e Serviços; Finanças Públicas e
Orçamento; Economia; Comunicações; Agricultura, Pecuária, Pesca e Extrativismo;
Homenagens e Datas Comemorativas.

→ Resolve o critério de **cobertura temática** do questionário sem classificação manual.

⚠️ `relevancia` veio `0` em todos os casos observados. Não confie nesse campo para ranquear.

### 3.10 Endpoints de grafo

| Endpoint | Aresta | Qualidade do sinal |
|---|---|---|
| `GET /proposicoes/{id}/autores` | Coautoria | ✅ Boa |
| `GET /orgaos/{id}/membros` | Comissão em comum | ✅ **Boa — usar esta** |
| `GET /deputados/{id}/orgaos` | Comissões de um deputado | ✅ Boa |
| `GET /deputados/{id}/frentes` | Frente em comum | ⛔ **Inútil** — 102 a 317 frentes por deputado |

**`/orgaos/{id}/membros`** (real, órgão 2003 = CCJC) — note a **vigência temporal**:

```json
{"dados":[{
  "id":178860,"nome":"Paulo Azi","siglaPartido":"UNIÃO","siglaUf":"BA",
  "idLegislatura":57,
  "titulo":"Titular","codTitulo":101,
  "dataInicio":"2026-02-09","dataFim":null}]}
```

**`/deputados/{id}/orgaos`** (real, deputado 204528) — 14 vínculos, 12 distintos:
6 comissões permanentes (`CDE`, `CE`, `CFFC`, `CICS`, `CSAUDE`, `SEMULHER`) e o restante
comissões especiais de PEC/PL (`PEC03424`, `PL233823`, `PLP10821`…).

⚠️ **`siglaOrgao` mistura comissão permanente com comissão especial.** Siglas no padrão
`PL233823`, `PEC22119`, `PLP10821` são **comissões especiais** criadas para uma proposição
específica. Filtre-as se quiser só as permanentes.

### 3.10.1 Dados de comissão e decisões conclusivas

| Recurso | Endpoint / arquivo |
|---|---|
| Cadastro de comissões | `/orgaos?codTipoOrgao=2` · `arquivos/orgaos/csv/orgaos.csv` |
| Composição com vigência | `/orgaos/{id}/membros` |
| Votações nominais de comissão | 📊 **116 em 2025** — já no `votacoesVotos.csv`, filtrar `siglaOrgao ≠ PLEN` |
| Tramitação completa | `arquivos/proposicoesTramitacoes/csv/proposicoesTramitacoes-{ano}.csv` |

**`proposicoesTramitacoes-{ano}.csv`** — 📊 169 mil linhas em 2025:

```
idTramitacao;dataHora;sequencia;uriProposicao;siglaTipo;numero;ano;siglaOrgao;
uriOrgao;regime;descricaoTramitacao;codSituacao;despacho;url
```

⚠️ **Não existe `descricaoTramitacao = "Aprovado em caráter conclusivo"`.** As 703
ocorrências de *"apreciação conclusiva"* em 2025 estão no campo **`despacho`** — são o
despacho de **distribuição** que autoriza o rito, não o registro da decisão. Marcador
auxiliar: apenas **26** `"Apresentação de Recurso"` no ano.

→ Dá para saber **quais proposições seguiram o rito conclusivo**; não dá para recuperar o
voto individual da maioria dessas decisões. Ver §7.5 e §4.1.4 do discovery.

**Domínio de `regime`** (medido): `Ordinário (Art. 151, III, RICD)` 35.653 ·
`Prioridade (Art. 151, II, RICD)` 6.950 · `Urgência (Art. 155, RICD)` 6.225 ·
`Art. 223 - CF` 5.967 · `"."` 94.649 ⚠️ (sentinela para "sem regime", tratar como `null`).

`/deputados/{id}/frentes` (real):

```json
{"dados":[{"id":55627,"uri":"…/frentes/55627",
  "titulo":"Frente Parlamentar Mista em Defesa dos Municípios Sedes de Usinas
            Hidroelétricas e Alagados","idLegislatura":57}]}
```

### 3.11 Endpoints auxiliares

| Endpoint | Retorno |
|---|---|
| `GET /legislaturas/{id}` | `{"id":57,"dataInicio":"2023-02-01","dataFim":"2027-01-31"}` |
| `GET /partidos` | Cadastro de partidos |
| `GET /orgaos?codTipoOrgao=2` | As 30 comissões permanentes |
| `GET /deputados/{id}/ocupacoes` | Histórico profissional |
| `GET /deputados/{id}/despesas?ano=&mes=` | Cota parlamentar |
| `GET /referencias/orgaos/codTipoOrgao` | Tabela de domínio |

**`/referencias/orgaos/codTipoOrgao`** (real, resumido):

| cod | nome |
|---|---|
| 1 | Comissão Diretora |
| 2 | Comissão Permanente |
| 3 | Comissão Especial |
| 4 | Comissão Parlamentar de Inquérito |
| 6 | Comissão Mista Permanente |
| 9 | Comissão Medida Provisória |
| 101 | Partido Político |
| 102 | Bloco Parlamentar |
| 103 | Governo na CD |

⚠️ `/deputados/{id}/despesas` retornou `{"dados":[]}` para um deputado/ano testado, mesmo
sendo um par válido. Confirme cobertura antes de planejar a F7.

---

## 4. Correlação com as outras bases

Detalhamento completo em
[13-correlacao-entre-fontes.md](13-correlacao-entre-fontes.md). Resumo:

| Alvo | Chave | Força |
|---|---|---|
| **→ TSE** | `cpf` (de `/deputados/{id}` ou de `deputados.csv`) ↔ `NR_CPF_CANDIDATO` | 🔑 **Determinística** |
| **→ Senado** | Sem chave comum. `nomeCivil` + `dataNascimento` + UF | ⚠️ Fuzzy |
| **Interno: votação → proposição** | Prefixo do `idVotacao` (30/30) ou `proposicoesAfetadas` | ✅ Forte |
| **Interno: voto → deputado** | `deputado_id` / `deputado_.id` | ✅ Forte |
| **Interno: proposição → tema** | `/proposicoes/{id}/temas` | ✅ 24/25 |

---

## 5. Armadilhas — checklist

| # | Armadilha | Efeito se ignorada |
|---|---|---|
| 1 | Votação simbólica devolve `dados: []` | Você conclui que a API está quebrada |
| 2 | `/votos` rejeita `itens`/`pagina` | HTTP 400 no meio da coleta |
| 3 | `idVotacao` é `varchar` (`"2456731-84"`) | Falha de tipo no banco |
| 4 | `descricao` do CSV contém `;` | `split(';')` desalinha as colunas |
| 5 | BOM UTF-8 no header dos CSVs | Primeira coluna com nome corrompido |
| 6 | `uriProposicaoCitada` aponta para PPP | Questionário feito de pareceres |
| 7 | `deputados.csv` não tem coluna `id` | Precisa extrair da `uri` |
| 8 | `cpf` com zeros à esquerda | Vira número e perde dígito → join falha |
| 9 | `siglaPartidoBloco` mistura 3 entidades | FK inválida |
| 10 | `orientacaoVoto` vazio = voto liberado | Confundido com "sem dado" |
| 11 | `keywords`/`ementaDetalhada` quase sempre `null` | Feature vazia |
| 12 | `relevancia` do tema sempre 0 | Ranking sem sentido |
| 13 | Campo do voto chama-se `deputado_` | Desserialização silenciosamente nula |
| 14 | PEC é votada em 2 turnos | Similaridade inflada |
| 15 | Proposição com `ano: 0` não é matéria real | Ruído no questionário |
