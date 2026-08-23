# Senado Federal (e o Congresso Nacional) — como funcionam

> **Para quem é este documento:** mesma proposta do
> [01-camara-dos-deputados.md](01-camara-dos-deputados.md) — explicar a instituição e
> ligar cada conceito ao dado. Inclui o **Congresso Nacional**, que é uma terceira arena
> deliberativa e costuma ser confundida com "os dois juntos".
> **Status:** v1.0 — 2026-08-22
> Ver também: [11-api-senado.md](11-api-senado.md), [00-discovery.md](00-discovery.md)

---

## 1. O que o Senado é — e por que não é "a Câmara com menos gente"

O Senado representa **os estados**, não a população. Por isso:

- **81 senadores**: exatamente **3 por estado**, mais 3 pelo Distrito Federal.
- **Roraima (≈650 mil habitantes) tem os mesmos 3 senadores que São Paulo (≈44 milhões).**

Isso é deliberado — é o princípio federativo. Mas gera uma **desproporção brutal**, muito
maior que a da Câmara. Um voto em Roraima vale, para fins de representação no Senado,
dezenas de vezes mais que um voto em São Paulo.

→ *Para o TCC:* se você comparar as duas casas (é o que a F6 propõe), essa diferença de
desenho é a explicação de fundo para qualquer divergência de comportamento que encontrar.
Vale uma frase no texto.

---

## 2. Eleição: majoritária, e isso muda tudo

Diferente da Câmara, o Senado é eleito por **voto majoritário simples** — quem tem mais
votos leva, sem quociente eleitoral, sem puxador de votos, sem lista.

**A renovação é escalonada e alternada:**

| Eleição | Cadeiras em disputa por estado |
|---|---|
| A cada 8 anos | **1/3** (1 senador por estado) |
| Nas eleições intermediárias | **2/3** (2 senadores por estado) |

Mandato de **8 anos** — o dobro do de um deputado, e o mais longo do sistema político
brasileiro.

⚠️ **Consequência para o dado:** o Senado de hoje foi eleito em **duas eleições
diferentes** (parte em uma, parte na seguinte). Não existe "a composição da legislatura X"
como existe na Câmara. Quando for cruzar com o TSE, um senador em exercício pode ter sido
eleito 6 anos antes do outro — **você precisa buscar em mais de um ano eleitoral.**

### 2.1 Os suplentes

Cada senador se elege com **dois suplentes**, escolhidos por ele e registrados na chapa.
O eleitor quase nunca sabe quem são.

Isso é objeto de crítica recorrente: os suplentes costumam ser financiadores de campanha,
sócios ou parentes, e assumem sem nunca terem recebido um voto próprio. Quando um senador
vira ministro, o suplente assume — e vota.

→ *No dado:* medimos **84 senadores distintos votando em 2025** para 81 cadeiras. Mesma
lógica dos 552 deputados. A regra da seção 6.1 do discovery (partido/UF desnormalizados na
linha do voto) vale igual aqui.

⚠️ Detalhe jurídico relevante: como o cargo é **majoritário**, o mandato pertence **à
pessoa**, não ao partido. Um senador pode trocar de partido **sem risco de perder o
mandato** — ao contrário do deputado. Espere **mais troca de sigla**, proporcionalmente,
no Senado.

---

## 3. Os poderes que só o Senado tem

Aqui está a diferença real entre as casas. O art. 52 da Constituição dá ao Senado
competências **privativas** — a Câmara não participa:

| Competência | O que significa na prática |
|---|---|
| **Julgar o impeachment** | A Câmara *autoriza* (2/3); quem *julga e condena* é o Senado (2/3 = 54 votos). Vale para Presidente, Vice, ministros do STF, PGR |
| **Aprovar autoridades** | Ministros do STF e tribunais superiores, presidente e diretores do **Banco Central**, PGR, embaixadores, parte dos ministros do TCU |
| **Autorizar dívida externa** | Operações financeiras externas da União, estados e municípios |
| **Fixar limites de endividamento** | Teto global da dívida pública |
| **Suspender lei inconstitucional** | Art. 52, X — dar efeito geral a decisão do STF |

### 3.1 A sabatina

Antes de aprovar uma autoridade, o Senado faz uma **sabatina**: o indicado é arguido em
comissão e depois votado em plenário.

- Ministro do STF → sabatina na **CCJ**
- Presidente/diretor do Banco Central → **CAE**
- Embaixador → **CRE**

⚠️ **Importante para o projeto:** essas votações são **nominais e altamente
significativas** politicamente — mas **não são sobre políticas públicas**. São sobre
pessoas. Se entrarem no questionário de afinidade sem tratamento, geram perguntas do tipo
*"você aprova o nome de Fulano para o STF?"*, que não medem posição ideológica do cidadão.

