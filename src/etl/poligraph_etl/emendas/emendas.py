"""Emendas parlamentares — Portal da Transparência.

Responde *"para onde este parlamentar mandou dinheiro público, quanto de fato saiu, e
quem recebeu?"*.

## ENTRADA

| | |
|---|---|
| Fonte | Download `emendas-parlamentares/UNICO` — ver [`fontes/portal.py`](fontes/portal.py) |
| CHAVE: Autenticação | Nenhuma: o download é público. A API de dados pedia a chave pessoal |
| Conteúdo | Três CSVs, todos os anos desde 2014: emendas, favorecidos, convênios |
| Formato | Latin-1; valores em **pt-BR** (`"343000,00"`) |

## TRATAMENTO

1. **Emendas:** uma linha por emenda × localidade × ação × plano orçamentário — 55
   emendas de 2023–26 ocupam mais de uma. O código do autor vem em coluna própria e é
   conferido contra o recorte do `codigoEmenda`: divergência é sinal de que a fonte mudou
2. **Favorecidos:** somados por mês e por quem recebeu. Pessoa não é identificada
3. **Convênios:** entidade própria. O valor é do convênio inteiro, e um convênio recebe
   até 23 emendas — somar por emenda contaria o mesmo dinheiro 23 vezes

## SAÍDA

| | |
|---|---|
| Tabelas | `emendas` · `autores_de_emenda` · `emendas_favorecidos` · `convenios` · `emendas_convenios` |
| Chave de ligação | `codigo_autor` — resolvido em passo **separado** |
| Constraints | `ux_emenda_programacao` · `ck_favorecido_identificacao` · `ck_convenio_valor` |
| Idempotência | `DELETE` pelos anos que entram, na mesma transação do `INSERT` |

---

RISCO: **A chave é o CÓDIGO DO AUTOR, não o nome.** O `codigoEmenda` embute um
identificador de **mandato**, estável dentro dele e válido para Câmara **e** Senado — que
é o motivo de tê-lo escolhido, já que o Senado não publica CPF.

DECISÃO: **`pessoa_id` sai NULO daqui.** Nada é descartado por não ter dono; o vínculo é
decisão de outro passo.

MEDIDO: [achado #24](../../../docs/achados/024-codigo-da-emenda-identifica-o-mandato.md) ·
MEDIDO: [achado #33](../../../docs/achados/033-o-destino-da-emenda.md)
"""

import logging
import re
from collections.abc import Iterable

import pandas as pd

from ..nucleo import normalizacao
from ..nucleo.tipos import UFS, TipoFavorecido, favorecido_do_portal, so_digitos

log = logging.getLogger("poligraph")

RECURSO = "emendas-parlamentares/UNICO"
ARQUIVO_EMENDAS = "EmendasParlamentares.csv"
ARQUIVO_FAVORECIDOS = "EmendasParlamentares_PorFavorecido.csv"
ARQUIVO_CONVENIOS = "EmendasParlamentares_Convenios.csv"

SEM_INFORMACAO = "Sem informação"

# A conversão vive em `normalizacao`, junto da do TSE: as duas usam a convenção pt-BR, e
# cópias separadas divergiriam. Apelido local porque é assim que este módulo lê melhor.
valor_brasileiro = normalizacao.valor_pt_br


# RISCO: Quando o parlamentar deixa o mandato, o SUPLENTE executa a emenda dele — e o Portal
#    passa a escrever o nome assim, citando o artigo da LDO que autoriza:
#
#      "TIAGO DIMAS (EX-PARLAMENTAR LAZARO BOTELHO, NOS TERMOS ART. 78 LDO 2025 ...)"
#
#    ATENÇÃO: Não é variação de grafia: é OUTRA PESSOA no lugar do autor.
_EX_PARLAMENTAR = re.compile(r"EX-PARLAMENTAR\s+([^,)]+)", re.IGNORECASE)


