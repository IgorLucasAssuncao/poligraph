"""Emendas parlamentares — o arquivo único do Portal.

RISCO: Os pontos sensíveis: a extração do **código do autor** — que é a chave —, a
conversão de valor em **formato brasileiro**, a **pessoa** que não pode ser identificada
entre os favorecidos, e o **convênio** que não pode ser somado uma vez por emenda.
"""

import pandas as pd
import pytest

from poligraph_etl import emendas


def emenda(**campos) -> dict:
    """DECISÃO: Campos copiados de uma linha REAL de `EmendasParlamentares.csv`."""
    base = {
        "Código da Emenda": "202541840004",
        "Ano da Emenda": "2025",
        "Tipo de Emenda": "Emenda Individual - Transferências com Finalidade Definida",
        "Código do Autor da Emenda": "4184",
        "Nome do Autor da Emenda": "LUIS CARLOS HEINZE",
        "Número da emenda": "0004",
        "Localidade de aplicação do recurso": "Nacional",
        "Código Município IBGE": "Sem informação",
        "Município": "Sem informação",
        "Código UF IBGE": "Sem informação",
        "UF": "Sem informação",
        "Região": "Sem informação",
        "Código Função": "05",
        "Nome Função": "Defesa nacional",
        "Código Subfunção": "152",
        "Nome Subfunção": "Defesa naval",
        "Código Programa": "6112",
        "Nome Programa": "DEFESA NACIONAL",
        "Código Ação": "20XV",
        "Nome Ação": "OPERACAO E MANUTENCAO DE MEIOS NAVAIS",
        "Código Plano Orçamentário": "0000",
        "Nome Plano Orçamentário": "DESPESAS DIVERSAS",
        "Valor Empenhado": "-26002,00",
        "Valor Liquidado": "12599,10",
        "Valor Pago": "12599,10",
        "Valor Restos A Pagar Inscritos": "0,00",
        "Valor Restos A Pagar Cancelados": "0,00",
        "Valor Restos A Pagar Pagos": "211398,90",
    }

    return {**base, **campos}


def tabela(*linhas: dict) -> pd.DataFrame:
    return pd.DataFrame(list(linhas), dtype=str)


# ═══════════════════════════════════════════════════════════════════
# RISCO: O código do autor — a chave
# ═══════════════════════════════════════════════════════════════════


def test_extrai_o_codigo_do_autor():
    """202541840004 = 2025 + 4184 + 0004."""
    assert emendas.codigo_do_autor("202541840004", "0004") == "4184"


def test_numero_de_tamanho_diferente_nao_quebra():
    """RISCO: O corte usa o número do registro, não posição fixa.

    ATENÇÃO: Recortar por índice erraria em SILÊNCIO quando o número tivesse outro tamanho —
    e o código extraído seria de outro autor.
    """
    assert emendas.codigo_do_autor("2025418412", "12") == "4184"


def test_codigo_incoerente_devolve_nada():
    """ATENÇÃO: Se o código não termina com o número, algo mudou na fonte."""
    assert emendas.codigo_do_autor("202541840004", "9999") is None
    assert emendas.codigo_do_autor("", "0004") is None


def test_coluna_do_autor_que_diverge_do_codigo_e_descartada():
    """RISCO: O arquivo traz o autor em coluna própria; o recorte vira conferência.

    ATENÇÃO: Se os dois divergem, gravar a coluna ligaria a emenda a outro parlamentar.
    """
    linhas, _ = emendas.para_linhas(
        tabela(emenda(), emenda(**{"Código da Emenda": "202541840005",
                                   "Número da emenda": "0005",
                                   "Código do Autor da Emenda": "9999"})),
        [2025],
    )

    assert [l["codigo_emenda"] for l in linhas] == ["202541840004"]


