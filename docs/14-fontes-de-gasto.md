# O que pode enriquecer o perfil do parlamentar

> **Tipo:** referência de fonte · **Medido em:** 2026-08-27 · **Status:** ✅ validado ao vivo
>
> ⭐ Todos os números desta página vêm de requisição executada, ⛔ não de documentação
> lida. Onde não deu para medir, está escrito que não deu.
>
> 📐 O que cada medida estatística significa: [`metodos.md`](metodos.md).

---

## 🔴 O critério que decide tudo: dá para associar à PESSOA?

> **Regra do autor (2026-08-27):** *"tudo tem que estar associado ao perfil do político —
> se não der para associar, não faz sentido para nós."* E: *"todas essas fontes têm o
> intuito de popular o perfil do político."*
>
> ⭐ **É o filtro certo, e ele decide sozinho.** O destino do dado é a ficha de UMA
> pessoa. Fonte sem coluna que aponte para um parlamentar não tem onde ser exibida — não
> é questão de esforço, é de não haver lugar na tela.

⭐ **É o filtro certo**, e ele reprova fontes que pareciam boas. Aplicado a cada uma:

| Fonte | Liga a um parlamentar? | Veredito |
|---|---|---|
| **Cota parlamentar** | ✅ `ideCadastro` — **99,6% dos registros** | ⭐ **Entra** |
| **Fotos** | ✅ id do deputado na própria URL | ⭐ **Entra** |
| **Fundão / prestação de contas** | ✅ **CPF do candidato** — chave forte | ⭐ **Entra** |
| **Licitações da Câmara** | ⛔ **NÃO** — 19 colunas, nenhuma de parlamentar | 🔴 **Fora** |
| **PNCP** | ⛔ **NÃO** — contratos do Executivo | 🔴 **Fora** |
| **Servidores da Câmara** | ⛔ **NÃO** — 15.227 registros, **0** lotados em gabinete de deputado | 🔴 **Fora** |
| **Salário / subsídio** | ⚠️ Liga, mas é **igual para todos** | 🟡 Não diferencia |

### ⚠️ Salário: liga, mas não enriquece

O **subsídio** de deputado e senador é **valor único, fixado em lei** — o mesmo para os
513. Exibi-lo na ficha não distingue ninguém de ninguém.

⭐ **O que varia entre parlamentares é a COTA** (por UF, pela distância a Brasília) e **o
uso que cada um faz dela**. É essa a métrica que enriquece o perfil, não o salário.

### ⛔ Por que licitação e servidores não passam no filtro

Conferi as **19 colunas** do CSV de licitações da Câmara:

```
idLicitacao · numero · ano · numProcesso · objeto · modalidade · tipo · situacao
vlrEstimado · vlrContratado · vlrPago · datas · numItens · numPropostas · numContratos
```

🔴 **Não existe campo de parlamentar.** São as compras da **instituição** — a Câmara
contratando serviço de infraestrutura, limpeza, TI. Nenhum deputado assina, nenhum
aparece.

O mesmo vale para o **PNCP**: contratos do Executivo, com CNPJ do fornecedor e órgão
contratante. Não há político do outro lado.

E o de **servidores** foi testado por último e reprovou também:

| | |
|---|---|
| Registros | 15.227 |
| Com lotação em gabinete de deputado | **0** |

⚠️ A coluna `lotacao` traz o órgão administrativo, ⛔ não o gabinete. Não dá para dizer
quantos assessores um deputado tem — que teria sido um bom campo de ficha.

⚠️ **Isso não as torna inúteis — torna-as outro trabalho.** Elas responderiam *"como o
Estado gasta"*, e o TCC pergunta *"como este parlamentar se comporta"*.

### ⭐ Mas existe uma ponte, e ela é boa

A cota parlamentar traz **`txtCNPJCPF` — o CNPJ de quem recebeu**. E a prestação de
contas eleitoral traz o CNPJ de **quem doou**.

> 🔴 **Cruzar as duas responde: "este deputado paga, com dinheiro público, empresas que
> financiaram a campanha dele?"**

