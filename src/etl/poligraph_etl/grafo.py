"""Comunidades e layout do grafo — o que preenche `nos_metrica`.

⚠️ Este módulo é o que faltava para o grafo existir. `similaridade.py` produz pares e
arestas; sem daqui, `arestas_grafo` tem ligações e `nos_metrica` fica vazia — o grafo
tem arestas e nenhum nó com nome, cor ou posição.

🔴 **Tudo aqui é determinístico por semente fixa.** Louvain e o layout de molas são
estocásticos: rodar duas vezes sem semente dá comunidades e posições diferentes sobre o
MESMO dado. Num TCC isso é fatal — a banca reproduz e não bate. A semente entra junto
da `versao_carga` na tabela `execucoes`, que é o retrato auditável de cada análise.
"""

import logging
from dataclasses import dataclass

import networkx as nx

log = logging.getLogger("poligraph")

# 🔴 Não é número mágico: é o que torna a execução reproduzível. Mudar aqui muda o
#    resultado publicado, e por isso a mudança tem de vir junto de nova `versao_carga`.
SEMENTE = 20260826

# ⚠️ Iterações do layout. Abaixo de ~50 o desenho ainda não estabilizou e comunidades
#    visualmente se sobrepõem; acima de ~200 o ganho não aparece na tela.
ITERACOES_LAYOUT = 120


@dataclass(frozen=True)
class NoDoGrafo:
    pessoa_id: int
    comunidade: int
    eixo_x: float
    eixo_y: float
    n_votacoes: int


def montar(pessoas: list[int], arestas: list) -> nx.Graph:
    """Grafo não-direcionado, peso = similaridade.

    ⚠️ Os nós vêm da lista de `pessoas`, ⛔ não das arestas. Deputado sem nenhuma
    aresta — quem votou pouco e não passou do mínimo da RN-02 com ninguém — precisa
    existir como nó isolado, senão some do grafo sem que nada registre o motivo.
    """
    g = nx.Graph()
    g.add_nodes_from(pessoas)

    for aresta in arestas:
        g.add_edge(aresta.pessoa_a, aresta.pessoa_b, peso=float(aresta.valor))

    return g


def detectar_comunidades(g: nx.Graph) -> dict[int, int]:
    """Louvain, ponderado pela similaridade. Decidido em `plano/07`.

    ⭐ O número de comunidades NÃO é escolhido: Louvain o encontra maximizando
    modularidade. É o que dá sentido ao objetivo específico #3 — comparar o grupo
    detectado **pelo voto** com o partido declarado. Fixar k de antemão embutiria a
    resposta na pergunta.

    ⚠️ Comunidades numeradas por TAMANHO, da maior para a menor. Sem isso o número é o
    que o algoritmo devolver, e a legenda da tela troca de cor entre duas execuções do
    mesmo dado.
    """
    grupos = nx.community.louvain_communities(g, weight="peso", seed=SEMENTE)
    grupos = sorted(grupos, key=len, reverse=True)

    return {
        pessoa: indice
        for indice, grupo in enumerate(grupos)
        for pessoa in grupo
    }


def calcular_posicoes(g: nx.Graph) -> dict[int, tuple[float, float]]:
    """Layout de molas (Fruchterman-Reingold), semente fixa.

    ⚠️ A posição é DESCRITIVA, não uma medida. Proximidade na tela sugere similaridade
    de voto, mas o eixo x não é "esquerda-direita" e o y não é nada — o layout não tem
    interpretação política. Isso precisa estar dito na tela, senão o leitor lê um
    espectro que o método não afirma.
    """
    posicoes = nx.spring_layout(
        g, weight="peso", seed=SEMENTE, iterations=ITERACOES_LAYOUT
    )

    return {pessoa: (float(xy[0]), float(xy[1])) for pessoa, xy in posicoes.items()}


def calcular_nos(
    pessoas: list[int], arestas: list, votacoes_por_pessoa: dict[int, int]
) -> list[NoDoGrafo]:
    """Junta comunidade, posição e volume de voto num nó só."""
    g = montar(pessoas, arestas)

    comunidades = detectar_comunidades(g)
    posicoes = calcular_posicoes(g)

    log.info(
        "  %d comunidades detectadas em %d nós (%d arestas)",
        len(set(comunidades.values())),
        g.number_of_nodes(),
        g.number_of_edges(),
    )

    return [
        NoDoGrafo(
            pessoa_id=pessoa,
            comunidade=comunidades[pessoa],
            eixo_x=posicoes[pessoa][0],
            eixo_y=posicoes[pessoa][1],
            n_votacoes=votacoes_por_pessoa.get(pessoa, 0),
        )
        for pessoa in pessoas
    ]
