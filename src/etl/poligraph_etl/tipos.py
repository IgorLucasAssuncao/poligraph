"""Os valores fechados das fontes, como enum (regra do `CLAUDE.md`, Pendência 91).

O código que a fonte publica é traduzido aqui, no contrato de entrada; dali em diante só o enum
circula. Valor que a fonte manda e o enum não conhece derruba a carga com `ValorDesconhecido`, como
`LayoutMudou` faz com coluna que some.

Os nomes e os valores são os mesmos dos enums C# em `Poligraph.Data/Data/Enums`.
"""

import unicodedata
from enum import StrEnum


class ValorDesconhecido(RuntimeError):
    """A fonte publicou num campo de domínio um valor que o enum não conhece."""

    def __init__(self, campo: str, valor: object):
        super().__init__(f"{campo}: valor {valor!r} não está no enum. A fonte mudou o domínio; acrescente o valor em tipos.py e no enum C#.")


class TipoCasa(StrEnum):
    """As duas casas do Congresso (`TipoCasa` no C#)."""

    CAMARA = "CAMARA"
    SENADO = "SENADO"


class TipoFonteDeCarga(StrEnum):
    """O órgão de onde veio o arquivo de uma carga (`TipoFonteDeCarga` no C#)."""

    CAMARA = "CAMARA"
    SENADO = "SENADO"
    TSE = "TSE"
    PORTAL_TRANSPARENCIA = "PORTAL_TRANSPARENCIA"
    RECEITA = "RECEITA"
    IBGE = "IBGE"
    TESOURO = "TESOURO"
    BANCO_CENTRAL = "BANCO_CENTRAL"


class TipoFonteDeIdentificador(StrEnum):
    """De quem é o id em `pessoa_fonte_ids` (`TipoFonteDeIdentificador` no C#)."""

    CAMARA = "CAMARA"
    SENADO = "SENADO"
    TSE = "TSE"


class FonteDaRedeSocial(StrEnum):
    """De onde veio o endereço de uma rede social (`FonteDaRedeSocial` no C#)."""

    CAMARA = "CAMARA"
    TSE = "TSE"


class TipoCargo(StrEnum):
    """Os cargos eletivos que a base guarda (`TipoCargo` no C#). Vereador fica fora (Pendência 90)."""

    PRESIDENTE = "PRESIDENTE"
    VICE_PRESIDENTE = "VICE_PRESIDENTE"
    SENADOR = "SENADOR"
    DEPUTADO_FEDERAL = "DEPUTADO_FEDERAL"
    GOVERNADOR = "GOVERNADOR"
    VICE_GOVERNADOR = "VICE_GOVERNADOR"
    DEPUTADO_ESTADUAL = "DEPUTADO_ESTADUAL"
    DEPUTADO_DISTRITAL = "DEPUTADO_DISTRITAL"
    PREFEITO = "PREFEITO"
    VICE_PREFEITO = "VICE_PREFEITO"


CARGOS_DO_CONGRESSO = frozenset({TipoCargo.SENADOR, TipoCargo.DEPUTADO_FEDERAL})
"""Os cargos cuja pessoa nasce da Câmara e do Senado, e não do TSE."""
CARGOS_MUNICIPAIS = frozenset({TipoCargo.PREFEITO, TipoCargo.VICE_PREFEITO})
CARGOS_NACIONAIS = frozenset({TipoCargo.PRESIDENTE, TipoCargo.VICE_PRESIDENTE})
TITULAR_DO_VICE = {
    TipoCargo.VICE_PRESIDENTE: TipoCargo.PRESIDENTE,
    TipoCargo.VICE_GOVERNADOR: TipoCargo.GOVERNADOR,
    TipoCargo.VICE_PREFEITO: TipoCargo.PREFEITO,
}
"""O titular da chapa de cada vice: os dois dividem o número de candidato."""