Isso **está** associado ao político, é verificável, e é pergunta de TCC. ⚠️ Depende de
confirmar que a prestação de contas expõe o CNPJ do doador — ⛔ ainda não verificado.

---

## O que efetivamente vai para a ficha

> ✅ **Atualizado em 2026-08-27, depois de ingerir de verdade.** As três fontes que
> passaram no filtro estão **no ar**, e o perfil tem hoje três abas de dinheiro:
> **Gastos**, **Emendas** e **Campanha**.

| Campo na ficha | Fonte | Estado | Medido |
|---|---|---|---|
| **Foto** | Câmara, `urlFoto` | ✅ No ar | 48 KB, sem autenticação |
| **Gasto de cota, total e por categoria** | `Ano-{ano}.csv.zip` | ✅ No ar | **208.188** despesas |
| **Maiores fornecedores** | mesma fonte, `txtFornecedor` | ✅ No ar | — |
| ⭐ **Emendas — empenhado × pago, por destino e função** | Portal, `api-de-dados/emendas` | ✅ No ar | **24.810**, 86% com autor |
| ⭐ **Financiamento de campanha — fundão separado** | TSE, prestação de contas | ✅ No ar | **22.511**, 642 de 643 |
| ~~Assessores~~ | — | 🔴 Não existe ligação | — |
| ~~Licitações~~ | — | 🔴 Não existe ligação | — |

### 🔴 As três distinções que a tela ⛔ não pode apagar

Cada fonte trouxe um par de números que é **tentador somar** — e somar destruiria a
informação:

| Par | Por que ⛔ não se soma |
|---|---|
| **Empenhado × pago** | Empenhar é reservar; pagar é o dinheiro sair. Exibir só o empenhado deixaria concluir que o dinheiro chegou — que é o que quem anuncia emenda gostaria |
| **Fundo Especial × Fundo Partidário** | O FEFC é eleitoral (2017); o Partidário custeia o partido o ano inteiro. Somar é defensável, mas é **uma afirmação** — quem a fizer que a assine |
| **CNPJ × CPF de fornecedor/doador** | CNPJ é dado público de empresa e fica legível; CPF é hasheado (RNF-13). Tratá-los igual perderia a ponte campanha → cota, ou vazaria dado pessoal |

⭐ **A API entrega os dois lados de cada par, sempre.** A soma, quando aparece, vem
**escrita como soma** — *"juntos, os dois fundos somam R$ X"*.

---

## Resumo — o que dá para usar hoje

| Fonte | O que tem | Precisa de chave? | Situação |
|---|---|---|---|
| **Cota parlamentar** | 209.176 registros em 2025, com CPF e CNPJ do fornecedor | ⛔ Não | ✅ **Pronta para ingerir** |
| **Licitações da Câmara** | 182 licitações, R$ 286,6 mi contratados | ⛔ Não | 🔴 **Não liga a parlamentar** |
| **PNCP** (contratações do Executivo) | 27.187 contratos em **10 dias** de janeiro/2025 | ⛔ Não | 🔴 **Não liga a parlamentar** |
| **Fotos de deputado** | 48 KB por pessoa, JPEG direto | ⛔ Não | ✅ Pronta |
| ⭐ **Fundão eleitoral (FEFC)** | `DS_FONTE_RECEITA` por candidato, com CPF e CNPJ do doador | ⛔ Não | ✅ **INGERINDO** — R$ 907,7 mi de FEFC |
| ⭐ **Emendas parlamentares** | Autor, município, empenhado × pago | 🔑 **Sim** | ✅ **INGERINDO** — 24.810 emendas |
| Servidores federais, convênios | Portal da Transparência | 🔑 Sim | 🔵 Ligam por CPF, que não temos em claro |

> ⚠️ **Correção de 2026-08-27.** Esta página afirmava que *"o Portal da Transparência é a
> fonte MENOS necessária"*. **O discovery do contrato OpenAPI desmente**: o grupo
> `emendas` liga ao parlamentar por `nomeAutor` e traz empenhado × pago por município.
> É a fonte mais forte do levantamento — ver §5.

