---
name: design-visual
description: Direção visual do poligraph — paleta, tipografia, o elemento-assinatura e o que NÃO fazer. Use ao criar ou alterar qualquer tela, componente de interface ou CSS.
---

# Design visual — poligraph

> **Adaptada de `frontend-design` (Anthropic, ver LICENSE.txt).** A original é genérica:
> pede que você invente uma direção do zero a cada página. Aqui a direção **já foi
> escolhida** e está fixada abaixo — o trabalho é executá-la com precisão, não
> reabri-la. Reabra só quando o autor pedir.

O princípio que sobrevive da original: **um design que poderia ser de qualquer produto
não é design, é template.** Aja como o diretor de arte de um estúdio que dá identidade
própria a cada cliente.

---

> 🔴 **Direção reaberta pelo autor em 2026-09-24: institucional.** O pedido foi passar
> autoridade e deixar de parecer "brincadeira com os dados", sem perder o público geral.
> O que mudou está marcado **(2026-09)** nas seções abaixo. O painel continua sendo a
> assinatura.

## 1. O briefing

| | |
|---|---|
| **Assunto** | O registro nominal de votação da Câmara dos Deputados |
| **Público** | Cidadão brasileiro comum — e a banca do TCC |
| **Trabalho da tela** | Levar a pessoa até o fim do questionário e fazer o resultado parecer confiável |
| **Modelo de interação** | Linha do tempo com coluna de apoio — **decisão do autor**, não reabrir |

⚠️ A linha do tempo veio de pedido do autor e fica. A **moldura**, não: o trilho lateral
esquerdo com `max-width` centralizado é a assinatura de layout do Twitter, e a calha
morta nas laterais faz parte dela — o autor apontou as duas coisas de uma vez.

🔴 **A moldura é de serviço público, e ocupa a tela inteira:** faixa de procedência,
cabeçalho de largura total com navegação horizontal, corpo, rodapé em colunas.

**(2026-09)** A faixa voltou depois de ter saído por ocupar espaço fixo. Ela **rola com a
página**; só o cabeçalho gruda. Tem tokens próprios (`--faixa-fundo`, `--faixa-texto`):
pintada com `--texto`, ela inverte no tema escuro. A faixa
não é enfeite — a credibilidade deste trabalho depende de o visitante saber que o número
vem do registro nominal da Câmara, não de opinião nossa.

---

## 2. A assinatura: o painel

O único elemento pelo qual o site deve ser lembrado.

Toda votação nominal da Câmara vira um **painel**: a lista de quem se posicionou. É o
artefato do assunto — nenhum outro produto teria motivo para desenhá-lo.

No questionário, entre uma pergunta e a seguinte, o painel aparece como uma fileira de
traços: **traço cheio = deputado que se posicionou; traço vazado = ausente.**

🔴 **⛔ O painel NUNCA mostra direção.** Nada de "cheio = Sim, vazado = Não". Revelar a
divisão antes das próximas perguntas induz conformidade e o instrumento passa a medir
adesão à maioria (ver `PerguntaPublica` na API e `Questionario.tsx`).

⭐ Repare que a assinatura **nasce da restrição**: é justamente por não poder mostrar
direção que sobra o comparecimento — e comparecimento tem forma visual própria. Design
bom sai da limitação, não apesar dela.

---

## 3. Paleta

```
--tinta        #12161B   texto — quase-preto frio
--papel        #FFFFFF   fundo
--painel       #F3F5F7   superfície (cartões laterais, campos)
--linha        #DDE2E7   réguas e bordas
--instrumento  #0F766E   realce — teal profundo
--atencao      #A8321F   só destrutivo (apagar conta)
```

🔴 **A cor não pode sugerir espectro político (RNF-16).** Por isso:

- **Um único** tom de realce, usado em navegação e ação — nunca para qualificar
  parlamentar, partido ou voto.
- **Teal**, e não azul nem vermelho nem verde-amarelo: nenhum partido brasileiro o
  reivindica, e ele lê como instrumento de medição, não como bandeira.
- Selo de voto é **neutro**: "Sim" e "Não" se distinguem por borda e traço, ⛔ nunca por
  verde e vermelho — que seriam lidos como acerto e erro.
- Avatar tira a cor de um hash do nome, em `hsl(matiz 22% 38%)` **(2026-09: era 45%,
  e o branco das iniciais ficava em 3,49:1 no pior matiz)**: saturação baixa
  garante que nenhum parlamentar caia num tom partidário por acaso.

---

## 4. Tipografia **(2026-09)**

Dois papéis:

| Papel | Fonte | Onde |
|---|---|---|
| **Texto e títulos** | Public Sans (variável, `@fontsource-variable/public-sans`) | Tudo |
| **Dado** | IBM Plex Mono | Números, selo de voto, painel, placar |

