"""Testes da normalização — o equivalente Python do API3.

ATENÇÃO: Cada caso aqui vem de uma MEDIÇÃO do discovery, não de suposição.
"""

import pytest

from poligraph_etl.nucleo.normalizacao import (
    classificar_categoria,
    inferir_polaridade,
    normalizar_cpf,
    normalizar_voto,
)

# ═══════════════════════════════════════════════════════════════════
# RN-03 — voto
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.parametrize(
    "bruto,esperado",
    [
        ("Sim", 1),
        ("sim", 1),
        ("  SIM  ", 1),
        ("Não", -1),
        ("Nao", -1),
        ("Abstenção", 0),
    ],
)
def test_voto_no_dominio_fechado(bruto, esperado):
    assert normalizar_voto(bruto) == esperado


@pytest.mark.parametrize("bruto", ["Obstrução", "Artigo 17", "Branco", "", None, "xyz"])
def test_voto_fora_do_calculo_vira_none(bruto):
    """ATENÇÃO: None = fora do cálculo. NÃO é discordância, e NÃO é abstenção."""
    assert normalizar_voto(bruto) is None


def test_obstrucao_nao_e_abstencao():
    """RISCO: Em 2023 obstrução foi 2,50% dos votos — medir só 2025 (0,2%) enganaria.

    É manobra de bancada: o parlamentar está presente e se recusa a votar.
    Contá-la como abstenção poria uma decisão de bancada dentro da matriz.
    """
    assert normalizar_voto("Obstrução") is None
    assert normalizar_voto("Abstenção") == 0
    assert normalizar_voto("Obstrução") != normalizar_voto("Abstenção")


# ═══════════════════════════════════════════════════════════════════
# RF-15 — categoria
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.parametrize(
    "descricao,esperado",
    [
        ("Aprovado o Requerimento de urgência", "PROCEDIMENTAL"),
        ("Rejeitado o adiamento da discussão", "PROCEDIMENTAL"),
        ("Aprovada a Preferência", "PROCEDIMENTAL"),
        ("Aprovada a Emenda de Plenário nº 7", "DESTAQUE"),
        ("Mantido o texto. Sim: 249; Não: 154.", "DESTAQUE"),
        ("Suprimido o texto", "DESTAQUE"),
        ("Aprovado o Projeto de Lei nº 2.162, de 2023", "SUBSTANTIVA"),
        ("Aprovada a Redação Final", "SUBSTANTIVA"),
        ("Aprovada a indicação do embaixador", "AUTORIDADE"),
        (None, "SUBSTANTIVA"),
        ("", "SUBSTANTIVA"),
    ],
)
def test_categoria(descricao, esperado):
    assert classificar_categoria(descricao) == esperado


def test_urgencia_de_projeto_e_procedimental_nao_substantiva():
    """ATENÇÃO: A ordem das regex importa: a descrição contém as duas palavras.

    Se SUBSTANTIVA casasse primeiro, requerimentos entrariam na matriz com peso
    1,0 — e a similaridade passaria a medir obstrução, não posição.
    """
    assert classificar_categoria(
        "Aprovado o Requerimento de urgência para o Projeto de Lei nº 1.234"
    ) == "PROCEDIMENTAL"


# ═══════════════════════════════════════════════════════════════════
# RISCO: Achado #12 — polaridade
# ═══════════════════════════════════════════════════════════════════


def test_mantido_o_texto_inverte_a_polaridade():
    """RISCO: "Mantido o texto" = o destaque supressivo foi rejeitado.

    Quem votou Sim quis MANTER o texto — votou CONTRA a supressão proposta.
    """
    assert inferir_polaridade("Mantido o texto. Sim: 249; Não: 154.") == -1


@pytest.mark.parametrize(
    "descricao",
    [
        "Aprovado o Projeto de Lei nº 2.162, de 2023",
        "Aprovada a Redação Final",
        "Rejeitado o Projeto",
        None,
    ],
)
def test_texto_principal_tem_polaridade_positiva(descricao):
    assert inferir_polaridade(descricao) == 1


# ═══════════════════════════════════════════════════════════════════
# CPF — zero à esquerda
# ═══════════════════════════════════════════════════════════════════


def test_cpf_preserva_zero_a_esquerda():
    """ATENÇÃO: O erro clássico: ler CPF como número perde o zero e o join falha em silêncio."""
    assert normalizar_cpf("01234567890") == "01234567890"
    assert normalizar_cpf(1234567890) == "01234567890"


