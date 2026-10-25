"""As cargas que chamam outras: a rotina agendada, a troca da chave do CPF e a limpeza do cache."""

import logging
import time
from datetime import date

import psycopg

from ..governo import selic
from ..nucleo import limpeza, rotina
from . import analise, cidades, comum, congresso, eleicoes, emendas, governo, pessoas, qualidade

log = logging.getLogger("poligraph")


def rodar_rechavear_cpf(conexao: psycopg.Connection) -> None:
    """Pendência 77 — refaz com a chave atual todo hash de CPF que está no banco.

    Serve para a troca do SHA-256 sem chave pelo HMAC, e para a rotação da chave. Um hash
    não se converte em outro sem o CPF, então cada tabela é recarregada da fonte:

    | Tabela | Coluna | Recarga |
    |---|---|---|
    | `pessoas` | `cpf_hash` | `cpf` |
    | `despesas` | `cnpj_ou_hash` | `cota`, nos anos que estão no banco |
    | `receitas_de_campanha` | `doador_cnpj_ou_hash` | `fundo`, nas eleições que estão no banco |
    | `patrimonios` | a ponte pelo `cpf_hash` | `patrimonio`, nas eleições que estão no banco |
    | `pessoas` | `titulo_hash`, e o `cpf_hash` de quem não está no Congresso | `mandatos`, que acha a pessoa pela candidatura e devolve os dois |

    RISCO: Até o fim, as tabelas misturam as duas chaves e o cruzamento entre elas falha em
    silêncio. Se o comando parar no meio, rode de novo: cada etapa substitui o seu recorte.
    """
    anos_da_cota = [linha[0] for linha in conexao.execute(
        "SELECT DISTINCT ano FROM despesas ORDER BY 1").fetchall()]
    eleicoes = [linha[0] for linha in conexao.execute(
        "SELECT DISTINCT ano_eleicao FROM receitas_de_campanha ORDER BY 1").fetchall()]
    anos_do_patrimonio = [linha[0] for linha in conexao.execute(
        "SELECT DISTINCT ano_eleicao FROM patrimonios ORDER BY 1").fetchall()]
    eleicoes_dos_mandatos = [linha[0] for linha in conexao.execute(
        "SELECT DISTINCT ano_eleicao FROM mandatos ORDER BY 1").fetchall()]

    apagados = conexao.execute(
        "UPDATE pessoas SET cpf_hash = NULL, titulo_hash = NULL WHERE cpf_hash IS NOT NULL OR titulo_hash IS NOT NULL").rowcount
    log.info("cpf_hash apagado de %d pessoas; refazendo com a chave atual.", apagados)
    pessoas.rodar_cpf(conexao, todas_as_legislaturas=True)

    if anos_da_cota:
        congresso.rodar_cota(conexao, anos_da_cota)
    for eleicao in eleicoes:
        eleicoes.rodar_fundo(conexao, eleicao, None)
    if anos_do_patrimonio:
        eleicoes.rodar_patrimonio(conexao, anos_do_patrimonio)
    if eleicoes_dos_mandatos:
        eleicoes.rodar_mandatos(conexao, eleicoes_dos_mandatos)

    refeitos = conexao.execute("SELECT count(cpf_hash) FROM pessoas").fetchone()[0]
    log.info("Rechaveado: %d de %d pessoas voltaram a ter cpf_hash.", refeitos, apagados)


def rodar_rotina(conexao: psycopg.Connection, frequencia: str) -> None:
    """Pendência 64 — roda as etapas da rotina, na ordem, e para na primeira que falhar.

    DECISÃO: Parar, e não seguir: depois de uma carga que falhou, o `conferir` julgaria um
    banco pela metade, e a próxima rotina refaz tudo de qualquer jeito. O Coolify mostra a
    tarefa como falha, com o log da etapa.
    """
    lista = rotina.etapas(frequencia, date.today())
    log.info("Rotina %s: %s", frequencia, " · ".join(str(etapa) for etapa in lista))

    _travar_rotina(conexao)
    try:
        for numero, etapa in enumerate(lista, 1):
            log.info("Etapa %d de %d: %s", numero, len(lista), etapa)
            _executar_etapa(conexao, etapa)
        _avisar_que_terminou(conexao, frequencia)
    finally:
        conexao.execute("SELECT pg_advisory_unlock(%s)", (TRAVA_DA_ROTINA,))


def _avisar_que_terminou(conexao: psycopg.Connection, frequencia: str) -> None:
    """Pendência 89 — grava em `eventos` que a rotina passou por todas as etapas.

    O worker de notificações lê esse registro e avisa quem segue. Só chega aqui a rotina que
    não falhou: a que parou no meio não grava evento, e ninguém é avisado sobre dado pela metade.
    """
    conexao.execute("INSERT INTO eventos (tipo) VALUES (%s)", (f"ROTINA_{frequencia.upper()}",))
    log.info("Evento ROTINA_%s gravado para o worker de notificações.", frequencia.upper())