⭐ A Public Sans foi desenhada para o sistema de design do governo americano: tem desenho
institucional sem ser a fonte padrão de IA (Inter), e não copia a identidade do gov.br.
A Archivo expandida saiu na mudança de direção.

**Escala fechada, seis passos.** Havia 40 tamanhos soltos. Nenhum `font-size` novo usa
número: todos usam a escala.

| Token | Tamanho | Uso |
|---|---:|---|
| `--t-1` | 13px | Rótulo, legenda, faixa de procedência |
| `--t-2` | 15px | Texto secundário, botões |
| `--t-3` | 16px | Texto corrido |
| `--t-4` | 20px | Título de seção |
| `--t-5` | 26px | Título de página, nome em destaque |
| `--t-6` | 34px | Número em destaque ("13 de 13") |

**Dois raios: 0 e `--raio` (3px).** Cápsula (`999px`) e círculo eram a marca de rede
social. O único `50%` que restou é o marcador de lista do documento legal.

⚠️ **Mono para número não é enfeite.** Todo número deste produto vem com a base junto
("4 de 5", "12 deputados"). Algarismo tabular alinha coluna a coluna e faz o número
parecer medido em vez de afirmado.

🔴 **Fontes auto-hospedadas via `@fontsource`, ⛔ nunca do CDN do Google.** O CDN entrega
o IP de todo visitante ao Google em toda visita — o que contradiz frontalmente a
postura de privacidade que o resto do projeto sustenta (LGPD, banner de consentimento,
direito de eliminação).

---

## 5. Movimento

Curvas e durações do Material Design 3. ⚠️ **Não são gosto:** `emphasized` acelera
devagar e freia forte, que é como objeto físico se move — o olho lê como natural.
Linear lê como máquina.

| Token | Valor | Onde |
|---|---|---|
| `--t-toque` | 90ms | Resposta ao clique. Acima de ~100ms vira animação e atrasa a próxima ação; abaixo de 60ms o olho não registra |
| `--t-curto` | 160ms | Hover, cor, borda |
| `--t-medio` | 260ms | Troca de tela |
| `--t-longo` | 380ms | Pergunta a pergunta |

⚠️ **Acima de ~400ms deixa de ser suavidade e vira espera.**

### Tela a tela

View Transitions API, via `viewTransition` do React Router. ⭐ **O truque é nomear a
moldura:** elemento com `view-transition-name` é retratado à parte e, se não mudou, fica
**parado**. Faixa, cabeçalho, lateral e rodapé têm nome — por isso só a coluna central
atravessa. Sem isso o cabeçalho pisca a cada clique, que é o defeito que a transição
deveria resolver.

### Pergunta a pergunta

**Direcional:** a respondida sai pela esquerda, a próxima entra pela direita. Direção é o
que transforma um piscar em progresso. ⚠️ Keyframe local só anima quem chega — sem a
saída da anterior a troca lê como pisca-pisca. Por isso passa por `comTransicao()`.

🔴 **`prefers-reduced-motion` é respeitado no JS, não só no CSS** (`transicao.ts`).
Zerar a animação no CSS ainda deixaria a View Transition rodar e bloquear a interação
durante o retrato do DOM.

⚠️ **Menos movimento ⛔ não é "nenhuma mudança visual":** sumir sem transição confunde
tanto quanto deslizar demais. Sai o deslocamento, fica a fusão curta.

---

### Tour guiado **(2026-09)**

`componentes/Tour.tsx`, sobre `<dialog>` nativo (foco preso, Esc, papel de diálogo), sem
biblioteca: as quatro mais usadas falharam em auditoria de acessibilidade.

🔴 **(2026-10-22, decisão do autor) Nenhum tour se oferece sozinho.** A ajuda mora num lugar
só: o "?" do cabeçalho, ao lado da auditoria (`componentes/Ajuda.tsx`). Na tela com tour, ele
abre um menu com "como ler esta tela" e "como o site funciona"; nas outras, abre o do site. A
exceção é o tour da auditoria, que abre na primeira vez que ela é ligada.

| Movimento | Token |
|---|---|
| Véu entra e sai | `--t-medio` |
| Destaque desliza de um alvo ao próximo | `--t-longo`, `--curva` |
| Balão some / aparece | `--t-toque` na saída, `--t-medio` na entrada |
| Rolagem da página | sem animação — animar deixaria o destaque atrasado |

Marque o alvo com `data-tour="<nome>"` e acrescente o passo em `tour.ts`. Passo cujo
alvo não aparece é pulado.

**Um tour por tela, além do do site:** `grafo`, `ficha`, `questionario`, `resultado`,
`emendas`, `governo`. A tela monta `<TourDaTelaComponent nome passos>`, que só anuncia o tour
ao provedor, sem desenhar nada. Regras:

- ⭐ O do site fica curto (onde cada coisa está); **como ler** cada tela vai no tour dela.
- 🔴 Número no texto do passo vem do dado: o `k` do grafo chega em `vizinhosPorNo`, da
  tabela `execucoes`. Sem isso, o texto afirmaria um número que o método já não usa.