→ *Recomendação:* tratar como uma **categoria própria** (`AUTORIDADE`) no campo
`categoria` da tabela `votacao`, junto com `PROCEDIMENTAL`, `DESTAQUE` e `SUBSTANTIVA`.
Excluir do questionário, **manter** na matriz de similaridade (revelam alinhamento com o
governo com muita clareza).

---

## 4. Quem manda no Senado

### 4.1 O Presidente do Senado

Acumula **dois cargos**:

1. Presidente do Senado Federal;
2. **Presidente do Congresso Nacional** — ou seja, comanda também as sessões conjuntas.

Poderes concretos:

- define a pauta do Senado **e** do Congresso;
- **decide quando pautar a análise de vetos presidenciais** — poder enorme, porque um veto
  não pautado simplesmente permanece;
- é o **terceiro na linha de sucessão presidencial** (Vice → Presidente da Câmara →
  Presidente do Senado → Presidente do STF);
- recebe e despacha pedidos de impeachment de ministros do STF.

Mandato da Mesa: **2 anos**, com a mesma vedação de recondução imediata na mesma
legislatura.

### 4.2 Lideranças

Mesma lógica da Câmara: líderes partidários, líder do governo, líder da minoria, e
negociação no colégio de líderes. Como a casa tem 81 pessoas em vez de 513, a negociação é
**mais pessoal e menos coreografada** — e a disciplina partidária tende a ser **mais
fraca**, porque cada senador tem peso individual muito maior.

→ *Previsão testável para o TCC:* espere encontrar, no Senado, **comunidades menos
nítidas** e **menor correlação entre partido e voto** do que na Câmara. Se a modularidade
da partição partidária for menor no Senado, isso não é ruído — é o efeito do desenho
institucional. Bom resultado para a seção de discussão.

---

## 5. As comissões do Senado

São **16 comissões permanentes** (lista obtida da API do Senado):

| Sigla | Comissão |
|---|---|
| **CCJ** | Constituição, Justiça e Cidadania |
| **CAE** | Assuntos Econômicos |
| CAS | Assuntos Sociais |
| CE | Educação e Cultura |
| CRE | Relações Exteriores e Defesa Nacional |
| CI | Serviços de Infraestrutura |
| CRA | Agricultura e Reforma Agrária |
| CMA | Meio Ambiente |
| CDH | Direitos Humanos e Legislação Participativa |
| CDR | Desenvolvimento Regional e Turismo |
| CCT | Ciência, Tecnologia, Inovação e Informática |
| CTFC | Transparência, Governança, Fiscalização e Controle e Defesa do Consumidor |
| CSP | Segurança Pública |
| CDD | Defesa da Democracia |
| CCDD | Comunicação e Direito Digital |
| CEsp | Esporte |

**CCJ** e **CAE** são as equivalentes da CCJC e da CFT da Câmara — os dois grandes filtros.

### 5.1 Poder terminativo

Equivalente ao "conclusivo" da Câmara: uma comissão do Senado pode decidir **em caráter
terminativo**, sem passar pelo plenário.

→ *Mesma consequência:* nem toda decisão do Senado aparece em votação de plenário.

---

## 6. O Congresso Nacional — a terceira arena

Esta é a parte que mais confunde. **"Congresso Nacional" não é sinônimo de "Câmara +
Senado somados".** É uma **instância deliberativa própria**, com sessões próprias,
presidida pelo Presidente do Senado.

### 6.1 O que se decide em sessão conjunta

| Matéria | Como funciona |
|---|---|
| **Vetos presidenciais** | Sessão conjunta; **a votação é secreta ou aberta conforme a regra vigente**, e os votos são **contados separadamente por casa** — precisa de maioria absoluta em cada uma |
| **Orçamento** (PPA, LDO, LOA) | Tramita na **CMO — Comissão Mista de Orçamento**, e é votado em sessão conjunta |
| **Medidas Provisórias** | Passam por uma **comissão mista**, depois vão à Câmara e ao Senado **separadamente** |
| **Decretos legislativos** de competência do CN | Estado de sítio, estado de defesa, intervenção federal |

### 6.2 ⚠️ Por que isso não resolve o achado #7 do discovery

Seria natural pensar: *"as sessões conjuntas são a ponte entre as duas casas, então dá para
comparar deputados e senadores por ali."*

**Os dados disponíveis não permitem isso.** Verificamos:

- No CSV de votações da Câmara de 2025, o campo `siglaOrgao` **não tem nenhuma ocorrência
  de `CN`**.
- No `/votacao` do Senado em 2025, `casaSessao` é **`SF` em 100%** das 128 votações.

