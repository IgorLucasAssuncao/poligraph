"""Os comandos da Câmara e do Senado: votações e votos, matérias, inteiro teor, palavras-chave, votações simbólicas, quem está em exercício e a cota parlamentar."""

import logging
import time
from collections import Counter
from datetime import date, datetime

import psycopg
import requests

from ..congresso import cota, em_exercicio, ingestao, ingestao_senado, orientacoes, proposicoes
from ..fontes import camara, senado
from ..nucleo import normalizacao, persistencia, procedencia
from ..contratos.camara import LinhaDeProposicaoDaCamara
from ..contratos.entrada import ler_tabela
from ..nucleo.tipos import TipoCasa, TipoFonteDeCarga, TipoFonteDeIdentificador
from . import comum
from .comum import baixar_da_camara, carga_de_resposta, carga_do_arquivo, registrar_o_que_nao_fecha

log = logging.getLogger("poligraph")


def rodar_ingerir(conexao: psycopg.Connection, anos: list[int]) -> None:
    """RF-01, RF-03, RF-08 — carga com log auditável.

    RISCO: Zero aqui NÃO é caso normal — é o arquivo ter mudado de forma.

    ATENÇÃO: Foi exatamente assim que o bug do `uri` sobreviveu: `0 deputados no arquivo`
    saiu em INFO, o ETL seguiu, e como o de-para ficou vazio os 13.825 votos de
    2025 também foram descartados, registrando `0 votos`. Dois zeros plausíveis e
    nenhuma exceção. Parar aqui é o que transforma isso em erro visível.

    `camara.conferir_volume(df, ano)`: DECISÃO: canário contra regressão de parsing

    RISCO: Canário do classificador por texto — ver `descricoes_nao_reconhecidas`.
    ATENÇÃO: Frase nova não derruba a ingestão, mas não passa em silêncio: sem
    isto, uma mudança de redação na fonte mandaria tudo para SUBSTANTIVA.

    RISCO: Cruzamento com o ÚNICO sinal estruturado que a fonte dá sobre o tipo do
    voto: a sigla no começo de `ultimaAberturaVotacao_descricao`.

    ATENÇÃO: NÃO corrige a categoria — o campo é da última abertura da SESSÃO, não
    da votação. Serve para a divergência aparecer, e foi assim que a votação
    2613731-65 ("Resultado. Sim: 182; Não: 182") se revelou um destaque de
    emenda depois de já ter virado pergunta.

    ATENÇÃO: A votação entra SEM proposição: ela é ingerida antes de a proposição
    existir, e a FK recusaria a linha. O vínculo vem logo abaixo.

    DECISÃO: A ementa é o que destrava a curadoria (Pendência 11): a DESCRIÇÃO da votação diz o
    número do projeto e não diz sobre o que ele é.

    ATENÇÃO: Voto fora do de-para é descartado, não inventado. Em volume, o problema
    está na ingestão de deputados — e aí o número precisa aparecer.

    DECISÃO: Orientação de bancada: é o que transforma "votou Sim" em posição. Sem ela,
    `governismo` e `disciplina` ficam nulos — as colunas existem desde o
    schema inicial e passaram a legislatura inteira vazias.
    MEDIDO: A Câmara não publica orientações de 2001 e 2002: 404, conferido em
    2026-10-01 (achado #35). Sem elas o ano entra inteiro, e só `governismo` e
    `disciplina` ficam nulos — que é o que já acontece no Senado inteiro.
    """
    log.info("Ingerindo deputados...")
    caminho = camara.baixar("deputados", anos[0], comum.CACHE / "deputados.csv")
    carga_dos_deputados = carga_do_arquivo(conexao, TipoFonteDeCarga.CAMARA, camara.url_do_arquivo("deputados", anos[0]), caminho)
    deputados = ingestao.deputados_para_linhas(camara.ler_csv(caminho))
    novos = persistencia.gravar_pessoas(conexao, deputados, carga_dos_deputados)
    log.info("  %d deputados no arquivo, %d novos", len(deputados), novos)

    if not deputados:
        raise RuntimeError(
            f"Nenhum deputado lido de {caminho}. O layout do CSV mudou? "
            "Sem o de-para, todos os votos seriam descartados em silêncio."
        )

    mapa = _mapa_pessoas(conexao)

    for ano in anos:
        log.info("Ingerindo %d...", ano)

        arquivo, carga_votacoes = baixar_da_camara(conexao, "votacoes", ano)
        df = camara.ler_csv(arquivo)
        camara.conferir_volume(df, ano)

        votacoes = ingestao.votacoes_para_linhas(df)
        simbolicas = persistencia.gravar_simbolicas(
            conexao, TipoCasa.CAMARA, ano, ingestao.simbolicas_por_legislatura(df), carga_votacoes
        )
        log.info("  %d votações simbólicas contadas (não entram na comparação)", simbolicas)

        orfas = normalizacao.descricoes_nao_reconhecidas(
            linha["descricao"] for linha in votacoes
        )
        if orfas:
            log.warning(
                "  %d descrições que nenhum padrão de categoria reconhece — a 1ª: %s",
                len(orfas), (orfas[0] or "")[:90],
            )

        aberturas = dict(
            zip(df["id"], df.get("ultimaAberturaVotacao_descricao", []), strict=False)
        )
        divergentes = normalizacao.divergencias_de_destaque(
            {**linha, "abertura": aberturas.get(linha["id"])} for linha in votacoes
        )
        if divergentes:
            log.warning(
                "  %d votações que a fonte abre como DTQ e nós não classificamos como "
                "DESTAQUE — confira antes de curar. A 1ª: %s",
                len(divergentes), divergentes[0][0],
            )

        persistencia.desconectar_proposicoes_ausentes(conexao, votacoes)
        persistencia.gravar_votacoes(conexao, votacoes, carga_votacoes)
        log.info("  %d registros, %d votações nominais", len(df), len(votacoes))

        arquivo_prop = camara.baixar(
            "votacoesProposicoes", ano, comum.CACHE / f"votacoesProposicoes-{ano}.csv"
        )
        lista, vinculo = proposicoes.para_linhas(
            camara.ler_csv(arquivo_prop).to_dict("records"),
            {v["id"] for v in votacoes},
        )
        carga_prop = carga_do_arquivo(conexao, TipoFonteDeCarga.CAMARA, camara.url_do_arquivo("votacoesProposicoes", ano), arquivo_prop)
        persistencia.gravar_proposicoes(conexao, lista, carga_prop)
        vinculadas = persistencia.vincular_proposicoes(conexao, vinculo, carga_id=carga_prop)
        log.info(
            "  %d proposições, %d votações vinculadas (%d sem ementa)",
            len(lista), vinculadas,
            sum(1 for p in lista if not p["ementa"]),
        )

        arquivo_votos, carga_votos = baixar_da_camara(conexao, "votacoesVotos", ano)
        df_votos = camara.ler_csv(arquivo_votos)
        votos = ingestao.votos_para_linhas(df_votos, mapa)
        persistencia.gravar_votos(conexao, votos, carga_votos)
        log.info("  %d votos de %d linhas", len(votos), len(df_votos))

        descartados = len(df_votos) - len(votos)
        if descartados:
            log.warning(
                "  %d votos descartados: deputado fora do de-para", descartados
            )

        try:
            arquivo_orientacoes, carga_orientacoes = baixar_da_camara(
                conexao, "votacoesOrientacoes", ano
            )
        except requests.HTTPError as erro:
            if erro.response is None or erro.response.status_code != 404:
                raise
            log.warning("  %d sem orientações de bancada publicadas (404)", ano)
            continue
        df_orientacoes = camara.ler_csv(arquivo_orientacoes)
        linhas = orientacoes.para_linhas(
            df_orientacoes.to_dict("records"), {v["id"] for v in votacoes}
        )
        persistencia.gravar_orientacoes(conexao, linhas, carga_orientacoes)
        log.info(
            "  %d orientações de %d linhas (%d bancadas)",
            len(linhas), len(df_orientacoes), len({l["bancada"] for l in linhas}),
        )

    secretas = persistencia.marcar_secretas_de_fato(conexao, TipoCasa.CAMARA)
    if secretas:
        log.info("  %d votações sem nenhuma posição marcadas como secretas (Pendência 69)", secretas)


