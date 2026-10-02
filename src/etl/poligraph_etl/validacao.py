"""ANÁLISE — validação do instrumento — o deputado consegue se encontrar?

RISCO: A ideia, do autor: **se um deputado usar o app e responder segundo os próprios
votos, ele tem de aparecer em primeiro lugar.** É verdade-terreno de graça — não
depende de opinião, painel humano nem rótulo externo. Se o método não recupera quem
tem resposta conhecida, não mede afinidade de quem não tem.

DECISÃO: E o mesmo experimento responde à outra pergunta, a de quantas perguntas bastam.
Repare no que realmente falha quando há poucas perguntas: **não é o deputado sair do
topo** — ele nunca sai, porque casa com os próprios votos por construção. O que falha é
o topo ficar LOTADO. Com 8 perguntas, dezenas de deputados podem ter respondido igual a
ele, e o app não consegue distingui-los.

Por isso a medida é o **tamanho do empate no topo**, não a posição.

ATENÇÃO: A polaridade não interfere aqui, e isso não é descuido: ela é aplicada dos dois
lados da comparação e se cancela. O experimento mede poder de discriminação, não a
correção do sinal — essa continua sendo responsabilidade do teste de regressão de
polaridade (API3).
"""

import logging
from dataclasses import dataclass

import numpy as np

log = logging.getLogger("poligraph")


@dataclass(frozen=True)
class ResultadoDaRodada:
    """Uma rodada = um número de perguntas."""

    n_perguntas: int
    deputados_avaliados: int
    empate_mediano: float
    empate_medio: float
    unicos: int
    """Quantos deputados ficaram SOZINHOS no topo — sem nenhum empate."""

    @property
    def taxa_unicos(self) -> float:
        return self.unicos / self.deputados_avaliados if self.deputados_avaliados else 0.0


def avaliar(
    matriz: np.ndarray,
    colunas_pergunta: list[int],
    minimo_respostas: int = 1,
    fracao_minima_comparavel: float = 0.60,
) -> ResultadoDaRodada:
    """Roda o experimento sobre um conjunto de perguntas.

    `matriz` é pessoa × votação, com `nan` onde não houve voto.
    `colunas_pergunta` são os índices das votações usadas como perguntas.

    ATENÇÃO: Trabalha em matriz inteira, não em laço por deputado: com 655 pessoas seriam
    429 mil comparações em Python puro. Em NumPy é uma multiplicação.

    ATENÇÃO: Só posicionamento conta. `nan` é ausência e 0 é abstenção — nenhum dos dois
    é concordância nem discordância.

    concordância = acordos / comparáveis, par a par

    RISCO: O MESMO piso que a API aplica (`TemBaseSuficiente`, 60% do respondido).

    ATENÇÃO: Sem ele o experimento mede outra coisa e mente para cima: quem faltou em
    15 das 22 e concordou nas 7 que compareceu marca concordância 1,0 e empata
    com quem respondeu todas. A regra "ausência não é discordância" é correta,
    mas sozinha infla o empate — foi o que produziu uma primeira medição com
    empate mediano de 90, contra 8 na conferência direta.

    ATENÇÃO: Tolerância de ponto flutuante: 20/22 e 20/22 podem diferir no último bit,
    e sem isto o empate não seria detectado.
    """
    recorte = matriz[:, colunas_pergunta]

    opiniao = np.where(np.isnan(recorte), 0, recorte)
    tem_opiniao = opiniao != 0

    respostas_por_deputado = tem_opiniao.sum(axis=1)
    elegiveis = np.flatnonzero(respostas_por_deputado >= minimo_respostas)

    if elegiveis.size == 0:
        return ResultadoDaRodada(len(colunas_pergunta), 0, 0.0, 0.0, 0)

    acordos = (opiniao @ opiniao.T + tem_opiniao.astype(float) @ tem_opiniao.T.astype(float)) / 2
    comparaveis = tem_opiniao.astype(float) @ tem_opiniao.T.astype(float)

    with np.errstate(invalid="ignore", divide="ignore"):
        concordancia = np.where(comparaveis > 0, acordos / comparaveis, np.nan)

    empates = []
    unicos = 0
    for i in elegiveis:
        piso = np.ceil(respostas_por_deputado[i] * fracao_minima_comparavel)
        com_base = comparaveis[i] >= piso

        linha = np.where(com_base, concordancia[i], np.nan)
        if np.all(np.isnan(linha)):
            continue

        melhor = np.nanmax(linha)

        no_topo = int(np.sum(linha >= melhor - 1e-9))
        empates.append(no_topo)
        if no_topo == 1:
            unicos += 1

    if not empates:
        return ResultadoDaRodada(len(colunas_pergunta), 0, 0.0, 0.0, 0)

    return ResultadoDaRodada(
        n_perguntas=len(colunas_pergunta),
        deputados_avaliados=len(empates),
        empate_mediano=float(np.median(empates)),
        empate_medio=float(np.mean(empates)),
        unicos=unicos,
    )