_CARGO_DO_TSE: dict[str, TipoCargo | None] = {
    "1": TipoCargo.PRESIDENTE,
    "2": TipoCargo.VICE_PRESIDENTE,
    "3": TipoCargo.GOVERNADOR,
    "4": TipoCargo.VICE_GOVERNADOR,
    "5": TipoCargo.SENADOR,
    "6": TipoCargo.DEPUTADO_FEDERAL,
    "7": TipoCargo.DEPUTADO_ESTADUAL,
    "8": TipoCargo.DEPUTADO_DISTRITAL,
    "9": None,
    "10": None,
    "11": TipoCargo.PREFEITO,
    "12": TipoCargo.VICE_PREFEITO,
    "13": None,
}
"""`CD_CARGO` do TSE. `None` é cargo conhecido e fora do escopo: suplentes de senador (9 e 10) e vereador (13)."""


def cargo_do_tse(codigo: str | None) -> TipoCargo | None:
    """O cargo de `CD_CARGO`; `None` para os cargos fora do escopo."""
    try:
        return _CARGO_DO_TSE[codigo or ""]
    except KeyError:
        raise ValorDesconhecido("CD_CARGO", codigo) from None


def anos_do_mandato(cargo: TipoCargo, ano_eleicao: int) -> tuple[int, int]:
    """O primeiro e o último ano do mandato previsto: oito anos para senador, quatro para o resto."""
    duracao = 8 if cargo is TipoCargo.SENADOR else 4
    return ano_eleicao + 1, ano_eleicao + duracao


class TipoSituacaoNoTurno(StrEnum):
    """`DS_SIT_TOT_TURNO` do TSE. Só os três primeiros são eleitos."""

    ELEITO = "ELEITO"
    ELEITO_POR_QP = "ELEITO_POR_QP"
    ELEITO_POR_MEDIA = "ELEITO_POR_MEDIA"
    SEGUNDO_TURNO = "SEGUNDO_TURNO"
    SUPLENTE = "SUPLENTE"
    NAO_ELEITO = "NAO_ELEITO"
    SEM_RESULTADO = "SEM_RESULTADO"
    FORA_DA_DISPUTA = "FORA_DA_DISPUTA"


ELEITOS = frozenset({TipoSituacaoNoTurno.ELEITO, TipoSituacaoNoTurno.ELEITO_POR_QP, TipoSituacaoNoTurno.ELEITO_POR_MEDIA})

_SITUACAO_DO_TSE: dict[str, TipoSituacaoNoTurno] = {
    "ELEITO": TipoSituacaoNoTurno.ELEITO,
    "ELEITO POR QP": TipoSituacaoNoTurno.ELEITO_POR_QP,
    "ELEITO POR MÉDIA": TipoSituacaoNoTurno.ELEITO_POR_MEDIA,
    "MÉDIA": TipoSituacaoNoTurno.ELEITO_POR_MEDIA,
    "2º TURNO": TipoSituacaoNoTurno.SEGUNDO_TURNO,
    "SUPLENTE": TipoSituacaoNoTurno.SUPLENTE,
    "NÃO ELEITO": TipoSituacaoNoTurno.NAO_ELEITO,
    "#NULO": TipoSituacaoNoTurno.SEM_RESULTADO,
    "#NULO#": TipoSituacaoNoTurno.SEM_RESULTADO,
    "REGISTRO NEGADO ANTES DA ELEIÇÃO": TipoSituacaoNoTurno.FORA_DA_DISPUTA,
    "REGISTRO NEGADO APÓS A ELEIÇÃO": TipoSituacaoNoTurno.FORA_DA_DISPUTA,
    "INDEFERIDO COM RECURSO": TipoSituacaoNoTurno.FORA_DA_DISPUTA,
    "CASSADO COM RECURSO": TipoSituacaoNoTurno.FORA_DA_DISPUTA,
    "SUBSTITUÍDO": TipoSituacaoNoTurno.FORA_DA_DISPUTA,
    "RENÚNCIA/FALECIMENTO COM SUBSTITUIÇÃO": TipoSituacaoNoTurno.FORA_DA_DISPUTA,
    "RENÚNCIA/FALECIMENTO/CASSAÇÃO ANTES DA ELEIÇÃO": TipoSituacaoNoTurno.FORA_DA_DISPUTA,
    "RENÚNCIA/FALECIMENTO/CASSAÇÃO APÓS A ELEIÇÃO": TipoSituacaoNoTurno.FORA_DA_DISPUTA,
}
"""MEDIDO em 2026-10-21 nos arquivos de 1998 a 2024. `MÉDIA` é a grafia de 2010 para eleito por média."""


