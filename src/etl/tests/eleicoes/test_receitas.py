"""Financiamento de campanha — o fundão (FEFC) e o resto.

RISCO: Três pontos sensíveis, e nenhum deles falha com exceção:

1. O join é por **hash de CPF**. Se as duas pontas hashearem diferente, nada casa — e
   o sintoma é uma ficha vazia, não um erro
2. **`FUNDO ESPECIAL` não ≠ `FUNDO PARTIDARIO`.** Somar os dois muda o número que o TCC
   vai citar
3. O CSV é **Latin-1** e usa `#NULO` como texto — lido como UTF-8 ou como vazio, ambos
   corrompem em silêncio
"""

import io
import zipfile
from pathlib import Path

import pytest

from poligraph_etl.eleicoes import receitas
from poligraph_etl.nucleo.normalizacao import hash_de_cpf

CPF_ELEITO = "01234567890"
CPF_PERDEDOR = "98765432100"

# ATENÇÃO: Cabeçalho e valores copiados do layout REAL do TSE, não inventados.
COLUNAS = [
    "DS_CARGO", "NR_CPF_CANDIDATO", "NM_CANDIDATO", "DS_FONTE_RECEITA",
    "DS_ORIGEM_RECEITA", "NM_DOADOR", "NR_CPF_CNPJ_DOADOR", "VR_RECEITA",
]


def linha(**campos) -> dict:
    base = {
        "DS_CARGO": "DEPUTADO FEDERAL",
        "NR_CPF_CANDIDATO": CPF_ELEITO,
        "NM_CANDIDATO": "FULANO DE TAL",
        "DS_FONTE_RECEITA": "FUNDO ESPECIAL",
        "DS_ORIGEM_RECEITA": "Recursos de partido político",
        "NM_DOADOR": "PARTIDO EXEMPLO",
        "NR_CPF_CNPJ_DOADOR": "12345678000199",
        "VR_RECEITA": "3170000,00",
    }

    return {**base, **campos}


@pytest.fixture
def conhecidos() -> dict[str, int]:
    """O de-para como ele sai do banco: **hash** → id. Nunca CPF em claro."""
    return {hash_de_cpf(CPF_ELEITO): 42}


# ═══════════════════════════════════════════════════════════════════
# RISCO: O join por hash de CPF
# ═══════════════════════════════════════════════════════════════════


def test_casa_o_candidato_pelo_hash_do_cpf(conhecidos):
    """DECISÃO: O CPF em claro entra pelo CSV e não sai do laço — o que casa é o hash."""
    linhas = receitas.para_linhas([linha()], conhecidos, 2022)

    assert len(linhas) == 1
    assert linhas[0]["pessoa_id"] == 42


def test_cpf_formatado_casa_igual(conhecidos):
    """RISCO: O TSE formata com pontos em alguns arquivos.

    ATENÇÃO: Sem normalizar antes de hashear, `012.345.678-90` nunca casaria com o hash
    gravado pela Câmara — e o sintoma seria "este deputado não recebeu nada".
    """
    linhas = receitas.para_linhas(
        [linha(NR_CPF_CANDIDATO="012.345.678-90")], conhecidos, 2022
    )

    assert len(linhas) == 1


def test_zero_a_esquerda_nao_se_perde(conhecidos):
    """ATENÇÃO: CPF lido como número perderia o zero e o join morreria calado."""
    linhas = receitas.para_linhas(
        [linha(NR_CPF_CANDIDATO=" 1234567890 ")], conhecidos, 2022
    )

    assert len(linhas) == 1


def test_quem_nao_esta_no_de_para_fica_de_fora(conhecidos):
    """DECISÃO: Candidato que não se elegeu não tem dono em `pessoas`."""
    assert receitas.para_linhas([linha(NR_CPF_CANDIDATO=CPF_PERDEDOR)], conhecidos, 2022) == []