def test_emenda_sem_autor_e_contada_a_parte_e_nao_como_mudanca_da_fonte(caplog):
    """Achado #38: `S/I` e `-99` não são erro de leitura; o log não pode chamá-los de mudança da fonte."""
    caplog.set_level("INFO", logger="poligraph")
    linhas, _ = emendas.para_linhas(
        tabela(emenda(), emenda(**{"Código da Emenda": "202599990001", "Número da emenda": "0001",
                                   "Código do Autor da Emenda": "S/I"})),
        [2025],
    )

    assert [l["codigo_emenda"] for l in linhas] == ["202541840004"]
    assert "sem autor identificado" in caplog.text
    assert "a fonte mudou" not in caplog.text


def _bancada_com_autor():
    return emenda(**{"Código da Emenda": "201971060001", "Ano da Emenda": "2019", "Número da emenda": "0001",
                     "Tipo de Emenda": "Emenda de Bancada", "Código do Autor da Emenda": "7106",
                     "Nome do Autor da Emenda": "BANCADA DA BAHIA", "UF": "BAHIA",
                     "Localidade de aplicação do recurso": "BAHIA (UF)"})


def _bancada_sem_autor(**campos):
    base = {"Código da Emenda": "Sem informação", "Ano da Emenda": "2017", "Número da emenda": "S/I",
            "Tipo de Emenda": "Emenda de Bancada", "Código do Autor da Emenda": "S/I",
            "Nome do Autor da Emenda": "Sem informação", "UF": "BAHIA",
            "Localidade de aplicação do recurso": "SALVADOR - BA"}
    return emenda(**{**base, **campos})


def test_bancada_sem_autor_entra_com_a_bancada_da_uf_e_marcada():
    """Pendência 81: a UF da linha dá a bancada, com o código que a própria bancada usa nos outros anos."""
    linhas, autores = emendas.para_linhas(
        tabela(_bancada_com_autor(), _bancada_sem_autor()), [2017],
    )

    inferida = linhas[0]
    assert (inferida["codigo_autor"], inferida["nome_autor"]) == ("7106", "BANCADA DA BAHIA")
    assert inferida["autoria_inferida"] is True
    assert inferida["codigo_emenda"] == "20177106I0001"
    assert autores == {"7106": "BANCADA DA BAHIA"}


def test_so_bancada_e_so_com_uf_conhecida():
    """Relator, comissão e bancada sem UF continuam fora: para eles a UF não diz o autor."""
    linhas, _ = emendas.para_linhas(
        tabela(_bancada_com_autor(),
               _bancada_sem_autor(**{"Tipo de Emenda": "Emenda de Relator"}),
               _bancada_sem_autor(**{"UF": "Sem informação"})),
        [2017],
    )

    assert linhas == []


def test_codigo_inferido_e_estavel_pela_ordem_dos_campos_e_nao_do_arquivo():
    a = _bancada_sem_autor(**{"Código Ação": "AAAA"})
    b = _bancada_sem_autor(**{"Código Ação": "BBBB"})

    uma, _ = emendas.para_linhas(tabela(_bancada_com_autor(), a, b), [2017])
    outra, _ = emendas.para_linhas(tabela(_bancada_com_autor(), b, a), [2017])

    assert {(l["codigo_acao"], l["codigo_emenda"]) for l in uma} == {(l["codigo_acao"], l["codigo_emenda"]) for l in outra}


def test_reconciliacao_fecha_e_diz_o_motivo_de_cada_real_fora():
    """Regra do autor: o orçamento fecha, e o que não fecha tem justificativa (Pendência 81)."""
    relator = _bancada_sem_autor(**{"Tipo de Emenda": "Emenda de Relator", "Valor Empenhado": "500,00"})
    bancada = _bancada_sem_autor(**{"Valor Empenhado": "300,00"})
    contas = emendas.reconciliar_emendas(tabela(_bancada_com_autor(), relator, bancada), [2017])

    empenhado = next(c for c in contas if c["medida"] == "EMPENHADO")
    assert empenhado["total_na_fonte"] == 800.0
    assert empenhado["total_na_base"] == 300.0
    assert empenhado["total_inferido"] == 300.0
    assert empenhado["motivos"] == {"RELATOR_SEM_AUTOR": 500.0}
    assert empenhado["total_na_fonte"] == empenhado["total_na_base"] + sum(empenhado["motivos"].values())


