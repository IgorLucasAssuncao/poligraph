"""CONFERÊNCIA — regras de plausibilidade sobre o que já está no banco.

Roda DEPOIS da carga e ⛔ escreve nada. Existe porque a restrição do banco e o canário
de volume ⛔ pegam o número plausível e errado: os 203 senadores da 55ª passaram pelos
dois, e só apareceram quando duas legislaturas foram vistas lado a lado (achado #37).

## Severidade

| | Efeito |
|---|---|
| `ERRO` | O comando termina com falha. O dado ⛔ deve ir à tela assim |
| `AVISO` | Vai ao relatório. É peculiaridade conhecida da fonte, ou pede olhar humano |

## Os limites são medidos, ⛔ escolhidos

📐 Medido em 2026-10-02, 51ª a 57ª legislatura (ver `plano/09 §5.2`):

| | Câmara | Senado |
|---|---:|---:|
| Cadeiras | 513 | 81 |
| Quem votou numa legislatura — menor e maior | 556 · 644 | 100 · 111 |
| Teto adotado | **700** | **125** |

O teto deixa folga para suplentes e ⛔ para o dobro: o Senado com 203 era o erro.
"""

from dataclasses import dataclass

CADEIRAS = {"CAMARA": 513, "SENADO": 81}

# Quem votou numa legislatura, contando suplentes e quem assumiu no meio.
TETO_DE_VOTANTES_NA_LEGISLATURA = {"CAMARA": 700, "SENADO": 125}

# 📐 82 de 81 acontece de verdade: no Senado, titular e suplente aparecem juntos no dia
#    da troca (SF-5999, 2019-08-14, Tocantins com 4). Passar de 10% acima é outra coisa.
FOLGA_DE_VOTANTES_NA_VOTACAO = 1.10

SENADORES_POR_UF = 3

# Acima disto, a legislatura tem mais votação sem voto nominal que com — a 51ª da Câmara
# tem 1.541 de 1.548, e o painel as conta como votações.
PROPORCAO_MAXIMA_SEM_VOTO = 0.5

PROPORCAO_MAXIMA_SEM_PARTIDO = 0.01

# O mesmo corte da ingestão: desde 2004 o código do Senado cresce com a data (#37).
PRIMEIRO_CODIGO_DE_2004 = 2523


@dataclass(frozen=True)
class Achado:
    regra: str
    severidade: str
    casa: str
    legislatura: int | None
    detalhe: str


# ═══════════════════════════════════════════════════════════════════
# As regras — funções puras sobre o que as consultas devolvem
# ═══════════════════════════════════════════════════════════════════


def votantes_na_legislatura(linhas: list[tuple[str, int, int]]) -> list[Achado]:
    """`(casa, legislatura, quem votou)`. Acima do teto é ERRO — foi o caso dos 203."""
    return [
        Achado(
            "votantes-na-legislatura", "ERRO", casa, legislatura,
            f"{votantes} votaram; o teto é {TETO_DE_VOTANTES_NA_LEGISLATURA[casa]} "
            f"para {CADEIRAS[casa]} cadeiras",
        )
        for casa, legislatura, votantes in linhas
        if votantes > TETO_DE_VOTANTES_NA_LEGISLATURA.get(casa, votantes)
    ]


def votantes_na_votacao(linhas: list[tuple[str, int, str, int]]) -> list[Achado]:
    """`(casa, legislatura, votação, votantes)`. Acima das cadeiras é AVISO; muito acima, ERRO."""
    achados = []
    for casa, legislatura, votacao, votantes in linhas:
        cadeiras = CADEIRAS.get(casa)
        if cadeiras is None or votantes <= cadeiras:
            continue

        grave = votantes > cadeiras * FOLGA_DE_VOTANTES_NA_VOTACAO
        achados.append(Achado(
            "votantes-na-votacao", "ERRO" if grave else "AVISO", casa, legislatura,
            f"{votacao}: {votantes} votantes para {cadeiras} cadeiras",
        ))
    return achados


