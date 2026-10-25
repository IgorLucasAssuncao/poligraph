"""Os comandos que calculam sobre os votos: similaridade e grafo, a curadoria do questionário e a validação do instrumento."""

import logging
from dataclasses import dataclass

import numpy as np
import psycopg

from ..analise import comparacao, curadoria, grafo, similaridade, validacao
from ..congresso import orientacoes
from ..nucleo import persistencia
from ..nucleo.tipos import TipoCasa, TipoMetrica

log = logging.getLogger("poligraph")

# RISCO: Abaixo disto a legislatura fica SEM grafo, e a tela não a oferece.
#
# MEDIDO: O discovery (§4.1.1.1) mediu o intervalo de confiança da concordância de um par:
#    ~±17 pp com 56 votações, ~±10 pp com 182. Com 100 fica em ~±13 pp. Abaixo disso
#    o desenho separaria gente por ruído, e um grafo errado com cara de medida é pior
#    que nenhum. Conta só o que entra na matriz: plenário, nominal, aberta.
VOTACOES_MINIMAS_PARA_GRAFO = 100


def rodar_analisar(conexao: psycopg.Connection, legislatura: int, casa: str) -> None:
    """RF-17, RF-19 — matriz, similaridade e grafo, de UMA casa.

    Cada casa gera a própria `execucao`: nenhuma aresta liga deputado a senador, porque
    as duas não votam as mesmas matérias (achado #7).

    ATENÇÃO: O grafo sai da CONCORDANCIA, não do cosseno: é a métrica que a
    tela explica ("votaram igual em X de Y"). O cosseno fica gravado em
    `similaridades` para a comparação da RF-18.

    DECISÃO: É aqui que o grafo ganha NÓS. Sem esta parte ele tem ligações e
    nenhum ponto com comunidade, cor ou posição — nada a desenhar.
    """
    pessoas, votacoes, matriz, pesos = _montar_matriz(conexao, legislatura, casa)
    log.info(
        "Matriz %s %dª: %d pessoas × %d votações",
        casa, legislatura, len(pessoas), len(votacoes),
    )

    if len(pessoas) < 2:
        log.warning("Menos de duas pessoas com voto — nada a calcular.")
        return

    if len(votacoes) < VOTACOES_MINIMAS_PARA_GRAFO:
        log.warning(
            "  %s %dª fica SEM grafo: %d votações de plenário abertas, o mínimo é %d.",
            casa, legislatura, len(votacoes), VOTACOES_MINIMAS_PARA_GRAFO,
        )
        return

    execucao_id = persistencia.abrir_execucao(
        conexao, casa, legislatura, similaridade.K_VIZINHOS, "v1",
        similaridade.parametros(),
    )
    try:
        for metrica in TipoMetrica:
            pares = similaridade.calcular_pares(matriz, pessoas, pesos, metrica)
            persistencia.gravar_similaridades(conexao, execucao_id, pares)
            log.info("  %s: %d pares acima do mínimo", metrica, len(pares))

            if metrica is TipoMetrica.CONCORDANCIA:
                arestas = similaridade.arestas_knn(pares)
                gravadas = persistencia.gravar_arestas(conexao, execucao_id, arestas)
                log.info("  grafo kNN: %d arestas gravadas", gravadas)

                nos = grafo.calcular_nos(
                    pessoas, arestas, _votacoes_por_pessoa(matriz, pessoas, pesos), matriz
                )
                gravados = persistencia.gravar_nos_metrica(conexao, execucao_id, nos)
                log.info("  %d nós gravados", gravados)

                _alinhamento(conexao, execucao_id, casa, legislatura, pessoas)

        persistencia.fechar_execucao(conexao, execucao_id, sucesso=True)
    except Exception:
        persistencia.fechar_execucao(conexao, execucao_id, sucesso=False)
        raise


