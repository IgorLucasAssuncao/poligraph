"""Os contratos da ETL contra o que existe de fato: o arquivo da fonte e a tabela do EF.

DECISÃO: o contrato de saída é conferido contra o banco criado por `schema_do_ef.sql`, e não
contra uma lista escrita aqui. Coluna que o EF renomeia, ou que passa a ser obrigatória,
derruba este teste antes de derrubar a carga.
"""

import csv
import inspect
import io
import types
import typing
import zipfile
from dataclasses import fields, is_dataclass
from datetime import date

import pytest

from poligraph_etl.comandos import comum, congresso
from poligraph_etl.nucleo import persistencia
from poligraph_etl.contratos import banco, camara as contratos_da_camara, portal as contratos_do_portal, senado as contratos_do_senado
from poligraph_etl.contratos.entrada import colunas_da_fonte
from poligraph_etl.fontes import camara, senado

CONTRATOS_DE_SAIDA = [c for _, c in inspect.getmembers(banco, inspect.isclass) if is_dataclass(c) and hasattr(c, "TABELA")]
CONTRATOS_DE_ENTRADA = [
    c for modulo in (contratos_da_camara, contratos_do_senado, contratos_do_portal)
    for _, c in inspect.getmembers(modulo, inspect.isclass) if is_dataclass(c) and c.__module__ == modulo.__name__
]

TIPOS_DO_BANCO = {
    int: {"smallint", "integer", "bigint"},
    float: {"numeric", "real", "double precision"},
    str: {"text", "character varying", "character", "date"},
    bool: {"boolean"},
    date: {"date"},
}


def _tipo_e_nulo(anotacao) -> tuple[type, bool]:
    """`str | None` → (str, True); `int` → (int, False)."""
    if isinstance(anotacao, types.UnionType) or typing.get_origin(anotacao) is typing.Union:
        argumentos = [a for a in typing.get_args(anotacao) if a is not type(None)]
        return argumentos[0], True
    return anotacao, False


def test_existe_ao_menos_um_contrato_de_cada_lado():
    """ATENÇÃO: sem isto, a descoberta por introspecção poderia achar zero contratos e os testes passariam vazios."""
    assert CONTRATOS_DE_SAIDA
    assert CONTRATOS_DE_ENTRADA


@pytest.mark.parametrize("contrato", CONTRATOS_DE_ENTRADA, ids=lambda c: c.__name__)
def test_entrada_diz_a_coluna_de_cada_campo_sem_repetir(contrato):
    colunas = colunas_da_fonte(contrato)

    assert len(set(colunas.values())) == len(colunas)
    assert all(nome.strip() for nome in colunas.values())


@pytest.mark.integracao
@pytest.mark.parametrize("contrato", CONTRATOS_DE_SAIDA, ids=lambda c: c.__name__)
def test_saida_bate_com_a_tabela_do_ef(conexao, contrato):
    """Cada campo existe como coluna, com tipo e nulidade compatíveis, e nenhuma coluna obrigatória fica de fora."""
    tabela = {
        nome: (tipo, nulo == "YES", padrao)
        for nome, tipo, nulo, padrao in conexao.execute(
            "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = %s",
            (contrato.TABELA,),
        ).fetchall()
    }
    assert tabela, f"a tabela {contrato.TABELA} não existe no schema do EF"

    anotacoes = typing.get_type_hints(contrato)
    for campo in fields(contrato):
        assert campo.name in tabela, f"{contrato.__name__}.{campo.name} não é coluna de {contrato.TABELA}"
        tipo, nulo = _tipo_e_nulo(anotacoes[campo.name])
        tipo_no_banco, nulo_no_banco, _ = tabela[campo.name]
        assert tipo_no_banco in TIPOS_DO_BANCO[tipo], f"{campo.name}: {tipo.__name__} contra {tipo_no_banco}"
        assert nulo == nulo_no_banco, f"{campo.name}: o contrato diz nulo={nulo}, o banco diz {nulo_no_banco}"

    nomes = {campo.name for campo in fields(contrato)}
    obrigatorias_esquecidas = sorted(
        nome for nome, (_, nulo, padrao) in tabela.items()
        if not nulo and padrao is None and nome not in nomes | {"id", "carga_id"}
    )
    assert not obrigatorias_esquecidas, f"{contrato.TABELA} exige {obrigatorias_esquecidas}, que o contrato não tem"


# ═══════════════════════════════════════════════════════════════════
# A cota de ponta a ponta: arquivo da fonte → contrato → transformação → banco
# ═══════════════════════════════════════════════════════════════════

COLUNAS_DA_COTA = [
    "txNomeParlamentar", "ideCadastro", "numAno", "numMes", "txtDescricao", "txtFornecedor",
    "txtCNPJCPF", "vlrLiquido", "datEmissao", "urlDocumento",
]


