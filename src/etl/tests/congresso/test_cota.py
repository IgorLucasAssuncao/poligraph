"""Cota parlamentar: o contrato de entrada, a transformação e a reconciliação.

RISCO: O ponto mais sensível deste módulo não é o parsing — é o CPF. O campo `txtCNPJCPF`
mistura CNPJ de empresa com **CPF em claro** de fornecedor pessoa física, e a RNF-13
proíbe o segundo no banco.
"""

import pytest

from poligraph_etl.congresso import cota
from poligraph_etl.contratos import entrada
from poligraph_etl.contratos.banco import Despesa
from poligraph_etl.contratos.camara import LinhaDaCotaDaCamara
from poligraph_etl.contratos.senado import LinhaDaCotaDoSenado
from poligraph_etl.fontes import camara, senado

ID_PESSOA_POR_ID_NA_CAMARA = {"62881": 7, "204554": 8}


def registro(**campos) -> dict:
    """DECISÃO: Colunas copiadas do arquivo REAL de 2025, não inventadas."""
    base = {
        "ideCadastro": "62881",
        "numAno": "2025",
        "numMes": "2",
        "txtDescricao": "MANUTENÇÃO DE ESCRITÓRIO DE APOIO",
        "txtFornecedor": "ALARES",
        "txtCNPJCPF": "633.560.420/0018-0",
        "vlrLiquido": "104.58",
        "datEmissao": "2025-02-28T00:00:00",
        "urlDocumento": "https://www.camara.leg.br/cota-parlamentar/documento",
    }
    return {**base, **campos}


def da_camara(**campos) -> Despesa | cota.Descarte:
    """Um registro cru da Câmara, pelo contrato de entrada, até a transformação."""
    [linha] = entrada.ler(LinhaDaCotaDaCamara, [registro(**campos)])
    return cota.despesa_da_camara(linha, ID_PESSOA_POR_ID_NA_CAMARA)


# ═══════════════════════════════════════════════════════════════════
# RISCO: CPF — RNF-13
# ═══════════════════════════════════════════════════════════════════


def test_cpf_de_fornecedor_e_hasheado():
    """RISCO: RNF-13: CPF nunca em claro no banco.

    ATENÇÃO: Fornecedor pessoa física traz CPF no MESMO campo que a empresa traz CNPJ. Gravar
    sem distinguir colocaria milhares de CPFs em claro numa tabela pública.
    """
    despesa = da_camara(txtCNPJCPF="123.456.789-09")

    assert despesa.fornecedor_eh_pessoa_fisica is True
    assert despesa.cnpj_ou_hash != "12345678909"
    assert len(despesa.cnpj_ou_hash) == 64


def test_cnpj_fica_legivel():
    """DECISÃO: CNPJ é dado público de empresa e PRECISA ficar em claro.

    ATENÇÃO: Hashear os dois por segurança aparente destruiria a análise que interessa —
    cruzar o mesmo fornecedor entre parlamentares.
    """
    despesa = da_camara()

    assert despesa.fornecedor_eh_pessoa_fisica is False
    assert despesa.cnpj_ou_hash == "63356042000180"


def test_o_hash_e_estavel():
    """ATENÇÃO: Mesmo CPF, mesmo hash — senão não dá para cruzar nem contar distintos."""
    assert da_camara(txtCNPJCPF="111.444.777-35").cnpj_ou_hash == da_camara(txtCNPJCPF="11144477735").cnpj_ou_hash


# ═══════════════════════════════════════════════════════════════════
# O que entra e o que fica fora, com o motivo
# ═══════════════════════════════════════════════════════════════════


def test_sem_ideCadastro_fica_fora_como_liderança_ou_órgão():
    """ATENÇÃO: São lideranças e órgãos — 0,4% em 2025. Não são pessoas, não têm ficha."""
    assert da_camara(ideCadastro="") == cota.Descarte(cota.SEM_PARLAMENTAR, 104.58)


def test_deputado_fora_do_de_para_fica_fora_com_o_valor():
    assert da_camara(ideCadastro="999999") == cota.Descarte(cota.FORA_DO_DE_PARA, 104.58)


def test_valor_zero_fica_fora():
    assert da_camara(vlrLiquido="0") == cota.Descarte(cota.VALOR_ZERO, 0.0)


def test_estorno_e_mantido():
    """DECISÃO: Valor negativo é estorno, e somá-lo importa para o total do deputado."""
    assert da_camara(vlrLiquido="-250.00").valor_liquido == -250.0


def test_separador_decimal_e_ponto():
    """ATENÇÃO: Conferido no arquivo real: `104.58`, não `104,58`."""
    assert da_camara(vlrLiquido="1234.56").valor_liquido == 1234.56


def test_a_linha_completa_vira_a_despesa_do_banco():
    assert da_camara() == Despesa(
        pessoa_id=7, ano=2025, mes=2, categoria="MANUTENÇÃO DE ESCRITÓRIO DE APOIO", fornecedor="ALARES",
        cnpj_ou_hash="63356042000180", fornecedor_eh_pessoa_fisica=False, valor_liquido=104.58,
        data_emissao="2025-02-28", url_documento="https://www.camara.leg.br/cota-parlamentar/documento",
    )


def test_categoria_vazia_vira_rotulo():
    """ATENÇÃO: `NOT NULL` no banco — sem isto a linha inteira seria rejeitada."""
    assert da_camara(txtDescricao="  ").categoria == "SEM CATEGORIA"