def legislaturas_a_analisar(conexao: psycopg.Connection, args) -> list[int]:
    """As pedidas; com `--todas`, as da casa na base; sem nada, a corrente."""
    if args.todas:
        return [
            linha[0]
            for linha in conexao.execute(
                "SELECT DISTINCT legislatura FROM votacoes WHERE casa = %s ORDER BY 1",
                (args.casa,),
            ).fetchall()
        ]

    if args.legislatura:
        return args.legislatura

    corrente = conexao.execute("SELECT max(legislatura) FROM votacoes").fetchone()[0]
    return [corrente] if corrente is not None else []


def _alinhamento(
    conexao: psycopg.Connection,
    execucao_id: int,
    casa: str,
    legislatura: int,
    pessoas: list[int],
) -> None:
    """Preenche `governismo` e `disciplina` a partir da orientação de bancada.

    DECISÃO: **Governismo** é seguir a bancada `Governo`; **disciplina** é seguir o próprio
    partido no momento do voto. O partido vem de `votos.partido_no_voto`, não da
    filiação de hoje: trocar de partido é comum, e medir disciplina contra a filiação
    atual reescreveria o passado.

    ATENÇÃO: Sai sem fazer nada no Senado — lá não existe orientação de bancada, e as duas
    colunas continuam nulas de propósito.

    ATENÇÃO: Uma consulta só, e não uma por pessoa: são 643 parlamentares, e o laço com
    ida ao banco levaria minutos para devolver o que cabe numa varredura.

    Sem base, NULO — nunca zero. Zero afirmaria "nunca seguiu o governo",
    e o que houve foi não haver votação comparável.

    DECISÃO: A base vai junto: a API a lia por conta própria, com a regra antiga
    de sigla exata, e mostraria um percentual novo sobre a base velha.
    """
    if casa != orientacoes.CASA:
        log.info("  alinhamento: %s não publica orientação de bancada", casa)
        return

    por_votacao: dict[str, dict[str, str]] = {}
    for votacao_id, bancada, orientacao in conexao.execute(
        """
        SELECT o.votacao_id, o.bancada, o.orientacao
          FROM orientacoes o
          JOIN votacoes v ON v.id = o.votacao_id
         WHERE v.casa = %s AND v.legislatura = %s
        """,
        (casa, legislatura),
    ).fetchall():
        por_votacao.setdefault(votacao_id, {})[bancada] = orientacao

    if not por_votacao:
        log.warning("  alinhamento: nenhuma orientação na base — rode `ingerir`")
        return

    votos_por_pessoa: dict[int, dict[str, int]] = {}
    partido_por_voto: dict[int, dict[str, str]] = {}
    for pessoa_id, votacao_id, valor, partido in conexao.execute(
        """
        SELECT vo.pessoa_id, vo.votacao_id, vo.valor, vo.partido_no_voto
          FROM votos vo
          JOIN votacoes v ON v.id = vo.votacao_id
         WHERE v.casa = %s AND v.legislatura = %s AND vo.valor IN (1, -1)
        """,
        (casa, legislatura),
    ).fetchall():
        votos_por_pessoa.setdefault(pessoa_id, {})[votacao_id] = valor
        partido_por_voto.setdefault(pessoa_id, {})[votacao_id] = partido

    metricas = []
    for pessoa_id in pessoas:
        votos = votos_por_pessoa.get(pessoa_id) or {}
        if not votos:
            continue

        segue_gov, base_gov = orientacoes.alinhamento(
            votos, por_votacao, orientacoes.BANCADA_DO_GOVERNO
        )
        segue_part, base_part = orientacoes.disciplina(
            votos, por_votacao, partido_por_voto.get(pessoa_id) or {}
        )

        metricas.append(
            {
                "pessoa_id": pessoa_id,
                "governismo": segue_gov / base_gov if base_gov else None,
                "disciplina": segue_part / base_part if base_part else None,
                "base_disciplina": base_part or None,
            }
        )

    persistencia.gravar_metricas_de_alinhamento(conexao, execucao_id, metricas)

    com_gov = sum(1 for m in metricas if m["governismo"] is not None)
    com_part = sum(1 for m in metricas if m["disciplina"] is not None)
    log.info(
        "  alinhamento: %d com governismo, %d com disciplina, de %d nós",
        com_gov, com_part, len(metricas),
    )