def autor_original(nome_autor: str | None) -> str | None:
    """O nome de quem APRESENTOU a emenda, quando o Portal cita o sucessor.

    DECISÃO: **Não é heurística de similaridade** — é ler um rótulo que a própria fonte
    escreve, com a base legal junto (art. 78 da LDO).

    ATENÇÃO: A emenda é do autor, não de quem a executa: a pergunta que a ficha responde é
    *"para onde ESTE parlamentar mandou dinheiro"*, e quem mandou foi quem apresentou.

    MEDIDO: Medido em 2026-08-29: **14** autores pendentes trazem o padrão, e em **12** o nome
    extraído casa com exatamente um deputado da 57ª — 229 emendas, R$ 656 mi.

    Devolve `None` quando não há o padrão, e quem chama segue com o nome original.
    """
    if not nome_autor:
        return None

    achado = _EX_PARLAMENTAR.search(nome_autor)
    if not achado:
        return None

    return " ".join(achado.group(1).split()) or None


def codigo_do_autor(codigo_emenda: str | None, numero: str | None) -> str | None:
    """Extrai o código do autor de dentro do código da emenda.

        202541840004
         │   │    └── número da emenda (tamanho VARIÁVEL)
         │   └─────── 4184 = o código do autor
         └─────────── ano

    RISCO: O corte usa o número do próprio registro, nunca posição fixa: recortar por
    índice erraria em silêncio, devolvendo o código de **outro** autor.

    DECISÃO: O arquivo traz o código do autor em coluna própria. O recorte continua como
    conferência: se os dois divergem, a fonte mudou de formato.
    """
    codigo = (codigo_emenda or "").strip()
    numero = (numero or "").strip()

    if not codigo or not numero or not codigo.endswith(numero):
        return None

    return codigo[4:-len(numero)] or None


CODIGOS_SEM_AUTOR = {"S/I", "-99"}
"""Os dois códigos que o Portal usa quando a emenda não tem autor parlamentar (achado #38)."""


def para_linhas(df: pd.DataFrame, anos: Iterable[int]) -> tuple[list[dict], dict[str, str]]:
    """Converte o CSV de emendas em linhas de `emendas`, e devolve o mapa código → nome.

    DECISÃO: **Nada é descartado por não ter dono.** Emenda de comissão, de bancada e de
    parlamentar de outra legislatura entra com `pessoa_id` nulo, e o vínculo é resolvido
    depois — perder o registro deixaria a reconciliação futura sem o que reconciliar.

    ATENÇÃO: O que se descarta é o registro **incoerente**: código do autor que não bate com o
    recorte do código da emenda. Medido em 2026-09-25: zero em 25.001 linhas de 2023–26.

    MEDIDO em 2026-10-02 (achado #38): em 2014–2020 há 17.810 linhas cujo autor é `S/I` ("Sem
    informação") ou `-99` ("RELATOR GERAL", em emendas de comissão).

    DECISÃO do autor (2026-10-02, Pendência 81): a linha `S/I` de **emenda de bancada** entra,
    com a bancada inferida pela UF da própria linha (`inferir_bancada`) e `autoria_inferida`
    verdadeiro. As outras sem autor (relator, comissão `-99`, individual de 2014) continuam
    fora, contadas no log.
    """
    anos = {str(a) for a in anos}
    bancadas = bancadas_por_uf(df)
    linhas: list[dict] = []
    inferidas: list[dict] = []
    autores: dict[str, str] = {}
    incoerentes = 0
    sem_autor = 0

    for r in df[df["Ano da Emenda"].isin(anos)].to_dict("records"):
        destino, bancada = destino_da_linha(r, bancadas)
        if destino == INFERIDA:
            inferidas.append(_linha(r, *bancada, codigo_emenda="", inferida=True))
            continue
        if destino == INCOERENTE:
            incoerentes += 1
            continue
        if destino != NA_BASE:
            sem_autor += 1
            continue

        codigo_emenda = r["Código da Emenda"].strip()
        codigo_autor = r["Código do Autor da Emenda"].strip()
        nome = r["Nome do Autor da Emenda"].strip()
        autores.setdefault(codigo_autor, nome)
        linhas.append(_linha(r, codigo_autor, nome, codigo_emenda=codigo_emenda, inferida=False))

    _numerar_inferidas(inferidas)
    for linha in inferidas:
        autores.setdefault(linha["codigo_autor"], linha["nome_autor"])

    if inferidas:
        log.info("  %d linhas de emenda de bancada sem autor no Portal, com a bancada inferida pela UF (Pendência 81)",
                 len(inferidas))
    if sem_autor:
        log.info("  %d emendas sem autor identificado no Portal (S/I, -99), fora da carga: achado #38", sem_autor)
    if incoerentes:
        log.warning("  %d emendas com código de autor incoerente — a fonte mudou?", incoerentes)

    return linhas + inferidas, autores


