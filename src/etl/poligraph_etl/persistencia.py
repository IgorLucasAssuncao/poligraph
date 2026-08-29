"""SAÍDA — a única camada que escreve no Postgres.

🔴 **O EF Core é dono do schema.** Este módulo só grava: ⛔ nunca cria tabela, nunca
altera coluna. Campo novo nasce em migration do EF, e `test_contrato_schema` trava a
divergência de nome de tabela, de coluna e de literal combinado entre os dois lados.

🔴 **Aqui ⛔ não se decide o que gravar.** O que entra e o que é descartado foi resolvido
na fase de TRATAMENTO; misturar as duas faz um descarte virar número plausível e errado.

## Idempotência (RF-09) — e por que cada tabela usa uma estratégia

O ETL roda todo dia sobre arquivos que a Câmara **reconstrói toda madrugada** e que o
Portal **corrige retroativamente**. Sem idempotência o banco dobraria por dia.

| Estratégia | Onde | Por quê |
|---|---|---|
| `ON CONFLICT (id) DO UPDATE` | `votacoes` · `votos` · `pessoas` | Há chave natural estável |
| `ON CONFLICT DO NOTHING` | `emendas` | `ux_emenda_autor_codigo` já garante unicidade |
| `DELETE` do recorte + `INSERT` | `despesas` · `receitas_de_campanha` | ⚠️ ⛔ **Não há** chave natural por linha: `ideDocumento` se repete entre parcelas, e o mesmo doador aparece várias vezes legitimamente |

⚠️ O recorte do `DELETE` é sempre o **mínimo**: reingerir 2025 ⛔ não apaga 2024.

📐 [achado #19](../../../docs/achados/019-csv-reconstruido-toda-madrugada.md)
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
                # 🔴 `COALESCE` na foto: uma fonte mais pobre ⛔ não apaga o que uma mais
                #    rica já trouxe. Medido — `senadores_dos_votos` roda DEPOIS de
                #    `senadores_para_linhas` e devolve os mesmos 81 em exercício com
                #    `url_foto` nula, porque o registro de voto não traz foto. Com
                #    atribuição direta, os 104 senadores terminavam sem foto no banco,
                #    sem erro e sem log.
                cur.execute(
                    """
                    UPDATE pessoas
                       SET nome_civil = %(nome_civil)s,
                           nome_exibicao = %(nome_exibicao)s,
                           url_foto = COALESCE(%(url_foto)s, url_foto)
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


def gravar_proposicoes(
    conexao: psycopg.Connection, proposicoes: Sequence[dict]
) -> int:
    """Grava proposições. `ON CONFLICT DO UPDATE` — a Câmara corrige ementa retroativa."""
    return _executar_em_lotes(
        conexao,
        """
        INSERT INTO proposicoes (id, sigla_tipo, numero, ano, ementa, url_inteiro_teor)
        VALUES (%(id)s, %(sigla_tipo)s, %(numero)s, %(ano)s, %(ementa)s,
                %(url_inteiro_teor)s)
        ON CONFLICT (id) DO UPDATE SET
            sigla_tipo = EXCLUDED.sigla_tipo,
            numero = EXCLUDED.numero,
            ano = EXCLUDED.ano,
            ementa = EXCLUDED.ementa
        """,
        proposicoes,
    )


def vincular_proposicoes(
    conexao: psycopg.Connection, vinculo: dict[str, int]
) -> int:
    """Liga cada votação à sua proposição.

    ⚠️ Passo SEPARADO da gravação das votações, e ⛔ não uma coluna a mais no `INSERT`
    delas. A votação é ingerida antes de a proposição existir — a FK recusaria a linha,
    e a ingestão inteira do ano cairia por causa de um vínculo.
    """
    return _executar_em_lotes(
        conexao,
        """
        UPDATE votacoes SET proposicao_id = %(proposicao_id)s
         WHERE id = %(votacao_id)s
           AND EXISTS (SELECT 1 FROM proposicoes p WHERE p.id = %(proposicao_id)s)
        """,
        [{"votacao_id": v, "proposicao_id": p} for v, p in vinculo.items()],
    )


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
    ids = {
        votacao["proposicao_id"]
        for votacao in votacoes
        if votacao.get("proposicao_id") is not None
    }
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


def mapa_de_cpf_hash(conexao: psycopg.Connection) -> dict[str, int]:
    """`cpf_hash` -> `pessoa_id` — o de-para que casa o TSE com a Câmara.

    ⭐ O join acontece **entre hashes**, ⛔ nunca entre CPFs em claro.

    ⚠️ Traz também quem foi excluído logicamente: o filtro de exclusão é da API, e o ETL
    ⛔ não pode reinserir receita órfã por não enxergar o dono.
    """
    return {
        linha[0]: linha[1]
        for linha in conexao.execute(
            "SELECT cpf_hash, id FROM pessoas WHERE cpf_hash IS NOT NULL"
        ).fetchall()
    }


