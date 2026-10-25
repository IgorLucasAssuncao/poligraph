"""Os municípios: a tabela TOM e IBGE, a população, a sede de cada CNPJ e as contas das prefeituras."""

import json
import logging
import time
from datetime import date
from pathlib import Path

import psycopg

from ..cidades import municipios
from ..fontes import brasilapi, receita
from ..nucleo import persistencia
from ..contratos import entrada
from ..nucleo.tipos import TipoFonteDeCarga
from . import comum
from .comum import carga_de_resposta, carga_do_arquivo

log = logging.getLogger("poligraph")


def rodar_municipios(conexao: psycopg.Connection, diretorio: Path | None) -> None:
    """A cidade da sede de cada CNPJ que recebeu emenda — só por chave forte.

    ATENÇÃO: Rode depois de `emendas`: os CNPJs procurados são os que estão em
    `emendas_favorecidos`. Sem eles, o cadastro inteiro é lido para gravar nada.
    """
    arquivo_tom = receita.baixar_tabela_tom(comum.CACHE / "receita-municipios.csv")
    carga_tom = carga_do_arquivo(conexao, "RECEITA", receita.TABELA_TOM, arquivo_tom)
    tabela = receita.ler_tabela_tom(arquivo_tom)
    linhas_municipios = municipios.municipios_para_linhas(tabela)
    tom_para_ibge = {m["codigo_tom"]: m["codigo_ibge"] for m in linhas_municipios}
    log.info("  %d municípios na tabela TOM ↔ IBGE", len(linhas_municipios))

    alvos = persistencia.cnpjs_que_receberam_emenda(conexao)
    if not alvos:
        log.warning("Nenhum CNPJ em emendas_favorecidos — rode `emendas` antes.")
        return

    pasta = receita.ultima_pasta()
    sedes: list[dict] = []
    for nome in receita.ARQUIVOS_DE_ESTABELECIMENTOS:
        if diretorio:
            arquivo = diretorio / nome
        else:
            arquivo = receita.baixar(pasta, nome, comum.CACHE / "receita" / pasta / nome)
        carga = carga_do_arquivo(conexao, "RECEITA", f"{receita.WEBDAV}/{pasta}/{nome}", arquivo)
        sedes.extend(
            {**linha, "carga_id": carga}
            for linha in municipios.sedes_para_linhas(
                receita.sedes([arquivo], alvos), tom_para_ibge, pasta
            )
        )
    log.info("  %d de %d CNPJs com município IBGE", len(sedes), len(alvos))

    with conexao.transaction():
        persistencia.gravar_municipios(conexao, linhas_municipios, carga_tom)
        persistencia.gravar_cnpjs_municipio(conexao, sedes)


def rodar_populacao(conexao: psycopg.Connection) -> None:
    """A população estimada pelo IBGE em cada município, o divisor do mapa por habitante.

    A carga é do IBGE, com o arquivo da API no cache e na procedência, como as outras.
    """
    from ..fontes import ibge

    arquivo = ibge.baixar(comum.CACHE / "ibge" / f"populacao-{date.today():%Y%m%d}.json")
    carga = carga_do_arquivo(conexao, "IBGE", ibge.URL, arquivo)
    linhas = ibge.ler(arquivo)
    com_populacao = persistencia.gravar_populacao(conexao, linhas, carga)
    ano = max((l["ano"] for l in linhas), default=None)
    log.info("População %s: %d municípios no arquivo, %d com população na base", ano, len(linhas), com_populacao)


def _recusas(contagem: dict[int, int]) -> str:
    """"3 de 429, 1 sem resposta": as recusas do Tesouro para o log."""
    return ", ".join(f"{n} {'sem resposta' if codigo == 0 else f'de {codigo}'}" for codigo, n in sorted(contagem.items())) or "nenhuma"


ESPERA_DEPOIS_DO_BLOQUEIO = 120
"""Segundos de pausa depois que o Tesouro bloqueia um município até o fim das tentativas."""