NA_BASE = "NA_BASE"
INFERIDA = "INFERIDA"
INCOERENTE = "INCOERENTE"
MOTIVOS_DE_FORA = ("RELATOR_SEM_AUTOR", "COMISSAO_SEM_AUTOR", "BANCADA_SEM_AUTOR_E_SEM_UF",
                   "INDIVIDUAL_SEM_AUTOR", "OUTRA_SEM_AUTOR", INCOERENTE)
"""Os motivos de uma linha do Portal ficar fora da base. A lista é o `CHECK` de `reconciliacao_motivos`."""


def destino_da_linha(r: dict, bancadas: dict[str, tuple[str, str]]) -> tuple[str, tuple[str, str] | None]:
    """Para onde vai uma linha do arquivo de emendas: a base, a base com autoria inferida, ou um motivo de ficar fora.

    É a mesma decisão para a carga e para a reconciliação (Pendência 81): se as duas usassem
    regras próprias, a conta deixaria de fechar no primeiro ajuste de uma delas.
    """
    codigo_emenda = (r.get("Código da Emenda") or "").strip()
    codigo_autor = (r.get("Código do Autor da Emenda") or "").strip()
    if codigo_do_autor(codigo_emenda, r.get("Número da emenda") or "") == codigo_autor:
        return NA_BASE, None
    if codigo_autor not in CODIGOS_SEM_AUTOR:
        return INCOERENTE, None

    tipo = r.get("Tipo de Emenda") or ""
    if codigo_autor == "S/I" and "Bancada" in tipo:
        bancada = inferir_bancada(r, bancadas)
        return (INFERIDA, bancada) if bancada else ("BANCADA_SEM_AUTOR_E_SEM_UF", None)
    if "Relator" in tipo:
        return "RELATOR_SEM_AUTOR", None
    if "Comiss" in tipo:
        return "COMISSAO_SEM_AUTOR", None
    if "Individual" in tipo:
        return "INDIVIDUAL_SEM_AUTOR", None
    return "OUTRA_SEM_AUTOR", None


def reconciliar_emendas(df: pd.DataFrame, anos: Iterable[int]) -> list[dict]:
    """Por ano da emenda, o empenhado e o pago: total do Portal, total que entra na base e o que fica fora, por motivo.

    A conta fecha por construção: toda linha do arquivo cai em exatamente um destino. O que
    a reconciliação acrescenta é deixar o motivo de cada real fora da base à vista, e permitir
    ao `conferir` notar se a base mudou depois.
    """
    anos = {str(a) for a in anos}
    bancadas = bancadas_por_uf(df)
    contas: dict[tuple[str, int], dict] = {}
    for r in df[df["Ano da Emenda"].isin(anos)].to_dict("records"):
        destino, _ = destino_da_linha(r, bancadas)
        for medida, coluna in (("EMPENHADO", "Valor Empenhado"), ("PAGO", "Valor Pago")):
            valor = valor_brasileiro(r[coluna])
            conta = contas.setdefault((medida, int(r["Ano da Emenda"])), _conta_vazia("EMENDAS", medida, int(r["Ano da Emenda"])))
            conta["total_na_fonte"] += valor
            if destino in (NA_BASE, INFERIDA):
                conta["total_na_base"] += valor
                if destino == INFERIDA:
                    conta["total_inferido"] += valor
            else:
                conta["motivos"][destino] = conta["motivos"].get(destino, 0.0) + valor
    return _arredondar(contas.values())