def test_motivos_sao_os_do_check_do_banco():
    """Um motivo escrito diferente do `CHECK` seria recusado na gravação, e a carga inteira cairia."""
    assert set(emendas.MOTIVOS_DE_FORA) <= {
        "RELATOR_SEM_AUTOR", "COMISSAO_SEM_AUTOR", "BANCADA_SEM_AUTOR_E_SEM_UF", "INDIVIDUAL_SEM_AUTOR",
        "OUTRA_SEM_AUTOR", "INCOERENTE"}


def test_pagamento_sem_codigo_e_de_ano_nao_carregado_ficam_fora_com_motivo():
    pagamentos = tabela(
        {"Código da Emenda": "202541840004", "Ano/Mês": "2025/03", "Valor Recebido": "100,00"},
        {"Código da Emenda": "Sem informação", "Ano/Mês": "2025/04", "Valor Recebido": "40,00"},
        {"Código da Emenda": "201241840001", "Ano/Mês": "2025/05", "Valor Recebido": "7,00"},
    )

    conta = emendas.reconciliar_pagamentos(pagamentos, {"202541840004"}, [2025])[0]

    assert (conta["ano"], conta["total_na_fonte"], conta["total_na_base"]) == (2025, 147.0, 100.0)
    assert conta["motivos"] == {"PAGAMENTO_SEM_CODIGO_DE_EMENDA": 40.0, "EMENDA_DE_ANO_NAO_CARREGADO": 7.0}


def test_pago_contra_recebido_fecha_com_as_duas_direcoes_da_diferenca():
    """Regra 5: o pago do arquivo de emendas contra o recebido do arquivo de pagamentos, emenda a emenda.

    Uma emenda paga sem recebedor publicado (positivo), uma recebida acima do pago (negativo) e uma que bate.
    """
    contas = emendas.reconciliar_pago_e_recebido([
        (2025, 500_000.0, 0.0),
        (2025, 0.0, 330_000.0),
        (2025, 1_500_000.0, 1_500_000.0),
        (2024, 10.0, 10.0),
    ])

    conta = next(c for c in contas if c["ano"] == 2025)
    assert (conta["conjunto"], conta["medida"]) == ("PAGO_X_RECEBIDO", "PAGO")
    assert (conta["total_na_fonte"], conta["total_na_base"]) == (2_000_000.0, 1_830_000.0)
    assert conta["motivos"] == {"PAGO_SEM_RECEBEDOR": 500_000.0, "RECEBIDO_ACIMA_DO_PAGO": -330_000.0}
    assert conta["total_na_fonte"] == conta["total_na_base"] + sum(conta["motivos"].values())
    assert next(c for c in contas if c["ano"] == 2024)["motivos"] == {}


INSERIR_EMENDA = """
    INSERT INTO emendas (codigo_autor, nome_autor, codigo_emenda, ano, codigo_acao, valor_empenhado, valor_liquidado, valor_pago, valor_resto_pago)
    VALUES ('4184', 'AUTOR', '202541840004', 2025, %s, 500, 500, %s, 100)
"""


@pytest.mark.integracao
def test_pago_e_recebido_soma_a_emenda_antes_de_juntar(conexao):
    """RISCO: emenda com duas linhas no arquivo (duas ações) contaria o recebido duas vezes se a junção viesse antes da soma."""
    from poligraph_etl import persistencia

    conexao.execute("TRUNCATE emendas, emendas_favorecidos" " CASCADE")
    for acao, pago in (("20XV", 300.0), ("2E89", 200.0)):
        conexao.execute(INSERIR_EMENDA, (acao, pago))
    conexao.execute(
        "INSERT INTO emendas_favorecidos (codigo_emenda, competencia, tipo, valor, intermediario)"
        " VALUES ('202541840004', '2025-06-01', 'PESSOA', 650, false)"
    )

    linhas = persistencia.pago_e_recebido_por_emenda(conexao, [2025])

    assert linhas == [(2025, 700.0, 650.0)]
    assert emendas.reconciliar_pago_e_recebido(linhas)[0]["motivos"] == {"PAGO_SEM_RECEBEDOR": 50.0}