def rodar_senado(conexao: psycopg.Connection, anos: list[int]) -> None:
    """Ingestão do Senado — senadores, votações e votos.

    As duas casas não são comparáveis entre si (achado #7), então isto alimenta um grafo
    próprio: o `analisar` recebe a casa e monta uma matriz separada. Nenhuma aresta liga
    deputado a senador.

    Zero senadores é mudança de contrato, não Senado vazio — e sem o de-para todos os
    votos seriam descartados em silêncio, como já aconteceu com a Câmara.

    DECISÃO: Depois do descarte: o volume que importa é o do ano de verdade.

    A lista de exercício só tem quem está hoje; os votos alcançam quem saiu,
    licenciou-se ou devolveu a cadeira. Criá-los a partir do próprio voto evita
    descartar 10,5% da base por falta de dono.

    Sigla nova é sinal de que o domínio mudou. Ela vira None e a ingestão segue,
    mas o log precisa denunciar — senão a base encolhe sem ninguém perceber.
    """
    log.info("Ingerindo senadores...")
    em_exercicio = senado.baixar_senadores()
    carga_dos_senadores = carga_de_resposta(
        conexao, TipoFonteDeCarga.SENADO, f"{senado.BASE}/senador/lista/atual", em_exercicio,
        comum.CACHE / "respostas" / f"senadores-{date.today():%Y%m%d}.json",
    )
    senadores = ingestao_senado.senadores_para_linhas(em_exercicio)
    novos = persistencia.gravar_pessoas(conexao, senadores, carga_dos_senadores)
    log.info("  %d senadores em exercício, %d novos", len(senadores), novos)

    if not senadores:
        raise RuntimeError(
            "Nenhum senador lido de /senador/lista/atual. O envelope do JSON mudou? "
            "Sem o de-para, todos os votos seriam descartados em silêncio."
        )

    for ano in anos:
        log.info("Ingerindo Senado %d...", ano)

        brutas, baixado = senado.baixar_votacoes_com_procedencia(ano)
        procedencia.guardar(baixado, comum.CACHE / "procedencia")
        carga = persistencia.registrar_carga(conexao, baixado, procedencia.comando())
        votacoes_brutas, fora = ingestao_senado.separar_fora_de_epoca(brutas)
        if fora:
            apagadas = persistencia.apagar_votacoes(
                conexao, [ingestao_senado.id_da_votacao(v) for v in fora]
            )
            log.warning(
                "  %d votações FORA DE ÉPOCA descartadas: o código é de outra numeração "
                "que a data (achado #37). %d já gravadas por carga anterior, apagadas.",
                len(fora), apagadas,
            )

        senado.conferir_volume(votacoes_brutas, ano)

        anteriores = ingestao_senado.senadores_dos_votos(
            votacoes_brutas, ja_conhecidos={s["id_externo"] for s in senadores}
        )
        recuperados = persistencia.gravar_pessoas(conexao, anteriores, carga)
        if recuperados:
            log.info("  %d senadores fora da lista de exercício, criados pelo voto",
                     recuperados)

        mapa = _mapa_pessoas(conexao, fonte=TipoFonteDeIdentificador.SENADO)

        votacoes = ingestao_senado.votacoes_para_linhas(votacoes_brutas)
        persistencia.gravar_votacoes(conexao, votacoes, carga)

        abertas = sum(1 for linha in votacoes if not linha["secreta"])
        log.info(
            "  %d votações, %d abertas (%.0f%% secretas)",
            len(votacoes), abertas,
            100 * (len(votacoes) - abertas) / max(len(votacoes), 1),
        )

        votos = ingestao_senado.votos_para_linhas(votacoes_brutas, mapa)
        persistencia.gravar_votos(conexao, votos, carga)

        com_posicao = sum(1 for linha in votos if linha["valor"] is not None)
        log.info(
            "  %d votos, %d com posição utilizável (%.0f%%)",
            len(votos), com_posicao, 100 * com_posicao / max(len(votos), 1),
        )

        descartados = sum(len(v.get("votos") or []) for v in votacoes_brutas) - len(votos)
        if descartados:
            log.warning("  %d votos descartados: senador fora do de-para", descartados)

        _materias_do_senado(conexao, votacoes_brutas)

        novas = ingestao_senado.siglas_desconhecidas(votacoes_brutas)
        if novas:
            descricoes = ingestao_senado.descricoes_de_sigla(votacoes_brutas)
            for sigla, quantas in sorted(novas.items()):
                log.warning(
                    "  sigla FORA do domínio medido: %s (%d) — %s",
                    sigla, quantas, descricoes.get(sigla, "sem descrição na fonte"),
                )