def situacao_do_tse(texto: str | None) -> TipoSituacaoNoTurno:
    """A situação de `DS_SIT_TOT_TURNO`, por igualdade exata: "contém ELEITO" pegaria NÃO ELEITO."""
    try:
        return _SITUACAO_DO_TSE[texto or ""]
    except KeyError:
        raise ValorDesconhecido("DS_SIT_TOT_TURNO", texto) from None


class TipoSexo(StrEnum):
    """`TipoSexo` no C#."""

    M = "M"
    F = "F"


_SEXO_DO_TSE: dict[str, TipoSexo | None] = {"2": TipoSexo.M, "4": TipoSexo.F, "-4": None, "-1": None, "0": None}
"""`CD_GENERO` do TSE; `-4` é não divulgável e `-1` e `0` (em 2000), não informado. MEDIDO em 2026-10-21."""


def sexo_do_tse(codigo: str | None) -> TipoSexo | None:
    try:
        return _SEXO_DO_TSE[codigo or ""]
    except KeyError:
        raise ValorDesconhecido("CD_GENERO", codigo) from None


class TipoGastoComDivida(StrEnum):
    """O que um pagamento da dívida é, pelo grupo e pelo elemento de despesa do orçamento federal."""

    JUROS = "JUROS"
    AMORTIZACAO = "AMORTIZACAO"
    REFINANCIAMENTO = "REFINANCIAMENTO"


_GRUPOS_DA_DIVIDA = {"2", "6"}
"""O grupo 2 (juros e encargos) e o 6 (amortização e refinanciamento). Os outros grupos não são dívida."""

_DIVIDA_DO_ORCAMENTO = {
    ("2", "00"): TipoGastoComDivida.JUROS,
    ("2", "21"): TipoGastoComDivida.JUROS,
    ("2", "22"): TipoGastoComDivida.JUROS,
    ("2", "23"): TipoGastoComDivida.JUROS,
    ("2", "24"): TipoGastoComDivida.JUROS,
    ("2", "26"): TipoGastoComDivida.JUROS,
    ("2", "92"): TipoGastoComDivida.JUROS,
    ("6", "00"): TipoGastoComDivida.AMORTIZACAO,
    ("6", "26"): TipoGastoComDivida.AMORTIZACAO,
    ("6", "71"): TipoGastoComDivida.AMORTIZACAO,
    ("6", "72"): TipoGastoComDivida.AMORTIZACAO,
    ("6", "92"): TipoGastoComDivida.AMORTIZACAO,
    ("6", "76"): TipoGastoComDivida.REFINANCIAMENTO,
    ("6", "77"): TipoGastoComDivida.REFINANCIAMENTO,
}
"""MEDIDO em 2026-10-24: os elementos dos grupos 2 e 6 nos arquivos de 2014 a 2026. 76 e 77 são o principal refinanciado."""


def gasto_com_divida(grupo: str | None, elemento: str | None) -> TipoGastoComDivida | None:
    """O tipo do pagamento da dívida; `None` fora dos grupos 2 e 6. Elemento novo nesses grupos derruba a carga."""
    if grupo not in _GRUPOS_DA_DIVIDA:
        return None
    try:
        return _DIVIDA_DO_ORCAMENTO[(grupo, elemento or "")]
    except KeyError:
        raise ValorDesconhecido("CÓDIGO ELEMENTO DE DESPESA", f"{grupo}/{elemento}") from None


