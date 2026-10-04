"""Pendência 72 — a procedência de cada arquivo baixado: o hash, a carga e o `carga_id` nas linhas."""

import hashlib
from datetime import datetime, timezone

import pytest

from poligraph_etl import procedencia


class RespostaFalsa:
    """O que o `requests` devolve, com o que a procedência lê."""

    def __init__(self, conteudo: bytes, cabecalhos: dict | None = None):
        self.url = "https://dadosabertos.camara.leg.br/arquivos/votacoes/csv/votacoes-2026.csv"
        self.content = conteudo
        self.headers = cabecalhos or {}


def test_o_hash_e_o_dos_bytes_como_chegaram():
    baixado = procedencia.de_resposta("CAMARA", RespostaFalsa(b"id;voto\n1;Sim\n"))

    assert baixado.sha256 == hashlib.sha256(b"id;voto\n1;Sim\n").hexdigest()
    assert len(baixado.sha256) == 64 and baixado.sha256 == baixado.sha256.lower()


def test_um_byte_a_mais_muda_o_hash():
    a = procedencia.de_resposta("CAMARA", RespostaFalsa(b"1;Sim"))
    b = procedencia.de_resposta("CAMARA", RespostaFalsa(b"1;Sin"))

    assert a.sha256 != b.sha256


def test_guarda_a_identificacao_que_a_fonte_deu_a_versao():
    """MEDIDO em 2026-10-02: a Câmara manda ETag e Last-Modified, e nenhum hash."""
    baixado = procedencia.de_resposta("CAMARA", RespostaFalsa(
        b"x", {"ETag": '"6abf5446-448d62"', "Last-Modified": "Fri, 02 Oct 2026 06:50:46 GMT"},
    ))

    assert baixado.etag == '"6abf5446-448d62"'
    assert baixado.modificado_na_fonte == datetime(2026, 10, 2, 6, 50, 46, tzinfo=timezone.utc)


def test_last_modified_malformado_vira_nulo_e_nao_derruba():
    baixado = procedencia.de_resposta("SENADO", RespostaFalsa(b"x", {"Last-Modified": "ontem"}))

    assert baixado.modificado_na_fonte is None


def test_fonte_desconhecida_e_recusada_antes_do_banco():
    with pytest.raises(ValueError):
        procedencia.de_resposta("WIKIPEDIA", RespostaFalsa(b"x"))


def test_guardar_usa_o_hash_como_nome_e_nao_duplica(tmp_path):
    baixado = procedencia.de_resposta("CAMARA", RespostaFalsa(b"conteudo"))

    primeiro = procedencia.guardar(baixado, tmp_path)
    segundo = procedencia.guardar(baixado, tmp_path)

    assert primeiro == segundo
    assert primeiro.name == baixado.sha256
    assert primeiro.read_bytes() == b"conteudo"
    assert hashlib.sha256(primeiro.read_bytes()).hexdigest() == baixado.sha256


def test_de_arquivo_tem_o_mesmo_hash_que_a_resposta_teria(tmp_path):
    """As cargas de dinheiro leem do cache: o hash do arquivo tem de bater com o dos bytes."""
    arquivo = tmp_path / "cota-2025.zip"
    arquivo.write_bytes(b"x" * (3 << 20))

    baixado = procedencia.de_arquivo("CAMARA", "https://www.camara.leg.br/cotas/Ano-2025.csv.zip", arquivo, tmp_path)

    assert baixado.sha256 == hashlib.sha256(b"x" * (3 << 20)).hexdigest()
    assert baixado.tamanho == 3 << 20
    assert baixado.conteudo is None and baixado.arquivo == arquivo


def test_de_arquivo_data_e_a_de_chegada_ao_disco(tmp_path):
    import os

    arquivo = tmp_path / "a.csv"
    arquivo.write_bytes(b"x")
    os.utime(arquivo, (1_700_000_000, 1_700_000_000))

    baixado = procedencia.de_arquivo("SENADO", "u", arquivo, tmp_path)

    assert baixado.baixado_em == datetime.fromtimestamp(1_700_000_000, timezone.utc)


def test_guardar_copia_e_nao_liga_ao_cache(tmp_path):
    """O download regrava o cache no mesmo lugar; a cópia guardada não pode mudar junto."""
    arquivo = tmp_path / "cache.zip"
    arquivo.write_bytes(b"versao 1")
    baixado = procedencia.de_arquivo("TSE", "u", arquivo, tmp_path)

    guardado = procedencia.guardar(baixado, tmp_path / "procedencia")
    arquivo.write_bytes(b"versao 2")

    assert guardado.read_bytes() == b"versao 1"