@pytest.mark.parametrize(
    "bruto,esperado",
    [
        ("123.456.789-00", "12345678900"),
        ("  12345678900  ", "12345678900"),
        (None, None),
        ("", None),
        ("abc", None),
        pytest.param("123456789012", None, id="12 dígitos: não é CPF"),
    ],
)
def test_cpf(bruto, esperado):
    assert normalizar_cpf(bruto) == esperado


# ═══════════════════════════════════════════════════════════════════
# RISCO: O que o pandas realmente entrega — descoberto na ingestão real
# ═══════════════════════════════════════════════════════════════════


def test_voto_vazio_do_pandas_vira_nulo():
    """RISCO: Célula vazia no CSV vira `float('nan')`, não `None` nem `""`.

    ATENÇÃO: O `dtype=str` do `read_csv` não alcança o que o `na_values` já transformou em
    nulo. A ingestão de 2025 morreu aqui com
    `'float' object has no attribute 'strip'`.
    """
    assert normalizar_voto(float("nan")) is None


def test_voto_de_tipo_inesperado_nao_estoura():
    """ATENÇÃO: Fora do cálculo, nunca discordância — ausência não é "votou contra".
    """
    for entrada in (None, 0, 1.5, [], {}):
        assert normalizar_voto(entrada) is None


# ═══════════════════════════════════════════════════════════════════
# RISCO: "ressalvados os destaques" — achado de 2026-08-26
# ═══════════════════════════════════════════════════════════════════


def test_ressalvados_os_destaques_e_voto_no_texto_principal():
    """RISCO: A frase cita destaque para dizer que ele NÃO estava em jogo.

    ATENÇÃO: Classificar como DESTAQUE tinha duas consequências silenciosas: a votação entrava
    na matriz com peso 0,7 em vez de 1,0, e o filtro "só texto principal" da curadoria a
    descartava. Eram 69 votações de mérito da legislatura 57.
    """
    descricao = (
        "Aprovado o Substitutivo ao Projeto de Lei nº 2.162, de 2023, adotado pelo "
        "relator da Comissão Especial, ressalvados os destaques. Sim: 291; Não: 148."
    )

    assert classificar_categoria(descricao) == "SUBSTANTIVA"


def test_destaque_de_verdade_continua_sendo_destaque():
    """ATENÇÃO: A exceção não pode abrir buraco: votação de destaque real continua marcada."""
    assert classificar_categoria("Aprovado o Destaque nº 3 do PL 1234.") == "DESTAQUE"
    assert classificar_categoria("Mantido o texto, rejeitado o destaque.") == "DESTAQUE"
    assert classificar_categoria("Aprovada a Emenda nº 12.") == "DESTAQUE"


def test_a_polaridade_nao_muda_com_a_correcao():
    """DECISÃO: `inferir_polaridade` olha "mantido o texto", não a categoria — segue intacta."""
    assert inferir_polaridade("Aprovado o Substitutivo, ressalvados os destaques.") == 1
    assert inferir_polaridade("Mantido o texto.") == -1


def test_destacado_no_particípio_tambem_e_destaque():
    """RISCO: A forma que o SENADO usa, e que o padrão original deixava passar.

    ATENÇÃO: O padrão cobria só o substantivo (`destaque`/`destaques`). O Senado escreve
    *"Votação nominal do Art. 21 …, destacado"* — particípio. Resultado medido: 14
    votações do Senado e 2 da Câmara entravam como SUBSTANTIVA, com peso 1,0 em vez de
    0,7 na matriz, e elegíveis como pergunta do questionário.

    RISCO: As duas da Câmara são as piores do conjunto: *"Rejeitada a matéria destacada"* é
    destaque **e** tem polaridade invertida.
    """
    for descricao in [
        "Votação nominal do Art. 21 do texto consolidado ao PL nº 576/2021, destacado.",
        "Votação nominal do §4º do art. 4º do Substitutivo ao PLP nº 175/2024, destacado.",
        "Votação nominal da Expressão do §19 do art. 165, constante da PEC 66/2023, destacada.",
        "Votação nominal das expressões contidas no PL 1.825/2022, destacadas.",
        "Rejeitada a matéria destacada. Fica modificado o texto do Relator",
    ]:
        assert classificar_categoria(descricao) == "DESTAQUE", descricao


def test_a_excecao_do_ressalvados_sobrevive_a_correcao():
    """ATENÇÃO: A guarda de "ressalvados os destaques" continua valendo.

    Ampliar o padrão não pode reintroduzir o erro que a exceção corrigiu — eram 69
    votações de mérito classificadas como destaque.
    """
    assert classificar_categoria(
        "Aprovado o Substitutivo ao PL 2.162, ressalvados os destaques."
    ) == "SUBSTANTIVA"