# ═══════════════════════════════════════════════════════════════════
# RISCO: Valor em formato brasileiro
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.parametrize(
    ("bruto", "esperado"),
    [
        ("12.599,10", 12599.10),        # ponto é MILHAR
        ("- 26.002,00", -26002.00),     # negativo separado do número
        ("211398,90", 211398.90),       # o arquivo não tem separador de milhar
        ("0,00", 0.0),
        ("1.234.567,89", 1234567.89),
        ("", 0.0),
        ("#NULO", 0.0),
        (None, 0.0),
    ],
)
def test_valor_brasileiro(bruto, esperado):
    assert emendas.valor_brasileiro(bruto) == pytest.approx(esperado)


def test_float_direto_quebraria():
    """RISCO: A razão de a função existir.

    ATENÇÃO: `float("12.599,10")` estoura, e `float("12.599")` daria **12,599** — três ordens
    de grandeza abaixo, sem erro nenhum.
    """
    with pytest.raises(ValueError):
        float("12.599,10")

    assert emendas.valor_brasileiro("12.599,10") == 12599.10


def test_empenho_negativo_e_mantido():
    """DECISÃO: Empenho negativo é CANCELAMENTO — caso normal, não erro."""
    linhas, _ = emendas.para_linhas(tabela(emenda()), [2025])

    assert linhas[0]["valor_empenhado"] == -26002.00
    assert linhas[0]["valor_resto_pago"] == 211398.90


# ═══════════════════════════════════════════════════════════════════
# O grão do arquivo
# ═══════════════════════════════════════════════════════════════════


def test_uma_emenda_em_duas_localidades_da_duas_linhas():
    """RISCO: O `DO NOTHING` de antes guardava só a primeira.

    MEDIDO: Medido em 2026-09-25: 55 emendas de 2023–26 ocupam mais de uma linha, R$ 0,18 bi
    empenhados na segunda. As duas precisam chegar ao banco.
    """
    linhas, _ = emendas.para_linhas(
        tabela(
            emenda(**{"Localidade de aplicação do recurso": "LINDOESTE - PR",
                      "Código Município IBGE": "4113734", "Valor Empenhado": "798257,00"}),
            emenda(**{"Localidade de aplicação do recurso": "PARANÁ (UF)",
                      "Valor Empenhado": "400000,00"}),
        ),
        [2025],
    )

    assert [l["valor_empenhado"] for l in linhas] == [798257.0, 400000.0]
    assert [l["codigo_municipio_ibge"] for l in linhas] == ["4113734", None]


def test_so_entram_os_anos_pedidos():
    """ATENÇÃO: O arquivo tem todos os anos desde 2014; a carga pede os da legislatura."""
    linhas, _ = emendas.para_linhas(
        tabela(emenda(), emenda(**{"Ano da Emenda": "2019"})), [2025]
    )

    assert len(linhas) == 1


# ═══════════════════════════════════════════════════════════════════
# Nada é descartado por falta de dono
# ═══════════════════════════════════════════════════════════════════


def test_emenda_de_bancada_entra_igual():
    """DECISÃO: A decisão do autor: ingerir tudo, resolver o vínculo depois.

    ATENÇÃO: Perder o registro por não saber ligar seria pior — a reconciliação futura não
    teria o que reconciliar.
    """
    linhas, autores = emendas.para_linhas(
        tabela(emenda(**{"Nome do Autor da Emenda": "BANCADA DO RIO DE JANEIRO",
                         "Código da Emenda": "202599990001",
                         "Código do Autor da Emenda": "9999",
                         "Número da emenda": "0001"})),
        [2025],
    )

    assert len(linhas) == 1
    assert autores["9999"] == "BANCADA DO RIO DE JANEIRO"