---

## 1. Cota parlamentar (CEAP)

### ⚠️ A API existe e devolve vazio

```
GET /api/v2/deputados/{id}/despesas?ano=2025   →  200, mas "dados": []
```

Testado em três deputados e três anos: **sempre vazio**. ⛔ Não use.

### ✅ O arquivo em bloco funciona

```
https://www.camara.leg.br/cotas/Ano-2025.csv.zip   →  200 · 6,6 MB
```

⚠️ **Fica fora de `dadosabertos.camara.leg.br`** — é `www.camara.leg.br/cotas/`. Foi por
isso que as tentativas em `/arquivos/despesas/` deram 404.

**Medido:**

| | |
|---|---|
| Registros em 2025 | **209.176** |
| **Com `ideCadastro`** | **208.239 — 99,6%** |
| Sem (lideranças e órgãos, não pessoas) | 937 — 0,4% |
| **Deputados distintos** | **562** |
| **Total gasto, por deputado identificado** | **R$ 244,6 mi** |
| Colunas | 32 |
| ZIP | 6,6 MB |

Colunas de interesse:

```
txNomeParlamentar · cpf · ideCadastro · nuLegislatura · sgUF · sgPartido
numSubCota · txtDescricao · txtFornecedor · txtCNPJCPF · vlrLiquido · datEmissao
```

⭐ **`ideCadastro` é o mesmo id da Câmara que o projeto já usa** — a ligação com `pessoas`
sai de graça, via `pessoa_fonte_ids`.

⚠️ **Traz `cpf` em claro.** 🔴 A RNF-13 proíbe armazenar CPF sem hash. Se esta fonte
entrar, o CPF passa pelo mesmo `cpf_hash` do resto.

---

## 2. Licitações

### 2.1 Câmara dos Deputados

```
/arquivos/licitacoes/csv/licitacoes-2025.csv   →  200
```

| | |
|---|---|
| Licitações em 2025 | **182** |
| Valor contratado | **R$ 286,6 mi** |
| Valor pago | **R$ 60,6 mi** |

⭐ O CSV traz `vlrEstimado`, `vlrContratado` **e `vlrPago`** — dá para medir a distância
entre os três, que é onde a análise interessa.

### 2.2 PNCP — Portal Nacional de Contratações Públicas

⭐ **É a fonte certa para o Executivo**, não o Portal da Transparência: é o repositório
oficial de contratações desde 2021, com **API aberta e sem cadastro**.

```
https://pncp.gov.br/api/consulta/v1/contratos?dataInicial=&dataFinal=&pagina=&tamanhoPagina=
```

⚠️ **`tamanhoPagina` tem limite** — 2 devolve `400 Tamanho de página inválido`; 10
funciona. Descobrir o teto antes de planejar a paginação.

**Volume medido — 10 dias de janeiro/2025:**

| | |
|---|---|
| Contratos | **27.187** |
| Páginas (10 por página) | 2.719 |

🔴 **Extrapolando, é da ordem de 1 milhão de contratos por ano.** ⛔ Não é fonte para
ingerir inteira — precisa de recorte (órgão, valor mínimo, período) definido antes.

---

## 3. ✅ Fundo eleitoral (FEFC) — ACHADO e medido (2026-08-27)

### Onde está

```
https://cdn.tse.jus.br/estatistica/sead/odsele/prestacao_contas/
    prestacao_de_contas_eleitorais_candidatos_2022.zip     →  ✅ 200 · 377 MB
```

⚠️ **Só este nome funciona.** `prestacao_de_contas_2022`, `prestacao_contas_2022` e
`prestacao_de_contas_eleitorais_2022` dão 404. ⛔ Não há arquivo de partidos com padrão
análogo — o de candidatos é o que interessa aqui.

📐 A receita de headers e o truque do `HEAD` × `GET`:
[`12-fonte-tse §2.0`](12-fonte-tse.md).

### O que tem dentro

**112 arquivos, 5 tipos, 27 UFs cada** (mais um `BRASIL` consolidado de 1,3 GB):