def rodar_cota(conexao: psycopg.Connection, anos: list[int]) -> None:
    """Cota parlamentar — o gasto de gabinete que vai para a ficha do deputado.

    ATENÇÃO: O descarte é NORMAL (lideranças, órgãos, valor zero), mas em volume alto
    significa de-para incompleto — e aí a ficha mostraria gasto a menos.
    """
    mapa = _mapa_pessoas(conexao)
    if not mapa:
        raise RuntimeError(
            "De-para de pessoas vazio. Rode `ingerir` antes: sem ele, nenhuma despesa "
            "encontra dono e tudo seria descartado em silêncio."
        )

    for ano in anos:
        log.info("Cota de %d...", ano)

        arquivo = camara.baixar_cota(ano, comum.CACHE / f"cota-{ano}.zip")
        linhas = camara.ler_cota(arquivo)
        camara.conferir_volume_de_cota(linhas, ano)
        carga = carga_do_arquivo(conexao, TipoFonteDeCarga.CAMARA, camara.URL_COTA.format(ano=ano), arquivo)

        transformado = cota.transformar_camara(linhas, mapa)
        gravadas = persistencia.gravar_despesas(conexao, list(mapa.values()), transformado.despesas, carga)
        conta = cota.reconciliar(transformado, "COTA_CAMARA", ano)
        persistencia.gravar_reconciliacoes(conexao, [conta], carga)
        registrar_o_que_nao_fecha([conta])

        log.info("  %d linhas, %d gravadas", len(linhas), gravadas)
        if transformado.descartes:
            log.warning(
                "  %d descartadas, por motivo: %s",
                len(transformado.descartes), dict(Counter(d.motivo for d in transformado.descartes)),
            )

    _cota_do_senado(conexao, anos)


