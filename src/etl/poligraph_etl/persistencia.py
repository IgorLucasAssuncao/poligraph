"""Gravação no Postgres.

🔴 O EF Core é DONO do schema. Este módulo só escreve — ⛔ nunca cria tabela, nunca
altera coluna. Se o ETL precisar de um campo novo, ele nasce numa migration do EF.

⚠️ Toda escrita é idempotente (RF-09): reexecutar uma carga não duplica registro.
O ETL roda todo dia sobre os mesmos arquivos, que a Câmara reconstrói toda madrugada
(achado #19) — sem idempotência, o banco dobraria de tamanho por dia.
"""

from dataclasses import dataclass
from typing import Iterable, Sequence

import psycopg

LOTE = 5_000


@dataclass(frozen=True)
class ResumoCarga:
    pessoas: int
    votacoes: int
    votos: int


# ═══════════════════════════════════════════════════════════════════
# PÚBLICOS
# ═══════════════════════════════════════════════════════════════════


def gravar_pessoas(conexao: psycopg.Connection, pessoas: Sequence[dict]) -> int:
    """Insere ou atualiza pessoas, casando pelo ID externo da fonte.

    ⭐ O `pessoa_fonte_id` é que dá a idempotência: a chave é (fonte, id_externo),
    então a mesma pessoa reingerida encontra o próprio registro.
    """
    inseridas = 0
    with conexao.cursor() as cur:
        for pessoa in pessoas:
            cur.execute(
                """
                SELECT pessoa_id FROM pessoa_fonte_ids
                 WHERE fonte = %(fonte)s AND id_externo = %(id_externo)s
                """,
                pessoa,
            )
            existente = cur.fetchone()

            if existente:
                cur.execute(
                    """
                    UPDATE pessoas
                       SET nome_civil = %(nome_civil)s,
                           nome_exibicao = %(nome_exibicao)s
                     WHERE id = %(id)s
                    """,
                    {**pessoa, "id": existente[0]},
                )
                continue

            cur.execute(
                """
                INSERT INTO pessoas (nome_civil, nome_exibicao, cpf_hash)
                VALUES (%(nome_civil)s, %(nome_exibicao)s, %(cpf_hash)s)
                RETURNING id
                """,
                pessoa,
            )
            pessoa_id = cur.fetchone()[0]

            cur.execute(
                """
                INSERT INTO pessoa_fonte_ids (pessoa_id, fonte, id_externo, metodo, confianca)
                VALUES (%(pessoa_id)s, %(fonte)s, %(id_externo)s,
                        %(metodo)s, %(confianca)s)
                """,
                {**pessoa, "pessoa_id": pessoa_id},
            )
            inseridas += 1

    return inseridas


def gravar_votacoes(conexao: psycopg.Connection, votacoes: Sequence[dict]) -> int:
    """Grava votações. `ON CONFLICT (id) DO UPDATE` — a Câmara corrige dado retroativo."""
    return _executar_em_lotes(
        conexao,
        """
        INSERT INTO votacoes (id, casa, legislatura, data, orgao, descricao,
                             proposicao_id, categoria, secreta, plenario,
                             votos_sim, votos_nao)
        VALUES (%(id)s, %(casa)s, %(legislatura)s, %(data)s, %(orgao)s, %(descricao)s,
                %(proposicao_id)s, %(categoria)s, %(secreta)s, %(plenario)s,
                %(votos_sim)s, %(votos_nao)s)
        ON CONFLICT (id) DO UPDATE SET
            descricao = EXCLUDED.descricao,
            categoria = EXCLUDED.categoria,
            votos_sim = EXCLUDED.votos_sim,
            votos_nao = EXCLUDED.votos_nao
        """,
        votacoes,
    )


def gravar_votos(conexao: psycopg.Connection, votos: Sequence[dict]) -> int:
    """Grava votos.

    ⚠️ `partido_no_voto` e `uf_no_voto` são atualizados no conflito de propósito:
    são registro histórico do momento do voto, e a Câmara corrige filiação
    retroativamente. Normalizar para o partido atual destruiria a informação —
    14 deputados trocaram de partido só em 2025.
    """
    return _executar_em_lotes(
        conexao,
        """
        INSERT INTO votos (votacao_id, pessoa_id, valor, partido_no_voto, uf_no_voto)
        VALUES (%(votacao_id)s, %(pessoa_id)s, %(valor)s,
                %(partido_no_voto)s, %(uf_no_voto)s)
        ON CONFLICT (votacao_id, pessoa_id) DO UPDATE SET
            valor = EXCLUDED.valor,
            partido_no_voto = EXCLUDED.partido_no_voto,
            uf_no_voto = EXCLUDED.uf_no_voto
        """,
        votos,
    )


def gravar_similaridades(
    conexao: psycopg.Connection, execucao_id: int, pares: Iterable
) -> int:
    """Grava os pares de similaridade de uma execução.

    ⚠️ Não usa ON CONFLICT: cada execução é um retrato novo e independente. Se a
    mesma execução for regravada, é bug — e o conflito de chave primária avisa.
    """
    linhas = [
        {
            "execucao_id": execucao_id,
            "pessoa_a": p.pessoa_a,
            "pessoa_b": p.pessoa_b,
            "metrica": p.metrica,
            "valor": p.valor,
            "n_votacoes_comuns": p.n_votacoes_comuns,
        }
        for p in pares
    ]

    return _executar_em_lotes(
        conexao,
        """
        INSERT INTO similaridades (execucao_id, pessoa_a, pessoa_b, metrica,
                                  valor, n_votacoes_comuns)
        VALUES (%(execucao_id)s, %(pessoa_a)s, %(pessoa_b)s, %(metrica)s,
                %(valor)s, %(n_votacoes_comuns)s)
        """,
        linhas,
    )


def abrir_execucao(
    conexao: psycopg.Connection, casa: str, legislatura: int, k: int, versao: str
) -> int:
    with conexao.cursor() as cur:
        cur.execute(
            """
            INSERT INTO execucoes (casa, legislatura, k, versao_carga, status)
            VALUES (%s, %s, %s, %s, 'EM_ANDAMENTO')
            RETURNING id
            """,
            (casa, legislatura, k, versao),
        )
        return cur.fetchone()[0]


def fechar_execucao(conexao: psycopg.Connection, execucao_id: int, sucesso: bool) -> None:
    with conexao.cursor() as cur:
        cur.execute(
            """
            UPDATE execucoes
               SET status = %s, concluida_em = now()
             WHERE id = %s
            """,
            ("CONCLUIDA" if sucesso else "FALHOU", execucao_id),
        )


# ═══════════════════════════════════════════════════════════════════
# PRIVADOS
# ═══════════════════════════════════════════════════════════════════


def _executar_em_lotes(
    conexao: psycopg.Connection, comando: str, linhas: Sequence[dict]
) -> int:
    """Executa em lotes. ⚠️ 463 mil votos numa transação só estouraria a memória."""
    if not linhas:
        return 0

    total = 0
    with conexao.cursor() as cur:
        for inicio in range(0, len(linhas), LOTE):
            fatia = linhas[inicio : inicio + LOTE]
            cur.executemany(comando, fatia)
            total += len(fatia)

    return total
