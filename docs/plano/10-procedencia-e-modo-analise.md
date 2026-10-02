# 10 — Procedência por linha, modo análise e cruzamento por CNPJ

> **Escrito em 2026-10-02**, a partir de um vídeo indicado pelo autor e da conversa sobre
> ele. É **plano**: o que está aqui ainda não foi construído, salvo onde dito.
> Pendências: PL72 a PL76 em [`PENDENCIAS`](../PENDENCIAS.md).

---

## 1. A origem — o vídeo

**"Investigando candidatos pela transparência do TSE"**, canal YuriRDev, YouTube
(`https://www.youtube.com/watch?v=-7F2BdGqaUU`, 8min45). Visto pela transcrição em
2026-10-02.

O autor baixou do TSE as receitas e despesas de campanha desde 2018 e montou um grafo
direcionado: candidato, doador e empresa são vértices; doação e pagamento são arestas. O
grafo ficou com 5,3 milhões de vértices e 7,6 milhões de arestas. Sobre ele, quatro
buscas:

| Busca | Como | Resultado e ressalva dele |
|---|---|---|
| Doação circular | Componentes fortemente conexos (Tarjan), ciclos de até 5 saltos e acima de R$ 10 mil | 38 mil ciclos. O maior, "R$ 177 milhões", era o PT Nacional mandando dinheiro à campanha do Lula, que voltava como **R$ 69,10**: o sistema somava as arestas do ciclo |
| Gasto fora do padrão | Item barato (adesivo, caneta) acima de 15 vezes a mediana do item | R$ 50 mil em adesivo é normal para presidente e estranho para vereador: passou a comparar com a receita da campanha e com o mesmo cargo e UF |
| Candidato que paga a própria empresa | Quadro de sócios da Receita, **pela BrasilAPI**, cruzado por **nome** com a lista de candidatos | 533 empresas com candidato sócio; 66 pagas pela campanha do próprio dono |
| Post ofensivo | Redes declaradas ao TSE, filtro de 470 palavras, classificação por IA | 1.200 de 40 mil, "com bastante falso positivo": a IA ordena a fila de um humano |

E duas lições que ele mesmo tira:

- **Cada linha carrega a procedência**: URL exata, data e hora do download e o SHA-256 do
  arquivo. Um "modo análise" deixa clicar em qualquer informação e ver de onde veio. "Dá
  para provar que eu não mexi em nada."
- **O dado do TSE é autodeclarado e tem erro.** O "candidato mais rico do Brasil" é um
  vereador com R$ 12 bilhões declarados, por um bem digitado com dígitos a mais.

Ele não deixou o site no ar.

### O que vale para o poligraph

| Ideia | Decisão | Onde |
|---|---|---|
| Procedência por linha | **Adotar** — pedido do autor | §2, PL72 |
| Modo análise | **Adotar** — pedido do autor | §3, PL73 |
| Conferir dado autodeclarado | Adotar: regra de patrimônio fora do comum no `conferir` | PL76 |
| Valor de um caminho no grafo | Lição de método: o valor de um caminho é o da **menor** aresta, não a soma | Qualquer agregação sobre ligações |
| Classificar posts com IA | **Não adotar**: juízo de valor sobre parlamentar (RNF-16), e falso positivo apontado para pessoa real | — |
| Alerta de gasto suspeito | **Não adotar como alerta.** Contexto factual (onde o gasto fica entre os pares) é possível; "suspeito" é juízo | — |
| Sócio cruzado por nome | **Não adotar por nome** — ver §4 | — |
| Site fora do ar | Confirma a cautela da RNF-17 | — |

MEDIDO em 2026-10-02: o maior patrimônio da nossa base é de R$ 240 milhões (senador, 2018),
plausível. Não há caso como o dos R$ 12 bilhões, mas a regra custa pouco.

---

## 2. Procedência por linha (PL72)

> FEITO em 2026-10-02 para votações, votos e orientações (Câmara e Senado). MEDIDO na
> recarga de 2026: 4 cargas, 100% das linhas com `carga_id`, e o SHA-256 de um novo
> download da Câmara igual ao gravado. A Câmara manda `ETag` e `Last-Modified`; o Senado,
> nenhum dos dois.

### O que se quer poder afirmar

"Este número é idêntico ao do arquivo da Câmara baixado em 02/10/2026 às 14:03, cujo
SHA-256 é `3f9a…`." Hoje o site diz a fonte por tela (o link do órgão); não diz de qual
arquivo, de quando, nem prova que é o mesmo.

### O desenho

Uma tabela **`cargas`**, uma linha por arquivo ou resposta baixada:

| Coluna | Tipo | Conteúdo |
|---|---|---|
| `id` | `bigint` | |
| `fonte` | `text` + `CHECK` | `CAMARA`, `SENADO`, `TSE`, `PORTAL_TRANSPARENCIA`, `RECEITA`, `IBGE` |
| `url` | `text` | O endereço exato pedido, com os parâmetros |
| `baixado_em` | `timestamptz` | Quando |
| `sha256` | `char(64)` | Do corpo da resposta ou do arquivo, como veio |
| `etag_da_fonte`, `modificado_na_fonte` | `text`, `timestamptz` | A identificação que o próprio órgão dá à versão: ele não publica hash |
| `bytes` | `bigint` | |
| `comando` | `text` | O comando da ETL e a versão (commit) |

