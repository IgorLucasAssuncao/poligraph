"""ANÁLISE — comunidade detectada × partido declarado — o objetivo específico #3 (RF-20).

RISCO: **A RQ2 perguntava "ARI ou modularidade?". A resposta é as duas, e elas respondem
perguntas diferentes:**

| Medida | Responde |
|---|---|
| **ARI** | As comunidades de voto *coincidem* com os partidos? |
| **Modularidade** | Qual das duas divisões descreve melhor o grafo? |

DECISÃO: Sozinha, a modularidade não compara nada — mede a qualidade de uma partição. Sozinho,
o ARI diz que duas partições diferem, mas não diz qual das duas é melhor. Juntos
sustentam a afirmação que interessa ao trabalho: *"as comunidades de voto descrevem o
grafo melhor que os partidos, e diferem deles nesta medida."*

ATENÇÃO: Implementados aqui em vez de trazer `scikit-learn`. O ARI são vinte linhas de
combinação; a modularidade o `networkx` já tem. Somar uma dependência de 30 MB por uma
função seria custo sem contrapartida.
"""

import logging
from dataclasses import dataclass

import networkx as nx

log = logging.getLogger("poligraph")


@dataclass(frozen=True)
class Comparacao:
    ari: float
    """−1 a 1. **0 = coincidência ao acaso**, 1 = partições idênticas."""

    modularidade_comunidade: float
    modularidade_partido: float
    n_comunidades: int
    n_partidos: int
    n_pessoas: int

    @property
    def comunidade_descreve_melhor(self) -> bool:
        return self.modularidade_comunidade > self.modularidade_partido


def comparar(
    grafo: nx.Graph,
    comunidade_de: dict[int, int],
    partido_de: dict[int, str],
) -> Comparacao:
    """ATENÇÃO: Compara só quem tem os dois rótulos — deputado sem partido registrado sai."""
    pessoas = [
        pessoa for pessoa in grafo.nodes
        if pessoa in comunidade_de and pessoa in partido_de
    ]

    comunidades = [comunidade_de[pessoa] for pessoa in pessoas]
    partidos = [partido_de[pessoa] for pessoa in pessoas]

    return Comparacao(
        ari=indice_rand_ajustado(comunidades, partidos),
        modularidade_comunidade=modularidade(grafo, pessoas, comunidades),
        modularidade_partido=modularidade(grafo, pessoas, partidos),
        n_comunidades=len(set(comunidades)),
        n_partidos=len(set(partidos)),
        n_pessoas=len(pessoas),
    )


def indice_rand_ajustado(a: list, b: list) -> float:
    """Índice de Rand ajustado entre duas partições dos mesmos elementos.

    RISCO: **Ajustado** é a palavra que importa. O Rand simples sobe só por haver muitos
    grupos: com 20 partidos e 30 comunidades, quase todo par de deputados cai em grupos
    diferentes nas duas partições, e isso conta como "concordância". O ajuste desconta o
    que se esperaria do acaso — por isso 0 significa "nada além do acaso", e não
    "nenhuma coincidência".
    """
    if len(a) != len(b):
        raise ValueError("as duas partições precisam ter o mesmo tamanho")

    elementos = len(a)
    if elementos < 2:
        return 0.0

    tabela: dict[tuple, int] = {}
    for x, y in zip(a, b):
        tabela[(x, y)] = tabela.get((x, y), 0) + 1

    linhas: dict = {}
    colunas: dict = {}
    for (x, y), quantos in tabela.items():
        linhas[x] = linhas.get(x, 0) + quantos
        colunas[y] = colunas.get(y, 0) + quantos

    soma_celulas = sum(_pares(quantidade) for quantidade in tabela.values())
    soma_linhas = sum(_pares(quantidade) for quantidade in linhas.values())
    soma_colunas = sum(_pares(quantidade) for quantidade in colunas.values())
    total_de_pares = _pares(elementos)

    esperado = soma_linhas * soma_colunas / total_de_pares
    maximo = (soma_linhas + soma_colunas) / 2

    # ATENÇÃO: Partições idênticas E triviais (tudo num grupo só) zeram o denominador.
    if maximo == esperado:
        return 0.0

    return (soma_celulas - esperado) / (maximo - esperado)


def modularidade(grafo: nx.Graph, pessoas: list[int], rotulos: list) -> float:
    """Modularidade da partição sobre o grafo, ponderada pela similaridade.

    DECISÃO: Mede quanto das arestas fica DENTRO dos grupos, descontado o que se esperaria
    de um grafo aleatório com os mesmos graus. Alto = a divisão explica a estrutura.
    """
    grupos: dict = {}
    for pessoa, rotulo in zip(pessoas, rotulos):
        grupos.setdefault(rotulo, set()).add(pessoa)

    subgrafo = grafo.subgraph(pessoas)

    return float(nx.community.modularity(subgrafo, grupos.values(), weight="peso"))


# ═══════════════════════════════════════════════════════════════════


def _pares(n: int) -> float:
    """Quantos pares distintos dá para formar com n elementos."""
    return n * (n - 1) / 2
