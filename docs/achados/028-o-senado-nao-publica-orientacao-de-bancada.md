# Achado 28 — o Senado não publica orientação de bancada

**Medido em 2026-08-28**, contra a API de dados abertos do Senado Federal.

---

## O que se procurava

Depois de ingerir `votacoesOrientacoes` da Câmara e preencher `governismo` e
`disciplina` ([achado #26](026-a-comunidade-nao-e-partido-nem-bloco.md)), a pergunta
natural é se o mesmo cabe no Senado. Sem orientação de bancada, ⛔ não há como medir
alinhamento — e o layout `Alinhamento` do grafo ⛔ não teria coordenada.

## O que a fonte oferece

| Verificação | Resultado |
|---|---|
| Campo de orientação no objeto de votação | **nenhum** — 24 campos, nenhum de bancada |
| Campo de bancada no voto individual | **nenhum** — 7 campos, todos sobre o parlamentar |
| `GET /votacao/orientacao` | **404** |
| `GET /orientacao` | **404** |
| `GET /plenario/orientacao/{ano}` | **404** |
| `GET /composicao/liderancas` | **404** |

⚠️ **⛔ Não é auditoria exaustiva da API.** Foram inspecionados o payload de `/votacao` e
sondados os caminhos acima. A página de documentação veio sem conteúdo — é renderizada
por JavaScript —, então a ausência de menção a "orientação" ali ⛔ não vale como
evidência.

## O caminho que existe, e por que ⛔ não fecha

`GET /composicao/lideranca` responde 200 e traz, entre 35 registros do Senado, um de
**"Liderança do Governo no Senado Federal"**. Hoje é a senadora **Teresa Leitão (PT)**.

A ideia seria usar o voto dela como proxy da posição do Governo. Medido:

| | |
|---|---:|
| Votações abertas do Senado na 57ª | 182 |
| Em que a Líder se posicionou | 147 (81%) |
| 🔴 **Ocorridas antes de ela assumir a liderança** | **174 (96%)** |

A designação é de **26/06/2026** e a legislatura começou em **2023**. O endpoint devolve
a liderança **atual**, ⛔ sem histórico — e 96% das votações aconteceram sob outra
liderança.

⛔ **Aplicar o voto dela ao período anterior atribuiria ao Governo a posição de quem ⛔
não o representava.** É pior que ⛔ não ter o dado: produziria um número plausível e
errado, que é o modo de falha que este projeto persegue.

## A objeção de método, que vale mesmo com histórico completo

| | Câmara | Senado (proxy) |
|---|---|---|
| A posição do Governo é | **publicada**, por votação | **inferida** do voto de uma pessoa |

Um líder se ausenta, e vota por cálculo regimental — `Obstrução` é exatamente isso, e na
Câmara ela aparece rotulada como tal. Chamar o voto individual de "orientação do
Governo" seria apresentar construção nossa como dado da fonte.

⭐ É a mesma regra que impediu classificar partido como governista em vez de derivar o
rótulo do dado ([#26](026-a-comunidade-nao-e-partido-nem-bloco.md)).

## Consequências

- `nos_metrica.governismo` e `.disciplina` ficam **nulas** no Senado, de propósito.
- O layout **Alinhamento** ⛔ não é oferecido lá; sobra o de molas, e o seletor inteiro
  some — um botão que ⛔ não escolhe nada é pior que nenhum.
- O eixo do grafo do Senado continua **sem nome**, e a tela diz isso.

## O padrão que este achado confirma

O Senado publica **menos** que a Câmara, e sempre no mesmo sentido — menos sobre o
comportamento individual:

| | Câmara | Senado |
|---|---|---|
| Votações secretas | **0** de 1.594 | **239** de 421 ([#17](017-senado-maioria-secreta.md)) |
| Orientação de bancada | publicada | ⛔ **não existe** |
| CPF do parlamentar | via API, um a um | ⛔ **não publica** ([#24](024-codigo-da-emenda-identifica-o-mandato.md)) |

⚠️ **Isto é limitação da fonte, ⛔ não do método**, e precisa estar dito assim no texto
do TCC. Toda comparação entre as duas casas carrega essa assimetria — e apresentá-las
lado a lado sem a ressalva sugeriria que a diferença é de comportamento parlamentar,
quando é de transparência.
