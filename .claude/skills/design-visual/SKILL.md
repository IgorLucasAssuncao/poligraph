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
cabeçalho de largura total com navegação horizontal, corpo, rodapé em colunas. A faixa
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
- Avatar tira a cor de um hash do nome, em `hsl(matiz 22% 45%)`: saturação baixa
  garante que nenhum parlamentar caia num tom partidário por acaso.

---

## 4. Tipografia

Três papéis, três escolhas:

| Papel | Fonte | Onde |
|---|---|---|
| **Display** | Archivo (variável, `wdth` 110–118, peso 700) | Título de coluna, texto da pergunta, nome no destaque |
| **Corpo** | IBM Plex Sans | Todo o resto |
| **Dado** | IBM Plex Mono | Números, selo de voto, painel, placar |

⚠️ **Archivo levemente EXPANDIDA**, não condensada. Condensada é o reflexo automático de
todo display; expandida ocupa espaço com calma e lê como placa institucional — que é o
mundo do assunto.

⚠️ **Mono para número não é enfeite.** Todo número deste produto vem com a base junto
("4 de 5", "12 deputados"). Algarismo tabular alinha coluna a coluna e faz o número
parecer medido em vez de afirmado.

🔴 **Fontes auto-hospedadas via `@fontsource`, ⛔ nunca do CDN do Google.** O CDN entrega
o IP de todo visitante ao Google em toda visita — o que contradiz frontalmente a
postura de privacidade que o resto do projeto sustenta (LGPD, banner de consentimento,
direito de eliminação). O login com Google é uma exceção consentida e explicada; fonte
não é.

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

## 6. O chão de qualidade — sem anunciar

- Responsivo até o celular (quebras em 1100px, 860px e 700px)
- **Foco de teclado visível** em tudo que recebe foco
- `prefers-reduced-motion` respeitado
- `prefers-color-scheme: dark` completo — tokens redefinidos, nunca cor solta
- Nada de layout pulando no hover (largura fixa em botão que troca de texto)

---

## 7. Os três defaults de IA — não caia neles

Design gerado por IA hoje converge para três aparências. **Todas as três orbitam este
assunto**, o que as torna especialmente tentadoras aqui:

1. Fundo creme (~#F4F1EA) + serifada de alto contraste + acento terracota
2. Fundo quase-preto + um único acento verde-ácido ou vermelhão
3. Diagramação de jornal — fios capilares, raio zero, colunas densas

O nº 3 é o mais perigoso neste projeto: "dados oficiais" puxa para *Diário Oficial*, e o
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