def _zip_da_cota(destino, linhas: list[dict]):
    """Um `Ano-{ano}.csv.zip` como a Câmara publica: CSV com ponto e vírgula, UTF-8 com BOM."""
    texto = io.StringIO()
    escritor = csv.DictWriter(texto, fieldnames=COLUNAS_DA_COTA, delimiter=";", quoting=csv.QUOTE_ALL)
    escritor.writeheader()
    escritor.writerows(linhas)
    with zipfile.ZipFile(destino, "w") as arquivo:
        arquivo.writestr("Ano-2025.csv", "\ufeff" + texto.getvalue())
    return destino


@pytest.fixture
def limpar(conexao):
    conexao.execute(
        "TRUNCATE despesas, reconciliacoes, reconciliacao_motivos, votos, votacoes, cargas, "
        "pessoa_fonte_ids, pessoas RESTART IDENTITY CASCADE"
    )


@pytest.mark.integracao
def test_cota_da_camara_grava_as_despesas_e_fecha_com_a_fonte(conexao, limpar, tmp_path, monkeypatch):
    persistencia.gravar_pessoas(conexao, [{
        "nome_civil": "Ana Ribeiro", "nome_exibicao": "Ana Ribeiro", "cpf_hash": None, "url_foto": None,
        "fonte": "CAMARA", "id_externo": "62881", "metodo": "MANUAL", "confianca": 1.0,
    }])
    nota = {
        "txNomeParlamentar": "Ana Ribeiro", "ideCadastro": "62881", "numAno": "2025", "numMes": "2",
        "txtDescricao": "COMBUSTÍVEIS", "txtFornecedor": "POSTO", "txtCNPJCPF": "12.345.678/0001-90",
        "vlrLiquido": "104.58", "datEmissao": "2025-02-28T00:00:00", "urlDocumento": "https://exemplo/1.pdf",
    }
    lideranca = {**nota, "txNomeParlamentar": "LID.GOV-CD", "ideCadastro": "", "vlrLiquido": "40.00"}

    monkeypatch.setattr(comum, "CACHE", tmp_path)
    monkeypatch.setattr(camara, "MINIMO_DE_COTA", 1)
    monkeypatch.setattr(camara, "baixar_cota", lambda ano, destino: _zip_da_cota(destino, [nota, lideranca]))
    monkeypatch.setattr(senado, "baixar_ceaps", lambda ano, destino: pytest.fail("sem senador na base, a CEAPS não é lida"))

    congresso.rodar_cota(conexao, [2025])

    despesas = conexao.execute(
        "SELECT pessoa_id, ano, mes, categoria, cnpj_ou_hash, valor_liquido, data_emissao::text, carga_id IS NOT NULL FROM despesas"
    ).fetchall()
    assert [(d[1], d[2], d[3], d[4], float(d[5]), d[6], d[7]) for d in despesas] == [
        (2025, 2, "COMBUSTÍVEIS", "12345678000190", 104.58, "2025-02-28", True)
    ]
    fonte, base = conexao.execute(
        "SELECT total_na_fonte, total_na_base FROM reconciliacoes WHERE conjunto = 'COTA_CAMARA' AND ano = 2025"
    ).fetchone()
    motivos = dict(conexao.execute("SELECT motivo, valor FROM reconciliacao_motivos").fetchall())
    assert (float(fonte), float(base), {m: float(v) for m, v in motivos.items()}) == (144.58, 104.58, {"SEM_PARLAMENTAR": 40.0})


@pytest.mark.integracao
def test_cota_sem_de_para_recusa_em_vez_de_descartar_tudo(conexao, limpar):
    with pytest.raises(RuntimeError, match="ingerir"):
        congresso.rodar_cota(conexao, [2025])


def test_ler_tabela_da_o_mesmo_que_ler_registro_a_registro():
    """O leitor por coluna é só mais rápido: célula vazia, espaço nas pontas e coluna a mais saem iguais."""
    import pandas as pd
    from dataclasses import dataclass
    from poligraph_etl.contratos.entrada import coluna, ler, ler_tabela

    @dataclass(frozen=True)
    class Linha:
        nome: str | None = coluna("Nome")
        valor: str | None = coluna("Valor")

    tabela = pd.DataFrame({"Nome": [" Ana ", "", "Bia"], "Valor": ["1,50", " ", "2"], "Sobra": ["x", "y", "z"]}, dtype=str)

    assert ler_tabela(Linha, tabela) == ler(Linha, tabela.to_dict("records"))
    assert ler_tabela(Linha, tabela)[1] == Linha(nome=None, valor=None)
    assert ler_tabela(Linha, tabela.iloc[0:0]) == []