def rodar_siconfi(conexao: psycopg.Connection, anos: list[int], municipios: list[str] | None, arquivo: Path | None = None) -> None:
    """As contas anuais das prefeituras, da DCA que cada uma entrega ao Tesouro (Pendência 90, fase 5).

    Uma requisição por município, anexo e ano: a API não responde sem o município. Uma de cada vez.
    MEDIDO em 2026-10-22: com quatro, o Tesouro respondeu 429 em menos de 3 minutos; com duas, depois de
    quatro anos carregados no mesmo dia, o bloqueio passou das oito tentativas e derrubou a carga.

    O progresso vai para `siconfi/dca-{ano}-parcial.json` a cada 100 municípios: rodar de novo continua
    de onde parou. O município que o Tesouro bloqueia fica para uma segunda rodada, depois de uma pausa;
    se ainda faltar algum, o comando para e diz quais, sem gravar o ano pela metade.

    DECISÃO: a procedência guarda as linhas que entram na conta (as contas de `siconfi.py`), não a
    resposta inteira: o ano inteiro passaria de 800 MB, e o resto do anexo não chega ao banco.
    """
    import requests

    from ..cidades import siconfi
    from ..contratos.siconfi import LinhaDaDca
    from ..fontes import siconfi as fonte

    usadas = {siconfi.CONTA_DA_RECEITA} | siconfi.CONTAS_DA_DESPESA
    if arquivo is not None:
        _siconfi_do_arquivo(conexao, anos, arquivo)
        return
    codigos = municipios or [linha[0] for linha in conexao.execute("SELECT codigo_ibge FROM municipios ORDER BY 1").fetchall()]

    def do_municipio(ano: int, codigo: str):
        receitas = fonte.consultar(ano, fonte.ANEXO_DE_RECEITAS, codigo)
        despesas = fonte.consultar(ano, fonte.ANEXO_DE_DESPESAS, codigo) if receitas else []
        lidas_r = entrada.ler(LinhaDaDca, receitas)
        lidas_d = entrada.ler(LinhaDaDca, despesas)
        guardar = [r for r in receitas + despesas if r.get("cod_conta") in usadas]
        return codigo, siconfi.contas_para_linha(codigo, ano, lidas_r, lidas_d), guardar

    for ano in anos:
        inicio = time.monotonic()
        parcial = comum.CACHE / "siconfi" / f"dca-{ano}-parcial.json"
        feito = json.loads(parcial.read_text(encoding="utf-8")) if parcial.exists() and not municipios else {"respostas": {}, "sem_declaracao": []}
        respostas: dict = feito["respostas"]
        sem_declaracao: list = feito["sem_declaracao"]
        ja = set(respostas) | set(sem_declaracao)
        if ja:
            log.info("  %d: retomando, %d municípios já consultados", ano, len(ja))

        def guardar_progresso() -> None:
            parcial.parent.mkdir(parents=True, exist_ok=True)
            parcial.write_text(json.dumps({"respostas": respostas, "sem_declaracao": sem_declaracao}, ensure_ascii=False), encoding="utf-8")

        pendentes = [c for c in codigos if c not in ja]
        for rodada in (1, 2):
            falharam = []
            for i, codigo in enumerate(pendentes, 1):
                try:
                    _, linha, guardar = do_municipio(ano, codigo)
                except requests.RequestException as erro:
                    log.warning("  %d: %s sem resposta do Tesouro (%s); fica para depois", ano, codigo, type(erro).__name__)
                    falharam.append(codigo)
                    time.sleep(ESPERA_DEPOIS_DO_BLOQUEIO)
                    continue
                if linha is None:
                    sem_declaracao.append(codigo)
                else:
                    respostas[codigo] = guardar
                if i % 100 == 0:
                    guardar_progresso()
                if i % 100 == 0:
                    log.info("  %d: %d de %d municípios consultados (%.0f s); recusas do Tesouro até aqui: %s",
                             ano, len(respostas) + len(sem_declaracao), len(codigos), time.monotonic() - inicio,
                             _recusas(fonte.RECUSAS))
            guardar_progresso()
            pendentes = falharam
            if not pendentes:
                break
        if pendentes:
            raise SystemExit(
                f"{ano}: o Tesouro não respondeu para {len(pendentes)} municípios ({', '.join(pendentes[:10])}...). "
                f"O progresso está em {parcial}; rode de novo para continuar de onde parou.")

        lidas = {c: entrada.ler(LinhaDaDca, g) for c, g in respostas.items()}
        linhas = [
            linha for c, l in lidas.items()
            if (linha := siconfi.contas_para_linha(
                c, ano, [x for x in l if x.cod_conta == siconfi.CONTA_DA_RECEITA], [x for x in l if x.cod_conta in siconfi.CONTAS_DA_DESPESA]))
        ]
        carga = carga_de_resposta(
            conexao, TipoFonteDeCarga.TESOURO, f"{fonte.URL}?an_exercicio={ano}", respostas,
            comum.CACHE / "siconfi" / f"dca-{ano}-{date.today():%Y%m%d}.json",
        )
        with conexao.transaction():
            if municipios:
                conexao.execute("DELETE FROM contas_dos_municipios WHERE ano = %s AND codigo_ibge = ANY(%s)", (ano, codigos))
                persistencia.gravar_contratos(conexao, linhas, carga)
            else:
                persistencia.gravar_contas_dos_municipios(conexao, [ano], linhas, carga)
        log.info("  %d: %d municípios com DCA, %d sem declaração, em %.0f s; recusas do Tesouro: %s", ano, len(linhas), len(sem_declaracao),
                 time.monotonic() - inicio, _recusas(fonte.RECUSAS))
        parcial.unlink(missing_ok=True)