def curva_de_discriminacao(
    matriz: np.ndarray,
    colunas_candidatas: list[int],
    passos: list[int],
    semente: int = 20260826,
) -> list[ResultadoDaRodada]:
    """Quanto o topo desafoga conforme entram mais perguntas.

    ATENÇÃO: As perguntas de cada rodada são sorteadas do conjunto candidato, com semente
    fixa. Pegar sempre as `k` primeiras mediria a ordem da curadoria, não o efeito da
    quantidade.
    """
    sorteio = np.random.default_rng(semente)
    resultados = []

    for k in passos:
        if k > len(colunas_candidatas):
            continue

        escolhidas = sorteio.choice(colunas_candidatas, size=k, replace=False)
        resultados.append(avaliar(matriz, sorted(escolhidas.tolist())))

    return resultados


def divisao(matriz: np.ndarray, coluna: int) -> float:
    """Quão dividida foi a votação: 0 = unânime, 0,5 = meio a meio.

    DECISÃO: É a medida de quanto uma pergunta INFORMA. Votação em que 95% votaram igual não
    separa ninguém — a pessoa responde e o ranking não muda.
    """
    valores = matriz[:, coluna]
    sim = int(np.sum(valores == 1))
    nao = int(np.sum(valores == -1))
    total = sim + nao

    return min(sim, nao) / total if total else 0.0


# ═══════════════════════════════════════════════════════════════════
# Desempate dirigido — nível C do `plano/03`, aplicado sob demanda
# ═══════════════════════════════════════════════════════════════════


def empatados_com(
    matriz: np.ndarray,
    respostas: dict[int, int],
    fracao_minima_comparavel: float = 0.60,
) -> np.ndarray:
    """Quem está no topo, dadas as respostas até agora.

    `respostas` é {coluna da votação: -1 ou 1}.
    """
    colunas = sorted(respostas)
    minha = np.array([respostas[coluna] for coluna in colunas], dtype=float)

    deles = np.where(np.isnan(matriz[:, colunas]), 0, matriz[:, colunas])
    comum = (deles != 0) & (minha != 0)

    comparaveis = comum.sum(axis=1)
    acordos = ((deles == minha) & comum).sum(axis=1)

    piso = np.ceil(np.count_nonzero(minha) * fracao_minima_comparavel)
    com_base = comparaveis >= piso

    with np.errstate(invalid="ignore", divide="ignore"):
        concordancia = np.where(com_base, acordos / np.maximum(comparaveis, 1), np.nan)

    if np.all(np.isnan(concordancia)):
        return np.array([], dtype=int)

    melhor = np.nanmax(concordancia)

    return np.flatnonzero(concordancia >= melhor - 1e-9)


def melhor_pergunta_para_dividir(
    matriz: np.ndarray, grupo: np.ndarray, candidatas: list[int]
) -> int | None:
    """A votação que mais divide **este grupo** — não a Câmara inteira.

    RISCO: É a diferença entre o nível A e o nível C do `plano/03`. Uma votação que racha a
    Câmara ao meio pode ser unânime dentro do grupo que empatou com você — e aí ela não
    desempata nada. O que importa é a divisão LOCAL.

    ATENÇÃO: Devolve `None` quando nenhuma candidata divide o grupo. Acontece de verdade: se
    os empatados votaram idêntico em tudo que existe, não há pergunta que os separe,
    e insistir seria fazer a pessoa responder à toa.
    """
    if grupo.size < 2:
        return None

    recorte = matriz[np.ix_(grupo, candidatas)]

    sim = np.sum(recorte == 1, axis=0)
    nao = np.sum(recorte == -1, axis=0)
    total = sim + nao

    with np.errstate(invalid="ignore", divide="ignore"):
        divisao_local = np.where(total > 0, np.minimum(sim, nao) / total, 0.0)

    if np.max(divisao_local) <= 0:
        return None

    return candidatas[int(np.argmax(divisao_local))]


def simular_desempate(
    matriz: np.ndarray,
    quem: int,
    base: list[int],
    candidatas: list[int],
    rodadas: int = 6,
    dirigido: bool = True,
    semente: int = 20260826,
) -> list[int]:
    """Tamanho do empate a cada pergunta adicional, para UM deputado.

    DECISÃO: `dirigido=False` sorteia a próxima pergunta. É o grupo de controle: sem ele, não
    dá para afirmar que o ganho veio da escolha e não de simplesmente perguntar mais.
    """
    sorteio = np.random.default_rng(semente + quem)
    respostas = {
        coluna: int(matriz[quem, coluna])
        for coluna in base
        if not np.isnan(matriz[quem, coluna])
    }
    respostas = {
        coluna: voto for coluna, voto in respostas.items() if voto != 0
    }

    disponiveis = [coluna for coluna in candidatas if coluna not in respostas]
    tamanhos = []

    for _ in range(rodadas):
        grupo = empatados_com(matriz, respostas)
        tamanhos.append(int(grupo.size))

        if grupo.size < 2 or not disponiveis:
            break

        proxima = (
            melhor_pergunta_para_dividir(matriz, grupo, disponiveis)
            if dirigido
            else int(sorteio.choice(disponiveis))
        )
        if proxima is None:
            break

        disponiveis.remove(proxima)

        voto = matriz[quem, proxima]
        if not np.isnan(voto) and voto != 0:
            respostas[proxima] = int(voto)

    return tamanhos