def reconciliar_pagamentos(df: pd.DataFrame, codigos: set[str], anos: Iterable[int]) -> list[dict]:
    """Por ano do pagamento, o recebido pelos favorecidos: o que entra na base e o que fica fora, por motivo.

    RISCO: `codigos` e `anos` são os que estão **no banco** depois da carga, e não só os da
    carga: uma carga de 2016–2020 não pode tratar como "não carregada" a emenda de 2023 que uma
    carga anterior gravou.

    | Motivo | O que é |
    |---|---|
    | `PAGAMENTO_SEM_CODIGO_DE_EMENDA` | O Portal publica o pagamento com "Sem informação" no lugar da emenda: não há a que ligá-lo |
    | `EMENDA_DE_ANO_NAO_CARREGADO` | A emenda é de um ano fora da carga (o pagamento de hoje de uma emenda de 2014, por exemplo) |
    | `EMENDA_FORA_DA_BASE` | A emenda é de ano carregado, mas ficou fora da base por um dos motivos de `reconciliar_emendas` |
    """
    anos_carregados = {str(a) for a in anos}
    contas: dict[tuple[str, int], dict] = {}
    for r in df.to_dict("records"):
        ano_do_pagamento = (r.get("Ano/Mês") or "")[:4]
        if ano_do_pagamento not in anos_carregados:
            continue
        codigo = (r.get("Código da Emenda") or "").strip()
        valor = valor_brasileiro(r["Valor Recebido"])
        conta = contas.setdefault(("RECEBIDO", int(ano_do_pagamento)), _conta_vazia("PAGAMENTOS", "RECEBIDO", int(ano_do_pagamento)))
        conta["total_na_fonte"] += valor
        if codigo in codigos:
            conta["total_na_base"] += valor
            continue
        if not codigo[:4].isdigit():
            motivo = "PAGAMENTO_SEM_CODIGO_DE_EMENDA"
        elif codigo[:4] not in anos_carregados:
            motivo = "EMENDA_DE_ANO_NAO_CARREGADO"
        else:
            motivo = "EMENDA_FORA_DA_BASE"
        conta["motivos"][motivo] = conta["motivos"].get(motivo, 0.0) + valor
    return _arredondar(contas.values())


PAGO_SEM_RECEBEDOR = "PAGO_SEM_RECEBEDOR"
RECEBIDO_ACIMA_DO_PAGO = "RECEBIDO_ACIMA_DO_PAGO"


def reconciliar_pago_e_recebido(emendas_da_base: Iterable[tuple[int, float, float]]) -> list[dict]:
    """Por ano da emenda, o pago do arquivo de emendas contra o recebido do arquivo de pagamentos.

    Os dois arquivos são do Portal e falam das mesmas emendas, mas não batem. MEDIDO (2026-10-09):
    nas emendas de 2025, 565 têm R$ 942,6 mi recebidos acima do pago e 608 têm R$ 257,3 mi pagos
    sem recebedor publicado. Cada arquivo fecha com a própria fonte (`EMENDAS` e `PAGAMENTOS`);
    este conjunto deixa à vista o quanto um difere do outro (regra 5).

    | Motivo | Valor | O que é |
    |---|---|---|
    | `PAGO_SEM_RECEBEDOR` | positivo | Emenda com pago acima do recebido: o pagamento ao favorecido não foi publicado, ou saiu depois do arquivo |
    | `RECEBIDO_ACIMA_DO_PAGO` | negativo | Emenda com recebido acima do pago: o arquivo de emendas registra menos do que os favorecidos receberam |

    A conta fecha por construção: pago = recebido + soma das diferenças, emenda a emenda.
    """
    contas: dict[int, dict] = {}
    for ano, pago, recebido in emendas_da_base:
        conta = contas.setdefault(ano, _conta_vazia("PAGO_X_RECEBIDO", "PAGO", ano))
        conta["total_na_fonte"] += pago
        conta["total_na_base"] += recebido
        diferenca = pago - recebido
        if diferenca > 0:
            conta["motivos"][PAGO_SEM_RECEBEDOR] = conta["motivos"].get(PAGO_SEM_RECEBEDOR, 0.0) + diferenca
        elif diferenca < 0:
            conta["motivos"][RECEBIDO_ACIMA_DO_PAGO] = conta["motivos"].get(RECEBIDO_ACIMA_DO_PAGO, 0.0) + diferenca
    return _arredondar(contas.values())