def test_outro_cargo_fica_de_fora(conhecidos):
    """ATENÇÃO: Vereador e senador não estão em `pessoas` — e um homônimo de CPF não
    existe, mas o filtro de cargo evita depender disso."""
    assert receitas.para_linhas([linha(DS_CARGO="VEREADOR")], conhecidos, 2022) == []


def test_de_para_vazio_descarta_tudo(conhecidos):
    """RISCO: A falha silenciosa que o comando precisa impedir ANTES de ler 396 MB.

    ATENÇÃO: Com `cpf` não executado, o de-para sai vazio e o resultado correto da função é
    **nada** — por isso quem barra é `_fundo`, com erro claro, não este módulo.
    """
    assert receitas.para_linhas([linha()], {}, 2022) == []


# ═══════════════════════════════════════════════════════════════════
# RISCO: Fundo Especial não ≠ Fundo Partidário
# ═══════════════════════════════════════════════════════════════════


def test_os_dois_fundos_nao_se_misturam(conhecidos):
    """RISCO: São fundos DIFERENTES, e o resumo os separa.

    ATENÇÃO: O FEFC ("fundão") é de 2017 e é eleitoral; o Fundo Partidário é permanente.
    Somá-los como "dinheiro público de campanha" é defensável — mas tem de ser dito, e
    quem soma é quem analisa, não o ETL.
    """
    linhas = receitas.para_linhas(
        [
            linha(DS_FONTE_RECEITA="FUNDO ESPECIAL", VR_RECEITA="1000,00"),
            linha(DS_FONTE_RECEITA="FUNDO PARTIDARIO", VR_RECEITA="500,00"),
            linha(DS_FONTE_RECEITA="OUTROS RECURSOS", VR_RECEITA="250,00"),
        ],
        conhecidos,
        2022,
    )
    resumo = receitas.resumir(linhas)

    assert resumo["fundo_especial"] == pytest.approx(1000.00)
    assert resumo["total"] == pytest.approx(1750.00)
    assert resumo["parlamentares"] == 1


def test_a_fonte_e_normalizada_para_caixa_alta(conhecidos):
    """ATENÇÃO: Sem isto, `Fundo Especial` e `FUNDO ESPECIAL` seriam duas fontes distintas —
    e o total do fundão sairia pela metade."""
    linhas = receitas.para_linhas(
        [linha(DS_FONTE_RECEITA="Fundo Especial")], conhecidos, 2022
    )

    assert linhas[0]["fonte_receita"] == "FUNDO ESPECIAL"
    assert receitas.resumir(linhas)["fundo_especial"] == pytest.approx(3170000.00)


# ═══════════════════════════════════════════════════════════════════
# RISCO: RNF-13 — o doador pessoa física
# ═══════════════════════════════════════════════════════════════════


def test_cnpj_do_doador_fica_legivel(conhecidos):
    """DECISÃO: CNPJ é dado público de empresa, e não pode ser hasheado.

    RISCO: É ele que permite cruzar **quem financiou a campanha** com **quem recebeu verba
    de gabinete depois** — a pergunta que justifica ingerir isto.
    """
    linhas = receitas.para_linhas([linha()], conhecidos, 2022)

    assert linhas[0]["doador_cnpj_ou_hash"] == "12345678000199"
    assert linhas[0]["doador_eh_pessoa_fisica"] is False


def test_cpf_do_doador_vira_hash(conhecidos):
    """RISCO: RNF-13 — e o **mesmo** hash da cota, para que os dois lados se comparem.

    E o CPF em claro não sobrou em canto nenhum da linha
    """
    from poligraph_etl.congresso.cota import identificar_fornecedor

    linhas = receitas.para_linhas(
        [linha(NR_CPF_CNPJ_DOADOR="012.345.678-90")], conhecidos, 2022
    )

    assert linhas[0]["doador_eh_pessoa_fisica"] is True
    assert linhas[0]["doador_cnpj_ou_hash"] == hash_de_cpf(CPF_ELEITO)
    assert linhas[0]["doador_cnpj_ou_hash"] == identificar_fornecedor(CPF_ELEITO)[0]

    assert CPF_ELEITO not in str(linhas[0])


