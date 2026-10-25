"""Os comandos do TSE: mandatos, patrimônio declarado, redes sociais e o financiamento de campanha."""

import logging
import time
from collections import Counter
from datetime import date
from pathlib import Path

import psycopg

from ..congresso import ingestao
from ..eleicoes import mandatos, patrimonio, receitas, redes
from ..fontes import camara, tse
from ..nucleo import persistencia
from ..contratos import entrada
from ..contratos.tse import LinhaDeCandidatura, LinhaDeVotacao
from ..nucleo.tipos import FonteDaRedeSocial, TipoCargo, TipoFonteDeCarga
from . import comum
from .comum import carga_de_resposta, carga_do_arquivo
from .pessoas import rodar_fundir_pessoas

log = logging.getLogger("poligraph")


ELEICOES_DOS_MANDATOS = [1998, 2000, 2002, 2004, 2006, 2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024, 2026]
"""As eleições que o TSE publica no layout atual do cadastro de candidatos (MEDIDO em 2026-10-21, de 2010 a 2024; 2026 em
2026-10-23, com o primeiro turno apurado)."""


def rodar_mandatos(conexao: psycopg.Connection, eleicoes: list[int]) -> None:
    """Os eleitos de cada eleição viram mandatos, e quem não está no Congresso ganha pessoa (Pendência 90).

    Rode depois de `cpf` e de `municipios`: a pessoa casa pelo `cpf_hash`, e o município do TSE casa pelo
    nome com a tabela de municípios.
    """
    cargas: dict[int, int] = {}
    por_eleicao: dict[int, list] = {}
    for ano in eleicoes:
        url = f"{tse.CDN}/{mandatos.RECURSO.format(ano=ano)}"
        arquivo = tse.baixar(url, comum.CACHE / f"consulta-cand-{ano}.zip")
        cargas[ano] = carga_do_arquivo(conexao, "TSE", url, arquivo)
        candidaturas = entrada.ler(LinhaDeCandidatura, patrimonio.linhas_do_zip(arquivo))
        por_eleicao[ano] = mandatos.eleitos(candidaturas)
        if ano % 4 == 2 and not any(e.cargo is TipoCargo.PRESIDENTE for e in por_eleicao[ano]):
            url_da_votacao = f"{tse.CDN}/{mandatos.RECURSO_DA_VOTACAO.format(ano=ano)}"
            votacao = tse.baixar(url_da_votacao, comum.CACHE / f"votacao-munzona-{ano}.zip")
            carga_do_arquivo(conexao, "TSE", url_da_votacao, votacao)
            presidente = mandatos.presidente_pelos_votos(
                entrada.ler(LinhaDeVotacao, patrimonio.linhas_do_zip(votacao)))
            if presidente:
                por_eleicao[ano] = mandatos.eleitos(candidaturas, frozenset({presidente}))
                log.warning("  %d: o TSE não marca o presidente eleito; pelos votos do último turno, SQ %s", ano, presidente)
        contagem = Counter(e.cargo.value for e in por_eleicao[ano])
        log.info("  %d: %d eleitos — %s", ano, len(por_eleicao[ano]), ", ".join(f"{c} {n}" for c, n in sorted(contagem.items())))
    todos = [e for eleitos_do_ano in por_eleicao.values() for e in eleitos_do_ano]

    identidades = mandatos.Identidades(
        persistencia.hashes_de_pessoas(conexao),
        persistencia.hashes_de_titulos(conexao),
        persistencia.pessoas_dos_mandatos(conexao),
        persistencia.pessoas_por_casa(conexao),
    )
    pelo_voto = mandatos.senadores_pelo_voto(
        [e for e in todos if identidades.pessoa(e) is None],
        [mandatos.SenadorNaBase(*linha) for linha in persistencia.senadores_com_voto(conexao)])
    identidades.por_candidatura.update(pelo_voto)
    log.info("  %d senadores eleitos ligados pelo voto no Senado (UF, período e nome)", len(pelo_voto))
    identidades.propagar(todos)
    novas = mandatos.pessoas_novas(todos, identidades, date.today().year)
    ponte = mandatos.ponte_de_municipios(
        [e for e in todos if e.codigo_ue], persistencia.municipios_para_ponte(conexao))
    sem_ibge = sorted({f"{e.nome_ue}-{e.uf} ({e.codigo_ue})" for e in todos if e.codigo_ue and ponte.get(e.codigo_ue) is None})
    if sem_ibge:
        log.warning("  %d municípios do TSE sem par no IBGE: %s", len(sem_ibge), ", ".join(sem_ibge))

    with conexao.transaction():
        for grupo, pessoa in persistencia.gravar_pessoas_do_tse(conexao, novas, cargas):
            for eleito in grupo:
                identidades.guardar(eleito, pessoa)
        faltantes = {}
        for eleito in todos:
            pessoa = identidades.pessoa(eleito)
            if pessoa is not None:
                identidades.guardar(eleito, pessoa)
                faltantes.setdefault(pessoa, {"id": pessoa, "cpf_hash": eleito.cpf_hash, "titulo_hash": eleito.titulo_hash})
        completados = persistencia.completar_hashes(conexao, list(faltantes.values()))
        for ano, eleitos_do_ano in por_eleicao.items():
            linhas = mandatos.mandatos_para_linhas(eleitos_do_ano, identidades, ponte)
            persistencia.gravar_mandatos(conexao, [ano], linhas, cargas[ano])
            sem_pessoa = Counter(e.cargo.value for e in eleitos_do_ano if identidades.pessoa(e) is None)
            log.info("  %d: %d mandatos gravados%s", ano, len(linhas),
                     "; sem pessoa na base: " + ", ".join(f"{c} {n}" for c, n in sorted(sem_pessoa.items())) if sem_pessoa else "")
        apagadas = persistencia.apagar_pessoas_sem_vinculo(conexao)
    log.info("Mandatos: %d pessoas novas, hashes conferidos em %d pessoas, %d pessoas sem vínculo apagadas.",
             len(novas), completados, apagadas)
    rodar_fundir_pessoas(conexao)