class TipoFavorecido(StrEnum):
    """Quem recebeu um pagamento de emenda, como `ck_favorecido_identificacao` o entende (`TipoFavorecido` no C#)."""

    PESSOA_JURIDICA = "PESSOA_JURIDICA"
    UNIDADE_GESTORA = "UNIDADE_GESTORA"
    PESSOA = "PESSOA"
    SEM_INFORMACAO = "SEM_INFORMACAO"


_FAVORECIDO_DO_PORTAL = {
    "Pessoa Física": TipoFavorecido.PESSOA,
    "Pessoa Fisica": TipoFavorecido.PESSOA,
    "Pessoa Jurídica": TipoFavorecido.PESSOA_JURIDICA,
    "Unidade Gestora": TipoFavorecido.UNIDADE_GESTORA,
}
"""O `Tipo Favorecido` do Portal. "Inscrição Genérica" é pessoa: o Portal a usa para o CPF que não publica."""


def favorecido_do_portal(tipo: str | None) -> TipoFavorecido | None:
    """O tipo do favorecido pelo rótulo do Portal; `None` para o rótulo que o mapa não conhece.

    DECISÃO: rótulo desconhecido não derruba a carga aqui, ao contrário dos outros enums: o pagamento entra como
    `SEM_INFORMACAO`, sem identificação, porque uma categoria nova pode ser de pessoa (`emendas.classificar_favorecido`).
    """
    texto = (tipo or "").strip()
    if texto.startswith("Inscrição Gen"):
        return TipoFavorecido.PESSOA
    return _FAVORECIDO_DO_PORTAL.get(texto)


def so_digitos(texto: str | None, tamanho: int) -> bool:
    """Se o texto é um código numérico de `tamanho` dígitos (CNPJ, código do IBGE, unidade gestora)."""
    return texto is not None and len(texto) == tamanho and texto.isdigit()


def digitos(texto: str | None) -> str:
    """Só os dígitos do texto: o CNPJ ou o CPF com a máscara tirada."""
    return "".join(c for c in (texto or "") if c.isdigit())


UFS = frozenset({
    "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR",
    "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
})
"""As 27 unidades da federação: domínio fechado, comparado por igualdade, e não por regex."""


class TipoCategoriaDeVotacao(StrEnum):
    """O que a votação decide, e o peso dela no grafo (`TipoCategoriaDeVotacao` no C#)."""

    PROCEDIMENTAL = "PROCEDIMENTAL"
    DESTAQUE = "DESTAQUE"
    SUBSTANTIVA = "SUBSTANTIVA"
    AUTORIDADE = "AUTORIDADE"


class TipoMetrica(StrEnum):
    """A medida de parecença entre dois parlamentares (`TipoMetrica` no C#)."""

    CONCORDANCIA = "CONCORDANCIA"
    COSSENO = "COSSENO"


class TipoOrientacao(StrEnum):
    """A orientação de uma bancada numa votação da Câmara, com o texto que o arquivo publica.

    DECISÃO (2026-10-24): enum, pela regra do `CLAUDE.md`, e não texto livre como dizia o `OrientacaoModel`. MEDIDO no
    banco no mesmo dia: só estes cinco valores, mais 6.725 linhas com o texto "nan", que eram a célula vazia do CSV.
    """

    SIM = "Sim"
    NAO = "Não"
    OBSTRUCAO = "Obstrução"
    LIBERADO = "Liberado"
    ABSTENCAO = "Abstenção"


POSICOES_DE_ORIENTACAO = frozenset({TipoOrientacao.SIM, TipoOrientacao.NAO})
"""As orientações que exprimem posição. Obstrução é tática de quórum, e liberado é ausência de orientação."""


def orientacao_da_camara(texto: object) -> TipoOrientacao | None:
    """A orientação pelo texto do arquivo; `None` para a célula vazia, que o pandas entrega como `NaN`."""
    if not isinstance(texto, str) or not texto.strip():
        return None
    try:
        return TipoOrientacao(" ".join(texto.split()))
    except ValueError:
        raise ValorDesconhecido("orientacao", texto) from None


