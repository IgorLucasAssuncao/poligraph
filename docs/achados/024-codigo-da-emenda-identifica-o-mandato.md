# Achado #24 — o `codigoEmenda` embute um identificador estável de **mandato**

> **Tipo:** achado medido · **Medido em:** 2026-08-27 · **Fonte:** `api-de-dados/emendas`, Portal da Transparência
> **Status:** ✅ Vale
>
> ⚠️ Este arquivo é a **fonte canônica** deste achado. Outros documentos devem
> LINKAR, ⛔ nunca repetir o número — número repetido é número que diverge.

---

## O que foi medido

Se dá para ligar uma emenda ao parlamentar **sem depender do nome**.

## Por que a pergunta importa

O endpoint devolve `nomeAutor` em CAIXA ALTA sem acento (`SOSTENES CAVALCANTE`), e a
Câmara guarda `Sóstenes Cavalcante`. Casar por nome é possível, mas:

| Problema do nome como chave | |
|---|---|
| Homônimo | Dois parlamentares com o mesmo nome de urna ⛔ não são separáveis |
| Grafia muda entre anos | O mesmo autor aparece escrito de formas diferentes |
| 🔴 **O Senado** | O plano cobre as duas casas, e o Senado ⛔ **não publica CPF** |

⭐ **A decisão do autor do projeto foi ir direto ao código**, justamente para ⛔ não
depender de dado que o Senado não tem.

## Resultado

O `codigoEmenda` é a concatenação de três campos:

```
202541840004
 │   │    └── numeroEmenda   (tamanho VARIÁVEL)
 │   └─────── 4184 ← código do autor
 └─────────── ano
```

| Medido em 2025 | |
|---|---|
| Autores com código **estável dentro do ano** | **173 de 173** |
| Códigos com **mais de um** autor | **0** — zero colisões |
| Estáveis entre 2023 e 2025 | **31 de 33** |

### ⭐ E os dois que mudaram viraram senadores

É o que revela **o que o código realmente identifica**: ⛔ não a pessoa, mas o **mandato**.
Por isso ele é estável dentro de um mandato e muda quando a pessoa troca de casa.

> 🔴 É exatamente a propriedade desejada — o código serve à Câmara **e** ao Senado, sem
> depender de CPF.

## ⚠️ O corte usa o `numeroEmenda`, ⛔ nunca posição fixa

```
202541840004  ·  numeroEmenda "0004"  →  código "4184"
2025418412    ·  numeroEmenda "12"    →  código "4184"
```

🔴 Recortar por índice fixo erraria **em silêncio** sempre que o número tivesse outro
tamanho — e o código extraído seria **de outro autor**. O código confere que o
`codigoEmenda` termina com o `numeroEmenda` e devolve `None` se não terminar: se a fonte
mudar de forma, isso vira pendência visível, ⛔ não atribuição errada.

## O desenho que este achado permitiu

**Ingerir tudo primeiro, resolver o vínculo depois.**

| | |
|---|---|
| `emendas.pessoa_id` | **Anulável de propósito** |
| `autores_de_emenda` | `codigo` → `pessoa_id`, com `metodo` ∈ `AUTOMATICO · MANUAL · NAO_RESOLVIDO` |

⭐ **Nada é descartado por não ter dono.** Emenda de comissão, de bancada e de
parlamentar de outra legislatura entra sem vínculo e vira **pendência visível**. Perder o
registro por não saber ligar seria pior: a reconciliação futura ⛔ não teria o que
reconciliar.

## Cobertura medida na ingestão real (2023–2026)

| | |
|---|---|
| Emendas gravadas | **24.810** |
| Autores distintos | **951** |
| Resolvidos automaticamente | **792** (83,3%) |
| Emendas com autor resolvido | **21.349** (86,0%) |
| Sem vínculo | **159** — 76 coletivos (comissões e bancadas), 83 senadores e outros |
| ⚠️ Ambíguos (mesmo nome, duas pessoas) | **9** — ⛔ ficam sem vínculo, ⛔ não viram palpite |

### 🔴 O recorte acidental que custou 241 autores

A primeira reconciliação comparava o nome apenas contra `pessoas WHERE cpf_hash IS NOT
NULL` — o que, na prática, a limitava aos **643 que votaram na legislatura 57**.

**Medido:** **241 autores** que casavam por nome ficavam soltos. Entre eles Angela Amin,
cujo último mandato foi na **legislatura 56** — e que apresentou emenda para o exercício
de 2023 **ainda na legislatura anterior**, porque a LOA de 2023 foi votada em 2022. Caso
normal, ⛔ não exceção.

> ⚠️ `cpf_hash` ⛔ **nada tem a ver** com casamento por nome. Era um recorte acidental que
> parecia uma salvaguarda. Removê-lo levou de 551 para **792** autores e de 17.761 para
> **21.349** emendas vinculadas.

⭐ Vincular autoria antiga ⛔ não polui tela nenhuma: a ficha do parlamentar já filtra a
legislatura corrente ([Pendência 35](../PENDENCIAS.md)).

## Ver também

- [`14-fontes-de-gasto §4`](../14-fontes-de-gasto.md) — o levantamento das emendas
- [`emendas.py`](../../src/etl/poligraph_etl/emendas.py) · [`test_emendas.py`](../../src/etl/tests/test_emendas.py)
