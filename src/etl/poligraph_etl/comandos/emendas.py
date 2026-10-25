"""As emendas parlamentares e os convênios, com a reconciliação dos autores e a resolução manual."""

import logging
from datetime import date

import psycopg

from ..congresso import ingestao
from ..emendas import convenentes, emendas
from ..fontes import portal
from ..nucleo import normalizacao, persistencia
from . import comum
from .comum import carga_do_arquivo, registrar_o_que_nao_fecha

log = logging.getLogger("poligraph")


def rodar_emendas(conexao: psycopg.Connection, anos: list[int]) -> None:
    """Emendas parlamentares — ingere primeiro, resolve o vínculo depois.

    RISCO: **Decisão do autor:** a chave é o **código do autor**, não o nome. Nada é
    descartado por não ter dono conhecido — senador, emenda de bancada e parlamentar de
    outra legislatura entram com `pessoa_id` nulo e ficam na fila de reconciliação.

    DECISÃO: O casamento por nome roda **uma vez**, como SUGESTÃO (`AUTOMATICO`). Depois disso
    o vínculo vive no código, e a grafia deixa de importar.

    ATENÇÃO: O arquivo é regerado todo dia, então o cache leva a data: o de ontem não serve.
    E emendas, favorecidos e convênios trocam **juntos**, numa transação — uma falha no
    meio deixaria a ficha com o favorecido de hoje e a emenda de ontem.
    """
    arquivo = portal.baixar(
        emendas.RECURSO, comum.CACHE / f"emendas-{date.today():%Y%m%d}.zip"
    )
    carga = carga_do_arquivo(conexao, "PORTAL_TRANSPARENCIA", portal.url(emendas.RECURSO), arquivo)

    tabela_de_emendas = portal.ler_csv(arquivo, emendas.ARQUIVO_EMENDAS)
    linhas, autores = emendas.para_linhas(tabela_de_emendas, anos)
    codigos = {linha["codigo_emenda"] for linha in linhas}
    log.info("  %d linhas, %d emendas, %d autores", len(linhas), len(codigos), len(autores))

    tabela_de_favorecidos = portal.ler_csv(arquivo, emendas.ARQUIVO_FAVORECIDOS)
    favorecidos = emendas.favorecidos_para_linhas(tabela_de_favorecidos, codigos)
    convenios, ligacoes = emendas.convenios_para_linhas(
        portal.ler_csv(arquivo, emendas.ARQUIVO_CONVENIOS), codigos
    )

    with conexao.transaction():
        gravadas = persistencia.gravar_emendas(conexao, anos, linhas, carga)
        persistencia.registrar_autores(conexao, autores, carga)
        persistencia.gravar_favorecidos(conexao, anos, favorecidos, carga)
        persistencia.gravar_convenios(conexao, anos, convenios, ligacoes, carga)
        codigos_na_base, anos_na_base = persistencia.codigos_e_anos_de_emenda(conexao)
        contas = (emendas.reconciliar_emendas(tabela_de_emendas, anos)
                  + emendas.reconciliar_pagamentos(tabela_de_favorecidos, codigos_na_base, anos_na_base)
                  + emendas.reconciliar_pago_e_recebido(persistencia.pago_e_recebido_por_emenda(conexao, anos)))
        persistencia.gravar_reconciliacoes(conexao, contas, carga)
    registrar_o_que_nao_fecha(contas)

    log.info(
        "%d linhas de emenda, %d pagamentos a favorecidos, %d convênios (%d ligações)",
        gravadas, len(favorecidos), len(convenios), len(ligacoes),
    )

    _reconciliar_autores(conexao)