def data_fora_da_legislatura(linhas: list[tuple[str, int, str, str]]) -> list[Achado]:
    """`(casa, legislatura, votação, data)` já filtradas pela consulta. Toda linha é ERRO."""
    return [
        Achado("data-fora-da-legislatura", "ERRO", casa, legislatura,
               f"{votacao} em {data} ⛔ cai na {legislatura}ª")
        for casa, legislatura, votacao, data in linhas
    ]


def codigo_fora_de_epoca(linhas: list[tuple[int, str, str]]) -> list[Achado]:
    """`(legislatura, id SF-…, data)`. O descarte da ingestão falhou, ou a carga é anterior a ele."""
    achados = []
    for legislatura, votacao, data in linhas:
        codigo = votacao.removeprefix("SF-")
        if not codigo.isdigit():
            continue
        if (int(codigo) >= PRIMEIRO_CODIGO_DE_2004) != (int(str(data)[:4]) >= 2004):
            achados.append(Achado("codigo-fora-de-epoca", "ERRO", "SENADO", legislatura,
                                  f"{votacao} datada de {data}"))
    return achados


def placar_divergente(linhas: list[tuple[int, str, int, int, int, int]]) -> list[Achado]:
    """`(legislatura, votação, sim gravado, sim contado, não gravado, não contado)`, da Câmara."""
    return [
        Achado("placar-divergente", "AVISO", "CAMARA", legislatura,
               f"{votacao}: placar {sim_g}×{nao_g}, votos contados {sim_c}×{nao_c}")
        for legislatura, votacao, sim_g, sim_c, nao_g, nao_c in linhas
        if (sim_g, nao_g) != (sim_c, nao_c)
    ]


def sem_posicao_nenhuma(linhas: list[tuple[str, int, str]]) -> list[Achado]:
    """`(casa, legislatura, votação)` com voto registrado e nenhuma posição.

    📐 Na Câmara são 11, quase todas eleição de autoridade ("Eleito o Sr. …"): votação
    secreta de fato, que a base marca como aberta. Ela ⛔ entra no cálculo — sem posição
    ⛔ há o que comparar —, mas conta como "aberta" no painel.
    """
    return [
        Achado("sem-posicao-nenhuma", "AVISO", casa, legislatura,
               f"{votacao}: só presença registrada — secreta de fato?")
        for casa, legislatura, votacao in linhas
        if casa == "CAMARA"
    ]


def votacoes_sem_voto(linhas: list[tuple[str, int, int, int]]) -> list[Achado]:
    """`(casa, legislatura, votações, sem voto)`. Mais da metade sem voto nominal é AVISO."""
    return [
        Achado("votacoes-sem-voto", "AVISO", casa, legislatura,
               f"{sem} de {total} votações sem voto nominal ({sem / total:.0%})")
        for casa, legislatura, total, sem in linhas
        if total and sem / total > PROPORCAO_MAXIMA_SEM_VOTO
    ]


def sem_partido(linhas: list[tuple[str, int, int, int]]) -> list[Achado]:
    """`(casa, legislatura, votos, sem partido)`. 📐 Era assim que os votos de 1998 apareciam."""
    return [
        Achado("sem-partido", "AVISO", casa, legislatura,
               f"{sem} de {total} votos sem partido ({sem / total:.1%})")
        for casa, legislatura, total, sem in linhas
        if total and sem / total > PROPORCAO_MAXIMA_SEM_PARTIDO
    ]


def senadores_demais_por_uf(linhas: list[tuple[int, str, str, int]]) -> list[Achado]:
    """`(legislatura, votação, UF, senadores)`. Mais de 3 é a troca de titular e suplente no dia."""
    return [
        Achado("senadores-por-uf", "AVISO", "SENADO", legislatura,
               f"{votacao}: {quantos} senadores de {uf}")
        for legislatura, votacao, uf, quantos in linhas
        if uf and quantos > SENADORES_POR_UF
    ]