class TipoSituacaoDaViagem(StrEnum):
    """A situação de uma viagem a serviço no Portal da Transparência (`Situação`)."""

    REALIZADA = "REALIZADA"
    NAO_REALIZADA = "NAO_REALIZADA"
    SEM_INFORMACAO = "SEM_INFORMACAO"


_SITUACAO_DA_VIAGEM = {
    "REALIZADA": TipoSituacaoDaViagem.REALIZADA,
    "NAO REALIZADA": TipoSituacaoDaViagem.NAO_REALIZADA,
    "SEM INFORMACAO": TipoSituacaoDaViagem.SEM_INFORMACAO,
}
"""MEDIDO em 2026-10-24, viagens de 2014 a 2026: 11.444.775 realizadas, 261.264 não realizadas e 5 sem informação."""


def situacao_da_viagem(texto: str | None) -> TipoSituacaoDaViagem:
    """A situação pelo texto do Portal, sem acento e em maiúsculas; vazio é sem informação."""
    chave = _sem_acento_maiusculo(texto)
    if not chave:
        return TipoSituacaoDaViagem.SEM_INFORMACAO
    try:
        return _SITUACAO_DA_VIAGEM[chave]
    except KeyError:
        raise ValorDesconhecido("Situação", texto) from None


def sim_ou_nao(campo: str, texto: str | None) -> bool:
    """O campo de sim ou não do Portal ("SIM", "NÃO"); vazio é não. MEDIDO em 2026-10-24 na `Viagem Urgente`: só os dois."""
    chave = _sem_acento_maiusculo(texto)
    if chave in ("", "NAO"):
        return False
    if chave == "SIM":
        return True
    raise ValorDesconhecido(campo, texto)


def _sem_acento_maiusculo(texto: str | None) -> str:
    sem_acento = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode("ascii")
    return " ".join(sem_acento.upper().split())


class TipoRede(StrEnum):
    """A rede social de um endereço, pelo domínio, com os valores de `ck_rede_tipo`."""

    INSTAGRAM = "INSTAGRAM"
    FACEBOOK = "FACEBOOK"
    X = "X"
    YOUTUBE = "YOUTUBE"
    TIKTOK = "TIKTOK"
    LINKEDIN = "LINKEDIN"
    OUTRA = "OUTRA"


class TipoOrigemDaReceita(StrEnum):
    """De onde veio uma receita de campanha (`DS_ORIGEM_RECEITA`), com a grafia que a tela mostra.

    MEDIDO em 2026-10-24, receitas de 2010 a 2024: 17 grafias para estas 10 origens. O TSE escreve a mesma origem em
    caixa alta em alguns anos, chamou "outros candidatos" de "outros candidatos/comitês" e tem três rótulos de
    comercialização, um deles o nome da própria coluna ("Descrição das doações relativas à comercialização").
    """

    PARTIDO = "Recursos de partido político"
    PESSOAS_FISICAS = "Recursos de pessoas físicas"
    PESSOAS_JURIDICAS = "Recursos de pessoas jurídicas"
    PROPRIOS = "Recursos próprios"
    OUTROS_CANDIDATOS = "Recursos de outros candidatos"
    FINANCIAMENTO_COLETIVO = "Recursos de financiamento coletivo"
    DOACOES_PELA_INTERNET = "Doações pela internet"
    COMERCIALIZACAO = "Comercialização de bens ou realização de eventos"
    RENDIMENTOS = "Rendimentos de aplicações financeiras"
    NAO_IDENTIFICADA = "Recursos de origens não identificadas"