| Tipo | O que traz |
|---|---|
| ⭐ **`receitas_candidatos_2022`** | **Quem financiou cada candidato** — é o que interessa |
| `receitas_candidatos_doador_originario_2022` | Rastreia doação que passou por intermediário |
| `despesas_contratadas_candidatos_2022` | O que a campanha contratou |
| `despesas_pagas_candidatos_2022` | O que foi efetivamente pago |
| `leiame` | Dicionário de dados |

### 🔴 O Fundão aparece EXPLICITAMENTE

O campo é **`DS_FONTE_RECEITA`**. Medido no Amapá (2.822 registros):

| Fonte de receita | Linhas |
|---|---|
| OUTROS RECURSOS | 1.684 |
| ⭐ **FUNDO ESPECIAL** — o FEFC | **969** |
| FUNDO PARTIDARIO | 95 |
| `#NULO` | 74 |

⚠️ **São dois fundos distintos, e o CSV os separa:** o **Fundo Especial (FEFC)** é o
"fundão eleitoral", criado em 2017; o **Fundo Partidário** é o financiamento permanente
dos partidos. ⛔ Somar os dois como "dinheiro público de campanha" é defensável, mas
precisa ser dito.

### Liga ao político? ✅ **Sim, por CPF e por nome**

60 colunas. As que importam:

```
LIGA AO CANDIDATO   NR_CPF_CANDIDATO · NM_CANDIDATO · SQ_CANDIDATO · DS_CARGO
ORIGEM DO RECURSO   DS_FONTE_RECEITA · DS_ORIGEM_RECEITA · DS_NATUREZA_RECEITA
DOADOR              NR_CPF_CNPJ_DOADOR · NM_DOADOR · NM_DOADOR_RFB · DS_CNAE_DOADOR
VALOR               VR_RECEITA
```

⭐ **`NR_CPF_CANDIDATO` é chave forte** — melhor que o nome das emendas.

### Teste real — deputado federal no Amapá

| Candidato | Fundão | Total recebido |
|---|---:|---:|
| KASSYO SANTOS RAMOS | R$ 3.170.000,00 | R$ 3.185.000,00 |
| CARLOS CAMILO GOES CAPIBERIBE | R$ 2.500.000,00 | R$ 2.593.000,00 |
| ANDRÉ DOS SANTOS ABDON | R$ 2.500.000,00 | R$ 2.500.000,00 |

⭐ **149 candidatos a deputado federal só no Amapá** — a menor UF do arquivo.

### ⭐ E fecha a ponte com a cota parlamentar

`NR_CPF_CNPJ_DOADOR` é o CNPJ de **quem doou**. `txtCNPJCPF` da cota é o CNPJ de **quem
recebeu** dinheiro público depois.

> 🔴 **Cruzar responde: "este deputado paga, com verba de gabinete, empresas que
> financiaram a campanha dele?"** — associado à pessoa, verificável, e pergunta de TCC.

### ✅ Ingerido — o resultado real (2026-08-27)

| | |
|---|---|
| Receitas gravadas | **22.511** |
| Parlamentares alcançados | **642 de 643** |
| Total arrecadado | **R$ 1.163.414.247,54** |
| ⭐ Fundo Especial (FEFC) | **R$ 907.742.619,90** — 78% do total |
| Tempo | ~90 s com o ZIP em cache; ~2 min com download |

⭐ **O único fora é um suplente com 6 votos**, que ⛔ não foi candidato a deputado federal
em 2022. 642 de 643 é o teto real da fonte, ⛔ não uma falha do casamento.

### ⚠️ O que precisou ser resolvido — e uma armadilha que só apareceu ingerindo