def _conta_vazia(conjunto: str, medida: str, ano: int) -> dict:
    return {"conjunto": conjunto, "medida": medida, "ano": ano, "total_na_fonte": 0.0,
            "total_na_base": 0.0, "total_inferido": 0.0, "motivos": {}}


def _arredondar(contas) -> list[dict]:
    """Centavos, como o banco grava. O resíduo de arredondamento fica abaixo de um centavo por motivo."""
    saida = []
    for conta in sorted(contas, key=lambda c: (c["conjunto"], c["medida"], c["ano"])):
        saida.append({
            **conta,
            "total_na_fonte": round(conta["total_na_fonte"], 2),
            "total_na_base": round(conta["total_na_base"], 2),
            "total_inferido": round(conta["total_inferido"], 2),
            "motivos": {m: round(v, 2) for m, v in conta["motivos"].items() if round(v, 2) != 0},
        })
    return saida


def bancadas_por_uf(df: pd.DataFrame) -> dict[str, tuple[str, str]]:
    """UF por extenso, sem acento → `(código, nome)` da bancada, tirado das linhas com autor do próprio arquivo.

    MEDIDO em 2026-10-02: 27 bancadas, um código cada, estável entre os anos ("BANCADA DA
    BAHIA" é sempre 7106).
    """
    mapa: dict[str, tuple[str, str]] = {}
    for r in df[df["Tipo de Emenda"].str.contains("Bancada", na=False)].to_dict("records"):
        codigo = r["Código do Autor da Emenda"].strip()
        if codigo in CODIGOS_SEM_AUTOR:
            continue
        nome = r["Nome do Autor da Emenda"].strip()
        estado = re.sub(r"^BANCADA D[AEO] ", "", normalizacao.sem_acento_maiusculo(nome))
        mapa.setdefault(estado, (codigo, nome))
    return mapa


def inferir_bancada(registro: dict, bancadas: dict[str, tuple[str, str]]) -> tuple[str, str] | None:
    """A bancada da emenda `S/I` de bancada, pela UF da linha. Nulo fora da emenda de bancada ou sem UF.

    MEDIDO em 2026-10-02, nas 2.279 emendas de bancada **com** autor e UF: a UF da linha é a da
    bancada em 97,1% das linhas (97,6% do valor). As exceções são repasses a entidade nacional
    registrados em "São Paulo (UF)".
    """
    if "Bancada" not in (registro.get("Tipo de Emenda") or ""):
        return None
    return bancadas.get(normalizacao.sem_acento_maiusculo(registro.get("UF")))


def _linha(r: dict, codigo_autor: str, nome: str, *, codigo_emenda: str, inferida: bool) -> dict:
    return {
        "codigo_autor": codigo_autor,
        "nome_autor": nome,
        "codigo_emenda": codigo_emenda,
        "ano": int(r["Ano da Emenda"]),
        "tipo": _texto(r["Tipo de Emenda"]),
        "localidade": _texto(r["Localidade de aplicação do recurso"]),
        "funcao": _texto(r["Nome Função"]),
        "subfuncao": _texto(r["Nome Subfunção"]),
        "codigo_municipio_ibge": _ibge(r["Código Município IBGE"]),
        "codigo_acao": _texto(r["Código Ação"]),
        "codigo_plano_orcamentario": _texto(r["Código Plano Orçamentário"]),
        "valor_empenhado": valor_brasileiro(r["Valor Empenhado"]),
        "valor_liquidado": valor_brasileiro(r["Valor Liquidado"]),
        "valor_pago": valor_brasileiro(r["Valor Pago"]),
        "valor_resto_pago": valor_brasileiro(r["Valor Restos A Pagar Pagos"]),
        "autoria_inferida": inferida,
    }


