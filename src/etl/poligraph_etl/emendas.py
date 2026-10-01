"""Emendas parlamentares — Portal da Transparência.

Responde *"para onde este parlamentar mandou dinheiro público, quanto de fato saiu, e
quem recebeu?"*.

## ENTRADA

| | |
|---|---|
| Fonte | Download `emendas-parlamentares/UNICO` — ver [`fontes/portal.py`](fontes/portal.py) |
| 🔑 Autenticação | ⛔ Nenhuma: o download é público. A API de dados pedia a chave pessoal |
| Conteúdo | Três CSVs, todos os anos desde 2014: emendas, favorecidos, convênios |
| Formato | Latin-1; valores em **pt-BR** (`"343000,00"`) |

## TRATAMENTO

1. **Emendas:** uma linha por emenda × localidade × ação × plano orçamentário — 55
   emendas de 2023–26 ocupam mais de uma. O código do autor vem em coluna própria e é
   conferido contra o recorte do `codigoEmenda`: divergência é sinal de que a fonte mudou
2. **Favorecidos:** somados por mês e por quem recebeu. Pessoa ⛔ não é identificada
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

🔴 **A chave é o CÓDIGO DO AUTOR, ⛔ não o nome.** O `codigoEmenda` embute um
identificador de **mandato**, estável dentro dele e válido para Câmara **e** Senado — que
é o motivo de tê-lo escolhido, já que o Senado ⛔ não publica CPF.

⭐ **`pessoa_id` sai NULO daqui.** Nada é descartado por não ter dono; o vínculo é
decisão de outro passo.

📐 [achado #24](../../../docs/achados/024-codigo-da-emenda-identifica-o-mandato.md) ·
📐 [achado #33](../../../docs/achados/033-o-destino-da-emenda.md)
"""

import logging
import re
from collections.abc import Iterable

import pandas as pd

from . import normalizacao

log = logging.getLogger("poligraph")

RECURSO = "emendas-parlamentares/UNICO"
ARQUIVO_EMENDAS = "EmendasParlamentares.csv"
ARQUIVO_FAVORECIDOS = "EmendasParlamentares_PorFavorecido.csv"
ARQUIVO_CONVENIOS = "EmendasParlamentares_Convenios.csv"

SEM_INFORMACAO = "Sem informação"

# A conversão vive em `normalizacao`, junto da do TSE: as duas usam a convenção pt-BR, e
# cópias separadas divergiriam. Apelido local porque é assim que este módulo lê melhor.
valor_brasileiro = normalizacao.valor_pt_br


# 🔴 Quando o parlamentar deixa o mandato, o SUPLENTE executa a emenda dele — e o Portal
#    passa a escrever o nome assim, citando o artigo da LDO que autoriza:
#
#      "TIAGO DIMAS (EX-PARLAMENTAR LAZARO BOTELHO, NOS TERMOS ART. 78 LDO 2025 ...)"
#
#    ⚠️ ⛔ Não é variação de grafia: é OUTRA PESSOA no lugar do autor.
_EX_PARLAMENTAR = re.compile(r"EX-PARLAMENTAR\s+([^,)]+)", re.IGNORECASE)


def autor_original(nome_autor: str | None) -> str | None:
    """O nome de quem APRESENTOU a emenda, quando o Portal cita o sucessor.

    ⭐ **⛔ Não é heurística de similaridade** — é ler um rótulo que a própria fonte
    escreve, com a base legal junto (art. 78 da LDO).

    ⚠️ A emenda é do autor, ⛔ não de quem a executa: a pergunta que a ficha responde é
    *"para onde ESTE parlamentar mandou dinheiro"*, e quem mandou foi quem apresentou.

    📐 Medido em 2026-08-29: **14** autores pendentes trazem o padrão, e em **12** o nome
    extraído casa com exatamente um deputado da 57ª — 229 emendas, R$ 656 mi.

    ⛔ Devolve `None` quando ⛔ não há o padrão, e quem chama segue com o nome original.
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

    🔴 O corte usa o número do próprio registro, ⛔ nunca posição fixa: recortar por
    índice erraria em silêncio, devolvendo o código de **outro** autor.

    ⭐ O arquivo traz o código do autor em coluna própria. O recorte continua como
    conferência: se os dois divergem, a fonte mudou de formato.
    """
    codigo = (codigo_emenda or "").strip()
    numero = (numero or "").strip()

    if not codigo or not numero or not codigo.endswith(numero):
        return None

    return codigo[4:-len(numero)] or None


def para_linhas(df: pd.DataFrame, anos: Iterable[int]) -> tuple[list[dict], dict[str, str]]:
    """Converte o CSV de emendas em linhas de `emendas`, e devolve o mapa código → nome.

    ⭐ **Nada é descartado por não ter dono.** Emenda de comissão, de bancada e de
    parlamentar de outra legislatura entra com `pessoa_id` nulo, e o vínculo é resolvido
    depois — perder o registro deixaria a reconciliação futura sem o que reconciliar.

    ⚠️ O que se descarta é o registro **incoerente**: código do autor que não bate com o
    recorte do código da emenda. Medido em 2026-09-25: zero em 25.001 linhas de 2023–26.
    """
    anos = {str(a) for a in anos}
    linhas: list[dict] = []
    autores: dict[str, str] = {}
    incoerentes = 0

    for r in df[df["Ano da Emenda"].isin(anos)].to_dict("records"):
        codigo_emenda = r["Código da Emenda"].strip()
        codigo_autor = r["Código do Autor da Emenda"].strip()

        if codigo_do_autor(codigo_emenda, r["Número da emenda"]) != codigo_autor:
            incoerentes += 1
            continue

        nome = r["Nome do Autor da Emenda"].strip()
        autores.setdefault(codigo_autor, nome)

        linhas.append(
            {
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
            }
        )

    if incoerentes:
        log.warning("  %d emendas com código de autor incoerente — a fonte mudou?", incoerentes)

    return linhas, autores