| # | Questão | |
|---|---|---|
| 1 | O CPF do deputado | ✅ Existe na **API REST** da Câmara; casamento **15 de 15** — §3.1 |
| 2 | **396 MB por eleição**, **Latin-1**, separador `;` | ✅ Lido em fluxo, ⛔ nunca em memória |
| 3 | **CPF em claro** de candidato e de doador pessoa física | ✅ Hasheado no laço de leitura — RNF-13 |
| 4 | Qual arquivo do ZIP ler | 🔴 **A armadilha** — [achado #23](achados/023-consolidado-do-tse-e-o-unico-com-df.md) |
| 5 | A eleição de 2026 | 🔵 O arquivo só existe depois do pleito |

> 🔴 **A armadilha do item 4, em uma linha:** são **26** arquivos estaduais mais um
> `_BRASIL`, ⛔ não 27 estaduais — o **DF ⛔ não tem arquivo próprio**, e o `_BRASIL`
> **duplica** os estaduais linha por linha. Ler só os estaduais perdia **R$ 17,2 milhões e
> 10 parlamentares em silêncio**; ler os dois dobraria o resto.

### 🔴 E o doador pessoa física

`NR_CPF_CNPJ_DOADOR` mistura CNPJ e CPF, exatamente como o `txtCNPJCPF` da cota. A regra é
**a mesma dos dois lados**, de propósito:

| | |
|---|---|
| **CNPJ** | Fica **legível** — é dado público de empresa, e é ele que sustenta a ponte campanha → cota |
| **CPF** | Vira **hash**, com a mesma função de `Pessoa.CpfHash` |
| `00000000000` | Vira **`NULL`** — ⚠️ hasheá-lo daria um valor CONSTANTE em milhares de linhas, que casaria todas entre si e **inventaria um doador comum que ⛔ não existe** |

### 3.1 ✅ O CPF existe — na API REST, não no CSV

> **Medido em 2026-08-27.** Eu havia escrito que *"o CPF do deputado nunca é ingerido"* e
> que a ligação teria de ser por nome. ⛔ **Errado.**

| Fonte | Campo `cpf` |
|---|---|
| `arquivos/deputados/csv/deputados.csv` | ⛔ **Vazio** — 0 de 7.889 ([achado #22](achados/022-deputados-nao-e-arquivo-anual.md)) |
| `api/v2/deputados/{id}` | ✅ **Preenchido** — 10 de 10 na amostra |

```json
{ "nomeCivil": "JOSE ABILIO SILVA DE SANTANA", "cpf": "36607606504" }
```

⚠️ **Custa uma requisição por deputado** — 643 chamadas, uma vez só. É o preço de uma
chave forte, e o [achado #22](achados/022-deputados-nao-e-arquivo-anual.md) registra que
o CSV em bloco não a tem.

#### ✅ Implementado — `python -m poligraph_etl cpf`

```
Buscando CPF de 643 deputados...
  643 de 643 com CPF
Concluído em 225.8s
```

| Verificado no banco | |
|---|---|
| Com `cpf_hash` | **643** |
| Hash válido (64 hex) | **643** |
| ⛔ **CPF em claro** | **0** |

⭐ **Idempotente:** a segunda execução responde *"todos já têm cpf_hash"* em 0,0s. Só
busca quem tem **voto** e ainda **não** tem hash — 7.889 pessoas no cadastro contra 643
com voto na legislatura.

⚠️ **Canário:** se menos de 80% retornarem CPF, o ETL registra WARNING. Perda grande
significa layout mudado ou bloqueio, ⛔ não "alguns sem CPF".

#### 🔴 O teste de casamento — CPF ganha

Deputados do **Amapá** (15) contra os candidatos a deputado federal do TSE (149):

| Estratégia | Acerto |
|---|---|
| ⭐ **Por CPF** | **15 de 15 — 100%** |
| Por nome civil normalizado | 14 de 15 — 93% |

⭐ **O CPF resolve sem heurística nenhuma.** O nome civil chega perto, mas erra um — e
errar um em quinze, em escala nacional, é dezenas de conciliações manuais.

#### ⚠️ Uma armadilha que custou uma rodada de teste

A primeira medição deu **0 de 15**, nos dois critérios. A causa ⛔ não era o dado:

🔴 **`pessoas.id` é o id SINTÉTICO do projeto (RF-11), ⛔ não o id da Câmara.** Passá-lo
para `api/v2/deputados/{id}` devolve **404**. O id externo vive em `pessoa_fonte_ids`, e
foi para isso que essa tabela existe.

⚠️ O erro é silencioso na leitura do código — os dois são `long`, e nada avisa.

#### 🔴 Ao ingerir o CPF, ele vira hash

A RNF-13 proíbe CPF em claro. ⭐ Mas o hash **não impede o casamento**: basta hashear os
dois lados com o mesmo algoritmo e comparar os hashes — o CPF em claro só precisa existir
**em memória**, durante a ingestão.

⚠️ É o mesmo desenho já usado em `despesas.cnpj_ou_hash`.

---

## 4. Fotos de parlamentar

### 4.1 Câmara — ⭐ a fonte recomendada

```
https://www.camara.leg.br/internet/deputado/bandep/{id}.jpg
→ 200 · 48 KB · image/jpeg
```

| | |
|---|---|
| Autenticação | ⛔ Nenhuma |
| Tamanho por foto | ~48 KB |
| **Total para 643 deputados** | **~31 MB** |

⭐ A URL **já vem** em `ultimoStatus.urlFoto`, no endpoint que o ETL já consome.

### 4.2 TSE — funciona, mas é grande

```
/estatistica/sead/eleicoes/eleicoes2022/fotos/foto_cand2022_SP_div.zip
→ 200 · 90 MB   ← só São Paulo
```

⛔ **Não recomendada para este projeto:** cobre candidatos (não só eleitos), exige a
receita de headers, e o volume por UF é 3× o total da Câmara inteira.

### 4.3 🔴 A decisão que NÃO é técnica

Guardar imagem é trivial. O que não é:

| Questão | |
|---|---|
| **LGPD** | Foto de político é dado pessoal. Uso acadêmico tem amparo, mas **rehospedar** difere de **linkar** |
| **Licença** | O termo de uso da Câmara precisa ser lido antes, não depois |
| **Precedente** | `Avatar.tsx` usa iniciais justamente porque *"coletar e rehospedar imagem de pessoa é outra discussão de licença e de LGPD que este trabalho não abriu"* |

⭐ **Recomendação:** guardar o **caminho em disco**, ⛔ não o binário em `bytea`. Dump,
backup e restore do Postgres agradecem, e trocar de estratégia depois fica barato.

---

## 5. Portal da Transparência — discovery **sem a chave**

> ⭐ Feito lendo o **contrato OpenAPI**, que responde **200 sem autenticação**:
> `https://api.portaldatransparencia.gov.br/v3/api-docs`. Dá para saber exatamente o que
> chega antes de esperar o token.

**106 endpoints, em 53 grupos.** A maioria é programa social (Bolsa Família, BPC, PETI,
Seguro Defeso) — ⛔ nada disso liga a parlamentar.

Aplicando o critério, restam quatro grupos:

### 🔴 `emendas` — a descoberta que muda o quadro

```
GET /api-de-dados/emendas?nomeAutor=&ano=&tipoEmenda=
```

O retorno traz:

```
codigoEmenda · ano · tipoEmenda · autor · nomeAutor · numeroEmenda
localidadeDoGasto · funcao · subfuncao
valorEmpenhado · valorLiquidado · valorPago
valorRestoInscrito · valorRestoCancelado · valorRestoPago
```

⭐ **`nomeAutor` é o parlamentar, e `localidadeDoGasto` é o município.** Isto responde
*"para onde este deputado mandou dinheiro público?"* — ligado à pessoa, com valor
empenhado × pago, e por município.

> 🔴 **Mas o vínculo ⛔ NÃO é feito pelo `nomeAutor`** — decisão do autor do projeto, e a
> medição a sustenta. O `codigoEmenda` embute um identificador estável de **mandato**, que
> ⛔ não depende de grafia e **serve também ao Senado**, que não publica CPF.
> 📐 [Achado #24](achados/024-codigo-da-emenda-identifica-o-mandato.md).

### ✅ Ingerido — o resultado real (2026-08-27)

| | |
|---|---|
| Emendas gravadas (2023–2026) | **24.810** |
| Autores distintos | **951** |
| Autores resolvidos | **792** (83,3%) |
| Emendas com autor resolvido | **21.349** (86,0%) |
| Deputados da 57ª com emenda | **550 de 643** |
| Sem vínculo | **159** — 76 comissões e bancadas, 83 senadores e outros |
| Tempo | ~10 min (≈1.700 requisições, 15 itens por página) |

⚠️ **A paginação é fixa em 15 itens e ⛔ não há parâmetro para mudar.** São ~420 páginas
por ano; o ETL pausa 0,12 s entre chamadas, porque é serviço público com limite de taxa.

⭐ **Emenda de comissão e de bancada ⛔ não é descartada** — entra com `pessoa_id` nulo e
vira pendência visível. As maiores, por valor empenhado, são exatamente elas: `COM. DA
SAUDE` (R$ 13,4 bi), `COM. DESENV REGIONAL E TURISMO` (R$ 9,6 bi), `BANCADA DO AMAZONAS`
(R$ 1,4 bi). Atribuí-las a alguém seria inventar autoria.

🔴 **É a fonte mais forte de todas as levantadas**, e vale mais que a cota: emenda
parlamentar é o instrumento de poder orçamentário do deputado, e o par
`valorEmpenhado × valorPago` mostra o que foi prometido versus o que saiu.

⚠️ **A ligação é por NOME, ⛔ não por id.** Vai exigir conciliação — grafia, homônimos,
nome parlamentar × nome civil. É o mesmo problema da RF-13, e o projeto já tem a `fila de
revisão manual` prevista para isso.

### 🟡 `servidores` e `peps` — ligam por CPF

```
GET /api-de-dados/servidores?cpf=&nome=
GET /api-de-dados/servidores/remuneracao?cpf=&mesAno=
GET /api-de-dados/peps?cpf=&nome=          ← Pessoas Expostas Politicamente
```

⭐ Ligam por **CPF**, que é chave forte. ⚠️ Mas o projeto guarda apenas `cpf_hash`
(RNF-13) — e ⛔ **hash não se reverte para consultar a API**. Usar isto exigiria manter o
CPF em claro em algum ponto do fluxo, o que contraria a regra.

🔵 Alternativa: consultar por `nome` e cair no mesmo problema de conciliação das emendas.

### ⛔ `contratos` e `licitacoes` — confirmam o que já se sabia

```
/contratos          → dataInicial, dataFinal, codigoOrgao
/contratos/cpf-cnpj → cpfCnpj                    ← do FORNECEDOR, não do político
/licitacoes         → dataInicial, dataFinal, codigoOrgao
```

🔴 **Nenhum parâmetro de parlamentar.** O `cpfCnpj` é do fornecedor. Confirma o veredito
da §"critério": são compras do Executivo, sem político do outro lado.

⭐ **Mas fecham a ponte:** `/contratos/cpf-cnpj` permite perguntar *"o que mais o governo
comprou desta empresa?"* — partindo de um CNPJ que veio da cota parlamentar.

### ✅ Discovery COM a chave (2026-08-27)

> ⚠️ Executado com credencial real. ⛔ A chave não está neste repositório, e é pessoal —
> atrelada ao CPF de quem a pediu.

**A chave funciona: `HTTP 200`.**

#### Volume e paginação

| | |
|---|---|
| Itens por página | **15** — ⛔ fixo, sem parâmetro de tamanho |
| Última página com dado (2025) | **421** |
| **Emendas em 2025** | **~6.315** |
| Anos disponíveis | **2022 a 2026** — todos respondem |
| Requisições para varrer um ano | **~421** |

⭐ **Volume tratável.** Ao contrário do PNCP (~1 milhão de contratos/ano), aqui uma
legislatura inteira são ~25 mil emendas — cabe em ingestão completa.

#### Composição da amostra (375 emendas)

| Tipo | Qtd |
|---|---|
| **Emenda Individual — Transferências com Finalidade Definida** | 372 |
| Emenda de Bancada | 2 |
| Emenda Individual — Transferências Especiais | 1 |

⭐ **99% são individuais**, que é exatamente o que liga a UM parlamentar.

#### 🔴 O teste que decide: os nomes casam?

O campo `nomeAutor` vem em **CAIXA ALTA, sem acento** — nosso banco guarda o nome
parlamentar. Testado contra os **643 deputados** que têm voto:

| | |
|---|---|
| Autores distintos na amostra | 266 |
| **Casam por nome normalizado** | **222 — 83%** |

⭐ **83% sem nenhuma heurística**, só removendo acento e caixa.

#### ⚠️ Os 17% que não casam — e por que isso é BOM

```
ALESSANDRO VIEIRA · CARLOS VIANA · EFRAIM FILHO · ELIZIANE GAMA · ESPERIDIAO AMIN
   → SENADORES. Emenda individual também é do Senado.

BANCADA DO RIO DE JANEIRO
   → Emenda de BANCADA, não tem autor pessoa.

CARLA DICKSON (EX-PARLAMENTAR PAULINHO FREIRE, NOS TERMOS ART. 78 LDO 2025…)
   → O campo carrega texto jurídico junto do nome.

ALAN RICK · ASTRONAUTA MARCOS PONTES · CHICO RODRIGUES
   → Deputados de outras legislaturas, ou que mudaram de casa.
```

🔴 **Nenhum dos casos é falha de conciliação — são registros que legitimamente não são
deputado da 57ª.** Isso significa que o casamento por nome é **muito melhor do que a §5
supunha**: a fila de revisão manual da RF-13 provavelmente ⛔ **não é necessária** aqui.

⚠️ Restam dois cuidados reais:
1. **Homônimo** entre deputado e senador — ⛔ não medido ainda
2. **Texto jurídico dentro do nome** — precisa de limpeza antes de comparar

#### ⚠️ Um campo que surpreende

```json
"valorEmpenhado": "- 26.002,00",
"valorPago":      "12.599,10",
"valorRestoPago": "211.398,90"
```

🔴 **Valores vêm como TEXTO em formato brasileiro**, com vírgula decimal e ponto de
milhar — e o empenhado pode ser **negativo** (cancelamento). ⛔ Converter com `float()`
direto quebra.

⚠️ E `valorRestoPago` pode ser **muito maior** que o pago do ano: é resto a pagar de
exercícios anteriores. Somar tudo como se fosse do ano corrente inflaria o número.

### Veredito do discovery

| Grupo | Liga ao parlamentar | Vale a chave? |
|---|---|---|
| **`emendas`** | ✅ por `nomeAutor` — **83% casam direto** | ✅ **CHAVE OBTIDA — pronta para ingerir** |
| `contratos/cpf-cnpj` | 🟡 indireto, via CNPJ da cota | ⭐ Sim, como complemento |
| `servidores`, `peps` | ⚠️ por CPF, que não temos em claro | 🔵 Talvez |
| `licitacoes`, `contratos` | ⛔ Não | ⛔ Não |
| Programas sociais (40+ endpoints) | ⛔ Não | ⛔ Não |

---

## O que falta decidir

| # | Decisão | Quem decide |
|---|---|---|
| 1 | A cota parlamentar entra no escopo? Ela **não** é sobre voto — é outro eixo de análise, e o título do TCC não a menciona | 🔴 Autor |
| 2 | Se entrar: o `cpf` do CSV passa por hash, como manda a RNF-13 | Já resolvido pela regra |
| 3 | Vale perseguir a ponte **fornecedor da cota × doador de campanha**? | 🔴 Autor |
| 3b | **Emendas** entram? A ligação é por NOME e exige conciliação (mesmo problema da RF-13) | 🔴 Autor |
| 4 | Fotos: rehospedar ou linkar? | 🔴 Autor — é LGPD, não técnica |

⛔ **Licitações e PNCP saíram da lista** por não passarem no critério de associação à
pessoa. Ficam registradas aqui como fonte descartada **com o motivo medido** — para
ninguém refazer o levantamento daqui a três meses.