def test_o_mapa_de_autores_junta_por_codigo():
    """ATENÇÃO: Duas emendas do mesmo autor dão UMA entrada no mapa."""
    _, autores = emendas.para_linhas(
        tabela(emenda(), emenda(**{"Código da Emenda": "202541840007",
                                   "Número da emenda": "0007"})),
        [2025],
    )

    assert autores == {"4184": "LUIS CARLOS HEINZE"}


# ═══════════════════════════════════════════════════════════════════
# RISCO: Favorecidos — quem recebeu
# ═══════════════════════════════════════════════════════════════════


def favorecido(**campos) -> dict:
    """DECISÃO: Campos de uma linha REAL de `EmendasParlamentares_PorFavorecido.csv`."""
    base = {
        "Código da Emenda": "202541840004",
        "Código do Autor da Emenda": "4184",
        "Nome do Autor da Emenda": "LUIS CARLOS HEINZE",
        "Número da emenda": "0004",
        "Tipo de Emenda": "Emenda Individual - Transferências com Finalidade Definida",
        "Ano/Mês": "202609",
        "Código do Favorecido": "37016159000104",
        "Favorecido": "2A ENGENHARIA LTDA",
        "Natureza Jurídica": "Sociedade Empresária Limitada",
        "Tipo Favorecido": "Pessoa Jurídica",
        "UF Favorecido": "SE",
        "Município Favorecido": "POÇO REDONDO",
        "Valor Recebido": "80017,25",
    }

    return {**base, **campos}


def test_pessoa_juridica_guarda_cnpj_e_nome():
    [linha] = emendas.favorecidos_para_linhas(tabela(favorecido()), {"202541840004"})

    assert linha["tipo"] == emendas.PESSOA_JURIDICA
    assert linha["documento"] == "37016159000104"
    assert linha["nome"] == "2A ENGENHARIA LTDA"
    assert linha["competencia"] == "2026-09-01"


@pytest.mark.parametrize(
    ("tipo", "documento", "natureza"),
    [
        ("Pessoa Fisica", "***.444.712-**", "Sem informação"),
        ("Inscrição Genérica", "EXPF00001", "Sem informação"),
        ("Inscrição Genéric", "EXPTCAMIL", "Sem informação"),
        ("Pessoa Jurídica", "25995281000190", "Empresário (Individual)"),
        ("Pessoa Jurídica", "12345678000190", "Produtor Rural (Pessoa Física)"),
    ],
)
def test_pessoa_nao_e_identificada(tipo, documento, natureza):
    """RISCO: LGPD: nome de pessoa não sai daqui, nem o documento, nem em hash.

    ATENÇÃO: As três últimas são as que escapariam de um filtro só por "Pessoa Fisica": a
    inscrição genérica traz o nome da pessoa, e o empresário individual o traz dentro da
    razão social — `"25.995.281 TATIANE GONCALVES NETO"`, do arquivo real.
    """
    [linha] = emendas.favorecidos_para_linhas(
        tabela(favorecido(**{"Tipo Favorecido": tipo, "Código do Favorecido": documento,
                             "Natureza Jurídica": natureza,
                             "Favorecido": "TATIANE GONCALVES NETO"})),
        {"202541840004"},
    )

    assert linha["tipo"] == emendas.PESSOA
    assert linha["documento"] is None
    assert linha["nome"] is None


def test_tipo_desconhecido_guarda_o_dinheiro_sem_identificacao():
    """DECISÃO: Categoria nova no Portal não derruba a carga — e não grava nome que pode ser de pessoa."""
    [linha] = emendas.favorecidos_para_linhas(
        tabela(favorecido(**{"Tipo Favorecido": "Categoria Nova"})), {"202541840004"}
    )

    assert linha["tipo"] == emendas.SEM_INFORMACAO_TIPO
    assert linha["nome"] is None
    assert linha["valor"] == pytest.approx(80017.25)