E uma coluna **`carga_id`** (FK) nas tabelas de dado de fonte: `votacoes`, `votos`,
`orientacoes`, `despesas`, `emendas`, `emendas_favorecidos`, `receitas_de_campanha`,
`patrimonios`, `cnpjs_municipio`. ATENÇÃO: `votos` tem 2,2 milhões de linhas; um `bigint`
a mais são ~17 MB, aceitável.

| Regra | Por quê |
|---|---|
| O schema é do EF (migration em `Poligraph.Data`) | Regra 4 do projeto: o Python nunca cria tabela |
| `carga_id` NOT NULL nas linhas novas; as antigas ficam nulas até a recarga | Mudança destrutiva leva dois deploys |
| Linha regravada por uma carga nova **troca** de `carga_id` | A procedência é da versão que está no banco |
| O arquivo baixado fica guardado no volume de cache, com o hash no nome | Sem o arquivo, o hash prova a igualdade só no dia; com ele, qualquer um refaz a conta |

Na ETL, uma função `registrar_carga(conexao, fonte, url, conteudo)` calcula o hash,
grava a linha e devolve o id; toda `gravar_*` passa a recebê-lo.

---

## 3. Modo análise (PL73)

### A experiência

- Um interruptor **"Modo análise"** no menu da conta, que vale também sem conta, e fica
  guardado no navegador.
- Ligado, todo número que tem procedência ganha um sublinhado pontilhado. Clicar abre um
  painel lateral com:
  1. **De onde veio**: o órgão, o arquivo ou endpoint, a data do download e o SHA-256 —
     com o link para o original.
  2. **Como foi contado**: a regra em português ("votos Sim ou Não, sem abstenção, nas
     votações de plenário da 57ª") e os números que entraram na conta.
  3. **As linhas**: para números pequenos, a lista; para grandes, a contagem e a
     consulta.
- Desligado, o site fica como está.

DECISÃO: é a regra que o projeto já segue — mostrar o cálculo junto do número, e o
número exibido ser o número usado — levada até o arquivo de origem.

### O que pede

| Peça | Como |
|---|---|
| API | Cada DTO com número relevante leva uma referência de procedência: a(s) carga(s) e a regra. `GET /api/procedencia/{carga}` devolve a carga |
| Front | Um componente `Numero` que, no modo análise, vira botão e abre o painel. Os números passam a ser escritos por ele |
| Ordem | Começar pela ficha (votos, presença, cota) e pelo painel do início: são os números que o TCC cita |

ATENÇÃO: depende da PL72. Sem a tabela de cargas, o painel só teria o link da fonte que já
existe.

---

## 4. Cruzar por CNPJ — a pergunta do autor

> "Não daria pra cruzar com CNPJ? As entidades, e os que doam pra campanha?"

**Dá, e por CNPJ é seguro**: é chave exata, sem homônimo. O que exige cuidado é ligar uma
**pessoa** a uma empresa.

### 4.1 Empresa com empresa — CNPJ com CNPJ

MEDIDO em 2026-10-02: o mesmo CNPJ aparece como **fornecedor da cota** e como
**favorecido de emenda** do mesmo parlamentar em **897 pares** — 443 parlamentares, 424
empresas.

| Quem aparece | Leitura |
|---|---|
| Azul, Latam, Gol, distribuidoras de energia | Os maiores: a passagem e a conta de luz pagas pela cota, e pagamentos pequenos de emenda. Coincidência de empresa grande, não vínculo |
| **323 empresas ligadas a um só parlamentar** | Onde o cruzamento tem o que mostrar |

**Proposta (PL74):** um fato na ficha, não alerta — "esta empresa também recebeu da cota
deste parlamentar", ao lado do favorecido da emenda. Sem adjetivo e sem ranking
(RNF-16). Cruzamento por CNPJ, chave exata.

### 4.2 Parlamentar sócio de empresa — pessoa com empresa

O quadro de sócios (pela BrasilAPI ou pelo arquivo da Receita) traz o **nome** do sócio e
o CPF **mascarado**, com só os 6 dígitos do meio (`***550179**`). Nós guardamos só o
`cpf_hash` (RNF-13).

- Por nome: não. Os achados do projeto já mediram o que homônimo faz.
- **Por nome + os 6 dígitos do meio: sim.** O CPF do parlamentar passa pela ETL na hora de
  calcular o hash (Câmara e TSE). Nesse momento dá para comparar os 6 dígitos e o nome
  com o quadro de sócios, e gravar **só o vínculo** parlamentar–CNPJ, não o CPF.
- Com isso, "a cota pagou empresa da qual o parlamentar é sócio" vira um fato verificável
  (PL75). O parlamentar é pessoa pública no exercício do mandato.

### 4.3 Doadores de campanha

- **Empresa não doa desde 2015** (STF, ADI 4.650): os doadores com CNPJ nas nossas receitas
  são órgãos de partido e campanhas. Cruzá-los por CNPJ mostra o caminho do dinheiro do
  partido, não empresa.
- **Doador pessoa física**: daria pela mesma técnica do §4.2, mas é **cidadão
  privado**. Ligar um doador comum a uma empresa no site seria expor pessoa que não é
  pública. Não fazer.

---

## 5. Ordem sugerida

| # | O quê | Pendência |
|---|---|---|
| 1 | Tabela `cargas` e `carga_id` na ETL, começando por votações e votos | PL72 |
| 2 | Modo análise na ficha e no painel do início | PL73 |
| 3 | Regra de patrimônio fora do comum no `conferir` | PL76 |
| 4 | "Também recebeu da cota" no favorecido da emenda | PL74 |
| 5 | Parlamentar sócio, por nome e 6 dígitos | PL75 |