def _numerar_inferidas(inferidas: list[dict]) -> None:
    """Dá à linha inferida um código próprio: ano, código da bancada, "I" e a ordem dela.

    DECISÃO: A linha `S/I` não tem código de emenda, e a chave única pede um. O "I" separa o
    código inventado do código do Portal: nenhum código real tem letra, e a tela não monta
    link do Portal com ele. A ordem sai dos campos da própria linha, então a mesma carga dá
    os mesmos códigos.
    """
    por_bancada: dict[tuple[int, str], list[dict]] = {}
    for linha in inferidas:
        por_bancada.setdefault((linha["ano"], linha["codigo_autor"]), []).append(linha)
    for (ano, codigo), grupo in por_bancada.items():
        grupo.sort(key=lambda l: (l["codigo_acao"] or "", l["codigo_plano_orcamentario"] or "",
                                  l["localidade"] or "", l["valor_empenhado"], l["valor_pago"]))
        for ordem, linha in enumerate(grupo, 1):
            linha["codigo_emenda"] = f"{ano}{codigo}I{ordem:04d}"


# ═══════════════════════════════════════════════════════════════════
# Favorecidos — quem recebeu
# ═══════════════════════════════════════════════════════════════════

# RISCO: Os valores do CHECK `ck_favorecido_tipo`. O contrato com o EF é conferido em teste.
PESSOA_JURIDICA = TipoFavorecido.PESSOA_JURIDICA
UNIDADE_GESTORA = TipoFavorecido.UNIDADE_GESTORA
PESSOA = TipoFavorecido.PESSOA
SEM_INFORMACAO_TIPO = TipoFavorecido.SEM_INFORMACAO
TIPOS_DE_FAVORECIDO = (PESSOA_JURIDICA, UNIDADE_GESTORA, PESSOA, SEM_INFORMACAO_TIPO)

# RISCO: Natureza jurídica que traz nome de pessoa dentro da razão social. O CNPJ de um
#    empresário individual identifica a pessoa tanto quanto o CPF — e o nome vem junto.
NATUREZAS_DE_PESSOA = {"Empresário (Individual)", "Produtor Rural (Pessoa Física)"}

# ATENÇÃO: Raiz de CNPJ de quem recebe para repassar. Medido em 2026-09-24: o Banco do Brasil
#    aparece como favorecido de R$ 32,57 bi em emendas de 2023–26, sempre em Brasília —
#    ele não é o destino, é o caminho. A Caixa (R$ 0,73 bi) não entra aqui: sem medir o
#    que é tarifa e o que é repasse, chamá-la de intermediária seria palpite.
RAIZES_INTERMEDIARIAS = {"00000000"}


def classificar_favorecido(tipo: str, documento: str, natureza: str) -> str:
    """O tipo do favorecido, como `ck_favorecido_identificacao` o entende.

    DECISÃO: Tipo desconhecido vira `SEM_INFORMACAO`: o dinheiro fica, a identificação não.
    Uma categoria nova no Portal não derruba a carga, e não grava identificação que pode
    ser de pessoa.
    """
    doPortal = favorecido_do_portal(tipo)
    documento = documento.strip()

    if doPortal is TipoFavorecido.PESSOA:
        return PESSOA
    if doPortal is TipoFavorecido.PESSOA_JURIDICA and so_digitos(documento, 14):
        return PESSOA if natureza.strip() in NATUREZAS_DE_PESSOA else PESSOA_JURIDICA
    if doPortal is TipoFavorecido.UNIDADE_GESTORA and so_digitos(documento, 6):
        return UNIDADE_GESTORA

    return SEM_INFORMACAO_TIPO


