# Achado 29 — o sobrenome casa com o nome da instituição

**Medido em 2026-08-29**, na primeira execução real do coletor de notícias.

---

## O que se mediu

A [RF-40](../03-requisitos.md) fixa **0,70** como confiança mínima para exibir a
associação entre notícia e parlamentar, e o `noticias.py` atribui **0,40** ao casamento
por sobrenome — deliberadamente abaixo do limiar. O número era **argumentado**, ⛔ não
medido: *"'Silva' casaria com dezenas"*.

A primeira coleta real permite medir.

| Fonte | Notícias |
|---|---:|
| Agência Câmara | 20 |
| Agência Senado | 15 |
| Agência Brasil | 10 |
| **Total** | **45** |

## O resultado

| Método | Menções | Exibíveis |
|---|---:|---:|
| `NOME_COMPLETO` (1,00) | 9 | 9 |
| `NOME_PARLAMENTAR` (0,85) | 7 | 7 |
| 🔴 `SOBRENOME` (0,40) | **94** | **0** |

🔴 **85% de todas as menções vêm do método mais fraco**, e o limiar as barra por inteiro.

## 🔴 Por que o sobrenome falha, e ⛔ não é o motivo que se supunha

O argumento original era **homonímia**: muitos parlamentares compartilham "Silva". O que
o dado mostra é **pior e mais sistemático**:

| Parlamentar | Menções | O que casou |
|---|---:|---|
| 🔴 **Silas Câmara** | **14** | a palavra **"Câmara"** — em manchete da **Agência Câmara** |
| 🔴 **Marco Brasil** | **4** | a palavra **"Brasil"** — em manchete da **Agência Brasil** |
| Helio Lopes · Julio Lopes · Cristiane Lopes | 3 cada | o mesmo "Lopes", na mesma matéria |
| Amália Barros · Ricardo Barros · Filipe Barros | 3 cada | o mesmo "Barros", na mesma matéria |

⭐ **O sobrenome de um parlamentar é o nome da instituição que a notícia cobre.** ⛔ Não
há corpus de notícia política em que "Câmara" ⛔ não apareça — o casamento acerta a
palavra e erra a pessoa **em toda matéria publicada**, para sempre.

⚠️ **52 pessoas distintas** produziram as 94 menções. Sobrenome comum ⛔ não associa a
pessoa errada: associa **várias pessoas de uma vez** à mesma matéria, o que ⛔ não é
ambiguidade a resolver, é ruído a descartar.

## O que isto decide

| | |
|---|---|
| ⭐ **O limiar de 0,70 fica** | Ele barrou 94 de 94, ⛔ sem barrar nenhuma boa |
| ⭐ **O peso 0,40 fica** | Está longe o bastante do limiar para ⛔ nunca exibir |
| 🔴 **A gravação continua guardando o que ⛔ não exibe** | É o que permitiu esta medição |

🔴 **Se o coletor tivesse filtrado na gravação, este achado ⛔ não existiria.** A tabela
teria 16 linhas corretas e nenhuma evidência de que o limiar está no lugar certo — e a
banca ⛔ não teria como conferir a afirmação.

⚠️ **⛔ Não vale eliminar o método `SOBRENOME`.** Ele custa nada, ⛔ não vai à tela, e é
a única forma de continuar medindo se o limiar segue calibrado quando a base de nomes
mudar na próxima legislatura.

## A cobertura real, que é o número desconfortável

📐 **12 das 45 notícias** têm ao menos uma associação exibível — **27%**.

⚠️ As outras 33 ⛔ não são falha do casamento: são matérias que ⛔ não citam parlamentar
nenhum pelo nome (*"Comissão aprova MP que destina crédito…"*). ⭐ O feed cobre a
atividade legislativa, ⛔ não as pessoas.

🔴 **Isto tem consequência de produto:** o feed de notícias de quem a pessoa segue vai
ser **esparso**, e a tela precisa dizer isso em vez de parecer quebrada. Ver
[RF-38](../03-requisitos.md).