def gravar_receitas(
    conexao: psycopg.Connection, ano_eleicao: int, linhas: Sequence[dict]
) -> int:
    """Grava o financiamento, substituindo a eleição que está entrando.

    ⚠️ O mesmo doador aparece várias vezes com o mesmo valor **legitimamente** (doação
    parcelada), então ⛔ não há chave natural por linha. Reingerir 2022 ⛔ não toca 2018.
    """
    if not linhas:
        return 0

    conexao.execute(
        "DELETE FROM receitas_de_campanha WHERE ano_eleicao = %s", (ano_eleicao,)
    )

    return _executar_em_lotes(
        conexao,
        """
        INSERT INTO receitas_de_campanha (pessoa_id, ano_eleicao, fonte_receita,
                                          origem_receita, doador, doador_cnpj_ou_hash,
                                          doador_eh_pessoa_fisica, valor)
        VALUES (%(pessoa_id)s, %(ano_eleicao)s, %(fonte_receita)s,
                %(origem_receita)s, %(doador)s, %(doador_cnpj_ou_hash)s,
                %(doador_eh_pessoa_fisica)s, %(valor)s)
        """,
        linhas,
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


def gravar_orientacoes(
    conexao: psycopg.Connection, orientacoes: Sequence[dict]
) -> int:
    """Grava orientação de bancada. ⚠️ Só a Câmara publica isso."""
    return _executar_em_lotes(
        conexao,
        """
        INSERT INTO orientacoes (votacao_id, bancada, orientacao)
        VALUES (%(votacao_id)s, %(bancada)s, %(orientacao)s)
        ON CONFLICT (votacao_id, bancada) DO UPDATE SET
            orientacao = EXCLUDED.orientacao
        """,
        orientacoes,
    )


def gravar_metricas_de_alinhamento(
    conexao: psycopg.Connection, execucao_id: int, metricas: Sequence[dict]
) -> int:
    """Preenche `governismo` e `disciplina` nos nós já gravados.

    ⚠️ `UPDATE`, ⛔ não `INSERT`: o nó nasce em `gravar_nos_metrica` com comunidade e
    posição, e o alinhamento é calculado depois — depende das orientações, que ⛔ não
    existem para o Senado.
    """
    return _executar_em_lotes(
        conexao,
        """
        UPDATE nos_metrica
           SET governismo = %(governismo)s, disciplina = %(disciplina)s
         WHERE execucao_id = %(execucao_id)s AND pessoa_id = %(pessoa_id)s
        """,
        [{**m, "execucao_id": execucao_id} for m in metricas],
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
            "pessoa_a": par.pessoa_a,
            "pessoa_b": par.pessoa_b,
            "metrica": par.metrica,
            "valor": par.valor,
            "n_votacoes_comuns": par.n_votacoes_comuns,
        }
        for par in pares
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


def gravar_noticias(conexao: psycopg.Connection, noticias: Sequence) -> dict[str, int]:
    """Grava as notícias e devolve `url -> id`.

    ⭐ **Devolve o de-para porque a menção precisa do id**, e a notícia pode já existir
    de uma coleta anterior — `RETURNING` sozinho ⛔ não traria a linha que ⛔ não foi
    inserida.

    ⚠️ `ON CONFLICT (url) DO UPDATE` sobre o título: o veículo corrige manchete depois de
    publicar, e a URL continua a mesma. ⛔ Não mexe em `coletada_em`, que é quando NÓS
    vimos pela primeira vez.
    """
    if not noticias:
        return {}

    linhas = [
        {
            "url": n.url,
            "titulo": n.titulo,
            "veiculo": n.veiculo,
            "publicada_em": n.publicada_em,
            "trecho": n.trecho,
            "hash_titulo": n.hash_titulo,
        }
        for n in noticias
    ]

    with conexao.cursor() as cursor:
        cursor.executemany(
            """
            INSERT INTO noticias (url, titulo, veiculo, publicada_em, trecho, hash_titulo)
            VALUES (%(url)s, %(titulo)s, %(veiculo)s, %(publicada_em)s, %(trecho)s,
                    %(hash_titulo)s)
            ON CONFLICT (url) DO UPDATE SET
                titulo = EXCLUDED.titulo,
                trecho = EXCLUDED.trecho,
                hash_titulo = EXCLUDED.hash_titulo
            """,
            linhas,
        )

        cursor.execute(
            "SELECT url, id FROM noticias WHERE url = ANY(%s)",
            ([n.url for n in noticias],),
        )

        return dict(cursor.fetchall())


def gravar_mencoes(conexao: psycopg.Connection, mencoes: Sequence[dict]) -> int:
    """Liga notícia a parlamentar.

    🔴 RF-40 — a confiança vai ao banco INTEIRA, inclusive abaixo do limiar de exibição.
    ⛔ Não é desperdício: guardar o que ⛔ não se exibe é o que permite medir depois se o
    limiar de 0,70 está no lugar certo. Filtrar na gravação apagaria a evidência.
    """
    return _executar_em_lotes(
        conexao,
        """
        INSERT INTO noticia_pessoas (noticia_id, pessoa_id, confianca, metodo)
        VALUES (%(noticia_id)s, %(pessoa_id)s, %(confianca)s, %(metodo)s)
        ON CONFLICT (noticia_id, pessoa_id) DO UPDATE SET
            confianca = EXCLUDED.confianca,
            metodo = EXCLUDED.metodo
        """,
        mencoes,
    )


def gravar_despesas(
    conexao: psycopg.Connection, pessoa_ids: list[int], despesas: Sequence[dict]
) -> int:
    """Grava a cota, substituindo o recorte (pessoa, ano) que está entrando."""
    if not despesas:
        return 0

    anos = sorted({despesa["ano"] for despesa in despesas})

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


def gravar_emendas(
    conexao: psycopg.Connection, anos: list[int], linhas: Sequence[dict]
) -> int:
    """Grava as emendas, substituindo os anos que estão entrando.

    ⭐ `pessoa_id` ⛔ NÃO é preenchido aqui: a emenda entra sem dono, e o vínculo é
    decisão de `vincular_emendas`.
    """
    if not linhas:
        return 0

    conexao.execute("DELETE FROM emendas WHERE ano = ANY(%s)", (anos,))

    return _executar_em_lotes(
        conexao,
        """
        INSERT INTO emendas (codigo_autor, nome_autor, codigo_emenda, ano, tipo,
                             localidade, funcao, subfuncao,
                             valor_empenhado, valor_liquidado, valor_pago,
                             valor_resto_pago)
        VALUES (%(codigo_autor)s, %(nome_autor)s, %(codigo_emenda)s, %(ano)s, %(tipo)s,
                %(localidade)s, %(funcao)s, %(subfuncao)s,
                %(valor_empenhado)s, %(valor_liquidado)s, %(valor_pago)s,
                %(valor_resto_pago)s)
        ON CONFLICT (codigo_autor, codigo_emenda) DO NOTHING
        """,
        linhas,
    )


def registrar_autores(conexao: psycopg.Connection, autores: dict[str, str]) -> int:
    """Registra os códigos de autor vistos, sem resolver o vínculo.

    ⭐ É a lista de pendências de reconciliação. Código sem `pessoa_id` fica **visível**,
    ⛔ em vez de virar registro perdido.

    ⚠️ `DO UPDATE` só no nome: a grafia muda entre anos, mas ⛔ nunca sobrescreve um
    `pessoa_id` já resolvido — inclusive o resolvido à mão.
    """
    if not autores:
        return 0

    linhas = [
        {"codigo": codigo, "nome_autor": nome}
        for codigo, nome in autores.items()
    ]

    return _executar_em_lotes(
        conexao,
        """
        INSERT INTO autores_de_emenda (codigo, nome_autor, metodo)
        VALUES (%(codigo)s, %(nome_autor)s, 'NAO_RESOLVIDO')
        ON CONFLICT (codigo) DO UPDATE SET nome_autor = EXCLUDED.nome_autor
        """,
        linhas,
    )


def vincular_emendas(conexao: psycopg.Connection) -> int:
    """Aplica o de-para resolvido às emendas já gravadas.

    ⭐ Roda depois da reconciliação e é idempotente — resolver um autor novo e rodar de
    novo preenche só o que faltava.
    """
    return conexao.execute(
        """
        UPDATE emendas e
           SET pessoa_id = a.pessoa_id
          FROM autores_de_emenda a
         WHERE a.codigo = e.codigo_autor
           AND a.pessoa_id IS NOT NULL
           AND e.pessoa_id IS DISTINCT FROM a.pessoa_id
        """
    ).rowcount


def autores_nao_resolvidos(conexao: psycopg.Connection) -> list[tuple[str, str]]:
    return [
        (linha[0], linha[1])
        for linha in conexao.execute(
            "SELECT codigo, nome_autor FROM autores_de_emenda "
            "WHERE pessoa_id IS NULL ORDER BY nome_autor"
        ).fetchall()
    ]


def resolver_autor(
    conexao: psycopg.Connection, codigo: str, pessoa_id: int, metodo: str
) -> None:
    conexao.execute(
        "UPDATE autores_de_emenda SET pessoa_id = %s, metodo = %s, atualizado_em = now() "
        "WHERE codigo = %s",
        (pessoa_id, metodo, codigo),
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
            "pessoa_a": aresta.pessoa_a,
            "pessoa_b": aresta.pessoa_b,
            "tipo": "SIMILARIDADE_VOTO",
            "peso": aresta.valor,
        }
        for aresta in arestas
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