def test_coluna_que_some_do_arquivo_derruba_a_leitura():
    """RISCO: Ler `None` em silêncio gravaria a despesa sem dono e o total sairia plausível e errado."""
    sem_fornecedor = registro()
    del sem_fornecedor["txtFornecedor"]

    with pytest.raises(entrada.LayoutMudou, match="txtFornecedor"):
        entrada.ler(LinhaDaCotaDaCamara, [sem_fornecedor])


# ═══════════════════════════════════════════════════════════════════
# Canário
# ═══════════════════════════════════════════════════════════════════


def test_arquivo_pequeno_demais_estoura():
    """DECISÃO: Medido: 209.176 linhas em 2025. Encolher muito significa layout mudado.

    ATENÇÃO: Sem o canário, um arquivo truncado entraria em silêncio e a ficha mostraria
    gasto a menos — sem nada acusar.
    """
    with pytest.raises(RuntimeError, match="layout"):
        camara.conferir_volume_de_cota([registro()], 2025)


def test_volume_normal_passa():
    camara.conferir_volume_de_cota([registro()] * 60_000, 2025)


# ═══════════════════════════════════════════════════════════════════
# RISCO: CEAPS — a cota do Senado, na mesma tabela
# ═══════════════════════════════════════════════════════════════════

ID_PESSOA_POR_NOME = {"ALAN RICK": 7}


def ceaps(**campos) -> dict:
    base = {
        "ANO": "2025",
        "MES": "1",
        "SENADOR": "ALAN RICK",
        "TIPO_DESPESA": "Aluguel de imóveis para escritório político",
        "CNPJ_CPF": "66.970.229/0132-26",
        "FORNECEDOR": "CLARO NXT TELECOMUNICAÇÕES S.A",
        "DATA": "18/01/2025",
        "VALOR_REEMBOLSADO": "399,44",
    }
    return {**base, **campos}


def do_senado(**campos) -> Despesa | cota.Descarte:
    [linha] = entrada.ler(LinhaDaCotaDoSenado, [ceaps(**campos)])
    return cota.despesa_do_senado(linha, ID_PESSOA_POR_NOME)


def test_ceaps_casa_pelo_nome_parlamentar():
    despesa = do_senado()

    assert despesa.pessoa_id == 7
    assert despesa.valor_liquido == 399.44


def test_ceaps_normaliza_acento_e_caixa_do_nome():
    """A CEAPS manda caixa alta; `pessoas.nome_exibicao` guarda com acento e caixa mista."""
    assert do_senado(SENADOR="Alan Rick").pessoa_id == 7


def test_ceaps_de_quem_nao_esta_no_de_para_fica_fora():
    """Atribuir por semelhança de nome seria inventar dono."""
    assert do_senado(SENADOR="FULANO") == cota.Descarte(cota.FORA_DO_DE_PARA, 399.44)


def test_ceaps_converte_a_data_para_iso():
    assert do_senado(DATA="03/12/2025").data_emissao == "2025-12-03"


def test_ceaps_data_vazia_nao_derruba_a_linha():
    assert do_senado(DATA="").data_emissao is None


def test_ceaps_valor_sem_centavos():
    """ATENÇÃO: O Senado manda `4000`, sem vírgula, na mesma coluna que manda `399,44`."""
    assert do_senado(VALOR_REEMBOLSADO="4000").valor_liquido == 4000


def test_ceaps_valor_zero_fica_fora():
    assert do_senado(VALOR_REEMBOLSADO="0") == cota.Descarte(cota.VALOR_ZERO, 0.0)


def test_ceaps_nao_tem_url_de_documento():
    """A CEAPS publica o número do documento, não o link da imagem."""
    assert do_senado().url_documento is None


CABECALHO_CEAPS = '"ANO";"MES";"SENADOR";"TIPO_DESPESA";"CNPJ_CPF";"FORNECEDOR";"DATA";"VALOR_REEMBOLSADO"'
LINHA_CEAPS = '"2025";"1";"ALAN RICK";"Aluguel";"66970229013226";"CLARO";"18/01/2025";"399,44"'


def test_ler_ceaps_pula_a_linha_de_metadado(tmp_path):
    """RISCO: A armadilha do arquivo: a PRIMEIRA linha não é o cabeçalho.

    Ela é `"ULTIMA ATUALIZACAO";"07/09/2026 02:02"`. Um `DictReader` direto tomaria isso
    como cabeçalho, nenhuma coluna casaria, e o contrato de entrada derrubaria a leitura.
    """
    caminho = tmp_path / "ceaps.csv"
    caminho.write_text(
        '"ULTIMA ATUALIZACAO";"07/09/2026 02:02"' + chr(10) + CABECALHO_CEAPS + chr(10) + LINHA_CEAPS + chr(10),
        encoding="latin-1",
    )

    linhas = senado.ler_ceaps(caminho)

    assert len(linhas) == 1
    assert linhas[0].nome_do_senador == "ALAN RICK"


def test_ler_ceaps_sem_a_linha_de_metadado_ainda_funciona(tmp_path):
    """Se o Senado tirar a linha de metadado, o leitor não pode perder o cabeçalho."""
    caminho = tmp_path / "ceaps.csv"
    caminho.write_text(CABECALHO_CEAPS + chr(10) + LINHA_CEAPS + chr(10), encoding="latin-1")

    assert senado.ler_ceaps(caminho)[0].valor_reembolsado == "399,44"