def test_doador_zerado_vira_nulo(conhecidos):
    """ATENÇÃO: O TSE usa `00000000000` para doação sem doador identificado.

    RISCO: Hasheá-lo daria um valor CONSTANTE gravado em milhares de linhas — que casaria
    todas entre si e inventaria um doador comum que não existe.
    """
    linhas = receitas.para_linhas(
        [linha(NR_CPF_CNPJ_DOADOR="00000000000")], conhecidos, 2022
    )

    assert linhas[0]["doador_cnpj_ou_hash"] is None
    assert linhas[0]["doador_eh_pessoa_fisica"] is False


# ═══════════════════════════════════════════════════════════════════
# Sentinelas e valor
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.parametrize("nulo", ["#NULO", "#NULO#", "#NE", "-1", "  "])
def test_sentinela_do_tse_nao_vira_texto(conhecidos, nulo):
    """ATENÇÃO: `#NULO` chega como TEXTO. Sem tratar, viraria o nome do doador na ficha."""
    linhas = receitas.para_linhas([linha(NM_DOADOR=nulo)], conhecidos, 2022)

    assert linhas[0]["doador"] is None


def test_fonte_ausente_nao_fica_vazia(conhecidos):
    """ATENÇÃO: `fonte_receita` é `required` no EF — string vazia passaria e viraria uma
    categoria fantasma na ficha."""
    linhas = receitas.para_linhas([linha(DS_FONTE_RECEITA="#NULO")], conhecidos, 2022)

    assert linhas[0]["fonte_receita"] == "NAO INFORMADA"


def test_valor_zero_e_descartado(conhecidos):
    """RISCO: `ck_receita_valor` exige `valor <> 0`.

    ATENÇÃO: Sem o descarte, **o lote inteiro** seria recusado pelo banco por causa de uma
    linha — o `executemany` é atômico.
    """
    assert receitas.para_linhas([linha(VR_RECEITA="0,00")], conhecidos, 2022) == []
    assert receitas.para_linhas([linha(VR_RECEITA="#NULO")], conhecidos, 2022) == []


def test_valor_usa_a_convencao_pt_br(conhecidos):
    """ATENÇÃO: `3170000,00` — vírgula decimal. Ler com ponto decimal daria 3170000 vezes
    menos... ou um erro. Aqui daria erro; em `1.000,00` daria **1,0** calado."""
    linhas = receitas.para_linhas(
        [linha(VR_RECEITA="1.000,00")], conhecidos, 2022
    )

    assert linhas[0]["valor"] == pytest.approx(1000.00)


def test_ano_de_eleicao_e_o_passado_nao_o_do_registro(conhecidos):
    """ATENÇÃO: Não há coluna de ano no CSV de receita — ele é do arquivo inteiro."""
    linhas = receitas.para_linhas([linha()], conhecidos, 2018)

    assert linhas[0]["ano_eleicao"] == 2018


# ═══════════════════════════════════════════════════════════════════
# O ZIP — quais arquivos entram
# ═══════════════════════════════════════════════════════════════════