def _cota_do_senado(conexao: psycopg.Connection, anos: list[int]) -> None:
    """CEAPS — a cota do Senado, na MESMA tabela `despesas` da Camara.

    A tabela ja e generica: a ficha consulta por `pessoa_id`, entao o senador passa a
    ter gasto de gabinete sem tocar em API nem em tela.

    O de-para e por NOME parlamentar, porque a CEAPS nao publica id. Quem nao casa e
    descartado: atribuir gasto por semelhanca seria inventar dono.

    O ano civil atravessa a posse: janeiro ainda é da legislatura anterior. O
    de-para é o das duas, e o senador de mandato de 8 anos é a mesma pessoa nelas.

    Descarte alto significa de-para incompleto ou nome grafado diferente — e a
    ficha mostraria gasto a menos, sem erro.
    """
    for ano in anos:
        log.info("CEAPS de %d...", ano)

        legislaturas = sorted(
            {ingestao.legislatura_da_data(f"{ano}-01-15"), ingestao.legislatura_da_data(f"{ano}-12-15")}
        )
        por_nome = persistencia.senadores_por_nome(conexao, legislaturas)
        if not por_nome:
            log.info("  nenhum senador votou em %s; CEAPS de %d não lida.", legislaturas, ano)
            continue

        arquivo = senado.baixar_ceaps(ano, comum.CACHE / f"ceaps-{ano}.csv")
        linhas = senado.ler_ceaps(arquivo)
        carga = carga_do_arquivo(conexao, TipoFonteDeCarga.SENADO, senado.CEAPS.format(ano=ano), arquivo)

        transformado = cota.transformar_senado(linhas, por_nome)
        gravadas = persistencia.gravar_despesas(conexao, list(por_nome.values()), transformado.despesas, carga)
        conta = cota.reconciliar(transformado, "COTA_SENADO", ano)
        persistencia.gravar_reconciliacoes(conexao, [conta], carga)
        registrar_o_que_nao_fecha([conta])

        log.info("  %d linhas, %d gravadas", len(linhas), gravadas)

        if len(transformado.descartes) > len(linhas) * 0.2:
            nao_casaram = sorted(
                {
                    normalizacao.sem_acento_maiusculo(linha.nome_do_senador)
                    for linha in linhas
                    if normalizacao.sem_acento_maiusculo(linha.nome_do_senador) not in por_nome
                }
            )
            log.warning(
                "  %d de %d descartadas. Nomes sem de-para: %s",
                len(transformado.descartes), len(linhas), ", ".join(nao_casaram[:10]) or "-",
            )