_ORIGEM_DA_RECEITA = {
    "RECURSOS DE PARTIDO POLITICO": TipoOrigemDaReceita.PARTIDO,
    "RECURSOS DE PESSOAS FISICAS": TipoOrigemDaReceita.PESSOAS_FISICAS,
    "RECURSOS DE PESSOAS JURIDICAS": TipoOrigemDaReceita.PESSOAS_JURIDICAS,
    "RECURSOS PROPRIOS": TipoOrigemDaReceita.PROPRIOS,
    "RECURSOS DE OUTROS CANDIDATOS": TipoOrigemDaReceita.OUTROS_CANDIDATOS,
    "RECURSOS DE OUTROS CANDIDATOS/COMITES": TipoOrigemDaReceita.OUTROS_CANDIDATOS,
    "RECURSOS DE FINANCIAMENTO COLETIVO": TipoOrigemDaReceita.FINANCIAMENTO_COLETIVO,
    "DOACOES PELA INTERNET": TipoOrigemDaReceita.DOACOES_PELA_INTERNET,
    "COMERCIALIZACAO DE BENS OU REALIZACAO DE EVENTOS": TipoOrigemDaReceita.COMERCIALIZACAO,
    "COMERCIALIZACAO DE BENS COM OR": TipoOrigemDaReceita.COMERCIALIZACAO,
    "COMERCIALIZACAO DE BENS COM FEFC": TipoOrigemDaReceita.COMERCIALIZACAO,
    "DESCRICAO DAS DOACOES RELATIVAS A COMERCIALIZACAO": TipoOrigemDaReceita.COMERCIALIZACAO,
    "RENDIMENTOS DE APLICACOES FINANCEIRAS": TipoOrigemDaReceita.RENDIMENTOS,
    "RECURSOS DE ORIGENS NAO IDENTIFICADAS": TipoOrigemDaReceita.NAO_IDENTIFICADA,
}


def origem_da_receita(texto: str | None) -> TipoOrigemDaReceita | None:
    """A origem pelo texto do TSE, sem acento nem caixa; vazio é `None`. A fonte da receita (fundo ou não) fica em
    `fonte_receita`, por isso as três comercializações viram uma só."""
    chave = _sem_acento_maiusculo(texto)
    if not chave:
        return None
    try:
        return _ORIGEM_DA_RECEITA[chave]
    except KeyError:
        raise ValorDesconhecido("DS_ORIGEM_RECEITA", texto) from None


def tipo_de_bem(texto: str | None) -> str:
    """O tipo do bem declarado, com a grafia da maioria dos anos.

    O TSE escreve "OUTROS BENS E DIREITOS" em caixa alta em parte das declarações e "Outros bens e direitos" no resto
    (MEDIDO em 2026-10-24: 4.221 e 12.608 bens; os outros 54 tipos vêm numa grafia só). Texto todo em caixa alta vira
    a primeira letra maiúscula e o resto minúsculo, como os outros tipos.
    """
    limpo = " ".join((texto or "").split())
    if not limpo:
        return "Não informado"
    return limpo[0] + limpo[1:].lower() if limpo.isupper() else limpo


def data_plausivel(data, ate_o_ano: int):
    """A data, se o ano fica entre 1900 e `ate_o_ano`; senão `None`. MEDIDO em 2026-10-24: 10 datas de nascimento do
    TSE com ano 0049, 0922, 1653 ou 7197, erro de digitação."""
    if data is None or not (1900 <= data.year <= ate_o_ano):
        return None
    return data


class TipoDeEleicao(StrEnum):
    """Ordinária ou suplementar (`CD_TIPO_ELEICAO`). A suplementar refaz a eleição anulada, no arquivo do ciclo original."""

    ORDINARIA = "ORDINARIA"
    SUPLEMENTAR = "SUPLEMENTAR"


_TIPO_DE_ELEICAO = {"0": TipoDeEleicao.ORDINARIA, "2": TipoDeEleicao.ORDINARIA, "1": TipoDeEleicao.SUPLEMENTAR}
"""MEDIDO em 2026-10-24, arquivos de candidatos de 1998 a 2026: "2" ordinária, "1" suplementar e "0" ordinária só em 2006."""


def tipo_de_eleicao_do_tse(codigo: str | None) -> TipoDeEleicao:
    """O tipo da eleição pelo código do TSE; vazio é ordinária, como nos arquivos sem a coluna preenchida."""
    if not codigo:
        return TipoDeEleicao.ORDINARIA
    try:
        return _TIPO_DE_ELEICAO[codigo.strip()]
    except KeyError:
        raise ValorDesconhecido("CD_TIPO_ELEICAO", codigo) from None