def _siconfi_do_arquivo(conexao: psycopg.Connection, anos: list[int], arquivo: Path) -> None:
    """Regrava um ano da DCA a partir da resposta guardada pelo `siconfi`, sem as 11 mil consultas ao Tesouro.

    O arquivo é o que o `siconfi` grava em `siconfi/dca-{ano}-{data}.json`: as linhas usadas, por município.
    MEDIDO em 2026-10-22: a carga de 2024 levou 77 minutos e caiu na gravação; com o arquivo, segundos.
    """
    from ..cidades import siconfi
    from ..contratos.siconfi import LinhaDaDca
    from ..fontes import siconfi as fonte

    if len(anos) != 1:
        raise SystemExit("Com --arquivo, um ano só: o arquivo é de um ano.")
    ano = anos[0]
    carga = carga_do_arquivo(conexao, TipoFonteDeCarga.TESOURO, f"{fonte.URL}?an_exercicio={ano}", arquivo)
    respostas = json.loads(arquivo.read_text(encoding="utf-8"))
    linhas = []
    for codigo, guardadas in respostas.items():
        lidas = entrada.ler(LinhaDaDca, guardadas)
        receitas = [l for l in lidas if l.cod_conta == siconfi.CONTA_DA_RECEITA]
        despesas = [l for l in lidas if l.cod_conta in siconfi.CONTAS_DA_DESPESA]
        if (linha := siconfi.contas_para_linha(codigo, ano, receitas, despesas)) is not None:
            linhas.append(linha)
    with conexao.transaction():
        persistencia.gravar_contas_dos_municipios(conexao, [ano], linhas, carga)
    log.info("  %d: %d municípios com DCA, do arquivo %s", ano, len(linhas), arquivo.name)


TAMANHO_DO_LOTE_DE_SEDES = 500


def rodar_sedes_brasilapi(conexao: psycopg.Connection, limite: int | None) -> None:
    """Pendência 71 — a sede dos CNPJs que o cadastro da Receita em bloco não resolveu.

    Em lotes de 500: cada lote vira um arquivo JSONL com os quatro campos (sem sócios), uma
    carga com o hash dele e a gravação. Interromper no meio não perde os lotes gravados, e a
    próxima execução retoma pelos que faltam.

    DECISÃO: A carga é da fonte RECEITA, com a URL da BrasilAPI: o dado é o cadastro aberto
    da Receita, e o caminho por onde ele veio fica escrito.
    """
    pendentes = persistencia.cnpjs_sem_sede(conexao)
    if limite is not None:
        pendentes = pendentes[:limite]
    conhecidos = persistencia.codigos_ibge(conexao)
    log.info("Sedes pela BrasilAPI: %d CNPJs a consultar", len(pendentes))

    hoje = date.today()
    cadastro_de = hoje.replace(day=1).isoformat()
    pasta = comum.CACHE / "brasilapi"
    pasta.mkdir(parents=True, exist_ok=True)

    achadas = sem_resposta = fora_da_tabela = 0
    ritmo = brasilapi.Ritmo()
    for inicio in range(0, len(pendentes), TAMANHO_DO_LOTE_DE_SEDES):
        lote = pendentes[inicio:inicio + TAMANHO_DO_LOTE_DE_SEDES]
        respostas = []
        for cnpj in lote:
            sede = brasilapi.sede(cnpj, ritmo)
            if sede is None:
                sem_resposta += 1
            elif sede["codigo_ibge"] not in conhecidos:
                fora_da_tabela += 1
            else:
                respostas.append(sede)

        if respostas:
            arquivo = pasta / f"sedes-{hoje:%Y%m%d}-{inicio // TAMANHO_DO_LOTE_DE_SEDES:03d}.jsonl"
            arquivo.write_text(
                "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in respostas), encoding="utf-8"
            )
            carga = carga_do_arquivo(conexao, "RECEITA", f"{brasilapi.BASE}/", arquivo)
            persistencia.gravar_cnpjs_municipio(
                conexao,
                [{"cnpj": r["cnpj"], "codigo_ibge": r["codigo_ibge"], "cadastro_de": cadastro_de} for r in respostas],
                carga,
            )
            achadas += len(respostas)
        log.info("  %d de %d: %d com sede gravada; pausa %.2f s, %d recusas até aqui",
                 inicio + len(lote), len(pendentes), achadas, ritmo.pausa, ritmo.recusas)

    log.info(
        "Sedes: %d gravadas, %d sem resposta (ficam para a próxima), %d com município fora da tabela",
        achadas, sem_resposta, fora_da_tabela,
    )