def test_ler_tabela_sem_a_coluna_derruba_a_carga():
    import pandas as pd
    import pytest
    from dataclasses import dataclass
    from poligraph_etl.contratos.entrada import LayoutMudou, coluna, ler_tabela

    @dataclass(frozen=True)
    class Linha:
        nome: str | None = coluna("Nome")

    with pytest.raises(LayoutMudou, match="Nome"):
        ler_tabela(Linha, pd.DataFrame({"Outra": ["a"]}, dtype=str))


def test_celula_vazia_do_pandas_vira_none_e_nao_o_texto_nan():
    """`str(float('nan'))` é "nan": sem a conferência, o contrato gravava o texto no banco (2026-10-24)."""
    from poligraph_etl.contratos.entrada import ler
    from poligraph_etl.contratos.portal import LinhaDeViagem

    viagem = ler(LinhaDeViagem, [{
        "Identificador do processo de viagem": "1", "Nome do órgão superior": float("nan"),
        "Situação": "Realizada", "Viagem Urgente": "SIM",
    }])[0]

    assert viagem.orgao_superior is None


def test_situacao_e_urgencia_da_viagem_pelo_valor_exato():
    from poligraph_etl.nucleo.tipos import TipoSituacaoDaViagem, ValorDesconhecido, sim_ou_nao, situacao_da_viagem

    assert situacao_da_viagem("Não realizada") is TipoSituacaoDaViagem.NAO_REALIZADA
    assert situacao_da_viagem("Realizada") is TipoSituacaoDaViagem.REALIZADA
    assert situacao_da_viagem("Sem informação") is TipoSituacaoDaViagem.SEM_INFORMACAO
    assert (sim_ou_nao("Viagem Urgente", "SIM"), sim_ou_nao("Viagem Urgente", "NÃO")) == (True, False)
    with pytest.raises(ValorDesconhecido):
        situacao_da_viagem("Não realizada por chuva")
    with pytest.raises(ValorDesconhecido):
        sim_ou_nao("Viagem Urgente", "TALVEZ")


def test_plenario_pela_sigla_exata():
    from poligraph_etl.contratos.camara import eh_plenario

    assert eh_plenario("PLEN") and not eh_plenario("PLEN2") and not eh_plenario(None)


def test_origem_da_receita_junta_as_grafias_do_tse():
    from poligraph_etl.nucleo.tipos import TipoOrigemDaReceita, ValorDesconhecido, origem_da_receita

    assert origem_da_receita("RECURSOS DE PARTIDO POLÍTICO") is TipoOrigemDaReceita.PARTIDO
    assert origem_da_receita("Recursos de partido político") is TipoOrigemDaReceita.PARTIDO
    assert origem_da_receita("Recursos de outros candidatos/comitês") is TipoOrigemDaReceita.OUTROS_CANDIDATOS
    assert origem_da_receita("Descrição das doações relativas à comercialização") is TipoOrigemDaReceita.COMERCIALIZACAO
    assert origem_da_receita("") is None
    with pytest.raises(ValorDesconhecido):
        origem_da_receita("Recursos de bitcoin")


def test_tipo_de_bem_em_caixa_alta_ganha_a_grafia_dos_outros_anos():
    from poligraph_etl.nucleo.tipos import tipo_de_bem

    assert tipo_de_bem("OUTROS BENS E DIREITOS") == "Outros bens e direitos"
    assert tipo_de_bem("VGBL - Vida Gerador de Benefício Livre") == "VGBL - Vida Gerador de Benefício Livre"
    assert tipo_de_bem("  ") == "Não informado"


def test_data_de_nascimento_impossivel_vira_nula():
    from datetime import date
    from poligraph_etl.nucleo.tipos import data_plausivel

    assert data_plausivel(date(7197, 4, 17), 2008) is None
    assert data_plausivel(date(49, 7, 13), 2008) is None
    assert data_plausivel(date(1960, 1, 1), 2008) == date(1960, 1, 1)


def test_municipio_sem_nome_do_ibge_usa_o_do_tom():
    from poligraph_etl.cidades.municipios import municipios_para_linhas

    linhas = municipios_para_linhas([{
        "CÓDIGO DO MUNICÍPIO - IBGE": "5003157", "CÓDIGO DO MUNICÍPIO - TOM": "9997",
        "MUNICÍPIO - IBGE": "", "MUNICÍPIO - TOM": "CORONEL SAPUCAIA", "UF": "MS",
    }, {
        "CÓDIGO DO MUNICÍPIO - IBGE": "3550308", "CÓDIGO DO MUNICÍPIO - TOM": "7107",
        "MUNICÍPIO - IBGE": "", "MUNICÍPIO - TOM": "SAO JOAO DA BOA VISTA", "UF": "SP",
    }])

    assert [l["nome"] for l in linhas] == ["Coronel Sapucaia", "Sao Joao da Boa Vista"]