def _materias_do_senado(conexao: psycopg.Connection, votacoes_brutas: list[dict]) -> None:
    """A ementa das votações do Senado — o que a descrição não diz.

    ## RISCO: Por que

    A descrição diz o NÚMERO do projeto:

    > *"Votação nominal do Projeto de Lei Complementar nº 124, de 2022, nos termos do
    > parecer."*

    Sem a matéria, os votos do Senado não têm assunto nenhum — a ficha do senador
    lista vinte linhas assim, e a curadoria do questionário vira adivinhação. É o mesmo
    buraco que a Pendência 40 fechou na Câmara.

    ## ATENÇÃO: Uma chamada por matéria

    Não há arquivo em lote: o Senado publica matéria a matéria. São ~360 chamadas por
    carga completa, e por isso só se baixa o que ainda não está no banco — recarregar
    o ano inteiro toda vez custaria minutos sem trazer nada novo.

    DECISÃO: Só o que falta. A ementa não muda depois de a matéria ser apresentada, e a
    releitura custaria uma requisição por matéria a cada execução.

    RISCO: O vínculo cobre TODAS as votações do ano, não só as recém-baixadas: matéria
    já no banco continua precisando ser apontada pelas votações novas.
    """
    codigos = {}
    for votacao in votacoes_brutas:
        codigo = votacao.get("codigoMateria")
        sessao = votacao.get("codigoSessaoVotacao")
        if codigo and sessao:
            codigos[f"SF-{sessao}"] = str(codigo)

    if not codigos:
        return

    with conexao.cursor() as cursor:
        cursor.execute(
            "SELECT id FROM proposicoes WHERE casa = 'SENADO' AND id = ANY(%s) AND carga_id IS NOT NULL",
            ([int(c) for c in set(codigos.values()) if c.isdigit()],),
        )
        ja_temos = {str(linha[0]) for linha in cursor.fetchall()}

    faltam = sorted(set(codigos.values()) - ja_temos)
    log.info("  %d matérias distintas, %d a baixar", len(set(codigos.values())), len(faltam))

    materias = []
    for posicao, codigo in enumerate(faltam, 1):
        if posicao % 50 == 0:
            log.info("    %d de %d...", posicao, len(faltam))
        materias.append(senado.baixar_materia(codigo))

    linhas, vinculo = proposicoes.do_senado(materias, codigos)

    if linhas:
        carga_das_materias = carga_de_resposta(
            conexao, TipoFonteDeCarga.SENADO, f"{senado.BASE}/materia/", [m for m in materias if m is not None],
            comum.CACHE / "respostas" / f"materias-{date.today():%Y%m%d-%H%M%S}.json",
        )
        persistencia.gravar_proposicoes(conexao, linhas, carga_das_materias)

    todas = {v: c for v, c in codigos.items()}
    ligados = persistencia.vincular_proposicoes(
        conexao,
        {v: int(c) for v, c in todas.items() if c.isdigit()},
        casa=TipoCasa.SENADO,
    )

    log.info("  %d matérias gravadas, %d votações vinculadas", len(linhas), ligados)


