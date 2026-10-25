"""ANÁLISE — comunidades e layout, o que preenche `nos_metrica`.

## ENTRADA

As `arestas_grafo` da execução, produzidas por `similaridade`.

## CÁLCULO

1. **Louvain** sobre a rede ponderada — comunidade detectada pelo VOTO, não pelo
   partido
2. Layout de **molas** (Fruchterman-Reingold), semente fixa: o desenho tem de ser
   reproduzível entre execuções
3. **SVD** para os dois componentes principais — eixos interpretáveis, em paralelo

## SAÍDA

`nos_metrica`: comunidade, posição de molas e posição por componentes.

---

ATENÇÃO: **Os eixos de molas não significam nada** — girar a figura não muda o que ela
diz. Quem tem eixo com significado é o SVD, e mesmo lá **o centro não é moderação**:
quem faltou a muitas votações também cai ali.

MEDIDO: [`docs/plano/07-grafo-e-afinidade.md §3.5`](../../../docs/plano/07-grafo-e-afinidade.md)
"""

import logging
from dataclasses import dataclass

import networkx as nx
import numpy as np

log = logging.getLogger("poligraph")

# RISCO: Não é número mágico: é o que torna a execução reproduzível. Mudar aqui muda o
#    resultado publicado, e por isso a mudança tem de vir junto de nova `versao_carga`.
SEMENTE = 20260826

# ATENÇÃO: Iterações do layout. Abaixo de ~50 o desenho ainda não estabilizou e comunidades
#    visualmente se sobrepõem; acima de ~200 o ganho não aparece na tela.
ITERACOES_LAYOUT = 120


@dataclass(frozen=True)
class NoDoGrafo:
    """Um parlamentar no grafo: a comunidade do Louvain e as duas posições, a das molas e a dos componentes."""

    pessoa_id: int
    comunidade: int
    eixo_x: float
    eixo_y: float
    n_votacoes: int

    componente_1: float = 0.0
    """DECISÃO: Pendência 43: as duas posições convivem. Molas para desenhar, componentes para o eixo
    interpretável do TCC. A tela escolhe qual mostrar; o banco guarda as duas."""
    componente_2: float = 0.0


def montar(pessoas: list[int], arestas: list) -> nx.Graph:
    """Grafo não-direcionado, peso = similaridade.

    ATENÇÃO: Os nós vêm da lista de `pessoas`, não das arestas. Deputado sem nenhuma
    aresta — quem votou pouco e não passou do mínimo da RN-02 com ninguém — precisa
    existir como nó isolado, senão some do grafo sem que nada registre o motivo.
    """
    rede = nx.Graph()
    rede.add_nodes_from(pessoas)

    for aresta in arestas:
        rede.add_edge(aresta.pessoa_a, aresta.pessoa_b, peso=float(aresta.valor))

    return rede


def detectar_comunidades(rede: nx.Graph) -> dict[int, int]:
    """Louvain, ponderado pela similaridade. Decidido em `plano/07`.

    DECISÃO: O número de comunidades NÃO é escolhido: Louvain o encontra maximizando
    modularidade. É o que dá sentido ao objetivo específico #3 — comparar o grupo
    detectado **pelo voto** com o partido declarado. Fixar k de antemão embutiria a
    resposta na pergunta.

    ATENÇÃO: Comunidades numeradas por TAMANHO, da maior para a menor. Sem isso o número é o
    que o algoritmo devolver, e a legenda da tela troca de cor entre duas execuções do
    mesmo dado.
    """
    grupos = nx.community.louvain_communities(rede, weight="peso", seed=SEMENTE)
    grupos = sorted(grupos, key=len, reverse=True)

    return {
        pessoa: indice
        for indice, grupo in enumerate(grupos)
        for pessoa in grupo
    }


def calcular_posicoes(rede: nx.Graph) -> dict[int, tuple[float, float]]:
    """Layout de molas (Fruchterman-Reingold), semente fixa.

    ATENÇÃO: A posição é DESCRITIVA, não uma medida. Proximidade na tela sugere similaridade
    de voto, mas o eixo x não é "esquerda-direita" e o y não é nada — o layout não tem
    interpretação política. Isso precisa estar dito na tela, senão o leitor lê um
    espectro que o método não afirma.
    """
    posicoes = nx.spring_layout(
        rede, weight="peso", seed=SEMENTE, iterations=ITERACOES_LAYOUT
    )

    return {pessoa: (float(xy[0]), float(xy[1])) for pessoa, xy in posicoes.items()}