def favorecidos_para_linhas(df: pd.DataFrame, codigos: set[str]) -> list[dict]:
    """Soma os pagamentos por emenda, mês e favorecido.

    RISCO: **Pessoa não é identificada, nem em hash.** O CPF já vem mascarado
    (`***.444.712-**`), e máscara não serve de chave; o nome vem em claro. A ficha só
    precisa do total que foi a pessoas — então nenhum dos dois é guardado.

    ATENÇÃO: Somar é obrigatório, não otimização: sem documento, duas pessoas do mesmo
    município no mesmo mês viram a mesma chave. Soma que dá zero sai — é estorno que
    anulou o pagamento, e `ck_favorecido_valor` o recusaria.
    """
    somas: dict[tuple, dict] = {}

    for r in df[df["Código da Emenda"].isin(codigos)].to_dict("records"):
        natureza = r["Natureza Jurídica"].strip()
        tipo = classificar_favorecido(r["Tipo Favorecido"], r["Código do Favorecido"], natureza)
        identificado = tipo in (PESSOA_JURIDICA, UNIDADE_GESTORA)
        documento = r["Código do Favorecido"].strip() if identificado else None

        linha = {
            "codigo_emenda": r["Código da Emenda"].strip(),
            "competencia": _competencia(r["Ano/Mês"]),
            "tipo": tipo,
            "documento": documento,
            "nome": r["Favorecido"].strip() if identificado else None,
            "natureza_juridica": _texto(natureza),
            "uf": _uf(r["UF Favorecido"]),
            "municipio": _texto(r["Município Favorecido"]),
            "intermediario": bool(documento) and tipo == PESSOA_JURIDICA
            and documento[:8] in RAIZES_INTERMEDIARIAS,
        }
        chave = (
            linha["codigo_emenda"], linha["competencia"], tipo, documento,
            linha["natureza_juridica"], linha["uf"], linha["municipio"],
        )

        atual = somas.setdefault(chave, {**linha, "valor": 0.0})
        atual["valor"] += valor_brasileiro(r["Valor Recebido"])

    return [s for s in somas.values() if round(s["valor"], 2) != 0]


# ═══════════════════════════════════════════════════════════════════
# Convênios — o objeto concreto
# ═══════════════════════════════════════════════════════════════════


def convenios_para_linhas(
    df: pd.DataFrame, codigos: set[str]
) -> tuple[list[dict], list[dict]]:
    """Separa os convênios da ligação emenda → convênio.

    RISCO: O valor é do **convênio inteiro**, repetido em cada emenda que o financia: um de
    R$ 80 mi aparece em 23. Por isso o convênio vira linha própria, uma vez só.

    DECISÃO: Medido em 2026-09-25: convenente, objeto, data e valor são os mesmos em todas as
    linhas de um mesmo número. O número identifica o convênio.
    """
    convenios: dict[str, dict] = {}
    ligacoes: set[tuple[str, str]] = set()

    for r in df[df["Código da Emenda"].isin(codigos)].to_dict("records"):
        numero = r["Número Convênio"].strip()
        valor = valor_brasileiro(r["Valor Convênio"])
        if not numero or valor <= 0:
            continue

        convenios.setdefault(
            numero,
            {
                "numero": numero,
                "convenente": r["Convenente"].strip(),
                "objeto": _texto(r["Objeto Convênio"]),
                "data_publicacao": _data_iso(r["Data Publicação Convênio"]),
                "valor": valor,
            },
        )
        ligacoes.add((r["Código da Emenda"].strip(), numero))

    return (
        list(convenios.values()),
        [{"codigo_emenda": c, "numero_convenio": n} for c, n in sorted(ligacoes)],
    )


def _texto(bruto: str | None) -> str | None:
    """Vazio e "Sem informação" viram nulo: os dois dizem que o dado não existe."""
    texto = (bruto or "").strip()
    return None if not texto or texto == SEM_INFORMACAO else texto


def _ibge(bruto: str | None) -> str | None:
    """Sete dígitos ou nada. O Portal escreve "Sem informação" quando o destino não é município."""
    texto = (bruto or "").strip()
    return texto if so_digitos(texto, 7) else None


def _uf(bruto: str | None) -> str | None:
    texto = (bruto or "").strip().upper()
    return texto if texto in UFS else None


def _competencia(bruto: str) -> str:
    """`"202609"` → `"2026-09-01"`: o mês, no primeiro dia, como o CHECK exige."""
    texto = bruto.strip()
    return f"{texto[:4]}-{texto[4:6]}-01"


def _data_iso(bruto: str) -> str:
    """`"16/01/2025"` → `"2025-01-16"`."""
    dia, mes, ano = bruto.strip().split("/")
    return f"{ano}-{mes}-{dia}"
