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
| **Fundão / prestação de contas** | ✅ por candidato, com CPF | 🟡 Entra, com fricção do TSE |
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

| Campo na ficha | Fonte | Estado |
|---|---|---|
| **Foto** | Câmara, `urlFoto` | ⭐ Pronta — 48 KB, sem autenticação |
| **Gasto de cota, total e por categoria** | `Ano-2025.csv.zip` | ⭐ Pronta — 99,6% liga por `ideCadastro` |
| **Maiores fornecedores do parlamentar** | mesma fonte, `txtFornecedor` | ⭐ Pronta |
| **Financiamento de campanha** | TSE, prestação de contas | 🟡 Fricção do WAF |
| ~~Assessores~~ | — | 🔴 Não existe ligação |
| ~~Licitações~~ | — | 🔴 Não existe ligação |

---

## Resumo — o que dá para usar hoje

| Fonte | O que tem | Precisa de chave? | Situação |
|---|---|---|---|
| **Cota parlamentar** | 209.176 registros em 2025, com CPF e CNPJ do fornecedor | ⛔ Não | ✅ **Pronta para ingerir** |
| **Licitações da Câmara** | 182 licitações, R$ 286,6 mi contratados | ⛔ Não | 🔴 **Não liga a parlamentar** |
| **PNCP** (contratações do Executivo) | 27.187 contratos em **10 dias** de janeiro/2025 | ⛔ Não | 🔴 **Não liga a parlamentar** |
| **Fotos de deputado** | 48 KB por pessoa, JPEG direto | ⛔ Não | ✅ Pronta |
| **Fundão eleitoral (FEFC)** | Prestação de contas por candidato | ⛔ Não | ⚠️ TSE, com fricção |
| 🔴 **Emendas parlamentares** | Autor, município, empenhado × pago | 🔑 **Sim** | ⏳ **É a razão para pedir a chave** |
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

## 3. Fundo eleitoral (FEFC) e prestação de contas

Fica no CDN do TSE, junto do resto:

```
/estatistica/sead/odsele/prestacao_contas/
    prestacao_de_contas_eleitorais_candidatos_2022.zip   →  ✅ 200
    prestacao_de_contas_eleitorais_partidos_2022.zip     →  ⛔ 404 (nome errado)
```

⚠️ O nome do arquivo de partidos precisa ser descoberto no
[portal de dados abertos do TSE](https://dadosabertos.tse.jus.br/) — o padrão que
funcionou para candidatos não vale para partidos.

### ⚠️ O WAF do TSE bloqueia `HEAD`

Descoberto aqui, mas 📐 **documentado onde é o dono**:
[`12-fonte-tse §2.0.1`](12-fonte-tse.md) — junto da receita de headers.

⚠️ Em resumo: `HEAD` dá 403 e `GET` dá 200 na **mesma URL**. Verificar disponibilidade
com `HEAD` é o reflexo natural, e aqui ele mente.

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