def rodar_simbolicas(conexao: psycopg.Connection, anos: list[int]) -> None:
    """Conta as simbólicas dos anos pedidos sem reingerir os votos: lê o arquivo de votações do
    cache e baixa só o que faltar. O `ingerir` já conta as do ano que carrega."""
    for ano in anos:
        arquivo = comum.CACHE / f"votacoes-{ano}.csv"
        if arquivo.exists():
            carga = carga_do_arquivo(conexao, TipoFonteDeCarga.CAMARA, camara.url_do_arquivo("votacoes", ano), arquivo)
        else:
            arquivo, carga = baixar_da_camara(conexao, "votacoes", ano)
        total = persistencia.gravar_simbolicas(
            conexao, TipoCasa.CAMARA, ano, ingestao.simbolicas_por_legislatura(camara.ler_csv(arquivo)), carga
        )
        log.info("  %d: %d votações simbólicas", ano, total)


def rodar_reclassificar(conexao: psycopg.Connection) -> None:
    """A2 — aplica a regra de categoria atual a toda votação gravada, sem baixar nada.

    A categoria muda o peso da votação no grafo; depois de mudar, rode `analisar` nas
    legislaturas que o log lista. Pergunta do questionário que mudasse de categoria
    derruba o comando: a curadoria escolheu a votação pela categoria antiga.
    """
    from ..nucleo.normalizacao import classificar_categoria

    votacoes = conexao.execute("SELECT id, casa, legislatura, categoria, descricao FROM votacoes").fetchall()
    perguntas = {linha[0] for linha in conexao.execute("SELECT votacao_id FROM perguntas WHERE ativa").fetchall()}

    mudancas = [
        (id_, casa, legislatura, antiga, nova)
        for id_, casa, legislatura, antiga, descricao in votacoes
        if (nova := classificar_categoria(descricao)) != antiga
    ]
    afetadas = [m[0] for m in mudancas if m[0] in perguntas]
    if afetadas:
        raise RuntimeError(f"A regra nova muda a categoria de perguntas ativas: {afetadas}")

    with conexao.transaction():
        for id_, _, _, _, nova in mudancas:
            conexao.execute("UPDATE votacoes SET categoria = %s WHERE id = %s", (nova, id_))

    contagem = Counter((casa, legislatura, antiga, nova) for _, casa, legislatura, antiga, nova in mudancas)
    log.info("Reclassificar: %d de %d votações mudaram de categoria", len(mudancas), len(votacoes))
    for (casa, legislatura, antiga, nova), n in sorted(contagem.items()):
        log.info("  %s %dª: %d de %s para %s", casa, legislatura, n, antiga, nova)