Ou seja: as duas APIs expõem **apenas as votações da própria casa**. As sessões do
Congresso Nacional não aparecem em nenhuma das duas.

E mesmo que aparecessem, há um problema conceitual: **na apreciação de veto os votos são
apurados por casa separadamente** — deputados e senadores não formam um colégio único. A
ponte é menos sólida do que parece à primeira vista.

→ **Conclusão que sustenta a decisão D3:** dois grafos, duas análises, comparação entre
elas. Não prometa "a rede do Congresso Nacional".

---

## 7. Quóruns do Senado

| Situação | Quórum (de 81) |
|---|---|
| Aprovar PL ordinário | maioria simples dos presentes |
| Aprovar PLP | **41** (maioria absoluta) |
| Aprovar PEC | **49** (3/5), em **dois turnos** |
| **Condenar em impeachment** | **54** (2/3) |
| Aprovar autoridade (sabatina) | maioria simples — **absoluta** para alguns cargos |
| Derrubar veto | maioria absoluta (41), em sessão conjunta, contado à parte |

Mesmo alerta da Câmara: **PEC tem dois turnos**, então a mesma matéria aparece duas vezes
com resultados quase idênticos. Deduplicar ou reportar o efeito.

---

## 8. Como o Senado difere da Câmara — tabela de referência

| Dimensão | Câmara | Senado |
|---|---|---|
| Representa | População | Estados |
| Membros | 513 | 81 |
| Mandato | 4 anos | 8 anos |
| Eleição | Proporcional, lista aberta | Majoritária simples |
| Renovação | Integral a cada 4 anos | 1/3 e 2/3, alternadamente |
| Suplência | Lista do partido | 2 suplentes nominais na chapa |
| Mandato pertence a | **Ao partido** | **À pessoa** |
| Comissões permanentes | 30 | 16 |
| Decisão sem plenário | "Conclusivo" | "Terminativo" |
| Poderes exclusivos | Autorizar impeachment; iniciar PLs do Executivo e de iniciativa popular | Julgar impeachment; aprovar autoridades; dívida externa |
| Presidente preside também | — | **O Congresso Nacional** |
| Sucessão presidencial | 2º | 3º |
| Votações nominais (2025) | **526** | **128** |
| Disciplina partidária | Mais alta | Mais baixa (esperado) |

---

## 9. O que muda no dado do Senado

Resumo prático — detalhes em [11-api-senado.md](11-api-senado.md):

| Aspecto | Situação |
|---|---|
| Formato | JSON **com envelope herdado de XML** (`ListaVotacoes.Votacoes.Votacao[]`) — desserialização mais chata |
| Volume | 128 votações nominais e ~10.400 votos em 2025 — o ano inteiro cabe em **uma chamada** de 2,4 MB |
| Riqueza | O registro de voto **já traz `ementa` e `identificacao` ("PLP 22/2025")** — melhor que a Câmara, que exige join |
| **CPF** | ⛔ **Não é exposto.** O detalhe do senador traz `NomeCompletoParlamentar`, `DataNascimento`, `Naturalidade`, `UfNaturalidade` — a conciliação com o TSE é por *fuzzy match* |
| Endpoint depreciado | `/plenario/lista/votacao/{AAAAMMDD}` foi desativado. Usar `/votacao` |
| Identificador | `CodigoParlamentar` (ex.: 5672) — estável, mas há também `CodigoPublicoNaLegAtual`, que **não** é o mesmo |

⚠️ **A ausência de CPF é o principal atrito de integração do projeto.** Mas com apenas 81
senadores, conciliar à mão é perfeitamente viável — e é honesto documentar isso como
método no TCC.

---

## 10. Glossário — o que muda de nome entre as casas

| Câmara | Senado | Significado |
|---|---|---|
| Conclusivo | **Terminativo** | Comissão decide sem plenário |
| CCJC | **CCJ** | Comissão de Constituição e Justiça |
| CFT | **CAE** (aproximadamente) | Filtro econômico-financeiro |
| Deputado | Senador | — |
| Mesa Diretora | Mesa do Senado Federal | Órgão administrativo |
| Bancada | Bancada / Representação | Conjunto de parlamentares de um partido |

Termos exclusivos do Senado:

| Termo | Significado |
|---|---|
| **Sabatina** | Arguição pública de autoridade indicada, antes da votação |
| **Casa revisora** | Papel do Senado quando o projeto nasceu na Câmara |
| **CMO** | Comissão Mista de Orçamento — colegiado conjunto que analisa PPA, LDO e LOA |
| **Sessão conjunta** | Reunião das duas casas sob presidência do Presidente do Senado |