@pytest.fixture
def zip_do_tse(tmp_path: Path) -> Path:
    """Um ZIP com a mesma FORMA do real: 5 tipos de arquivo dividindo o mesmo pacote.

    ATENÇÃO: **As duas grafias plausíveis do doador originário.** A documentação do TSE
    lista o tipo como `receitas_candidatos_doador_originario_2022`, mas a
    posição do ano no nome do arquivo estadual não foi medida no ZIP real.
    A segunda grafia CASA com o prefixo — é ela que torna `IGNORAR` necessário.
    """
    caminho = tmp_path / "prestacao.zip"

    conteudo = ";".join(COLUNAS) + "\n" + ";".join(
        [
            "DEPUTADO FEDERAL", CPF_ELEITO, "JOSÉ AÇÃÍ", "FUNDO ESPECIAL",
            "Recursos de partido político", "PARTIDO EXEMPLO", "12345678000199",
            "3170000,00",
        ]
    ) + "\n"

    with zipfile.ZipFile(caminho, "w") as zipe:
        zipe.writestr("receitas_candidatos_2022_AP.csv", conteudo.encode("latin-1"))
        zipe.writestr("receitas_candidatos_2022_SP.csv", conteudo.encode("latin-1"))
        zipe.writestr("receitas_candidatos_2022_BRASIL.csv", conteudo.encode("latin-1"))

        zipe.writestr("receitas_candidatos_doador_originario_2022_AP.csv", "x")
        zipe.writestr("receitas_candidatos_2022_doador_originario_AP.csv", "x")
        zipe.writestr("despesas_pagas_candidatos_2022_AP.csv", "x")
        zipe.writestr("leiame.pdf", "x")

    return caminho


def test_o_consolidado_e_o_unico_lido(zip_do_tse):
    """RISCO: O consolidado **substitui** os estaduais — nunca soma com eles.

    ATENÇÃO: Medido no ZIP real de 2022: `_BRASIL`/SP tem **17.609** linhas de deputado
    federal, e o arquivo `_SP` tem as mesmas **17.609**. Ler os dois dobraria o
    financiamento de cada candidato, e o número continuaria plausível.

    DECISÃO: E o consolidado é o único que traz o **DF**, que não tem arquivo próprio.
    """
    nomes = receitas.nomes_de_receita(zip_do_tse, 2022)

    assert nomes == ["receitas_candidatos_2022_BRASIL.csv"]


def test_sem_consolidado_cai_para_os_estaduais(tmp_path):
    """DECISÃO: Plano B: se o TSE deixar de publicar o consolidado, os estaduais servem.

    ATENÇÃO: Com a ressalva conhecida — nesse caminho o **DF fica de fora**, porque não
    existe arquivo estadual dele. Quem avisa é o canário de casamento do comando.
    """
    caminho = tmp_path / "sem-consolidado.zip"
    with zipfile.ZipFile(caminho, "w") as zipe:
        zipe.writestr("receitas_candidatos_2022_AP.csv", "x")
        zipe.writestr("receitas_candidatos_2022_SP.csv", "x")
        zipe.writestr("receitas_candidatos_doador_originario_2022_AP.csv", "x")
        zipe.writestr("receitas_candidatos_2022_doador_originario_AP.csv", "x")
        zipe.writestr("despesas_pagas_candidatos_2022_AP.csv", "x")

    assert receitas.nomes_de_receita(caminho, 2022) == [
        "receitas_candidatos_2022_AP.csv",
        "receitas_candidatos_2022_SP.csv",
    ]


def test_le_latin1_sem_corromper(zip_do_tse, conhecidos):
    """RISCO: O TSE é **Latin-1** — a única fonte do projeto assim.

    ATENÇÃO: Lido como UTF-8, `JOSÉ AÇÃÍ` estouraria em `UnicodeDecodeError` na primeira linha
    acentuada de um arquivo de 396 MB.
    """
    registros = list(receitas.ler_receitas(zip_do_tse, "receitas_candidatos_2022_AP.csv"))

    assert len(registros) == 1
    assert registros[0]["NM_CANDIDATO"] == "JOSÉ AÇÃÍ"

    linhas = receitas.para_linhas(registros, conhecidos, 2022)
    assert linhas[0]["valor"] == pytest.approx(3170000.00)


def test_ano_diferente_nao_acha_nada(zip_do_tse):
    """ATENÇÃO: Pedir 2018 num ZIP de 2022 devolve **vazio**, e o comando trata isso como
    erro — não como "essa eleição não teve receita"."""
    assert receitas.nomes_de_receita(zip_do_tse, 2018) == []