def test_banco_do_brasil_e_intermediario():
    """RISCO: R$ 32,57 bi de 2023–26 foram ao Banco do Brasil, em Brasília — que repassa.

    ATENÇÃO: Contá-lo como destino faria o DF parecer o maior destino de emenda do país.
    """
    linhas = emendas.favorecidos_para_linhas(
        tabela(
            favorecido(**{"Código do Favorecido": "00000000000191",
                          "Favorecido": "BANCO DO BRASIL SA", "UF Favorecido": "DF"}),
            favorecido(),
        ),
        {"202541840004"},
    )

    assert [l["intermediario"] for l in linhas] == [True, False]


def test_pagamentos_de_pessoas_no_mesmo_mes_se_somam():
    """ATENÇÃO: Sem documento, duas pessoas do mesmo lugar e mês são a mesma chave.

    Somar é obrigatório: o índice único recusaria a segunda linha.
    """
    pessoa = {"Tipo Favorecido": "Pessoa Fisica", "Natureza Jurídica": "Sem informação"}
    linhas = emendas.favorecidos_para_linhas(
        tabela(
            favorecido(**pessoa, **{"Código do Favorecido": "***.111.111-**",
                                    "Valor Recebido": "100,00"}),
            favorecido(**pessoa, **{"Código do Favorecido": "***.222.222-**",
                                    "Valor Recebido": "50,00"}),
        ),
        {"202541840004"},
    )

    assert len(linhas) == 1
    assert linhas[0]["valor"] == pytest.approx(150.0)


def test_estorno_que_anula_o_pagamento_sai():
    """ATENÇÃO: Soma zero é linha que o `ck_favorecido_valor` recusaria."""
    linhas = emendas.favorecidos_para_linhas(
        tabela(favorecido(), favorecido(**{"Valor Recebido": "-80017,25"})),
        {"202541840004"},
    )

    assert linhas == []


def test_favorecido_de_emenda_fora_da_carga_fica_de_fora():
    """DECISÃO: É o que garante a ligação sem chave estrangeira: só entra código que a carga trouxe."""
    assert emendas.favorecidos_para_linhas(tabela(favorecido()), {"202300000001"}) == []


def test_tipos_sao_os_do_check():
    """RISCO: Os quatro valores precisam ser exatamente os de `ck_favorecido_tipo`.

    O contrato com o EF é conferido em `test_contrato_schema.py`; este fixa o Python.
    """
    assert set(emendas.TIPOS_DE_FAVORECIDO) == {
        "PESSOA_JURIDICA", "UNIDADE_GESTORA", "PESSOA", "SEM_INFORMACAO",
    }


# ═══════════════════════════════════════════════════════════════════
# RISCO: Convênios — o valor é do convênio, não da emenda
# ═══════════════════════════════════════════════════════════════════


def convenio(**campos) -> dict:
    base = {
        "Código da Emenda": "202541820013",
        "Código Função": "10",
        "Nome Função": "Saúde",
        "Código Subfunção": "302",
        "Nome Subfunção": "Assistência hospitalar e ambulatorial",
        "Localidade do gasto": "BAHIA (UF)",
        "Tipo de Emenda": "Emenda Individual - Transferências com Finalidade Definida",
        "Data Publicação Convênio": "16/01/2025",
        "Convenente": "MUNICIPIO DE CHAPADINHA",
        "Objeto Convênio": "AQUISICAO DE EQUIPAMENTO",
        "Número Convênio": "1AAQKR",
        "Valor Convênio": "80000000,00",
    }

    return {**base, **campos}