TRAVA_DA_ROTINA = 64_2026
"""Chave da trava do Postgres que impede duas rotinas ao mesmo tempo (Pendência 64)."""


def _travar_rotina(conexao: psycopg.Connection) -> None:
    """Espera a outra rotina terminar, se houver uma rodando.

    DECISÃO (2026-10-15): esperar, e não desistir. A semanal e a mensal caem no mesmo dia algumas
    vezes por ano; desistindo, a mensal do mês se perderia. A trava é da sessão: cai sozinha se o
    processo morrer, e a conexão da ETL é autocommit, então nenhuma transação a segura.
    """
    if conexao.execute("SELECT pg_try_advisory_lock(%s)", (TRAVA_DA_ROTINA,)).fetchone()[0]:
        return
    log.info("Outra rotina está rodando; esperando ela terminar.")
    conexao.execute("SELECT pg_advisory_lock(%s)", (TRAVA_DA_ROTINA,))
    log.info("A outra rotina terminou; seguindo.")


def _executar_etapa(conexao: psycopg.Connection, etapa: rotina.Etapa) -> None:
    """Os mesmos comandos da linha de comando; `analisar` vai na legislatura corrente da casa."""
    anos = etapa.argumentos.get("anos", [])
    if etapa.comando == "ingerir":
        congresso.rodar_ingerir(conexao, anos)
    elif etapa.comando == "senado":
        congresso.rodar_senado(conexao, anos)
    elif etapa.comando == "em-exercicio":
        congresso.rodar_em_exercicio(conexao)
    elif etapa.comando == "palavras-chave":
        congresso.rodar_palavras_chave(conexao, None)
    elif etapa.comando == "inteiro-teor":
        congresso.rodar_inteiro_teor(conexao)
    elif etapa.comando == "cota":
        congresso.rodar_cota(conexao, anos)
    elif etapa.comando == "emendas":
        emendas.rodar_emendas(conexao, anos)
    elif etapa.comando == "populacao":
        cidades.rodar_populacao(conexao)
    elif etapa.comando == "simbolicas":
        congresso.rodar_simbolicas(conexao, anos)
    elif etapa.comando == "sedes-brasilapi":
        cidades.rodar_sedes_brasilapi(conexao, None)
    elif etapa.comando == "convenios":
        emendas.rodar_convenios(conexao)
    elif etapa.comando == "governo":
        governo.rodar_governo(conexao, anos, etapa.argumentos["eleicao"])
    elif etapa.comando == "selic":
        governo.rodar_selic(conexao, selic.DESDE)
    elif etapa.comando == "defesa-civil":
        governo.rodar_defesa_civil(conexao, anos)
    elif etapa.comando == "viagens":
        governo.rodar_viagens(conexao, anos)
    elif etapa.comando == "compras":
        governo.rodar_compras(conexao, anos)
    elif etapa.comando == "sancoes":
        governo.rodar_sancoes(conexao)
    elif etapa.comando == "compras-centralizadas":
        governo.rodar_compras_centralizadas(conexao, anos)
    elif etapa.comando == "municipios":
        cidades.rodar_municipios(conexao, None)
    elif etapa.comando == "fundo":
        eleicoes.rodar_fundo(conexao, etapa.argumentos["eleicao"], None)
    elif etapa.comando == "siconfi":
        cidades.rodar_siconfi(conexao, etapa.argumentos["anos"], None)
    elif etapa.comando == "mandatos":
        eleicoes.rodar_mandatos(conexao, etapa.argumentos["eleicoes"])
    elif etapa.comando == "patrimonio":
        eleicoes.rodar_patrimonio(conexao, anos)
    elif etapa.comando == "redes":
        eleicoes.rodar_redes(conexao, anos)
    elif etapa.comando == "analisar":
        casa = etapa.argumentos["casa"]
        corrente = conexao.execute(
            "SELECT max(legislatura) FROM votacoes WHERE casa = %s", (casa,)).fetchone()[0]
        if corrente is not None:
            analise.rodar_analisar(conexao, corrente, casa)
    elif etapa.comando == "conferir":
        qualidade.rodar_conferir(conexao)
    elif etapa.comando == "limpar-cache":
        rodar_limpar_cache()
    else:
        raise ValueError(f"Etapa sem execução: {etapa.comando}")


def rodar_limpar_cache() -> None:
    """Apaga do cache o que venceu, pelas regras de `limpeza`. Não toca no banco."""
    log.info("Limpando o cache em %s...", comum.CACHE)
    limpeza.limpar(comum.CACHE, time.time())
