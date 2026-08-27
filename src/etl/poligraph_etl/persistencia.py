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
                           nome_exibicao = %(nome_exibicao)s,
                           url_foto = %(url_foto)s
                     WHERE id = %(id)s
                    """,
                    {**pessoa, "id": existente[0]},
                )
                continue

            cur.execute(
                """
                INSERT INTO pessoas (nome_civil, nome_exibicao, cpf_hash, url_foto)
                VALUES (%(nome_civil)s, %(nome_exibicao)s, %(cpf_hash)s, %(url_foto)s)
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


def desconectar_proposicoes_ausentes(
    conexao: psycopg.Connection, votacoes: Sequence[dict]
) -> int:
    """Zera `proposicao_id` que não existe na tabela `proposicoes`, e diz quantos.

    🔴 Sem isto a ingestão morre com `ForeignKeyViolation` na primeira votação — foi o
    que aconteceu na primeira execução real contra a Câmara.

    ⚠️ **O CSV de votações não permite criar a proposição.** Ele traz só
    `ultimaApresentacaoProposicao_idProposicao`, sem sigla, número, ano ou ementa —
    conferido no cabeçalho do arquivo de 2025. E a proposição votada em 2025 pode ser
    de 2019, então nem ingerir `proposicoes-2025.csv` cobriria o conjunto.

    ⭐ `proposicao_id` é anulável **por desenho**, e nada que o produto faz hoje
    depende dela: afinidade e grafo saem do voto. Quem vai precisar é a RF-30, exibir a
    ementa original ao lado da pergunta — ver PL40.

    ⛔ Não é descarte silencioso: devolve a contagem, e o chamador registra no log.
    """
    ids = {v["proposicao_id"] for v in votacoes if v.get("proposicao_id") is not None}
    if not ids:
        return 0

    existentes = {
        linha[0]
        for linha in conexao.execute(
            "SELECT id FROM proposicoes WHERE id = ANY(%s)", (list(ids),)
        ).fetchall()
    }

    desconectadas = 0
    for votacao in votacoes:
        atual = votacao.get("proposicao_id")
        if atual is not None and atual not in existentes:
            votacao["proposicao_id"] = None
            desconectadas += 1

    return desconectadas


def pessoas_sem_cpf(conexao: psycopg.Connection) -> list[tuple[str, int]]:
    """Quem tem VOTO mas ainda não tem `cpf_hash`, com o id da Câmara junto.

    ⚠️ **Só quem votou**, e o recorte importa: são 7.889 pessoas no cadastro contra ~643
    com voto na legislatura. Buscar CPF de todas seriam 7.889 requisições para preencher
    7.246 registros que ninguém consulta.

    ⭐ E só quem AINDA não tem — reingerir ⛔ não refaz o trabalho.
    """
    return [
        (str(linha[0]), linha[1])
        for linha in conexao.execute(
            """
            SELECT DISTINCT f.id_externo, p.id
              FROM pessoas p
              JOIN pessoa_fonte_ids f ON f.pessoa_id = p.id AND f.fonte = 'CAMARA'
             WHERE p.cpf_hash IS NULL
               AND EXISTS (SELECT 1 FROM votos v WHERE v.pessoa_id = p.id)
             ORDER BY p.id
            """
        ).fetchall()
    ]


def gravar_cpf_hash(conexao: psycopg.Connection, pessoa_id: int, hash_cpf: str) -> None:
    """🔴 Grava o HASH, ⛔ nunca o CPF. RNF-13."""
    conexao.execute(
        "UPDATE pessoas SET cpf_hash = %s WHERE id = %s", (hash_cpf, pessoa_id)
    )


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


