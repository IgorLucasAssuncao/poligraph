# Achados — o que foi medido

> **Tipo:** índice · **Atualizado em:** 2026-08-28
>
> ⭐ **Um achado é uma medição datada.** Ele nunca muda: remedir gera achado **novo**, ou
> uma revisão explícita dentro do mesmo arquivo. É por isso que ele vive separado do
> plano e da referência, que precisam estar sempre atuais.

---

## Como usar

🔴 **Cada arquivo aqui é a fonte canônica do seu achado.** Outros documentos **linkam**,
⛔ nunca repetem o número.

> ⚠️ **Por que essa regra existe:** o mínimo de 20 votações em comum estava escrito em
> **cinco arquivos**. Mudar exigiria mudar em cinco — e um ficaria para trás. Número
> repetido é número que diverge.

**Para citar na parte teórica:** o arquivo traz o que foi medido, como, quando e o
resultado. É a unidade que a fundamentação e a metodologia referenciam.

📐 **Os valores estatísticos** — o que significa `r`, ARI, modularidade — estão em
[`../metodos.md`](../metodos.md), não aqui. Achado é *o que se descobriu*; método é *como
se mede*.

---

## Os 28 achados

### 🔴 Estruturantes — mudaram a arquitetura

| # | Achado | Por que pesa |
|---|---|---|
| [**#7**](007-casas-nao-sao-comparaveis.md) | As duas casas **não são comparáveis** entre si | ⛔ Não existe grafo único Câmara + Senado |
| [**#12**](012-polaridade-nao-e-constante.md) | 🔴 A polaridade de "Sim" **não é constante** | Em 14% das votações, "Sim" significa rejeitar. **O achado mais perigoso** |
| [**#1**](001-votacoes-simbolicas.md) | A maioria das votações **não tem voto nominal** | Todo o dimensionamento parte daqui |
| [**#11**](011-maioria-e-procedimental.md) | 58% das nominais são **procedimentais** | Gera duas regras **opostas**: filtrar no questionário, não filtrar na matriz |
| [**#15**](015-comissao-nao-serve-de-reserva.md) | Comissão **não serve de reserva** | ⚠️ Corrige afirmação anterior do próprio discovery |

### 📊 Sobre o dado da Câmara

| # | Achado | |
|---|---|---|
| [#3](003-id-de-votacao-e-string.md) | O id de votação é **string composta** | `varchar`, não `bigint` |
| [#6](006-csv-consolidado-por-ano.md) | Existem **CSVs anuais** | ⭐ Elimina o N+1 |
| [#8](008-uriproposicaocitada-e-armadilha.md) | `uriProposicaoCitada` é **armadilha** | Leva ao parecer, não ao projeto |
| [#9](009-prefixo-do-id-e-a-proposicao.md) | O **prefixo do id** é a proposição | 30/30 resolveram |
| [#10](010-classificacao-tematica-oficial.md) | Existe **classificação temática oficial** | ⛔ Ainda não usada |
| [#14](014-comissao-tambem-vota-simbolico.md) | O ponto cego **se repete na comissão** | |
| [#19](019-csv-reconstruido-toda-madrugada.md) | Os CSVs são **reconstruídos toda noite** | ⭐ Por isso `ON CONFLICT DO UPDATE` |
| [#20](020-endpoint-devolve-duplicatas.md) | O endpoint devolve **duplicatas** | Deduplicar por `id_externo` |
| [#2](002-votos-nao-aceita-paginacao.md) | `/votos` **não pagina** | Perdeu relevância com o #6 |
| [#22](022-deputados-nao-e-arquivo-anual.md) | `deputados` **não é arquivo anual** | ⭐ Achado da implementação |

### 🏛️ Sobre o Senado e as pontes

| # | Achado | |
|---|---|---|
| [#4](004-endpoint-do-senado-depreciado.md) | Endpoint de plenário **depreciado** | ✅ Já migrado |
| [#17](017-senado-maioria-secreta.md) | **56% secretas** no Senado | Custo é precisão, não viabilidade |
| [#18](018-ponte-temporal-entre-as-casas.md) | 41 dos 81 senadores **foram deputados** | Ponte **temporal**, não sincrônica |
| [#21](021-cpmi-nao-publica-votacao.md) | A CPMI **não publica** votação | ⏳ **Reverificar antes da conclusão** |

### 🔗 Sobre outras fontes e sinais

| # | Achado | |
|---|---|---|
| [#5](005-tse-bloqueia-acesso-automatizado.md) | TSE bloqueia acesso automatizado | ⚠️ **Revisado** — é automatizável |
| [#13](013-frente-parlamentar-nao-serve.md) | Frente parlamentar **não discrimina** | Assinar é barato |
| [#16](016-relatoria-e-o-melhor-sinal.md) | **Relatoria** é o melhor sinal não-voto | ⛔ Não implementado |

### 💰 Sobre o dinheiro do mandato

⭐ **Os dois vieram da implementação, ⛔ não do discovery** — só apareceram ao rodar a
ingestão contra a fonte real.

| # | Achado | |
|---|---|---|
| [**#23**](023-consolidado-do-tse-e-o-unico-com-df.md) | 🔴 No TSE, o consolidado é o **único arquivo com o DF** | E ele duplica os estaduais. Ler só os estaduais perdia **R$ 17,2 mi** em silêncio |
| [**#24**](024-codigo-da-emenda-identifica-o-mandato.md) | O `codigoEmenda` embute um id estável de **mandato** | 173/173 estáveis, **zero colisões** — e serve ao Senado, que não publica CPF |

### 🔬 Sobre o método

| # | Achado | |
|---|---|---|
| [**#25**](025-a-metrica-nao-e-onde-mora-a-qualidade.md) | 🔴 A **métrica de afinidade não é onde mora a qualidade** | Concordância, cosseno e Pearson dão o mesmo ranking (ρ ≥ 0,996). O que discrimina é a **escolha das perguntas** |
| [**#26**](026-a-comunidade-nao-e-partido-nem-bloco.md) | 🔴 A comunidade **não é o partido nem o bloco governista** | ARI 0,272 contra partido e 0,268 contra governo/oposição — e os dois rótulos quase não se sobrepõem entre si (0,058) |
| [**#27**](027-a-borda-do-grafo-e-falta-de-dado.md) | 🔴 A **borda do desenho é falta de dado**, e o centro é a maioria | Os 10 da borda têm **zero ligações** e 20 votações; o centro tem governismo 81,8% contra 80,7% da Câmara inteira |
| [**#28**](028-o-senado-nao-publica-orientacao-de-bancada.md) | ⛔ O **Senado não publica orientação de bancada** | O único proxy possível — o voto do Líder do Governo — ⛔ não serve: 96% das votações são anteriores à designação dele |
| [**#29**](029-o-sobrenome-casa-com-a-instituicao.md) | 🔴 O **sobrenome casa com o nome da instituição** | 94 de 110 menções vieram do método mais fraco e o limiar barrou todas. "Silas **Câmara**" casou 14 vezes com manchete da Agência **Câmara**; "Marco **Brasil**", 4 vezes com a Agência **Brasil** |
| [**#30**](030-o-destaque-carrega-o-grafo.md) | ⭐ O **peso do destaque quase não importa**, mas incluí-lo importa muito | Entre 0,3 e 1,0 a vizinhança muda 6% a 17%; com peso **zero** sobram **2 dos 10** vizinhos. Na matriz há **422 destaques contra 141 substantivas** |
| [**#31**](031-a-pec-estava-escondida-como-destaque.md) | 🔴 A **PEC estava escondida como destaque** | "Proposta de **Emenda** à Constituição" casava com o padrão de destaque: **73 votações de PEC** com peso 0,7 e fora da curadoria. O universo do Senado **dobrou**, de 52 para 104 |

---

## ⏳ Achados com prazo de validade

Dependem de fato externo que pode mudar. Estão em
[`../REVISAR-ANTES-DA-CONCLUSAO.md`](../REVISAR-ANTES-DA-CONCLUSAO.md):

| # | O que reverificar |
|---|---|
| [#21](021-cpmi-nao-publica-votacao.md) | A CPMI passou a publicar votação nominal? Mudaria o #7 |
| [#5](005-tse-bloqueia-acesso-automatizado.md) | Já revisado uma vez — o TSE mudou de novo? |

---

## ⚠️ Dois achados que se corrigem

⭐ **Vale ler juntos, porque mostram o método funcionando:**

- [**#15**](015-comissao-nao-serve-de-reserva.md) desmente uma afirmação anterior do
  discovery sobre comissões servirem de reserva
- [**#5**](005-tse-bloqueia-acesso-automatizado.md) foi revisado quando uma segunda
  medição contradisse a primeira
- [**#27**](027-a-borda-do-grafo-e-falta-de-dado.md) corrige uma afirmação **da própria
  interface**: ela dizia que quem faltou a muitas votações cai no centro do desenho, e a
  medição mostrou que cai na **borda**. A conclusão estava certa pelo motivo errado —
  que sobrevive até alguém verificar

> 🔴 **A regra metodológica do projeto nasceu disto:** *medir um ano e generalizar foi a
> origem de quase todos os erros cometidos aqui.* Antes de afirmar um número, meça — e
> diga sobre qual período.