def rodar_convenios(conexao: psycopg.Connection) -> None:
    """O CNPJ de quem assinou cada convênio de emenda — rode depois de `emendas`."""
    numeros = persistencia.numeros_de_convenio(conexao)
    if not numeros:
        log.warning("Nenhum convênio no banco — rode `emendas` antes.")
        return

    data = convenentes.ultimo_retrato()
    arquivo = portal.baixar(convenentes.RECURSO.format(data=data), comum.CACHE / f"convenios-{data}.zip")
    carga = carga_do_arquivo(conexao, "PORTAL_TRANSPARENCIA", portal.url(convenentes.RECURSO.format(data=data)), arquivo)
    linhas = convenentes.ler(arquivo, numeros)
    log.info("  retrato de %s: %d de %d convênios achados, %d com CNPJ", data, len(linhas), len(numeros),
             sum(1 for linha in linhas if linha["cnpj_convenente"]))

    with conexao.transaction():
        persistencia.gravar_convenentes(conexao, linhas, carga)


def _reconciliar_autores(conexao: psycopg.Connection) -> None:
    """Sugere o vínculo código → pessoa, pelo nome normalizado.

    ATENÇÃO: Roda só sobre quem ainda NÃO está resolvido — nunca sobrescreve resolução
    manual.

    ATENÇÃO: **Ambiguidade não vira palpite:** se duas pessoas normalizam para o mesmo nome,
    o código fica sem vínculo e aparece na lista de pendências. Chutar seria pior — o
    erro ficaria congelado no código e invisível.

    RISCO: TODAS as pessoas, não só as com `cpf_hash` — filtrar por ele limitava a
    reconciliação aos 643 votantes da 57ª e deixava 241 autores soltos, gente que
    apresentou emenda para 2023 ainda na legislatura anterior (a LOA foi votada em
    2022). A ficha já filtra a legislatura corrente, então autoria antiga não polui.

    DECISÃO: O desempate da Pendência 47 — ver `_desempatar` — com quem votou na legislatura em que
    a emenda foi APRESENTADA: a de um ano entra na lei orçamentária votada no ano
    anterior, e o código do autor é de um mandato só (achado #24).

    ATENÇÃO: Era quem votou na legislatura corrente. Com as emendas de 2014 a 2022, isso
    escolheria o homônimo de hoje para a emenda de 2017 — e a emenda iria para a
    ficha de outra pessoa, sem erro nenhum.

    RISCO: REGRA B — o Portal renomeia o autor para o SUPLENTE que executa a emenda:
    "TIAGO DIMAS (EX-PARLAMENTAR LAZARO BOTELHO, NOS TERMOS ART. 78 LDO 2025)".
    O nome do sucessor não casa com ninguém, e a emenda fica órfã — mas ela é
    de quem a APRESENTOU. DECISÃO: Não é similaridade: é um rótulo da própria fonte.

    ATENÇÃO: Pendência é NORMAL: senadores e bancadas nunca terão dono na nossa base.
    """
    pendentes = persistencia.autores_nao_resolvidos(conexao)
    if not pendentes:
        log.info("Nenhum autor pendente de reconciliação.")
        return

    por_nome: dict[str, list[int]] = {}
    for pessoa_id, nome in conexao.execute(
        "SELECT id, nome_exibicao FROM pessoas"
    ).fetchall():
        por_nome.setdefault(normalizacao.sem_acento_maiusculo(nome), []).append(pessoa_id)

    anos_por_autor = persistencia.anos_dos_autores(conexao)
    votantes = persistencia.votantes_por_legislatura(conexao)
    corrente = max(votantes) if votantes else None

    def com_voto_de(codigo: str) -> set[int]:
        return votantes_do_mandato(anos_por_autor.get(codigo, set()), votantes, corrente)

    resolvidos = por_sucessor = por_desempate = ambiguos = 0

    for codigo, nome_autor in pendentes:
        candidatos = por_nome.get(normalizacao.sem_acento_maiusculo(nome_autor), [])

        original = None
        if not candidatos:
            original = emendas.autor_original(nome_autor)
            if original:
                candidatos = por_nome.get(
                    normalizacao.sem_acento_maiusculo(original), []
                )

        escolhido = _desempatar(candidatos, com_voto_de(codigo))

        if escolhido is None:
            if len(candidatos) > 1:
                ambiguos += 1
            continue

        persistencia.resolver_autor(conexao, codigo, escolhido, "AUTOMATICO")
        resolvidos += 1
        if original:
            por_sucessor += 1
        elif len(candidatos) > 1:
            por_desempate += 1

    vinculadas = persistencia.vincular_emendas(conexao)

    log.info(
        "Reconciliação: %d de %d autores resolvidos, %d emendas vinculadas",
        resolvidos, len(pendentes), vinculadas,
    )
    if por_sucessor:
        log.info("  %d pelo nome do ex-parlamentar citado no registro", por_sucessor)
    if por_desempate:
        log.info("  %d por desempate — homônimo sem voto na base", por_desempate)
    if ambiguos:
        log.warning("  %d autores AMBÍGUOS — dois parlamentares com o mesmo nome", ambiguos)

    restantes = len(persistencia.autores_nao_resolvidos(conexao))
    if restantes:
        log.info(
            "  %d autores seguem sem vínculo (senadores, bancadas, outras legislaturas)",
            restantes,
        )