# ═══════════════════════════════════════════════════════════════════
# RISCO: Senadores — o cargo tem de casar com a CASA da pessoa
# ═══════════════════════════════════════════════════════════════════

CPF_SENADOR = "11144477735"


def test_sem_casa_por_pessoa_so_a_camara_entra(conhecidos):
    """O comportamento de antes de o Senado ter `cpf_hash` continua o padrão."""
    assert receitas.para_linhas([linha(DS_CARGO="SENADOR")], conhecidos, 2022) == []


def test_senador_entra_quando_a_casa_dele_e_o_senado():
    conhecidos = {hash_de_cpf(CPF_SENADOR): 7}

    linhas = receitas.para_linhas(
        [linha(DS_CARGO="SENADOR", NR_CPF_CANDIDATO=CPF_SENADOR)],
        conhecidos,
        2022,
        {7: "SENADO"},
    )

    assert len(linhas) == 1
    assert linhas[0]["pessoa_id"] == 7


def test_campanha_ao_senado_que_o_deputado_PERDEU_nao_entra(conhecidos):
    """RISCO: O caso que motivou o `casa_por_pessoa`.

    O CPF é o mesmo em toda eleição. Um deputado em exercício que disputou o Senado
    numa eleição anterior e não se elegeu tem receita naquele arquivo — e somá-la
    ao financiamento dele daria um total maior, plausível e errado, sem erro nenhum.
    """
    linhas = receitas.para_linhas(
        [linha(DS_CARGO="SENADOR")], conhecidos, 2018, {42: "CAMARA"}
    )

    assert linhas == []


def test_cargo_que_nao_e_de_nenhuma_casa_nunca_entra(conhecidos):
    assert receitas.para_linhas(
        [linha(DS_CARGO="GOVERNADOR")], conhecidos, 2022, {42: "CAMARA"}
    ) == []


# ═══════════════════════════════════════════════════════════════════
# RISCO: O de-para de CPF do Senado, extraído do próprio arquivo do TSE
# ═══════════════════════════════════════════════════════════════════


def _zip_de_receitas(tmp_path: Path, linhas: list[dict], ano: int = 2022) -> Path:
    caminho = tmp_path / f"contas-{ano}.zip"
    colunas = ["DS_CARGO", "NM_CANDIDATO", "SG_UF", "NR_CPF_CANDIDATO"]

    corpo = ";".join(f'"{c}"' for c in colunas) + chr(10)
    for l in linhas:
        corpo += ";".join(f'"{l.get(c, "")}"' for c in colunas) + chr(10)

    with zipfile.ZipFile(caminho, "w") as pacote:
        pacote.writestr(f"receitas_candidatos_{ano}_BRASIL.csv", corpo.encode("latin-1"))

    return caminho


def test_cpf_de_senadores_casa_por_nome_e_uf(tmp_path):
    caminho = _zip_de_receitas(tmp_path, [
        {"DS_CARGO": "Senador", "NM_CANDIDATO": "JOSÉ DA SILVA",
         "SG_UF": "SP", "NR_CPF_CANDIDATO": CPF_SENADOR},
    ])

    mapa = receitas.cpf_de_senadores(caminho, 2022)

    assert mapa[("JOSE DA SILVA", "SP")] == CPF_SENADOR


def test_homonimo_em_estados_diferentes_sao_pessoas_diferentes(tmp_path):
    """ATENÇÃO: A UF faz parte da chave: sem ela, um sobrescreveria o outro."""
    caminho = _zip_de_receitas(tmp_path, [
        {"DS_CARGO": "Senador", "NM_CANDIDATO": "JOSE DA SILVA",
         "SG_UF": "SP", "NR_CPF_CANDIDATO": CPF_SENADOR},
        {"DS_CARGO": "Senador", "NM_CANDIDATO": "JOSE DA SILVA",
         "SG_UF": "BA", "NR_CPF_CANDIDATO": CPF_ELEITO},
    ])

    mapa = receitas.cpf_de_senadores(caminho, 2022)

    assert mapa[("JOSE DA SILVA", "SP")] == CPF_SENADOR
    assert mapa[("JOSE DA SILVA", "BA")] == CPF_ELEITO


