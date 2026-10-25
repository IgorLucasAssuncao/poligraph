"""Quem é quem: o CPF (só o HMAC) das duas casas, a fusão de quem foi deputado e senador, e a retirada do CPF que sobrou em texto livre."""

import logging
import time
from datetime import datetime

import psycopg

from ..eleicoes import receitas
from ..fontes import camara, senado, tse
from ..nucleo import normalizacao, persistencia
from ..nucleo.tipos import TipoFonteDeCarga
from . import comum
from .comum import carga_de_resposta, carga_do_arquivo

log = logging.getLogger("poligraph")

# ATENÇÃO: Segundos entre chamadas na busca de CPF — são centenas contra serviço público.
PAUSA_ENTRE_CHAMADAS = 0.15


def rodar_cpf(conexao: psycopg.Connection, todas_as_legislaturas: bool = False) -> None:
    """Completa `cpf_hash` das duas casas — e cada uma tem um caminho.

    Câmara: a API REST publica o CPF, uma requisição por deputado.
    Senado: não publica. O caminho é o nome civil contra a prestação de contas do TSE,
    em `_nome_civil_dos_senadores` e `_cpf_dos_senadores`.
    """
    _cpf_dos_deputados(conexao, todas_as_legislaturas)
    _nome_civil_dos_senadores(conexao)
    _cpf_dos_senadores(conexao, todas_as_legislaturas)
    rodar_fundir_pessoas(conexao)


def rodar_fundir_pessoas(conexao: psycopg.Connection) -> None:
    """Uma pessoa só para quem tem o mesmo CPF ou o mesmo título de eleitor: o deputado que virou senador, o parlamentar que virou prefeito."""
    with conexao.transaction():
        fundidas = persistencia.fundir_pessoas(conexao, persistencia.pares_do_mesmo_cpf(conexao))
    log.info("Pessoas fundidas pelo CPF (deputado e senador): %d.", fundidas)


def _cpf_dos_deputados(conexao: psycopg.Connection, todas_as_legislaturas: bool = False) -> None:
    """Completa `cpf_hash` a partir da API REST da Câmara.

    RISCO: **Por que existe um comando só para isto:** a coluna `cpf` do CSV em bloco vem
    VAZIA — 0 de 7.889. O valor só existe em `/api/v2/deputados/{id}`, **uma requisição
    por deputado**.

    DECISÃO: E vale a viagem: contra a prestação de contas do TSE, o CPF casou **15 de 15**,
    contra 14 de 15 do nome civil.

    ATENÇÃO: O CPF em claro existe apenas **em memória** — o que vai para o banco é o hash.

    RISCO: a origem registrada é um índice das consultas (deputado e endereço), SEM a resposta: ela
    traz o CPF em claro, que o projeto não grava em lugar nenhum. O hash prova o índice, não a resposta.

    ATENÇÃO: Uma pausa curta: são centenas de requisições seguidas contra um serviço
    público, e não há motivo para apertá-lo.

    RISCO: Perda grande significa layout mudado ou bloqueio — não "alguns sem CPF".
    """
    faltantes = list(dict.fromkeys(
        persistencia.pessoas_sem_cpf(conexao, todas_as_legislaturas) + persistencia.deputados_com_homonimo_no_senado(conexao)))
    if not faltantes:
        log.info("Todos os deputados com voto já têm cpf_hash.")
        return

    log.info("Buscando CPF de %d deputados...", len(faltantes))

    achados_com_hash: list[tuple[int, str]] = []
    consultados: list[dict] = []
    for i, (id_camara, pessoa_id) in enumerate(faltantes, 1):
        cpf = camara.cpf_do_deputado(id_camara)
        hash_cpf = normalizacao.hash_de_cpf(cpf)
        consultados.append({"id_camara": id_camara, "url": f"{camara.API}/deputados/{id_camara}"})

        if hash_cpf:
            achados_com_hash.append((pessoa_id, hash_cpf))

        time.sleep(PAUSA_ENTRE_CHAMADAS)

        if i % 100 == 0:
            log.info("  %d de %d...", i, len(faltantes))

    carga = carga_de_resposta(
        conexao, TipoFonteDeCarga.CAMARA, f"{camara.API}/deputados", consultados,
        comum.CACHE / "respostas" / f"cpf-deputados-{datetime.now():%Y%m%d-%H%M%S}.json",
    )
    for pessoa_id, hash_cpf in achados_com_hash:
        persistencia.gravar_cpf_hash(conexao, pessoa_id, hash_cpf, carga)
    achados = len(achados_com_hash)
    log.info("  %d de %d com CPF", achados, len(faltantes))

    if achados < len(faltantes) * 0.8:
        log.warning(
            "  ATENÇÃO: Menos de 80% dos deputados tinham CPF. A API mudou ou está limitando?"
        )


# As duas eleições que compõem a 57ª legislatura do Senado: a Casa renova por terços
# alternados, então metade das cadeiras vem de 2018 e a outra de 2022.
ELEICOES_DO_SENADO = (2010, 2014, 2018, 2022)