def votantes_do_mandato(
    anos_das_emendas: set[int], votantes: dict[int, set[int]], corrente: int | None
) -> set[int]:
    """Quem votou na legislatura em que as emendas foram apresentadas.

    A emenda de um ano entra na lei orçamentária votada no ano ANTERIOR: a de 2019 foi
    apresentada em 2018, ainda na 55ª. Sem ano conhecido, vale a legislatura corrente.
    """
    legislaturas = {
        ingestao.legislatura_da_data(f"{ano - 1}-07-01") for ano in anos_das_emendas
    } or ({corrente} if corrente else set())
    return set().union(*(votantes.get(l, set()) for l in legislaturas))


def _desempatar(candidatos: list[int], com_voto: set[int]) -> int | None:
    """Qual das pessoas de mesmo nome é a autora, ou `None` se não dá para saber.

    ## RISCO: REGRA A — o homônimo histórico manufatura ambiguidade

    A busca é contra as **7.993 pessoas** do banco, quase todas de legislaturas antigas.
    MEDIDO: Medido em 2026-08-29, isso criava **14** empates que não existem na realidade:

    | Deputado em exercício | "Concorrente" |
    |---|---|
    | Bebeto — Carlos Roberto Rodrigues, 1.117 votos | *BEBETO* — Adalberto Souza Galvão, **0 votos** |
    | Albuquerque — José F. Lopes, 933 votos | *ALBUQUERQUE* — Manoel J. de Albuquerque, **0 votos** |

    DECISÃO: **Quem não tem voto nenhum na base não aparece em tela nenhuma** — e não é
    o autor de emenda de 2024. Se sobra **exatamente um** com voto, é ele.

    ## Por que isto não é chute

    | Evidência | |
    |---|---|
    | Concorrente ser senador em exercício | RISCO: **0 de 14** — era o risco real, porque senador apresenta emenda |
    | Destino da emenda bate com a UF do parlamentar | DECISÃO: **50 de 56** · 2 discordam · 4 sem UF |
    | Emendas de 2024 em diante, que só a 57ª podia apresentar | 82% |

    ATENÇÃO: **Ambiguidade REAL continua sem vínculo**, e deve continuar: `ÁTILA DE MELO LIRA`
    e `ÁTILA FREITAS LIRA` são duas pessoas, as duas com voto — o desempate desiste, e a
    saída é o `--resolver`.
    """
    if len(candidatos) == 1:
        return candidatos[0]

    if len(candidatos) < 2:
        return None

    votantes = [pessoa_id for pessoa_id in candidatos if pessoa_id in com_voto]

    return votantes[0] if len(votantes) == 1 else None


