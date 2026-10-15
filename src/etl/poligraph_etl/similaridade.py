"""ANÁLISE — matriz de votos, similaridade e as arestas do grafo.

## ENTRADA

Tabelas `votos` e `votacoes`, já tratadas. Nada de arquivo aqui.

## CÁLCULO

1. Monta a matriz **pessoa × votação**, só plenário e nunca secreta
2. Concordância e cosseno, **ponderados pela categoria** da votação
3. RISCO: Descarta o par com menos de **20 votações em comum** — RN-02, e o banco também
   recusa pelo `ck_sim_minimo`
4. kNN k=10 por **união**: a aresta sobrevive se **qualquer um** dos dois escolheu o
   outro, porque o grafo é não-direcionado

## SAÍDA

`similaridades` · `arestas_grafo`, sempre atreladas a uma `execucao`.

---

RISCO: **O cálculo de similaridade é DAQUI.** O C# só lê essas tabelas — se um cálculo
aparecer lá, é regressão de arquitetura.

MEDIDO: [`docs/plano/07-grafo-e-afinidade.md §3.2`](../../../docs/plano/07-grafo-e-afinidade.md)
"""

from dataclasses import dataclass

import numpy as np

# ═══════════════════════════════════════════════════════════════════
# Pesos medidos no discovery
# ═══════════════════════════════════════════════════════════════════

# Nem toda votação diz o mesmo sobre uma pessoa.
PESO_CATEGORIA = {
    "SUBSTANTIVA": 1.0,    # mérito da matéria — o sinal mais forte
    "DESTAQUE": 0.7,       # mérito, mas de um trecho
    "AUTORIDADE": 0.3,     # voto em pessoa, não em política
    "PROCEDIMENTAL": 0.0,  # Não fora da matriz: mede obstrução, não posição
}

# DECISÃO: Não é arbitrário: vem da correlação medida de posição entre anos dentro da
#    legislatura (r = 0,862). Discovery §7.4.1.
RAZAO_RECENCIA = 0.86

# RN-02 — abaixo disto o par é descartado
MINIMO_VOTACOES_COMUNS = 20

# kNN. Limiar global não funciona: a similaridade média entre dois deputados
# quaisquer é 0,663, e mesmo com corte em 0,90 a densidade fica em 11,6%.
K_VIZINHOS = 10


def parametros() -> dict:
    """Os parâmetros que a execução grava, para a metodologia mostrar o que foi usado."""
    return {
        "minimo_votacoes_comuns": MINIMO_VOTACOES_COMUNS,
        "razao_recencia": RAZAO_RECENCIA,
        "peso_destaque": PESO_CATEGORIA["DESTAQUE"],
        "peso_autoridade": PESO_CATEGORIA["AUTORIDADE"],
    }


@dataclass(frozen=True)
class ParSimilar:
    pessoa_a: int
    pessoa_b: int
    metrica: str
    valor: float
    n_votacoes_comuns: int


def peso_da_votacao(categoria: str, anos_decorridos: float) -> float:
    """Peso de uma votação na matriz: categoria × recência."""
    return PESO_CATEGORIA.get(categoria, 1.0) * (RAZAO_RECENCIA ** max(anos_decorridos, 0.0))


def concordancia_simples(
    votos_a: np.ndarray, votos_b: np.ndarray, pesos: np.ndarray
) -> tuple[float, int]:
    """Fração ponderada de votações em que os dois votaram igual.

    DECISÃO: É a métrica explicável: "votaram igual em 82% das vezes". Vai para a tela.

    Considera apenas as votações em que AMBOS se posicionaram — NaN (ausente) e 0
    (abstenção) saem da conta, em vez de contarem como discordância.
    """
    comum = _mascara_comum(votos_a, votos_b, pesos)
    n = int(comum.sum())
    if n == 0:
        return 0.0, 0

    acordos = (votos_a[comum] == votos_b[comum]).astype(float)
    peso_comum = pesos[comum]

    return float((acordos * peso_comum).sum() / peso_comum.sum()), n


def cosseno(votos_a: np.ndarray, votos_b: np.ndarray, pesos: np.ndarray) -> tuple[float, int]:
    """Cosseno ponderado, reescalado para [0, 1].

    ATENÇÃO: O cosseno cru vive em [-1, 1]. O banco exige [0, 1] (`ck_sim_valor`), então
    aplica-se (c + 1) / 2. Vai para o grafo, não para a tela.
    """
    comum = _mascara_comum(votos_a, votos_b, pesos)
    n = int(comum.sum())
    if n == 0:
        return 0.0, 0

    a = votos_a[comum] * pesos[comum]
    b = votos_b[comum] * pesos[comum]

    norma = np.linalg.norm(a) * np.linalg.norm(b)
    if norma == 0:
        return 0.5, n

    return float((np.dot(a, b) / norma + 1.0) / 2.0), n


def calcular_pares(
    matriz: np.ndarray,
    pessoas: list[int],
    pesos: np.ndarray,
    metrica: str = "CONCORDANCIA",
) -> list[ParSimilar]:
    """Todos os pares da MESMA casa que atendem ao mínimo da RN-02.

    ATENÇÃO: `pessoa_a < pessoa_b` sempre — invariante I3, e o banco tem CHECK para isso.
    """
    funcao = concordancia_simples if metrica == "CONCORDANCIA" else cosseno
    pares: list[ParSimilar] = []

    for i in range(len(pessoas)):
        for j in range(i + 1, len(pessoas)):
            valor, n = funcao(matriz[i], matriz[j], pesos)
            if n < MINIMO_VOTACOES_COMUNS:
                continue

            a, b = sorted((pessoas[i], pessoas[j]))
            pares.append(ParSimilar(a, b, metrica, valor, n))

    return pares


def arestas_knn(pares: list[ParSimilar], k: int = K_VIZINHOS) -> list[ParSimilar]:
    """Mantém só as k arestas mais fortes de cada nó.

    DECISÃO: Por que não limiar global: a similaridade média entre dois deputados quaisquer
    é 0,663 — deputados concordam muito. Limiar liga quase todo mundo ou ninguém.
    O kNN dá densidade previsível (644 × 10 ≈ 6.440 arestas) e resiste a nó
    "concordante com todos", que num limiar viraria hub artificial.

    a aresta sobrevive se QUALQUER um dos dois a escolheu — o grafo é não-direcionado
    """
    por_pessoa: dict[int, list[ParSimilar]] = {}
    for par in pares:
        por_pessoa.setdefault(par.pessoa_a, []).append(par)
        por_pessoa.setdefault(par.pessoa_b, []).append(par)

    escolhidas: set[tuple[int, int]] = set()
    for vizinhos in por_pessoa.values():
        for par in sorted(vizinhos, key=lambda vizinho: vizinho.valor, reverse=True)[:k]:
            escolhidas.add((par.pessoa_a, par.pessoa_b))

    return [par for par in pares if (par.pessoa_a, par.pessoa_b) in escolhidas]


# ═══════════════════════════════════════════════════════════════════


def _mascara_comum(votos_a: np.ndarray, votos_b: np.ndarray, pesos: np.ndarray) -> np.ndarray:
    """Votações em que ambos se posicionaram e que contam na matriz.

    `& (pesos > 0)`: PROCEDIMENTAL tem peso 0
    """
    return (
        ~np.isnan(votos_a) & ~np.isnan(votos_b)
        & (votos_a != 0) & (votos_b != 0)
        & (pesos > 0)
    )