def test_mesmo_nome_e_mesma_uf_com_dois_cpf_vira_ambiguidade(tmp_path):
    """RISCO: Ambiguidade sai como `None`, nunca "o primeiro"."""
    caminho = _zip_de_receitas(tmp_path, [
        {"DS_CARGO": "Senador", "NM_CANDIDATO": "JOSE DA SILVA",
         "SG_UF": "SP", "NR_CPF_CANDIDATO": CPF_SENADOR},
        {"DS_CARGO": "Senador", "NM_CANDIDATO": "JOSE DA SILVA",
         "SG_UF": "SP", "NR_CPF_CANDIDATO": CPF_ELEITO},
    ])

    assert receitas.cpf_de_senadores(caminho, 2022)[("JOSE DA SILVA", "SP")] is None


def test_deputado_nao_entra_no_de_para_de_senador(tmp_path):
    caminho = _zip_de_receitas(tmp_path, [
        {"DS_CARGO": "Deputado Federal", "NM_CANDIDATO": "JOSE DA SILVA",
         "SG_UF": "SP", "NR_CPF_CANDIDATO": CPF_SENADOR},
    ])

    assert receitas.cpf_de_senadores(caminho, 2022) == {}


def test_layout_antigo_sai_com_os_nomes_do_atual(tmp_path):
    """Pendência 53: 2014 e 2010 têm as colunas por extenso; a fonte vira o vocabulário de hoje."""
    caminho = tmp_path / "prestacao_final_2014.zip"
    colunas = ["Cargo", "Nome candidato", "CPF do candidato", "UF", "Valor receita",
               "CPF/CNPJ do doador", "Fonte recurso", "Tipo receita", "Nome do doador"]
    linha = ["Deputado Federal", "FULANO", CPF_SENADOR, "SP", "1000,50",
             "12345678000190", "Fundo Partidáo", "Recursos de partido político", "PARTIDO X"]
    corpo = ";".join(f'"{c}"' for c in colunas) + chr(10) + ";".join(f'"{v}"' for v in linha) + chr(10)
    with zipfile.ZipFile(caminho, "w") as pacote:
        pacote.writestr("receitas_candidatos_2014_brasil.txt", corpo.encode("latin-1"))

    nomes = receitas.nomes_de_receita(caminho, 2014)
    registro = next(receitas.ler_receitas(caminho, nomes[0]))

    assert nomes == ["receitas_candidatos_2014_brasil.txt"]
    assert (registro["DS_CARGO"], registro["VR_RECEITA"], registro["DS_FONTE_RECEITA"]) == (
        "Deputado Federal", "1000,50", "FUNDO PARTIDARIO")


def test_layout_antigo_traz_a_candidatura_com_a_uf_como_ue():
    """Sem o sequencial e a UE, o governador e o deputado estadual de 2010 e 2014 não casavam pela candidatura."""
    registro = receitas.traduzir_layout_antigo({"Sequencial Candidato": "250000001234", "UF": "GO", "Cargo": "Governador"})

    assert (registro["SG_UE"], registro["SQ_CANDIDATO"]) == ("GO", "250000001234")
    linhas = receitas.para_linhas(
        [{**registro, "VR_RECEITA": "10,00", "NR_CPF_CNPJ_DOADOR": "12345678000190"}], {}, 2014,
        por_candidatura={("GO", "250000001234"): 7},
    )
    assert [l["pessoa_id"] for l in linhas] == [7]