def rodar_patrimonio(conexao: psycopg.Connection, anos: list[int]) -> None:
    """Bens declarados ao TSE, por tipo. Rode depois de `cpf` e de `mandatos`.

    Duas pontes: o `cpf_hash` liga as candidaturas de parlamentar, eleitas ou não; `mandatos` liga os
    eleitos dos outros cargos, inclusive os de 2024, que vêm sem CPF.
    """
    hashes = persistencia.hashes_de_pessoas(conexao)
    todas: list[dict] = []
    for ano in anos:
        candidatos = tse.baixar(f"{tse.CDN}/{patrimonio.RECURSO_CANDIDATOS.format(ano=ano)}",
                                comum.CACHE / f"consulta-cand-{ano}.zip")
        ligadas = {**persistencia.candidaturas_dos_mandatos(conexao, ano), **patrimonio.candidaturas(candidatos, hashes)}
        url_dos_bens = f"{tse.CDN}/{patrimonio.RECURSO_BENS.format(ano=ano)}"
        bens = tse.baixar(url_dos_bens, comum.CACHE / f"bem-candidato-{ano}.zip")
        carga = carga_do_arquivo(conexao, "TSE", url_dos_bens, bens)
        linhas = [
            {**linha, "carga_id": carga}
            for linha in patrimonio.bens_para_linhas(patrimonio.linhas_do_zip(bens), ligadas, ano)
        ]
        log.info("  %d: %d candidaturas ligadas, %d pessoas com bem declarado", ano, len(ligadas),
                 len({linha["pessoa_id"] for linha in linhas}))
        todas.extend(linhas)

    with conexao.transaction():
        persistencia.gravar_patrimonios(conexao, anos, todas)