def test_guardar_acima_do_limite_fica_so_o_hash(tmp_path, monkeypatch):
    monkeypatch.setattr(procedencia, "LIMITE_PARA_GUARDAR", 10)
    arquivo = tmp_path / "estabelecimentos0.zip"
    arquivo.write_bytes(b"x" * 11)

    assert procedencia.guardar(procedencia.de_arquivo("RECEITA", "u", arquivo, tmp_path), tmp_path / "p") is None
    assert not (tmp_path / "p").exists()


def test_versao_do_codigo_e_estavel_e_curta():
    versao = procedencia.versao_do_codigo()

    assert versao == procedencia.versao_do_codigo()
    assert len(versao) == len("etl-") + 12 and versao.startswith("etl-")


def test_a_linha_que_traz_a_sua_carga_a_mantem():
    """O patrimônio grava duas eleições numa chamada, cada uma de um arquivo."""
    from poligraph_etl.persistencia import _com_carga

    linhas = _com_carga([{"ano": 2018, "carga_id": 1}, {"ano": 2022}], 7)

    assert [linha["carga_id"] for linha in linhas] == [1, 7]


# Banco


@pytest.fixture
def limpo(conexao):
    conexao.execute(
        "TRUNCATE votos, votacoes, cargas, pessoa_fonte_ids, pessoas "
        "RESTART IDENTITY CASCADE"
    )
    return conexao


def _votacao(id_votacao: str) -> dict:
    return {
        "id": id_votacao, "casa": "CAMARA", "legislatura": 57,
        "data": "2025-12-09", "orgao": "PLEN", "descricao": "Aprovado o Projeto",
        "proposicao_id": None, "categoria": "SUBSTANTIVA",
        "secreta": False, "plenario": True, "votos_sim": 1, "votos_nao": 0,
    }


def test_a_carga_entra_com_o_hash_e_a_linha_aponta_para_ela(limpo):
    from poligraph_etl import persistencia

    baixado = procedencia.de_resposta("CAMARA", RespostaFalsa(b"votacoes"))
    carga = persistencia.registrar_carga(limpo, baixado, "poligraph_etl ingerir --anos 2026")
    persistencia.gravar_votacoes(limpo, [_votacao("1-1")], carga)

    sha, url, versao = limpo.execute(
        "SELECT sha256, url, versao FROM cargas WHERE id = %s", (carga,)).fetchone()
    assert sha == baixado.sha256
    assert versao == procedencia.versao_do_codigo()
    assert url.endswith("votacoes-2026.csv")
    assert limpo.execute("SELECT carga_id FROM votacoes WHERE id = '1-1'").fetchone()[0] == carga


def test_regravar_troca_a_carga_e_sem_carga_mantem_a_anterior(limpo):
    """A procedência é da versão que está no banco; regravar sem carga não a apaga."""
    from poligraph_etl import persistencia

    primeira = persistencia.registrar_carga(limpo, procedencia.de_resposta("CAMARA", RespostaFalsa(b"v1")), "c")
    segunda = persistencia.registrar_carga(limpo, procedencia.de_resposta("CAMARA", RespostaFalsa(b"v2")), "c")

    persistencia.gravar_votacoes(limpo, [_votacao("1-1")], primeira)
    persistencia.gravar_votacoes(limpo, [_votacao("1-1")], segunda)
    assert limpo.execute("SELECT carga_id FROM votacoes").fetchone()[0] == segunda

    persistencia.gravar_votacoes(limpo, [_votacao("1-1")])
    assert limpo.execute("SELECT carga_id FROM votacoes").fetchone()[0] == segunda


def test_o_banco_recusa_hash_que_nao_e_hexadecimal_de_64(limpo):
    psycopg = pytest.importorskip("psycopg")
    with pytest.raises(psycopg.errors.CheckViolation):
        limpo.execute(
            "INSERT INTO cargas (fonte, url, sha256, bytes, comando) VALUES ('CAMARA', 'u', %s, 1, 'c')",
            ("A" * 64,),
        )


def test_de_arquivo_recusa_caminho_fora_da_pasta(tmp_path):
    """RISCO: o caminho vem da linha de comando; `..` não pode levar a carga para fora do cache."""
    cache = tmp_path / "cache"
    cache.mkdir()
    fora = tmp_path / "fora.zip"
    fora.write_bytes(b"x")

    with pytest.raises(ValueError):
        procedencia.de_arquivo("TSE", "u", cache / ".." / "fora.zip", cache)


def test_de_arquivo_recusa_pasta_no_lugar_de_arquivo(tmp_path):
    with pytest.raises(ValueError):
        procedencia.de_arquivo("TSE", "u", tmp_path, tmp_path)