def rodar_curar(conexao: psycopg.Connection, casa: str, legislatura: int, limite: int) -> None:
    """Pendência 11 — reduz o universo às votações que valem leitura humana.

    Não grava pergunta nenhuma. A polaridade sugerida é auxílio: atribuí-la
    automaticamente é o erro que este projeto persegue, porque um sinal invertido não
    aparece na tela, aparece como número plausível.

    DECISÃO: A EMENTA primeiro, e a descrição depois. A descrição diz o NÚMERO do
    projeto; a ementa diz sobre o que ele é — e é dela que sai a pergunta.

    ATENÇÃO: 3 das 266 substantivas não têm proposição vinculada. Dizer isso é
    melhor que omitir a linha: quem cura precisa saber que vai ter de
    procurar a matéria à mão.
    """
    curadas = curadoria.ja_curadas(conexao)
    achadas = curadoria.candidatas(conexao, casa, legislatura, limite)

    if not achadas:
        log.warning(
            "Nenhuma candidata em %s na legislatura %d. Rode a ingestão antes.",
            casa, legislatura,
        )
        return

    log.info("=== %d candidatas em %s, da mais dividida ===", len(achadas), casa)
    log.info("")

    for posicao, candidata in enumerate(achadas, 1):
        marca = "JA CURADA" if candidata.votacao_id in curadas else ""
        log.info(
            "%2d. %-12s %s  %3d x %-3d  divisao %.0f%%  polaridade sugerida %+d  %s",
            posicao, candidata.votacao_id, candidata.data,
            candidata.sim, candidata.nao, candidata.divisao * 100,
            candidata.polaridade_sugerida, marca,
        )
        if candidata.ementa:
            log.info("    ementa: %s", candidata.ementa[:150])
        else:
            log.info("    ementa: (sem proposicao vinculada - procure pelo numero)")
        log.info("    votacao: %s", candidata.descricao[:110])

    log.info("")
    log.info("A afirmacao em linguagem leiga e a polaridade FINAL sao leitura humana.")
    log.info("Formato: src/api/Poligraph.Data/curadoria/perguntas-lote-1.json")


def rodar_validar(conexao: psycopg.Connection, legislatura: int, divisao_minima: float) -> None:
    """RF-20 e a validação do questionário. Não escreve no banco — é medição.

    ═══ 1. Quantas perguntas bastam ═══

    ═══ 1b. Desempate dirigido × aleatório ═══

    ═══ 2. Comunidade × partido (RF-20 / RQ2) ═══
    ATENÇÃO: Da CÂMARA e da legislatura validada (Pendência 54): "a mais recente" de qualquer casa
    comparava a matriz da Câmara com as comunidades do Senado quando ele rodava por
    último.
    """
    pessoas, votacoes, matriz, _ = _montar_matriz(conexao, legislatura)
    log.info("Matriz: %d pessoas × %d votações", len(pessoas), len(votacoes))

    candidatas = [
        indice
        for indice in range(len(votacoes))
        if validacao.divisao(matriz, indice) >= divisao_minima
    ]
    log.info(
        "%d votações com divisão >= %.2f servem como pergunta",
        len(candidatas),
        divisao_minima,
    )

    log.info("")
    log.info("  perguntas | empate mediano no topo | sozinhos no topo")
    for ponto in validacao.curva_de_discriminacao(
        matriz, candidatas, [4, 6, 8, 10, 12, 16, 22, 30, 40]
    ):
        log.info(
            "  %9d | %22.0f | %5.1f%% (%d de %d)",
            ponto.n_perguntas,
            ponto.empate_mediano,
            ponto.taxa_unicos * 100,
            ponto.unicos,
            ponto.deputados_avaliados,
        )

    _comparar_desempates(matriz, candidatas)

    execucao = conexao.execute(
        """
        SELECT max(id) FROM execucoes
         WHERE status = 'CONCLUIDA' AND casa = 'CAMARA' AND legislatura = %s
        """,
        (legislatura,),
    ).fetchone()
    if not execucao or execucao[0] is None:
        log.warning("Nenhuma execução concluída — rode `analisar` antes.")
        return

    comunidade_de = {
        linha[0]: linha[1]
        for linha in conexao.execute(
            "SELECT pessoa_id, comunidade FROM nos_metrica WHERE execucao_id = %s",
            (execucao[0],),
        ).fetchall()
        if linha[1] is not None
    }

    if not comunidade_de:
        log.warning("`nos_metrica` vazia — rode `analisar` com a versão que grava nós.")
        return

    partido_de = _partido_mais_recente(conexao, legislatura)
    arestas = [
        _Aresta(linha[0], linha[1], linha[2])
        for linha in conexao.execute(
            "SELECT pessoa_a, pessoa_b, peso FROM arestas_grafo WHERE execucao_id = %s",
            (execucao[0],),
        ).fetchall()
    ]

    rede = grafo.montar(list(comunidade_de), arestas)
    resultado = comparacao.comparar(rede, comunidade_de, partido_de)

    log.info("")
    log.info("=== Comunidade de voto x partido - %d deputados ===", resultado.n_pessoas)
    log.info("  %d comunidades detectadas, %d partidos", resultado.n_comunidades, resultado.n_partidos)
    log.info("  ARI (coincidência entre as duas): %.3f", resultado.ari)
    log.info("  Modularidade da comunidade: %.3f", resultado.modularidade_comunidade)
    log.info("  Modularidade do partido:    %.3f", resultado.modularidade_partido)
    log.info(
        "  → %s descreve melhor a estrutura de voto.",
        "A COMUNIDADE" if resultado.comunidade_descreve_melhor else "O PARTIDO",
    )