def pares_de_resolucao(entradas: list[str]) -> list[tuple[str, str]]:
    """Converte `["4184=204521"]` em `[("4184", "204521")]`.

    ## RISCO: O segundo valor é o id NA CÂMARA, não `pessoas.id`

    ATENÇÃO: **Isto mudou em 2026-08-29, depois de o defeito se materializar.** A Pendência 47
    registrava `--resolver 4511=43` para o Allan Garcês. Depois de uma reingestão:

    | | |
    |---|---|
    | Quando foi registrado | `43` = Allan Garcês |
    | RISCO: Hoje | `43` = **André Ferreira** · Allan Garcês virou o **31** |

    `pessoas.id` é `BIGSERIAL` e é **reatribuído** quando a base é recarregada. Um
    comando anotado no dia anterior colocaria as emendas de um parlamentar na ficha de
    outro — **em silêncio**, porque a FK aceita qualquer id que exista.

    DECISÃO: O id da Câmara vem da fonte e nunca muda. É o mesmo que aparece na URL do
    perfil oficial e em `pessoa_fonte_ids`.

    RISCO: Entrada malformada **estoura**, não é ignorada: `--resolver 4184` sem o `=`
    seria descartado em silêncio, e a pessoa concluiria que vinculou quando não vinculou.

    ATENÇÃO: O id da fonte é numérico nas três (Câmara, Senado, TSE). Recusar aqui pega
    o typo com uma mensagem útil, em vez de devolver "ninguém com id_externo".
    """
    pares: list[tuple[str, str]] = []

    for entrada in entradas:
        codigo, separador, externo = entrada.partition("=")
        if not separador or not codigo.strip() or not externo.strip():
            raise ValueError(
                f"'{entrada}' não é CODIGO=ID_NA_CAMARA. Ex.: --resolver 4184=204521"
            )

        if not externo.strip().isdigit():
            raise ValueError(f"'{externo.strip()}' não é um id da Câmara")

        pares.append((codigo.strip(), externo.strip()))

    return pares


def resolver_a_mao(conexao: psycopg.Connection, entradas: list[str]) -> None:
    """Pendência 45 — vincula autor de emenda à mão, a saída dos ambíguos.

    Dois parlamentares com o mesmo nome de urna não são separáveis por texto: a
    reconciliação automática desiste de propósito e quem decide é uma pessoa. Fica
    gravado como `MANUAL`, que execução automática posterior nunca sobrescreve.

    RISCO: Resolve o id ESTÁVEL da fonte para a chave interna, na hora de aplicar —
    nunca o contrário. Ver `pares_de_resolucao`.

    A FK pegaria o id inexistente, mas com mensagem do Postgres; aqui dá para
    dizer o que fazer.
    """
    for codigo, id_externo in pares_de_resolucao(entradas):
        pessoa = conexao.execute(
            """
            SELECT p.id, p.nome_exibicao
              FROM pessoas p
              JOIN pessoa_fonte_ids f ON f.pessoa_id = p.id
             WHERE f.id_externo = %s
            """,
            (id_externo,),
        ).fetchone()

        if not pessoa:
            raise RuntimeError(
                f"ninguém com id_externo {id_externo}. ATENÇÃO: É o id NA CÂMARA (o da URL do "
                f"perfil oficial), não `pessoas.id` — que muda a cada reingestão."
            )

        pessoa_id, nome_exibicao = pessoa

        autor = conexao.execute(
            "SELECT nome_autor FROM autores_de_emenda WHERE codigo = %s", (codigo,)
        ).fetchone()
        if not autor:
            raise RuntimeError(
                f"código {codigo} não foi visto em nenhuma emenda. Rode `emendas` antes."
            )

        persistencia.resolver_autor(conexao, codigo, pessoa_id, "MANUAL")
        log.info(
            "  %s (%s) -> %s (câmara %s, id interno %d)",
            codigo, autor[0], nome_exibicao, id_externo, pessoa_id,
        )

    vinculadas = persistencia.vincular_emendas(conexao)
    log.info("%d emendas vinculadas", vinculadas)