# ═══════════════════════════════════════════════════════════════════
# As consultas — uma por regra, na mesma ordem
# ═══════════════════════════════════════════════════════════════════

CONSULTAS = {
    "votantes_na_legislatura": """
        SELECT t.casa, t.legislatura, count(DISTINCT v.pessoa_id)
          FROM votos v JOIN votacoes t ON t.id = v.votacao_id
         GROUP BY 1, 2
    """,
    "votantes_na_votacao": """
        SELECT t.casa, t.legislatura, t.id, count(*)
          FROM votos v JOIN votacoes t ON t.id = v.votacao_id
         GROUP BY 1, 2, 3
        HAVING count(*) > CASE t.casa WHEN 'CAMARA' THEN 513 ELSE 81 END
    """,
    "data_fora_da_legislatura": """
        SELECT casa, legislatura, id, data::text
          FROM votacoes
         WHERE data <  make_date(2023 + (legislatura - 57) * 4, 2, 1)
            OR data >= make_date(2027 + (legislatura - 57) * 4, 2, 1)
    """,
    "codigo_fora_de_epoca": """
        SELECT legislatura, id, data::text FROM votacoes WHERE casa = 'SENADO'
    """,
    "placar_divergente": """
        SELECT t.legislatura, t.id, t.votos_sim, s.sim, t.votos_nao, s.nao
          FROM votacoes t
          JOIN (SELECT votacao_id,
                       count(*) FILTER (WHERE valor = 1)  AS sim,
                       count(*) FILTER (WHERE valor = -1) AS nao
                  FROM votos GROUP BY 1) s ON s.votacao_id = t.id
         WHERE t.casa = 'CAMARA'
           AND (t.votos_sim IS DISTINCT FROM s.sim OR t.votos_nao IS DISTINCT FROM s.nao)
    """,
    "sem_posicao_nenhuma": """
        SELECT t.casa, t.legislatura, t.id
          FROM votacoes t
          JOIN (SELECT votacao_id FROM votos GROUP BY 1
                HAVING count(*) FILTER (WHERE valor IS NOT NULL) = 0) s
            ON s.votacao_id = t.id
         WHERE NOT t.secreta
    """,
    "votacoes_sem_voto": """
        SELECT t.casa, t.legislatura, count(*),
               count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM votos v WHERE v.votacao_id = t.id))
          FROM votacoes t GROUP BY 1, 2
    """,
    "sem_partido": """
        SELECT t.casa, t.legislatura, count(*),
               count(*) FILTER (WHERE v.partido_no_voto IN ('', 'Sem registro'))
          FROM votos v JOIN votacoes t ON t.id = v.votacao_id
         GROUP BY 1, 2
    """,
    "senadores_demais_por_uf": """
        SELECT t.legislatura, t.id, v.uf_no_voto, count(*)
          FROM votos v JOIN votacoes t ON t.id = v.votacao_id
         WHERE t.casa = 'SENADO'
         GROUP BY 1, 2, 3
        HAVING count(*) > 3
    """,
}

REGRAS = {
    "votantes_na_legislatura": votantes_na_legislatura,
    "votantes_na_votacao": votantes_na_votacao,
    "data_fora_da_legislatura": data_fora_da_legislatura,
    "codigo_fora_de_epoca": codigo_fora_de_epoca,
    "placar_divergente": placar_divergente,
    "sem_posicao_nenhuma": sem_posicao_nenhuma,
    "votacoes_sem_voto": votacoes_sem_voto,
    "sem_partido": sem_partido,
    "senadores_demais_por_uf": senadores_demais_por_uf,
}


def conferir(executar) -> list[Achado]:
    """Roda todas as regras. `executar(sql)` devolve as linhas — o chamador tem a conexão."""
    achados: list[Achado] = []
    for nome, regra in REGRAS.items():
        achados.extend(regra([tuple(linha) for linha in executar(CONSULTAS[nome])]))
    return achados