def rodar_inteiro_teor(conexao: psycopg.Connection) -> None:
    """O endereço do texto integral das proposições da Câmara que ainda não o têm, um arquivo de proposições por ano.

    MEDIDO em 2026-10-24: 4.894 proposições votadas, de 39 anos (1988 a 2026); o arquivo de 2024 tem 53 MB. Só os anos com
    proposição pendente são baixados, e a que o arquivo não traz fica vazia, para não ser procurada de novo.
    """
    pendentes = persistencia.proposicoes_sem_inteiro_teor(conexao)
    log.info("Inteiro teor: %d proposições pendentes em %d anos", sum(map(len, pendentes.values())), len(pendentes))
    achadas = vazias = 0
    for ano, ids in sorted(pendentes.items()):
        try:
            arquivo, carga = baixar_da_camara(conexao, "proposicoes", ano)
        except requests.HTTPError as erro:
            if erro.response is None or erro.response.status_code != 404:
                raise
            log.warning("  %d sem arquivo de proposições (404)", ano)
            continue
        linhas = proposicoes.inteiro_teor_para_linhas(ler_tabela(LinhaDeProposicaoDaCamara, camara.ler_csv(arquivo)), ids)
        lidas = {id_proposicao for id_proposicao, _ in linhas}
        linhas += [(id_proposicao, "") for id_proposicao in ids - lidas]
        persistencia.gravar_inteiro_teor(conexao, linhas, carga)
        achadas += sum(1 for _, url in linhas if url)
        vazias += sum(1 for _, url in linhas if not url)
    log.info("  %d com texto integral, %d sem texto publicado", achadas, vazias)


def rodar_palavras_chave(conexao: psycopg.Connection, limite: int | None) -> None:
    """Pendência 70 — busca as palavras-chave das proposições votadas que ainda não as têm.

    Câmara pela API (`keywords`), Senado pela matéria (`IndexacaoMateria`). Uma requisição
    por proposição, com pausa curta, gravando de 100 em 100: interromper no meio não perde o
    que já veio, e a próxima execução retoma pelas nulas.
    """
    pendentes = persistencia.proposicoes_sem_palavras_chave(conexao)
    if limite is not None:
        pendentes = pendentes[:limite]
    log.info("Palavras-chave: %d proposições a consultar", len(pendentes))

    lote: list[tuple[str, int, str]] = []
    falhas = 0

    def gravar(lote: list[tuple[str, int, str]]) -> None:
        """Cada lote, por casa, vira um arquivo com as respostas, registrado com o hash antes de gravar."""
        for casa in (TipoCasa.CAMARA, TipoCasa.SENADO):
            da_casa = [linha for linha in lote if linha[0] == casa]
            if not da_casa:
                continue
            url = f"{camara.API}/proposicoes" if casa == TipoCasa.CAMARA else f"{senado.BASE}/materia/"
            carga = carga_de_resposta(
                conexao, casa, url, [{"id": id_, "palavras_chave": p} for _, id_, p in da_casa],
                comum.CACHE / "respostas" / f"palavras-chave-{casa.lower()}-{datetime.now():%Y%m%d-%H%M%S-%f}.json",
            )
            persistencia.gravar_palavras_chave(conexao, da_casa, carga)

    for posicao, (casa, id_proposicao) in enumerate(pendentes, 1):
        if casa == TipoCasa.CAMARA:
            palavras = camara.palavras_chave_da_proposicao(id_proposicao)
        else:
            materia = senado.baixar_materia(str(id_proposicao))
            palavras = None if materia is None else materia.get("indexacao") or ""
        if palavras is None:
            falhas += 1
        else:
            lote.append((casa, id_proposicao, palavras))
        if len(lote) >= 100:
            gravar(lote)
            lote = []
            log.info("  %d de %d", posicao, len(pendentes))
        time.sleep(0.05)

    gravar(lote)
    if falhas:
        log.warning("  %d não responderam; ficam para a próxima execução", falhas)


