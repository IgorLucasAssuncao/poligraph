"""CONFERÊNCIA — regras de plausibilidade sobre o que já está no banco.

Roda DEPOIS da carga e não escreve nada. Existe porque a restrição do banco e o canário
de volume não pegam o número plausível e errado: os 203 senadores da 55ª passaram pelos
dois, e só apareceram quando duas legislaturas foram vistas lado a lado (achado #37).

## Severidade

| | Efeito |
|---|---|
| `ERRO` | O comando termina com falha. O dado não deve ir à tela assim |
| `AVISO` | Vai ao relatório. É peculiaridade conhecida da fonte, ou pede olhar humano |

## Os limites são medidos, não escolhidos

MEDIDO: Medido em 2026-10-02, 51ª a 57ª legislatura (ver `plano/09 §5.2`):

| | Câmara | Senado |
|---|---:|---:|
| Cadeiras | 513 | 81 |
| Quem votou numa legislatura — menor e maior | 556 · 644 | 100 · 111 |
| Teto adotado | **700** | **125** |

O teto deixa folga para suplentes e não para o dobro: o Senado com 203 era o erro.
"""

from dataclasses import dataclass

CADEIRAS = {"CAMARA": 513, "SENADO": 81}

# Quem votou numa legislatura, contando suplentes e quem assumiu no meio.
TETO_DE_VOTANTES_NA_LEGISLATURA = {"CAMARA": 700, "SENADO": 125}

# MEDIDO: 82 de 81 acontece de verdade: no Senado, titular e suplente aparecem juntos no dia
#    da troca (SF-5999, 2019-08-14, Tocantins com 4). Passar de 10% acima é outra coisa.
FOLGA_DE_VOTANTES_NA_VOTACAO = 1.10

SENADORES_POR_UF = 3

# Acima disto, a legislatura tem mais votação sem voto nominal que com — a 51ª da Câmara
# tem 1.541 de 1.548, e o painel as conta como votações.
PROPORCAO_MAXIMA_SEM_VOTO = 0.5

PROPORCAO_MAXIMA_SEM_PARTIDO = 0.01

# O mesmo corte da ingestão: desde 2004 o código do Senado cresce com a data (#37).
PRIMEIRO_CODIGO_DE_2004 = 2523

# Pendência 76. MEDIDO em 2026-10-02, eleições de 2018 e 2022: o maior patrimônio declarado na base é
# R$ 240 mi, e o percentil 99 fica entre R$ 35 mi e R$ 48 mi. O TSE é autodeclarado, e o
# "candidato mais rico do Brasil" já foi um bem digitado com dígitos a mais (R$ 12 bi).
TETO_DE_PATRIMONIO = 500_000_000

# MEDIDO: o maior salto entre 2018 e 2022, entre quem declarou mais de R$ 100 mil, foi de 14 vezes.
SALTO_DE_PATRIMONIO = 50
PATRIMONIO_MINIMO_DO_SALTO = 10_000_000

# Pendência 81. Um real de folga: a reconciliação arredonda cada motivo para centavos.
TOLERANCIA_DA_RECONCILIACAO = 1.0


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
               f"{votacao} em {data} não cai na {legislatura}ª")
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

    MEDIDO: Na Câmara são 11, quase todas eleição de autoridade ("Eleito o Sr. …"): votação
    secreta de fato, que a base marca como aberta. Ela não entra no cálculo — sem posição
    Não há o que comparar —, mas conta como "aberta" no painel.
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
    """`(casa, legislatura, votos, sem partido)`. MEDIDO: Era assim que os votos de 1998 apareciam."""
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


def patrimonio_acima_do_teto(linhas: list[tuple[str, int, float]]) -> list[Achado]:
    """`(nome, eleição, total declarado)`. Acima do teto é AVISO: pode ser dígito a mais."""
    return [
        Achado("patrimonio-acima-do-teto", "AVISO", "TSE", None,
               f"{nome}, eleição de {eleicao}: R$ {total / 1e6:,.1f} mi declarados")
        for nome, eleicao, total in linhas
        if total > TETO_DE_PATRIMONIO
    ]


def salto_de_patrimonio(linhas: list[tuple[str, int, float, int, float]]) -> list[Achado]:
    """`(nome, eleição anterior, total, eleição seguinte, total)`. Multiplicar por 50 é AVISO.

    Só conta quando o segundo total passa de `PATRIMONIO_MINIMO_DO_SALTO`: de R$ 1 mil para
    R$ 100 mil também é 100 vezes, e não diz nada.
    """
    return [
        Achado("salto-de-patrimonio", "AVISO", "TSE", None,
               f"{nome}: R$ {antes / 1e6:,.2f} mi em {eleicao_antes} → "
               f"R$ {depois / 1e6:,.1f} mi em {eleicao_depois}")
        for nome, eleicao_antes, antes, eleicao_depois, depois in linhas
        if depois > PATRIMONIO_MINIMO_DO_SALTO and antes > 0 and depois / antes >= SALTO_DE_PATRIMONIO
    ]


