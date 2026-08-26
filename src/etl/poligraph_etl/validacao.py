"""Validação do instrumento — o deputado consegue se encontrar?

🔴 A ideia, do autor: **se um deputado usar o app e responder segundo os próprios
votos, ele tem de aparecer em primeiro lugar.** É verdade-terreno de graça — não
depende de opinião, painel humano nem rótulo externo. Se o método não recupera quem
tem resposta conhecida, não mede afinidade de quem não tem.

⭐ E o mesmo experimento responde à outra pergunta, a de quantas perguntas bastam.
Repare no que realmente falha quando há poucas perguntas: **não é o deputado sair do
topo** — ele nunca sai, porque casa com os próprios votos por construção. O que falha é
o topo ficar LOTADO. Com 8 perguntas, dezenas de deputados podem ter respondido igual a
ele, e o app não consegue distingui-los.

Por isso a medida é o **tamanho do empate no topo**, não a posição.

⚠️ A polaridade não interfere aqui, e isso não é descuido: ela é aplicada dos dois
lados da comparação e se cancela. O experimento mede poder de discriminação, ⛔ não a
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

    ⚠️ Trabalha em matriz inteira, ⛔ não em laço por deputado: com 655 pessoas seriam
    429 mil comparações em Python puro. Em NumPy é uma multiplicação.
    """
    recorte = matriz[:, colunas_pergunta]

    # ⚠️ Só posicionamento conta. `nan` é ausência e 0 é abstenção — nenhum dos dois
    #    é concordância nem discordância.
    opiniao = np.where(np.isnan(recorte), 0, recorte)
    tem_opiniao = opiniao != 0

    respostas_por_deputado = tem_opiniao.sum(axis=1)
    elegiveis = np.flatnonzero(respostas_por_deputado >= minimo_respostas)

    if elegiveis.size == 0:
        return ResultadoDaRodada(len(colunas_pergunta), 0, 0.0, 0.0, 0)

    # concordância = acordos / comparáveis, par a par
    acordos = (opiniao @ opiniao.T + tem_opiniao.astype(float) @ tem_opiniao.T.astype(float)) / 2
    comparaveis = tem_opiniao.astype(float) @ tem_opiniao.T.astype(float)

    with np.errstate(invalid="ignore", divide="ignore"):
        concordancia = np.where(comparaveis > 0, acordos / comparaveis, np.nan)

    empates = []
    unicos = 0
    for i in elegiveis:
        # 🔴 O MESMO piso que a API aplica (`TemBaseSuficiente`, 60% do respondido).
        #
        # ⚠️ Sem ele o experimento mede outra coisa e mente para cima: quem faltou em
        #    15 das 22 e concordou nas 7 que compareceu marca concordância 1,0 e empata
        #    com quem respondeu todas. A regra "ausência não é discordância" é correta,
        #    mas sozinha infla o empate — foi o que produziu uma primeira medição com
        #    empate mediano de 90, contra 8 na conferência direta.
        piso = np.ceil(respostas_por_deputado[i] * fracao_minima_comparavel)
        com_base = comparaveis[i] >= piso

        linha = np.where(com_base, concordancia[i], np.nan)
        if np.all(np.isnan(linha)):
            continue

        melhor = np.nanmax(linha)

        # ⚠️ Tolerância de ponto flutuante: 20/22 e 20/22 podem diferir no último bit,
        #    e sem isto o empate não seria detectado.
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

    ⚠️ As perguntas de cada rodada são sorteadas do conjunto candidato, com semente
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

    ⭐ É a medida de quanto uma pergunta INFORMA. Votação em que 95% votaram igual não
    separa ninguém — a pessoa responde e o ranking não muda.
    """
    valores = matriz[:, coluna]
    sim = int(np.sum(valores == 1))
    nao = int(np.sum(valores == -1))
    total = sim + nao

    return min(sim, nao) / total if total else 0.0