def rodar_em_exercicio(conexao: psycopg.Connection) -> None:
    """Quem está em exercício hoje, pela lista oficial de cada casa (decisão do autor, 2026-10-18).

    Roda depois de `ingerir` e `senado`, que criam as pessoas. Uma casa com lista curta derruba a
    carga antes de gravar: o worker tiraria da lista de seguidos de todo mundo quem faltasse.
    """
    hoje = f"{date.today():%Y%m%d}"

    deputados = camara.baixar_deputados_em_exercicio()
    carga = carga_de_resposta(conexao, TipoFonteDeCarga.CAMARA, camara.URL_EM_EXERCICIO, deputados,
                               comum.CACHE / "respostas" / f"deputados-em-exercicio-{hoje}.json")
    pessoas_da_camara = _mapa_pessoas(conexao, TipoFonteDeIdentificador.CAMARA)
    resultado = em_exercicio.da_camara(deputados, pessoas_da_camara)
    legislatura = next((linha.legislatura for linha in resultado.linhas if linha.legislatura), None)
    licenciados = _licenciados_da_camara(conexao, deputados, legislatura, pessoas_da_camara) if legislatura else []
    gravadas = persistencia.gravar_em_exercicio(conexao, TipoCasa.CAMARA, em_exercicio.juntar(resultado.linhas, licenciados), carga)
    log.info("  Câmara: %d gravados (%d licenciados), %d sem pessoa no banco ainda",
             gravadas, len(licenciados), resultado.sem_pessoa)

    senadores = senado.baixar_senadores()
    carga = carga_de_resposta(conexao, TipoFonteDeCarga.SENADO, f"{senado.BASE}/senador/lista/atual", senadores,
                               comum.CACHE / "respostas" / f"senadores-em-exercicio-{hoje}.json")
    pessoas_do_senado = _mapa_pessoas(conexao, TipoFonteDeIdentificador.SENADO)
    resultado = em_exercicio.do_senado(senadores, pessoas_do_senado)
    afastados = senado.baixar_afastados()
    carga_de_resposta(conexao, TipoFonteDeCarga.SENADO, f"{senado.BASE}/senador/afastados", afastados,
                       comum.CACHE / "respostas" / f"senadores-afastados-{hoje}.json")
    licenciados = em_exercicio.licenciados_do_senado(afastados, pessoas_do_senado)
    gravadas = persistencia.gravar_em_exercicio(conexao, TipoCasa.SENADO, em_exercicio.juntar(resultado.linhas, licenciados), carga)
    log.info("  Senado: %d gravados (%d licenciados), %d sem pessoa no banco ainda",
             gravadas, len(licenciados), resultado.sem_pessoa)


def _licenciados_da_camara(conexao: psycopg.Connection, em_exercicio_hoje: list[dict], legislatura: int,
                           pessoas: dict[str, int]) -> list:
    """Os licenciados da Câmara: a situação de cada deputado da legislatura que não está em exercício.

    Uma consulta por deputado fora do exercício (MEDIDO em 2026-10-19: 135 na 57ª, ~30 s). A resposta
    de cada um é guardada em `respostas/`, como a de redes e CPF.
    """
    da_legislatura = camara.deputados_da_legislatura(legislatura)
    fora = {str(d.get("id")) for d in da_legislatura} - {str(d.get("id")) for d in em_exercicio_hoje}
    situacoes = {id_camara: camara.situacao_do_deputado(id_camara) for id_camara in sorted(fora)}
    carga_de_resposta(conexao, TipoFonteDeCarga.CAMARA, f"{camara.API}/deputados/{{id}}", situacoes,
                       comum.CACHE / "respostas" / f"situacao-dos-deputados-{date.today():%Y%m%d}.json")
    return em_exercicio.licenciados_da_camara(situacoes, pessoas, legislatura)


def _mapa_pessoas(conexao: psycopg.Connection, fonte: str = TipoFonteDeIdentificador.CAMARA) -> dict[str, int]:
    """`id_externo` -> `pessoa_id`, por fonte.

    A fonte é parâmetro porque a mesma pessoa pode ter id nas duas casas: 41 dos 81
    senadores já foram deputados (achado #18). Misturar as duas faria o voto de senador
    procurar dono entre ids da Câmara e ser descartado inteiro.
    """
    linhas = conexao.execute(
        "SELECT id_externo, pessoa_id FROM pessoa_fonte_ids WHERE fonte = %s", (fonte,)
    ).fetchall()
    return {str(externo): pessoa_id for externo, pessoa_id in linhas}