def reconciliacao_nao_fecha(linhas: list[tuple[str, str, int, float]]) -> list[Achado]:
    """`(conjunto, medida, ano, resíduo)`. Fonte − base − motivos acima de R$ 1 é ERRO: diferença sem justificativa."""
    return [
        Achado("reconciliacao-nao-fecha", "ERRO", conjunto, None,
               f"{medida} de {ano}: R$ {residuo:,.2f} entre o Portal e a base sem motivo")
        for conjunto, medida, ano, residuo in linhas
        if abs(residuo) > TOLERANCIA_DA_RECONCILIACAO
    ]


def base_mudou_depois_da_reconciliacao(linhas: list[tuple[str, str, int, float, float]]) -> list[Achado]:
    """`(conjunto, medida, ano, registrado, na base hoje)`. A base mudou depois da carga, e a justificativa ficou velha."""
    return [
        Achado("base-mudou-depois-da-reconciliacao", "ERRO", conjunto, None,
               f"{medida} de {ano}: reconciliado R$ {registrado:,.2f}, na base hoje R$ {hoje:,.2f}")
        for conjunto, medida, ano, registrado, hoje in linhas
        if abs(registrado - hoje) > TOLERANCIA_DA_RECONCILIACAO
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
    "patrimonio_acima_do_teto": """
        SELECT p.nome_exibicao, t.ano_eleicao, sum(t.valor)::float
          FROM patrimonios t JOIN pessoas p ON p.id = t.pessoa_id
         GROUP BY 1, 2, t.pessoa_id
    """,
    "reconciliacao_nao_fecha": """
        SELECT r.conjunto, r.medida, r.ano,
               (r.total_na_fonte - r.total_na_base - coalesce(sum(m.valor), 0))::float
          FROM reconciliacoes r LEFT JOIN reconciliacao_motivos m ON m.reconciliacao_id = r.id
         GROUP BY r.id, r.conjunto, r.medida, r.ano, r.total_na_fonte, r.total_na_base
    """,
    "base_mudou_depois_da_reconciliacao": """
        SELECT r.conjunto, r.medida, r.ano, r.total_na_base::float,
               coalesce(CASE
                   WHEN r.conjunto = 'EMENDAS' AND r.medida = 'EMPENHADO'
                       THEN (SELECT sum(e.valor_empenhado) FROM emendas e WHERE e.ano = r.ano)
                   WHEN r.conjunto = 'EMENDAS' AND r.medida = 'PAGO'
                       THEN (SELECT sum(e.valor_pago) FROM emendas e WHERE e.ano = r.ano)
                   WHEN r.conjunto = 'PAGO_X_RECEBIDO'
                       THEN (SELECT sum(f.valor) FROM emendas_favorecidos f
                              WHERE f.codigo_emenda IN (SELECT codigo_emenda FROM emendas e WHERE e.ano = r.ano))
                   WHEN r.conjunto IN ('COTA_CAMARA', 'COTA_SENADO')
                       THEN (SELECT sum(d.valor_liquido) FROM despesas d JOIN cargas c ON c.id = d.carga_id
                              WHERE d.ano = r.ano AND c.fonte = substring(r.conjunto FROM 6))
                   ELSE (SELECT sum(f.valor) FROM emendas_favorecidos f
                          WHERE extract(year FROM f.competencia) = r.ano)
               END, 0)::float
          FROM reconciliacoes r
    """,
    "salto_de_patrimonio": """
        SELECT p.nome_exibicao, a.ano_eleicao, a.valor, b.ano_eleicao, b.valor
          FROM (SELECT pessoa_id, ano_eleicao, sum(valor)::float AS valor
                  FROM patrimonios GROUP BY 1, 2) a
          JOIN (SELECT pessoa_id, ano_eleicao, sum(valor)::float AS valor
                  FROM patrimonios GROUP BY 1, 2) b
            ON b.pessoa_id = a.pessoa_id AND b.ano_eleicao = a.ano_eleicao + 4
          JOIN pessoas p ON p.id = a.pessoa_id
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
    "patrimonio_acima_do_teto": patrimonio_acima_do_teto,
    "salto_de_patrimonio": salto_de_patrimonio,
    "reconciliacao_nao_fecha": reconciliacao_nao_fecha,
    "base_mudou_depois_da_reconciliacao": base_mudou_depois_da_reconciliacao,
}


def conferir(executar) -> list[Achado]:
    """Roda todas as regras. `executar(sql)` devolve as linhas — o chamador tem a conexão."""
    achados: list[Achado] = []
    for nome, regra in REGRAS.items():
        achados.extend(regra([tuple(linha) for linha in executar(CONSULTAS[nome])]))
    return achados