def gravar_despesas(
    conexao: psycopg.Connection, pessoa_ids: list[int], despesas: Sequence[dict]
) -> int:
    """Grava a cota parlamentar, substituindo o que já havia dos mesmos deputados.

    ⚠️ **Apaga antes de inserir**, e não é preguiça: o arquivo da Câmara é reconstruído
    com correções ([achado #19](../../docs/achados/019-csv-reconstruido-toda-madrugada.md)),
    e não há chave natural estável por linha — `ideDocumento` se repete entre
    parcelas. `ON CONFLICT` exigiria inventar uma chave que a fonte não garante.

    ⭐ O recorte do DELETE é (pessoa, ano) das linhas que estão entrando — reingerir
    2025 ⛔ não apaga 2024.
    """
    if not despesas:
        return 0

    anos = sorted({d["ano"] for d in despesas})

    conexao.execute(
        "DELETE FROM despesas WHERE pessoa_id = ANY(%s) AND ano = ANY(%s)",
        (pessoa_ids, anos),
    )

    return _executar_em_lotes(
        conexao,
        """
        INSERT INTO despesas (pessoa_id, ano, mes, categoria, fornecedor,
                              cnpj_ou_hash, fornecedor_eh_pessoa_fisica,
                              valor_liquido, data_emissao, url_documento)
        VALUES (%(pessoa_id)s, %(ano)s, %(mes)s, %(categoria)s, %(fornecedor)s,
                %(cnpj_ou_hash)s, %(fornecedor_eh_pessoa_fisica)s,
                %(valor_liquido)s, %(data_emissao)s, %(url_documento)s)
        """,
        despesas,
    )


def gravar_arestas(
    conexao: psycopg.Connection, execucao_id: int, arestas: Iterable
) -> int:
    """Grava as arestas do grafo kNN.

    🔴 Esta função não existia, e era por isso que `arestas_grafo` ficava vazia PARA
    SEMPRE. O `__main__` calculava o kNN, escrevia a contagem no log e descartava o
    resultado — sem erro, sem aviso: o ETL dizia "concluído", a execução fechava como
    `CONCLUIDA`, e `/api/grafo` devolvia 200 com um grafo em branco.

    ⚠️ `tipo` é sempre `SIMILARIDADE_VOTO` por enquanto. A coluna prevê
    `COMISSAO_COMUM` e `COAUTORIA`, que ainda não têm origem de dado.

    ⚠️ Sem `ON CONFLICT`, pelo mesmo motivo de `gravar_similaridades`: cada execução é
    um retrato novo, e conflito de chave aqui é bug, não caso normal.
    """
    linhas = [
        {
            "execucao_id": execucao_id,
            "pessoa_a": a.pessoa_a,
            "pessoa_b": a.pessoa_b,
            "tipo": "SIMILARIDADE_VOTO",
            "peso": a.valor,
        }
        for a in arestas
    ]

    return _executar_em_lotes(
        conexao,
        """
        INSERT INTO arestas_grafo (execucao_id, pessoa_a, pessoa_b, tipo, peso)
        VALUES (%(execucao_id)s, %(pessoa_a)s, %(pessoa_b)s, %(tipo)s, %(peso)s)
        """,
        linhas,
    )


def gravar_nos_metrica(
    conexao: psycopg.Connection, execucao_id: int, nos: Iterable
) -> int:
    """Grava comunidade, posição e volume de voto de cada nó.

    ⚠️ `governismo` e `disciplina` ficam NULOS: dependem da orientação de bancada, que
    vem do arquivo `votacoesOrientacoes` da Câmara e ainda não é ingerido. A coluna é
    anulável de propósito — no Senado ela nunca terá valor, porque lá não existe
    orientação de bancada.
    """
    linhas = [
        {
            "execucao_id": execucao_id,
            "pessoa_id": no.pessoa_id,
            "comunidade": no.comunidade,
            "eixo_x": no.eixo_x,
            "eixo_y": no.eixo_y,
            "n_votacoes": no.n_votacoes,
            "componente_1": no.componente_1,
            "componente_2": no.componente_2,
        }
        for no in nos
    ]

    return _executar_em_lotes(
        conexao,
        """
        -- ⚠️ `componente1`, SEM underscore antes do dígito. O snake_case do EF quebra
        --    por MAIÚSCULA, e `Componente1` não tem nenhuma antes do `1`. Escrever
        --    `componente_1` dá `UndefinedColumn` — aconteceu de verdade.
        INSERT INTO nos_metrica (execucao_id, pessoa_id, comunidade,
                                 eixo_x, eixo_y, governismo, disciplina, n_votacoes,
                                 componente1, componente2)
        VALUES (%(execucao_id)s, %(pessoa_id)s, %(comunidade)s,
                %(eixo_x)s, %(eixo_y)s, NULL, NULL, %(n_votacoes)s,
                %(componente_1)s, %(componente_2)s)
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