def rodar_redes(conexao: psycopg.Connection, anos: list[int]) -> None:
    """Redes sociais: a Câmara para deputados, o TSE (candidatura) para senadores e para quem só tem mandato no TSE.

    ATENÇÃO: o arquivo de redes do TSE não traz `SG_UE`, só o `SQ_CANDIDATO`. MEDIDO em 2026-10-21: de 2014 em
    diante o número é único entre os eleitos da eleição; em 2012 há 4 repetidos, por isso os anos de antes de
    2014 não entram.

    O TSE da eleição MAIS RECENTE de cada senador: por isso os anos vão do último ao primeiro.

    RISCO: só troca as redes do TSE de quem tem rede nos arquivos lidos. Antes trocava as de todo senador e de todo
    político fora do Congresso, e `redes --anos 2026` (a etapa da rotina pós-eleição) apagou as redes de quem não
    concorreu em 2026: MEDIDO em 2026-10-23, Andrezinho Ceciliano ficou sem as redes de 2022 e de 2024.
    """
    consultados: list[int] = []
    da_camara: list[dict] = []
    respostas_da_camara: dict[str, list[str]] = {}
    for i, (id_camara, pessoa_id) in enumerate(persistencia.deputados_da_legislatura(conexao), 1):
        urls = camara.redes_do_deputado(id_camara)
        if urls is not None:
            consultados.append(pessoa_id)
            respostas_da_camara[id_camara] = urls
            da_camara.extend(redes.para_linhas(pessoa_id, urls, FonteDaRedeSocial.CAMARA))
        if i % 100 == 0:
            log.info("  %d deputados consultados", i)
        time.sleep(0.05)
    log.info("  Câmara: %d deputados, %d redes", len(consultados), len(da_camara))

    senadores = persistencia.senadores_da_legislatura(conexao)
    fora_do_congresso = persistencia.pessoas_fora_do_congresso(conexao)
    hashes = {h: p for h, p in persistencia.hashes_de_pessoas(conexao).items() if p in senadores}
    do_tse: dict[int, list[dict]] = {}
    for ano in sorted((a for a in anos if a >= 2014), reverse=True):
        candidatos = tse.baixar(f"{tse.CDN}/{patrimonio.RECURSO_CANDIDATOS.format(ano=ano)}",
                                comum.CACHE / f"consulta-cand-{ano}.zip")
        por_candidatura = {
            **{c: p for c, p in persistencia.candidaturas_dos_mandatos(conexao, ano).items() if p in fora_do_congresso},
            **patrimonio.candidaturas(candidatos, hashes, frozenset({TipoCargo.SENADOR})),
        }
        ligadas = {sq: pessoa for (_, sq), pessoa in por_candidatura.items()}
        arquivo = tse.baixar(f"{tse.CDN}/{redes.RECURSO_TSE.format(ano=ano)}", comum.CACHE / f"rede-social-{ano}.zip")
        carga_do_ano = carga_do_arquivo(conexao, "TSE", f"{tse.CDN}/{redes.RECURSO_TSE.format(ano=ano)}", arquivo)
        por_pessoa: dict[int, list[str]] = {}
        for linha in patrimonio.linhas_do_zip(arquivo):
            pessoa = ligadas.get(linha.get("SQ_CANDIDATO"))
            if pessoa is not None and pessoa not in do_tse:
                por_pessoa.setdefault(pessoa, []).append(redes.url_da_linha(linha))
        for pessoa, urls in por_pessoa.items():
            do_tse[pessoa] = [{**linha, "carga_id": carga_do_ano} for linha in redes.para_linhas(pessoa, urls, "TSE")]
    log.info("  TSE: %d senadores e políticos fora do Congresso com rede", len(do_tse))

    carga_da_camara = carga_de_resposta(
        conexao, TipoFonteDeCarga.CAMARA, f"{camara.API}/deputados", respostas_da_camara,
        comum.CACHE / "respostas" / f"redes-camara-{date.today():%Y%m%d}.json",
    )
    with conexao.transaction():
        persistencia.gravar_redes(conexao, consultados, da_camara, FonteDaRedeSocial.CAMARA, carga_da_camara)
        persistencia.gravar_redes(conexao, list(do_tse), [l for ls in do_tse.values() for l in ls], "TSE")