def _nome_civil_dos_senadores(conexao: psycopg.Connection) -> int:
    """Completa `nome_civil` pelo detalhe do Senado. É a chave para casar com o TSE.

    A lista de exercício traz `NomeCompletoParlamentar` dos 81 de hoje; os suplentes que
    devolveram a cadeira só aparecem nos votos, e o voto não tem nome completo. O
    endpoint de detalhe responde para qualquer código.

    Só grava se for DIFERENTE do nome parlamentar: gravar o mesmo texto deixaria a
    pessoa fora de `senadores_sem_nome_civil` na próxima execução, escondendo que
    o Senado não tem o dado dela.
    """
    faltantes = persistencia.senadores_sem_nome_civil(conexao)
    if not faltantes:
        log.info("Todos os senadores com voto já têm nome civil.")
        return 0

    log.info("Buscando nome civil de %d senadores...", len(faltantes))

    respostas: dict[str, dict | None] = {}
    nomes: list[tuple[int, str]] = []
    for codigo, pessoa_id in faltantes:
        identificacao = senado.baixar_senador(codigo)
        respostas[codigo] = identificacao
        completo = (identificacao or {}).get("NomeCompletoParlamentar")
        parlamentar = (identificacao or {}).get("NomeParlamentar")

        if completo and completo.strip() != (parlamentar or "").strip():
            nomes.append((pessoa_id, completo.strip()))

        time.sleep(PAUSA_ENTRE_CHAMADAS)

    carga = carga_de_resposta(
        conexao, TipoFonteDeCarga.SENADO, f"{senado.BASE}/senador/", respostas,
        comum.CACHE / "respostas" / f"senadores-detalhe-{datetime.now():%Y%m%d-%H%M%S}.json",
    )
    for pessoa_id, nome in nomes:
        persistencia.gravar_nome_civil(conexao, pessoa_id, nome, carga)
    achados = len(nomes)

    log.info("  %d de %d com nome civil", achados, len(faltantes))
    return achados


def _cpf_dos_senadores(conexao: psycopg.Connection, todas_as_legislaturas: bool = False) -> None:
    """Completa `cpf_hash` dos senadores casando o nome civil contra o TSE.

    RISCO: **O Senado não publica CPF.** A prestação de contas eleitoral publica: cada
    candidato a Senador aparece com `NM_CANDIDATO` (civil), `SG_UF` e
    `NR_CPF_CANDIDATO`. O casamento é por **nome civil + UF**, nunca por nome
    sozinho — homônimo em estados diferentes é outra pessoa, e atribuir a campanha de um
    a outro daria número plausível e errado.

    ATENÇÃO: **Teto conhecido:** suplentes não prestam contas próprias. Quem assumiu a cadeira
    sem ter sido eleito titular não está no arquivo, e continua sem `cpf_hash`. Isso
    não é falha de carga — é alcance da fonte, e a tela precisa dizer isso em vez de
    mostrar zero como se fosse medida.

    Chave repetida entre as duas eleições com CPF diferente é ambiguidade, e
    ambiguidade não se resolve escolhendo uma.
    """
    pendentes = persistencia.senadores_para_casar(conexao, todas_as_legislaturas)
    if not pendentes:
        log.info("Todos os senadores com voto já têm cpf_hash.")
        return

    mapa: dict[tuple[str, str], tuple[str, int] | None] = {}
    for eleicao in ELEICOES_DO_SENADO:
        arquivo = comum.CACHE / f"prestacao-contas-{eleicao}.zip"
        if not arquivo.exists():
            url = tse.url_de_prestacao_de_contas(eleicao)
            if not tse.existe(url):
                log.warning("  TSE não respondeu para %s; seguindo sem essa eleição", url)
                continue
            arquivo = tse.baixar(url, arquivo)

        do_ano = receitas.cpf_de_senadores(arquivo, eleicao)
        carga_do_ano = carga_do_arquivo(conexao, "TSE", tse.url_de_prestacao_de_contas(eleicao), arquivo)
        log.info("  %d candidatos a Senador em %d", len(do_ano), eleicao)

        for chave, cpf in do_ano.items():
            if chave in mapa and (mapa[chave] is None or mapa[chave][0] != cpf):
                mapa[chave] = None
            else:
                mapa.setdefault(chave, (cpf, carga_do_ano))

    if not mapa:
        log.warning("Nenhum candidato a Senador lido do TSE; cpf_hash não foi tocado.")
        return

    casados = ambiguos = 0
    for pessoa_id, nome_civil, uf in pendentes:
        achado = mapa.get((normalizacao.sem_acento_maiusculo(nome_civil), uf.upper()))
        if achado is None:
            ambiguos += (normalizacao.sem_acento_maiusculo(nome_civil), uf.upper()) in mapa
            continue

        cpf, carga_do_cpf = achado
        hash_cpf = normalizacao.hash_de_cpf(cpf)
        if hash_cpf:
            persistencia.gravar_cpf_hash(conexao, pessoa_id, hash_cpf, carga_do_cpf)
            casados += 1

    log.info("  %d de %d senadores casados por nome civil + UF", casados, len(pendentes))
    if ambiguos:
        log.warning("  %d ficaram de fora por ambiguidade de nome + UF", ambiguos)


def rodar_tirar_cpf(conexao: psycopg.Connection) -> None:
    """O CPF que entrou no texto antes de toda carga passar por `sem_cpf` (regra 3)."""
    with conexao.transaction():
        mudadas = persistencia.gravar_texto_sem_cpf(conexao)
    log.info("Texto sem CPF: %s", ", ".join(f"{coluna} {n}" for coluna, n in mudadas.items() if n) or "nada a mudar")
