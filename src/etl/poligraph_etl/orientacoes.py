"""Orientação de bancada — o que transforma "votou Sim" em posição política.

## ENTRADA

| | |
|---|---|
| Fonte | `dadosabertos.camara.leg.br/arquivos/votacoesOrientacoes/csv/votacoesOrientacoes-{ano}.csv` |
| Tamanho | ~1,1 MB por ano · ~5 mil linhas |
| Formato | CSV `;`, aspas, `utf-8-sig` |
| ⛔ Não existe | O **Senado** ⛔ não publica orientação de bancada |

## TRATAMENTO

1. Descarta linha cuja votação ⛔ não está na base — a orientação sem votação ⛔ não mede nada
2. Descarta orientação **vazia**: são 24% das linhas, e vazio ⛔ não é "liberado"
3. Normaliza o nome da bancada (espaço colapsado), mantendo a grafia da fonte

## SAÍDA

| | |
|---|---|
| Tabela | `orientacoes` |
| Chave | `(votacao_id, bancada)` — uma orientação por bancada por votação |
| Constraint | `ck_orientacao_nao_vazia` · FK `CASCADE` para `votacoes` |
| Idempotência | `ON CONFLICT (votacao_id, bancada) DO UPDATE` |

---

## 🔴 Por que esta tabela existe

Saber que um deputado votou "Sim" ⛔ não diz nada sozinho. Vira informação quando se
compara com o que pediram a ele:

| Medida | Contra o quê |
|---|---|
| **Governismo** | A orientação da bancada **Governo** |
| **Disciplina** | A orientação do **próprio partido** no momento do voto |

⚠️ **A bancada mistura três naturezas no mesmo campo, porque a fonte mistura:** partido
(`PT`), bloco (`Bl AvanSolidPrd`) e posição na Casa (`Governo`, `Oposição`, `Minoria`,
`Maioria`). Quem separa é a leitura, ⛔ não a ingestão — impor taxonomia nossa sobre dado
da Câmara seria inventar categoria.

⭐ **`Obstrução` ⛔ não é `Não`.** É pedido de esvaziamento de quórum, não posição de
mérito. Conta como orientação existente e ⛔ nunca como voto contrário.
"""

import logging

log = logging.getLogger("poligraph")

CASA = "CAMARA"

# ⚠️ A bancada que representa o Governo. É rótulo da própria Câmara, ⛔ não escolha
#    nossa — aparece ao lado de `Oposição`, `Minoria` e `Maioria`.
BANCADA_DO_GOVERNO = "Governo"

# ⭐ Orientações que exprimem POSIÇÃO. `Obstrução` e `Liberado` existem e são gravadas,
#    mas ⛔ não entram na conta de alinhamento: obstrução é tática de quórum e liberado
#    é ausência de orientação.
POSICOES = {"Sim", "Não"}


def para_linhas(registros, votacoes_conhecidas: set[str]) -> list[dict]:
    """Converte o CSV em linhas de `orientacoes`.

    Descarta, e por quê:

    | Caso | Motivo |
    |---|---|
    | Votação fora da base | Orientação sem votação ⛔ não mede alinhamento de ninguém |
    | Orientação vazia | 24% das linhas. Vazio ⛔ não é "Liberado" — é ausência de dado |
    | Bancada vazia | ⛔ Não há a quem atribuir |
    """
    linhas: list[dict] = []
    vistos: set[tuple[str, str]] = set()

    for registro in registros:
        votacao_id = _texto(registro.get("idVotacao"))
        bancada = _texto(registro.get("siglaBancada"))
        orientacao = _texto(registro.get("orientacao"))

        if not votacao_id or not bancada or not orientacao:
            continue
        if votacao_id not in votacoes_conhecidas:
            continue

        # ⚠️ A fonte repete o par em votação com mais de um objeto. Deduplicar aqui, e
        #    ⛔ não só no `ON CONFLICT`, mantém a contagem do log verdadeira.
        chave = (votacao_id, bancada)
        if chave in vistos:
            continue
        vistos.add(chave)

        linhas.append(
            {"votacao_id": votacao_id, "bancada": bancada, "orientacao": orientacao}
        )

    return linhas


def alinhamento(
    votos_da_pessoa: dict[str, int],
    orientacoes_por_votacao: dict[str, dict[str, str]],
    bancada: str,
) -> tuple[int, int]:
    """Quantas vezes a pessoa seguiu a bancada, e sobre quantas votações comparáveis.

    ⭐ Devolve o PAR, ⛔ nunca a proporção. `12 de 15` e `800 de 1000` dão 0,8 os dois, e
    só o par distingue o deputado que participou de tudo daquele que apareceu quinze
    vezes. Quem divide é quem exibe, e aí a base anda junto.

    A votação só é comparável quando **os dois lados se posicionaram**:

    | Situação | Fora do denominador porque |
    |---|---|
    | A bancada orientou `Obstrução` | É tática de quórum, ⛔ não posição de mérito |
    | A bancada orientou `Liberado` | ⛔ Não houve orientação a seguir |
    | A pessoa se absteve ou faltou | Ausência ⛔ não é desobediência |
    """
    seguiu = comparaveis = 0

    for votacao_id, valor in votos_da_pessoa.items():
        orientacao = (orientacoes_por_votacao.get(votacao_id) or {}).get(bancada)
        if orientacao not in POSICOES:
            continue

        # O voto do parlamentar tem de ser Sim (1) ou Não (-1). Abstenção é 0 e sai.
        if valor not in (1, -1):
            continue

        comparaveis += 1
        if (valor == 1) == (orientacao == "Sim"):
            seguiu += 1

    return seguiu, comparaveis


def _texto(valor) -> str:
    return "" if valor is None else " ".join(str(valor).split())