def rodar_fundo(conexao: psycopg.Connection, eleicao: int, arquivo: Path | None) -> None:
    """Financiamento de campanha — o fundão e o resto, ligados por CPF.

    RISCO: **Depende de `cpf` ter rodado antes.** Sem `cpf_hash` em `pessoas`, o de-para sai
    vazio e **toda** linha do TSE é descartada — 396 MB lidos para gravar zero, com log
    de sucesso. É exatamente o tipo de falha silenciosa que este projeto já pagou caro.

    Vários arquivos significa que o TSE não publicou o consolidado — e aí o DF fica
    de fora, ver `receitas.nomes_de_receita`.

    O cargo esperado sai da casa em que a pessoa votou. Sem isto, a campanha ao
    Senado que um deputado atual PERDEU entraria no financiamento dele.

    RISCO: Separados pelo mesmo motivo que no banco: somá-los é decisão de quem analisa.

    Casar pouco não é erro do TSE, é `cpf` incompleto — e sem o aviso a ficha
    mostraria financiamento zerado para a maioria, sem ninguém perceber.
    """
    hashes = persistencia.mapa_de_cpf_hash(conexao)
    if not hashes:
        raise RuntimeError(
            "Nenhuma pessoa com `cpf_hash`. Rode `cpf` antes: o join com o TSE é por "
            "hash de CPF, e sem ele toda receita seria descartada em silêncio."
        )

    log.info("De-para: %d pessoas com CPF hasheado", len(hashes))

    url = tse.url_de_prestacao_de_contas(eleicao)
    if arquivo is None:
        if not tse.existe(url):
            raise tse.ErroDeAcessoAoTse(
                f"O TSE não respondeu para {url}. Se for 403, a receita de headers "
                "caiu; baixe à mão e use --arquivo. Ver docs/12-fonte-tse.md §2.2."
            )
        arquivo = tse.baixar(url, comum.CACHE / f"prestacao-contas-{eleicao}.zip")

    carga = carga_do_arquivo(conexao, "TSE", url, arquivo)

    nomes = receitas.nomes_de_receita(arquivo, eleicao)
    if not nomes:
        raise RuntimeError(
            f"Nenhum `receitas_candidatos_{eleicao}_*.csv` dentro de {arquivo.name}. "
            "O layout do ZIP mudou?"
        )

    log.info(
        "%d arquivo(s) de receita: %s", len(nomes),
        "consolidado" if len(nomes) == 1 else f"{len(nomes)} estaduais (sem DF)",
    )

    casas = persistencia.casa_por_pessoa(conexao)
    por_candidatura = persistencia.candidaturas_dos_mandatos(conexao, eleicao)
    log.info("  %d candidaturas eleitas (Pendência 90)", len(por_candidatura))

    todas: list[dict] = []
    for nome in nomes:
        linhas = receitas.para_linhas(
            receitas.ler_receitas(arquivo, nome), hashes, eleicao, casas, por_candidatura
        )
        todas.extend(linhas)

        if linhas:
            log.info("  %s — %d linhas de quem está na base", nome, len(linhas))

    gravadas = persistencia.gravar_receitas(conexao, eleicao, todas, carga)
    resumo = receitas.resumir(todas)

    log.info(
        "Eleição %d: %d receitas gravadas, %d pessoas",
        eleicao, gravadas, int(resumo["parlamentares"]),
    )
    log.info(
        "  total R$ %.2f · fundo especial (FEFC) R$ %.2f",
        resumo["total"], resumo["fundo_especial"],
    )

    if eleicao % 4 == 0:
        log.info("  eleição municipal: a conferência contra os deputados da legislatura não vale aqui")
        return

    legislatura = ingestao.legislatura_da_data(f"{eleicao + 1}-03-01")
    da_legislatura = {
        linha[0] for linha in conexao.execute(
            """
            SELECT DISTINCT p.id FROM pessoas p
             WHERE p.cpf_hash IS NOT NULL
               AND EXISTS (SELECT 1 FROM votos v JOIN votacoes t ON t.id = v.votacao_id
                            WHERE v.pessoa_id = p.id AND t.legislatura = %s)
            """,
            (legislatura,),
        ).fetchall()
    }
    eleitos = len(da_legislatura)
    casados = len({linha["pessoa_id"] for linha in todas} & da_legislatura)
    if eleitos and casados < eleitos * 0.5:
        log.warning(
            "  só %d de %d com CPF e voto na %dª casaram com a eleição de %d. Rode `cpf` de novo, "
            "ou confira se a eleição é a que elegeu a legislatura.",
            casados, eleitos, legislatura, eleicao,
        )
    else:
        log.info("  %d de %d com CPF e voto na %dª têm receita na eleição de %d", casados, eleitos, legislatura, eleicao)