# ═══════════════════════════════════════════════════════════════════
# Favorecidos — quem recebeu
# ═══════════════════════════════════════════════════════════════════

# 🔴 Os valores do CHECK `ck_favorecido_tipo`. O contrato com o EF é conferido em teste.
PESSOA_JURIDICA = "PESSOA_JURIDICA"
UNIDADE_GESTORA = "UNIDADE_GESTORA"
PESSOA = "PESSOA"
SEM_INFORMACAO_TIPO = "SEM_INFORMACAO"
TIPOS_DE_FAVORECIDO = (PESSOA_JURIDICA, UNIDADE_GESTORA, PESSOA, SEM_INFORMACAO_TIPO)

# 🔴 Natureza jurídica que traz nome de pessoa dentro da razão social. O CNPJ de um
#    empresário individual identifica a pessoa tanto quanto o CPF — e o nome vem junto.
NATUREZAS_DE_PESSOA = {"Empresário (Individual)", "Produtor Rural (Pessoa Física)"}

# ⚠️ Raiz de CNPJ de quem recebe para repassar. Medido em 2026-09-24: o Banco do Brasil
#    aparece como favorecido de R$ 32,57 bi em emendas de 2023–26, sempre em Brasília —
#    ele ⛔ não é o destino, é o caminho. A Caixa (R$ 0,73 bi) ⛔ entra aqui: sem medir o
#    que é tarifa e o que é repasse, chamá-la de intermediária seria palpite.
RAIZES_INTERMEDIARIAS = {"00000000"}


def classificar_favorecido(tipo: str, documento: str, natureza: str) -> str:
    """O tipo do favorecido, como `ck_favorecido_identificacao` o entende.

    ⭐ Tipo desconhecido vira `SEM_INFORMACAO`: o dinheiro fica, a identificação ⛔ não.
    Uma categoria nova no Portal ⛔ derruba a carga, e ⛔ grava identificação que pode
    ser de pessoa.
    """
    tipo = tipo.strip()
    documento = documento.strip()

    if tipo in ("Pessoa Fisica", "Pessoa Física") or tipo.startswith("Inscrição Gen"):
        return PESSOA
    if tipo == "Pessoa Jurídica" and re.fullmatch(r"\d{14}", documento):
        return PESSOA if natureza.strip() in NATUREZAS_DE_PESSOA else PESSOA_JURIDICA
    if tipo == "Unidade Gestora" and re.fullmatch(r"\d{6}", documento):
        return UNIDADE_GESTORA

    return SEM_INFORMACAO_TIPO


def favorecidos_para_linhas(df: pd.DataFrame, codigos: set[str]) -> list[dict]:
    """Soma os pagamentos por emenda, mês e favorecido.

    🔴 **Pessoa ⛔ não é identificada, nem em hash.** O CPF já vem mascarado
    (`***.444.712-**`), e máscara ⛔ serve de chave; o nome vem em claro. A ficha só
    precisa do total que foi a pessoas — então nenhum dos dois é guardado.

    ⚠️ Somar é obrigatório, ⛔ não otimização: sem documento, duas pessoas do mesmo
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

    🔴 O valor é do **convênio inteiro**, repetido em cada emenda que o financia: um de
    R$ 80 mi aparece em 23. Por isso o convênio vira linha própria, uma vez só.

    ⭐ Medido em 2026-09-25: convenente, objeto, data e valor são os mesmos em todas as
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
    """Vazio e "Sem informação" viram nulo: os dois dizem que o dado ⛔ existe."""
    texto = (bruto or "").strip()
    return None if not texto or texto == SEM_INFORMACAO else texto


def _ibge(bruto: str | None) -> str | None:
    """Sete dígitos ou nada. O Portal escreve "Sem informação" quando o destino ⛔ é município."""
    texto = (bruto or "").strip()
    return texto if re.fullmatch(r"\d{7}", texto) else None


def _uf(bruto: str | None) -> str | None:
    texto = (bruto or "").strip().upper()
    return texto if re.fullmatch(r"[A-Z]{2}", texto) else None


def _competencia(bruto: str) -> str:
    """`"202609"` → `"2026-09-01"`: o mês, no primeiro dia, como o CHECK exige."""
    texto = bruto.strip()
    return f"{texto[:4]}-{texto[4:6]}-01"


def _data_iso(bruto: str) -> str:
    """`"16/01/2025"` → `"2025-01-16"`."""
    dia, mes, ano = bruto.strip().split("/")
    return f"{ano}-{mes}-{dia}"