def calcular_nos(
    pessoas: list[int],
    arestas: list,
    votacoes_por_pessoa: dict[int, int],
    matriz: np.ndarray | None = None,
) -> list[NoDoGrafo]:
    """Junta comunidade, posição, componentes e volume de voto num nó só.

    ATENÇÃO: Sem matriz não há componentes: teste que só exercita o grafo passa None.
    """
    rede = montar(pessoas, arestas)

    comunidades = detectar_comunidades(rede)
    posicoes = calcular_posicoes(rede)

    componentes = calcular_componentes(matriz) if matriz is not None else None

    log.info(
        "  %d comunidades detectadas em %d nós (%d arestas)",
        len(set(comunidades.values())),
        rede.number_of_nodes(),
        rede.number_of_edges(),
    )

    return [
        NoDoGrafo(
            pessoa_id=pessoa,
            comunidade=comunidades[pessoa],
            eixo_x=posicoes[pessoa][0],
            eixo_y=posicoes[pessoa][1],
            n_votacoes=votacoes_por_pessoa.get(pessoa, 0),
            componente_1=float(componentes[i, 0]) if componentes is not None else 0.0,
            componente_2=float(componentes[i, 1]) if componentes is not None else 0.0,
        )
        for i, pessoa in enumerate(pessoas)
    ]


# ═══════════════════════════════════════════════════════════════════
# Componentes principais — o eixo interpretável (Pendência 43)
# ═══════════════════════════════════════════════════════════════════


def calcular_componentes(matriz: np.ndarray) -> np.ndarray:
    """As duas primeiras componentes principais da matriz de votos, por SVD.

    DECISÃO: **A diferença para o layout de molas:** aqui o eixo x SIGNIFICA alguma coisa. É a
    direção em que os deputados mais se diferenciam — a linhagem do W-NOMINATE na
    ciência política. No layout de molas, x e y não têm interpretação nenhuma: gire a
    figura e ela continua igualmente válida.

    RISCO: **ATENÇÃO — o centro da figura NÃO é "moderado".**

    Ausência e abstenção viram **0** antes do SVD. Depois de centrar, zero fica perto da
    média, e **quem faltou muito é empurrado para o meio do desenho**. O centro mistura
    duas coisas incomparáveis: quem vota no meio-termo e quem simplesmente não votou.

    ATENÇÃO: **Medido na legislatura 57**, não deduzido:

    | | Mediana de votações |
    |---|---|
    | 80 nós mais próximos do centro | **472** |
    | 80 nós nos extremos | **925** |

    Correlação entre distância do centro e número de votações: **r = 0,566**.

    Não É limitação do método, não bug. A literatura de *ideal point estimation*
    (W-NOMINATE e sucessores) trata ausência com imputação justamente por isso. Aqui o
    zero é o ponto neutro entre −1 e +1: mantém a conta honesta sem inventar voto, ao
    preço de confundir ausência com moderação.

    RISCO: **Isso precisa estar dito NA TELA** — ver o texto de ajuda do seletor de layout.

    RISCO: **O SINAL DO SVD É ARBITRÁRIO.** Numericamente, `u` e `-u` são soluções igualmente
    válidas: o desenho sairia espelhado a cada execução, e a "esquerda" da figura viraria
    a "direita" sem nada ter mudado nos dados. Fixado pela convenção abaixo.

    DECISÃO: Quanto cada componente explica é resultado, não diagnóstico: mede o quanto a
    Câmara se divide ao longo de UMA linha só.
    """
    centrada = np.where(np.isnan(matriz), 0.0, matriz)
    centrada = centrada - centrada.mean(axis=0)

    u, valores, _ = np.linalg.svd(centrada, full_matrices=False)
    coordenadas = u[:, :2] * valores[:2]

    explicada = valores**2 / (valores**2).sum()
    log.info(
        "  componentes: 1ª explica %.1f%% da variância, 2ª explica %.1f%%",
        explicada[0] * 100,
        explicada[1] * 100,
    )

    return _normalizar(_fixar_sinal(coordenadas))


def _fixar_sinal(coordenadas: np.ndarray) -> np.ndarray:
    """Convenção de sinal, para o desenho não espelhar entre execuções.

    ATENÇÃO: A regra é arbitrária de propósito e só precisa ser ESTÁVEL: o componente aponta
    para o lado onde está a pessoa de maior coordenada absoluta.
    """
    for coluna in range(coordenadas.shape[1]):
        extremo = coordenadas[np.argmax(np.abs(coordenadas[:, coluna])), coluna]
        if extremo < 0:
            coordenadas[:, coluna] *= -1

    return coordenadas


def _normalizar(coordenadas: np.ndarray) -> np.ndarray:
    """Reescala para [-1, 1] com um divisor ÚNICO para os dois eixos.

    RISCO: **A primeira versão dividia cada eixo pelo próprio máximo, e isso mentia.**
    O componente 2 explica 9,6% da variância contra 34,6% do componente 1 — mas,
    normalizado à parte, ele ocupava a MESMA altura na tela. O resultado parecia uma
    nuvem bidimensional quando o dado é quase unidimensional: ruído desenhado do mesmo
    tamanho que sinal.

    DECISÃO: Com divisor único, o eixo 2 fica visualmente menor **na proporção em que importa
    menos**. A figura fica achatada — e é essa a forma verdadeira da Câmara.
    """
    maximo = float(np.max(np.abs(coordenadas)))

    return coordenadas / (maximo or 1.0)