def _comparar_desempates(matriz, candidatas: list[int], base_inicial: int = 12) -> None:
    """Dirigido × aleatório, sobre uma amostra de deputados.

    RISCO: O grupo de controle é o que faz isto valer como evidência. Sem ele, o encolhimento
    do empate poderia vir apenas de perguntar mais — e a "contribuição técnica" seria
    só um contador de perguntas.

    ATENÇÃO: Amostra de deputados, não todos: são 655 × 6 rodadas × duas estratégias.
    """
    sorteio = np.random.default_rng(20260826)
    base = sorted(sorteio.choice(candidatas, size=base_inicial, replace=False).tolist())
    restantes = [candidata for candidata in candidatas if candidata not in base]

    quem_avaliar = sorteio.choice(matriz.shape[0], size=120, replace=False)

    def media_por_rodada(dirigido: bool) -> list[float]:
        """ATENÇÃO: Séries têm comprimentos diferentes: quem chega a 1 para antes. O último
        valor é repetido para a média não subir artificialmente ao perdê-los.
        """
        series = [
            validacao.simular_desempate(
                matriz, int(pessoa), base, restantes, rodadas=6, dirigido=dirigido
            )
            for pessoa in quem_avaliar
        ]
        mais_longa = max(len(serie) for serie in series)
        return [
            float(np.mean([serie[min(rodada, len(serie) - 1)] for serie in series]))
            for rodada in range(mais_longa)
        ]

    dirigido = media_por_rodada(True)
    aleatorio = media_por_rodada(False)

    log.info("")
    log.info("=== Desempate: dirigido x aleatorio (base de %d perguntas) ===", base_inicial)
    log.info("  perguntas extras | dirigido | aleatório")
    for extras, (com_direcao, ao_acaso) in enumerate(zip(dirigido, aleatorio)):
        log.info("  %16d | %8.1f | %9.1f", extras, com_direcao, ao_acaso)


@dataclass(frozen=True)
class _Aresta:
    """ATENÇÃO: `grafo.montar` espera `.pessoa_a`, `.pessoa_b` e `.valor`."""

    pessoa_a: int
    pessoa_b: int
    valor: float


def _partido_mais_recente(conexao: psycopg.Connection, legislatura: int) -> dict[int, str]:
    """ATENÇÃO: Partido vem do voto, não da pessoa: o registro é histórico e deputado troca.

    ATENÇÃO: O último voto DENTRO da legislatura validada: comparar comunidade × partido de 2019
    com a sigla de 2025 mediria a troca de partido, não o agrupamento.
    """
    linhas = conexao.execute(
        """
        SELECT DISTINCT ON (x.pessoa_id) x.pessoa_id, x.partido_no_voto
          FROM votos x JOIN votacoes v ON v.id = x.votacao_id
         WHERE v.legislatura = %s
         ORDER BY x.pessoa_id, v.data DESC
        """,
        (legislatura,),
    ).fetchall()

    return {pessoa: partido for pessoa, partido in linhas if partido}