def test_convenio_de_varias_emendas_entra_uma_vez():
    """RISCO: O convênio 1AAQKR, de R$ 80 mi, aparece em 23 emendas no arquivo real.

    MEDIDO: Somado por emenda, o total de convênios de 2023–26 daria R$ 24,18 bi; contado uma
    vez, R$ 18,79 bi. São R$ 5,4 bi que não existem.
    """
    convenios, ligacoes = emendas.convenios_para_linhas(
        tabela(
            convenio(),
            convenio(**{"Código da Emenda": "202541820009"}),
            convenio(**{"Código da Emenda": "202340570003"}),
        ),
        {"202541820013", "202541820009", "202340570003"},
    )

    assert len(convenios) == 1
    assert convenios[0]["valor"] == 80_000_000.0
    assert convenios[0]["data_publicacao"] == "2025-01-16"
    assert len(ligacoes) == 3


def test_a_mesma_ligacao_repetida_conta_uma_vez():
    """MEDIDO: Medido: uma emenda aparece duas vezes com o mesmo convênio, em localidades diferentes."""
    _, ligacoes = emendas.convenios_para_linhas(
        tabela(convenio(), convenio(**{"Localidade do gasto": "Nacional"})),
        {"202541820013"},
    )

    assert ligacoes == [{"codigo_emenda": "202541820013", "numero_convenio": "1AAQKR"}]


# ═══════════════════════════════════════════════════════════════════
# A forma canônica do nome — usada só na reconciliação inicial
# ═══════════════════════════════════════════════════════════════════

from poligraph_etl.normalizacao import sem_acento_maiusculo  # noqa: E402


@pytest.mark.parametrize(
    ("camara", "portal"),
    [
        ("Sóstenes Cavalcante", "SOSTENES CAVALCANTE"),
        ("José  Guimarães", "JOSE GUIMARAES"),
        (" Célia Xakriabá ", "CELIA XAKRIABA"),
    ],
)
def test_grafias_diferentes_convergem(camara: str, portal: str):
    """ATENÇÃO: A Câmara guarda com acento e caixa mista; o Portal manda CAIXA ALTA sem acento.

    DECISÃO: Isto roda UMA vez, para descobrir de quem é o código. Depois o vínculo vive no
    código e a grafia deixa de importar.
    """
    assert sem_acento_maiusculo(camara) == sem_acento_maiusculo(portal)


def test_nomes_diferentes_nao_convergem():
    assert sem_acento_maiusculo("Ana Silva") != sem_acento_maiusculo("Ana Silveira")


@pytest.mark.integracao
def test_cnpj_sem_sede_ou_com_sede_sem_carga_volta_para_a_fila(conexao):
    """MEDIDO (2026-10-10): 31.574 sedes do cadastro de 2026-09 sem carga; sem ela não se sabe o arquivo."""
    from poligraph_etl import persistencia

    conexao.execute("TRUNCATE emendas_favorecidos, cnpjs_municipio, municipios, cargas" " CASCADE")
    conexao.execute("INSERT INTO municipios (codigo_ibge, codigo_tom, nome, uf) VALUES ('4314902', '8801', 'Porto Alegre', 'RS')")
    for cnpj, valor in (("11111111000111", 300), ("22222222000122", 200), ("33333333000133", 100)):
        conexao.execute(
            "INSERT INTO emendas_favorecidos (codigo_emenda, competencia, tipo, documento, nome, valor, intermediario)"
            " VALUES ('202541840004', '2025-06-01', 'PESSOA_JURIDICA', %s, 'EMPRESA', %s, false)",
            (cnpj, valor),
        )
    carga = conexao.execute(
        "INSERT INTO cargas (fonte, url, sha256, bytes, comando) VALUES ('RECEITA', 'u', repeat('a', 64), 1, 'c') RETURNING id"
    ).fetchone()[0]
    conexao.execute("INSERT INTO cnpjs_municipio (cnpj, codigo_ibge, cadastro_de, carga_id) VALUES ('11111111000111', '4314902', '2026-09-01', NULL)")
    conexao.execute("INSERT INTO cnpjs_municipio (cnpj, codigo_ibge, cadastro_de, carga_id) VALUES ('22222222000122', '4314902', '2026-10-01', %s)", (carga,))

    assert persistencia.cnpjs_sem_sede(conexao) == ["11111111000111", "33333333000133"]
