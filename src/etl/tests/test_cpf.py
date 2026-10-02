"""RISCO: O CPF — RNF-13.

O que estes testes protegem: **o CPF em claro só pode existir em memória.** O que vai
para o banco é o hash, e o hash precisa ser o MESMO dos dois lados de qualquer
conciliação — senão a chave forte deixa de casar e ninguém percebe.
"""

import pytest

from poligraph_etl.normalizacao import hash_de_cpf, normalizar_cpf


def test_formatos_diferentes_dao_o_mesmo_hash():
    """RISCO: É o que faz a conciliação com o TSE funcionar.

    ATENÇÃO: A Câmara devolve `36607606504`; o TSE formata com pontos em alguns arquivos. Sem
    normalizar ANTES de hashear, os dois nunca casariam — e o sintoma seria "o CPF não
    bate", não um erro.
    """
    formatos = ["012.345.678-90", "01234567890", " 012 345 678 90 "]
    hashes = {hash_de_cpf(f) for f in formatos}

    assert len(hashes) == 1


def test_zero_a_esquerda_sobrevive():
    """RISCO: O erro clássico: ler CPF como número perde o zero.

    ATENÇÃO: `01234567890` viraria `1234567890`, e o join com o TSE perderia a pessoa **em
    silêncio**. É por isso que o ETL lê tudo como texto.

    DECISÃO: e o hash acompanha
    """
    assert normalizar_cpf("01234567890") == "01234567890"
    assert normalizar_cpf(1234567890) == "01234567890"

    assert hash_de_cpf("01234567890") == hash_de_cpf(1234567890)


def test_hash_tem_64_caracteres():
    assert len(hash_de_cpf("01234567890")) == 64


def test_hash_nao_contem_o_cpf():
    """Não Óbvio, mas é a asserção que documenta a intenção."""
    assert "01234567890" not in hash_de_cpf("01234567890")


@pytest.mark.parametrize("entrada", [None, "", "   ", "abc"])
def test_sem_cpf_nao_vira_hash(entrada):
    """ATENÇÃO: `None`, nunca hash de string vazia — que seria um valor constante gravado
    em todo deputado sem CPF, e casaria todos entre si."""
    assert hash_de_cpf(entrada) is None


def test_cpf_longo_demais_e_recusado():
    """ATENÇÃO: Mais de 11 dígitos não é CPF — é CNPJ ou lixo."""
    assert normalizar_cpf("123456789012345") is None
    assert hash_de_cpf("123456789012345") is None


def test_a_cota_usa_o_mesmo_hash_das_pessoas():
    """RISCO: O ponto todo da centralização.

    ATENÇÃO: Enquanto `cota.py` tinha o próprio `sha256`, nada garantia que os dois lados
    usassem a mesma normalização — e a divergência só apareceria como "não casa".
    """
    from poligraph_etl.cota import _identificar_fornecedor

    documento, pessoa_fisica = _identificar_fornecedor("012.345.678-90")

    assert pessoa_fisica is True
    assert documento == hash_de_cpf("01234567890")


# ═══════════════════════════════════════════════════════════════════
# RISCO: CPF dentro de NOME — o nome empresarial de MEI
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.parametrize(
    ("bruto", "limpo"),
    [
        ("FULANO DE TAL 12345678900", "FULANO DE TAL"),
        ("FULANO DE TAL 123.456.789-00", "FULANO DE TAL"),
        ("12345678900 FULANO DE TAL", "FULANO DE TAL"),
        ("POSTO EXEMPLO LTDA", "POSTO EXEMPLO LTDA"),
        # DECISÃO: Os 14 dígitos de um CNPJ não são um CPF: ficam.
        ("EMPRESA 12345678000190", "EMPRESA 12345678000190"),
        ("12345678900", None),
        (None, None),
    ],
)
def test_sem_cpf_tira_o_cpf_do_nome_de_mei(bruto, limpo):
    from poligraph_etl.normalizacao import sem_cpf

    assert sem_cpf(bruto) == limpo