def _votacoes_por_pessoa(matriz, pessoas: list[int], pesos) -> dict[int, int]:
    """Quantas votações cada pessoa efetivamente pesou.

    ATENÇÃO: Conta só posicionamento (Sim ou Não). Ausência e abstenção ficam de fora, pelo
    mesmo motivo do cálculo de afinidade: quem não se posicionou não discordou.

    RISCO: **E só as de peso maior que zero.** PROCEDIMENTAL tem peso 0 e não entra em
    nenhuma conta de similaridade — contá-la aqui produz um número que a tela exibe e
    o método não usou.

    ATENÇÃO: Medido: o Soldado Noelio aparecia com **40 votações** e nenhuma ligação, e 24
    daquelas 40 eram procedimentais. Um leitor olharia "40 votações" ao lado do mínimo
    de 20 e concluiria, com razão, que o corte estava errado — quando o que ele tinha
    eram 16. Número exibido que não é o número usado é o modo de falha deste projeto.
    """
    posicionou = (~np.isnan(matriz)) & (matriz != 0) & (pesos > 0)

    return {pessoa: int(posicionou[i].sum()) for i, pessoa in enumerate(pessoas)}


def _montar_matriz(conexao: psycopg.Connection, legislatura: int, casa: str = TipoCasa.CAMARA):
    """Monta a matriz pessoa × votação de UMA casa.

    Só votações nominais de plenário, e não secretas. Votação de comissão fica de fora:
    é 3× mais consensual que plenário (39% contra 12% de quase unanimidade), e misturá-la
    achataria a similaridade. No Senado o filtro de sigilo é o que mais corta — 239 das
    421 votações da legislatura.

    A casa é parâmetro, e nunca uma matriz só: as duas casas não votam as mesmas
    matérias, então similaridade entre deputado e senador não teria denominador
    (achado #7). São dois grafos independentes.

    As pessoas saem dos votos DESTA casa. Sem o recorte, a matriz ganharia 643
    deputados de linhas inteiramente vazias ao analisar o Senado — e o kNN passaria a
    comparar quem não tem voto em comum nenhum.
    """
    votacoes = conexao.execute(
        """
        SELECT id, categoria, EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM data)
          FROM votacoes
         WHERE casa = %s AND legislatura = %s AND plenario AND NOT secreta
         ORDER BY id
        """,
        (casa, legislatura),
    ).fetchall()

    pessoas = [
        linha[0]
        for linha in conexao.execute(
            """
            SELECT DISTINCT v.pessoa_id
              FROM votos v JOIN votacoes vt ON vt.id = v.votacao_id
             WHERE vt.casa = %s AND vt.legislatura = %s
             ORDER BY 1
            """,
            (casa, legislatura),
        ).fetchall()
    ]

    indice_votacao = {votacao[0]: ordem for ordem, votacao in enumerate(votacoes)}
    indice_pessoa = {pessoa: ordem for ordem, pessoa in enumerate(pessoas)}

    matriz = np.full((len(pessoas), len(votacoes)), np.nan)
    for votacao_id, pessoa_id, valor in conexao.execute(
        """
        SELECT v.votacao_id, v.pessoa_id, v.valor
          FROM votos v JOIN votacoes vt ON vt.id = v.votacao_id
         WHERE v.valor IS NOT NULL AND vt.casa = %s AND vt.legislatura = %s
        """,
        (casa, legislatura),
    ).fetchall():
        i, j = indice_pessoa.get(pessoa_id), indice_votacao.get(votacao_id)
        if i is not None and j is not None:
            matriz[i, j] = valor

    pesos = np.array(
        [similaridade.peso_da_votacao(cat, float(anos)) for _, cat, anos in votacoes]
    )

    return pessoas, votacoes, matriz, pesos