- ⚠️ Cada página com tour tem um teste que procura todos os alvos dela: um alvo que
  some faz o passo ser pulado sem aviso.

---

### Todo número leva à fonte **(2026-09)**

- Item com fonte oficial (voto, emenda, convênio, nota fiscal, página do parlamentar) usa
  `<LinkDeFonte>`: abre em nova aba, diz isso ao leitor de tela, `noopener noreferrer`.
- 🔴 A URL de item sai da API, de `FontesOficiais` — ⛔ montada no front. A de conjunto de
  dados sai de `fontes.ts`. Os dois só levam endereço aberto e conferido.
- Lista longa ⛔ corta calada: `usePaginas` + `BotaoMostrarMais`, que diz quantos faltam.
- Tabela e lista que alguém levaria para a planilha ganham `BotaoBaixarCsv` — da lista
  INTEIRA, ⛔ da página na tela.

## 6. O chão de qualidade — sem anunciar

- Responsivo até o celular (quebras em 1100px, 860px e 700px)
- **Foco de teclado visível** em tudo que recebe foco
- `prefers-reduced-motion` respeitado
- `prefers-color-scheme: dark` completo — tokens redefinidos, nunca cor solta
- Nada de layout pulando no hover (largura fixa em botão que troca de texto)

---

## 6.1 Os dois temas — medido, não suposto **(2026-09)**

O tema tem **três** estados: botão em claro, botão em escuro, e "Sistema", que não
carimba nada. Toda cor precisa funcionar nos três.

| Regra | Por quê |
|---|---|
| **Cor só por token.** Nenhuma cor com definição apenas dentro do bloco escuro | No estado "Sistema" o bloco `[data-tema]` não vale |
| **Contorno de controle usa `--borda-controle`** (3,61 no claro, 4,24 no escuro) | `--borda` e `--borda-forte` ficam abaixo de 3:1, e campo sem contorno visível não se acha |
| **Canvas pergunta `temaEfetivoEscuro()`**, nunca só `prefers-color-scheme` | O grafo ignorava o botão e desenhava cores claras sobre a página escura |
| **Canvas se inscreve em `aoMudarTema()`** | Sem isso, trocar o tema deixa o desenho com as cores antigas |
| **Paleta de comunidade tem versão escura** (`CORES_ESCURO`) | Índigo, marrom e vinho ficavam entre 2,07 e 2,45 sobre o fundo escuro |
| **Foco é anel de 3px em `--realce`** | 5,47 no claro, 10,63 no escuro. Amarelo sobre branco dava ~1,6 |

📐 Antes de fechar qualquer mudança de cor, meça a razão de contraste nos dois temas:
4,5:1 para texto, 3:1 para contorno de controle e para marca de gráfico.

---

## 7. Os três defaults de IA — não caia neles

Design gerado por IA hoje converge para três aparências. **Todas as três orbitam este
assunto**, o que as torna especialmente tentadoras aqui:

1. Fundo creme (~#F4F1EA) + serifada de alto contraste + acento terracota
2. Fundo quase-preto + um único acento verde-ácido ou vermelhão
3. Diagramação de jornal — fios capilares, raio zero, colunas densas

**(2026-09)** O autor aceitou chegar perto do nº 3 ao pedir o tom institucional. O que
impede virar Diário Oficial é a disciplina acima — escala fechada, número com fonte
dita, painel como assinatura —, não a volta do arredondado.

O nº 3 era o mais perigoso neste projeto: "dados oficiais" puxa para *Diário Oficial*, e o
resultado é um site que parece qualquer portal de transparência. A saída não é a
diagramação, é **o painel** — a assinatura da seção 2.

---

## 8. Texto de interface

Palavra em tela é material de design, não decoração.

- **Vocabulário único.** A RF-42 diz "seguir / deixar de seguir" — então é isso em toda
  parte: botão, menu, título de página, texto de apoio. "Acompanhar" no menu e "Seguir"
  no botão leem como dois recursos diferentes.
- **Voz ativa, e o botão diz o que acontece.** "Apagar minha conta", não "Enviar".
- **Vazio é convite.** "Você ainda não segue ninguém" seguido dos dois caminhos — nunca
  só o aviso.
- **Erro não pede desculpa e não é vago.** Diz o que houve e o que fazer.
- ⛔ **Nunca percentual solto** (RF-29): "concordaram em 4 de 5", porque "80%" esconde
  que a base foram 5 perguntas.
- 🔴 **"Não é recomendação de voto"** aparece na tela de resultado (RNF-14).

---

## 9. Antes de fechar

Chanel: antes de sair de casa, olhe no espelho e tire um acessório.

Gaste a ousadia **num lugar só** — o painel. Tudo em volta fica quieto e disciplinado. Se
um elemento não serve ao briefing, corte.
