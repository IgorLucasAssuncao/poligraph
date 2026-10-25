"""Cota parlamentar — a despesa de gabinete de cada deputado (CEAP) e de cada senador (CEAPS).

## ENTRADA

| | Câmara | Senado |
|---|---|---|
| Contrato | `contratos.camara.LinhaDaCotaDaCamara` | `contratos.senado.LinhaDaCotaDoSenado` |
| Leitura | `fontes.camara.ler_cota` | `fontes.senado.ler_ceaps` |
| Tamanho | ~6,6 MB compactado, ~233 mil linhas por ano | ~16 mil linhas por ano |
| Decimal | **PONTO** | vírgula |
| Dono | `ideCadastro`, o id do deputado na Câmara | o nome do senador, normalizado |

ATENÇÃO: `GET /deputados/{id}/despesas` da API da Câmara responde **200** com `"dados": []`;
por isso a cota vem do arquivo em bloco.

## TRANSFORMAÇÃO

Cada linha vira uma `Despesa` ou um `Descarte` com motivo:

| Motivo | Quando |
|---|---|
| `SEM_PARLAMENTAR` | Câmara: linha sem `ideCadastro`, de liderança ou órgão (0,4%) |
| `FORA_DO_DE_PARA` | O id ou o nome não liga a ninguém da base |
| `VALOR_ZERO` | Linha sem efeito financeiro; violaria `ck_despesa_valor` |

A reconciliação (regra 5) soma os mesmos descartes: o que não entra na base aparece com o
motivo e o valor, e a regra de descarte existe num lugar só.

## SAÍDA

| | |
|---|---|
| Contrato | `contratos.banco.Despesa` → tabela `despesas` |
| Constraint do banco | `ck_despesa_valor` (`valor_liquido <> 0`) · FK `CASCADE` |
| Idempotência | `DELETE` por (pessoa, ano) antes do `INSERT` |

---

DECISÃO: Valor **negativo é estorno** e é mantido — somá-lo importa para o total.

RISCO: `txtCNPJCPF` e `CNPJ_CPF` misturam CNPJ de empresa com **CPF em claro** de pessoa física;
a RNF-13 proíbe o segundo. Hashear os dois destruiria a análise: sem CNPJ legível não dá para
cruzar o mesmo fornecedor entre parlamentares.

MEDIDO: [`docs/14-fontes-de-gasto.md §1`](../../../docs/14-fontes-de-gasto.md)
"""

from dataclasses import dataclass, field

from ..contratos.banco import Despesa
from ..contratos.camara import LinhaDaCotaDaCamara
from ..contratos.senado import LinhaDaCotaDoSenado
from ..nucleo.normalizacao import hash_de_cpf, inteiro, sem_acento_maiusculo, sem_cpf, valor_com_ponto

SEM_PARLAMENTAR = "SEM_PARLAMENTAR"
FORA_DO_DE_PARA = "FORA_DO_DE_PARA"
VALOR_ZERO = "VALOR_ZERO"

SEM_CATEGORIA = "SEM CATEGORIA"

_decimal_com_ponto = valor_com_ponto
"""RISCO: ponto DECIMAL, o oposto do Portal e do TSE. `valor_pt_br` aqui daria um total mil vezes
menor, sem erro: o apelido direto é o que impede a troca calada (`test_dinheiro`)."""


@dataclass(frozen=True)
class Descarte:
    """Uma linha da fonte que não entra na base, com o motivo e o valor que ela levava."""

    motivo: str
    valor: float


@dataclass
class Transformado:
    """O arquivo inteiro depois da transformação: o que entra e o que fica fora."""

    despesas: list[Despesa] = field(default_factory=list)
    descartes: list[Descarte] = field(default_factory=list)

    @property
    def total_na_fonte(self) -> float:
        return sum(d.valor_liquido for d in self.despesas) + sum(d.valor for d in self.descartes)


def despesa_da_camara(linha: LinhaDaCotaDaCamara, id_pessoa_por_id_na_camara: dict[str, int]) -> Despesa | Descarte:
    """Uma nota da Câmara como despesa da base, ou o motivo de ela ficar fora."""
    valor = _decimal_com_ponto(linha.valor_liquido)
    if not linha.id_deputado_na_camara:
        return Descarte(SEM_PARLAMENTAR, valor)

    id_pessoa = id_pessoa_por_id_na_camara.get(linha.id_deputado_na_camara)
    if id_pessoa is None:
        return Descarte(FORA_DO_DE_PARA, valor)
    if valor == 0:
        return Descarte(VALOR_ZERO, valor)

    documento, pessoa_fisica = identificar_fornecedor(linha.cnpj_ou_cpf_do_fornecedor)
    return Despesa(
        pessoa_id=id_pessoa,
        ano=inteiro(linha.ano_da_despesa),
        mes=inteiro(linha.mes_da_despesa),
        categoria=linha.categoria or SEM_CATEGORIA,
        fornecedor=sem_cpf(linha.fornecedor),
        cnpj_ou_hash=documento,
        fornecedor_eh_pessoa_fisica=pessoa_fisica,
        valor_liquido=valor,
        data_emissao=(linha.data_de_emissao or "")[:10] or None,
        url_documento=linha.url_do_documento,
    )


def despesa_do_senado(linha: LinhaDaCotaDoSenado, id_pessoa_por_nome: dict[str, int]) -> Despesa | Descarte:
    """Uma despesa da CEAPS como despesa da base, ou o motivo de ela ficar fora.

    A CEAPS não tem id de senador: o dono é o nome, normalizado sem acento e em caixa alta.
    Quem não casa fica fora: atribuir gasto por semelhança de nome seria inventar dono.
    """
    valor = _decimal_com_virgula(linha.valor_reembolsado)
    id_pessoa = id_pessoa_por_nome.get(sem_acento_maiusculo(linha.nome_do_senador))
    if id_pessoa is None:
        return Descarte(FORA_DO_DE_PARA, valor)
    if valor == 0:
        return Descarte(VALOR_ZERO, valor)

    documento, pessoa_fisica = identificar_fornecedor(linha.cnpj_ou_cpf_do_fornecedor)
    return Despesa(
        pessoa_id=id_pessoa,
        ano=inteiro(linha.ano_da_despesa),
        mes=inteiro(linha.mes_da_despesa),
        categoria=linha.categoria or SEM_CATEGORIA,
        fornecedor=sem_cpf(linha.fornecedor),
        cnpj_ou_hash=documento,
        fornecedor_eh_pessoa_fisica=pessoa_fisica,
        valor_liquido=valor,
        data_emissao=_data_iso(linha.data_da_despesa),
        url_documento=None,
    )


def transformar_camara(linhas: list[LinhaDaCotaDaCamara], id_pessoa_por_id_na_camara: dict[str, int]) -> Transformado:
    """O arquivo da Câmara inteiro, separado entre o que entra e o que fica fora."""
    return _separar(despesa_da_camara(linha, id_pessoa_por_id_na_camara) for linha in linhas)


def transformar_senado(linhas: list[LinhaDaCotaDoSenado], id_pessoa_por_nome: dict[str, int]) -> Transformado:
    """O arquivo da CEAPS inteiro, separado entre o que entra e o que fica fora."""
    return _separar(despesa_do_senado(linha, id_pessoa_por_nome) for linha in linhas)


def reconciliar(transformado: Transformado, conjunto: str, ano: int) -> dict:
    """O total da fonte, o que entrou na base e o que ficou fora, por motivo (regra 5).

    Sai do mesmo resultado que é gravado: fonte = base + motivos por construção, e o
    `conferir` ainda confere que a base não mudou depois.
    """
    motivos: dict[str, float] = {}
    for descarte in transformado.descartes:
        motivos[descarte.motivo] = motivos.get(descarte.motivo, 0.0) + descarte.valor
    return {
        "conjunto": conjunto,
        "medida": "VALOR_LIQUIDO",
        "ano": ano,
        "total_na_fonte": round(transformado.total_na_fonte, 2),
        "total_na_base": round(sum(d.valor_liquido for d in transformado.despesas), 2),
        "total_inferido": 0.0,
        "motivos": {m: round(v, 2) for m, v in motivos.items() if round(v, 2) != 0},
    }


def identificar_fornecedor(bruto: str | None) -> tuple[str | None, bool]:
    """Separa CNPJ de CPF e **hasheia o CPF** — a mesma regra de `receitas`.

    RISCO: Usa o mesmo HMAC de `pessoas.cpf_hash`, o que torna os dois lados comparáveis sem
    reverter nenhum deles.
    """
    digitos = "".join(caractere for caractere in (bruto or "") if caractere.isdigit())
    if not digitos:
        return None, False
    if len(digitos) == 11:
        return hash_de_cpf(digitos), True
    return digitos, False


def _separar(resultados) -> Transformado:
    transformado = Transformado()
    for resultado in resultados:
        if isinstance(resultado, Descarte):
            transformado.descartes.append(resultado)
        else:
            transformado.despesas.append(resultado)
    return transformado


def _decimal_com_virgula(bruto: str | None) -> float:
    """A CEAPS manda `399,44` e também `4000`, sem centavos, na mesma coluna."""
    return valor_com_ponto((bruto or "").replace(",", "."))


def _data_iso(bruto: str | None) -> str | None:
    """`dd/mm/aaaa` → `aaaa-mm-dd`. Devolve `None` para o que não converte."""
    partes = (bruto or "").strip().split("/")
    if len(partes) != 3 or not all(partes):
        return None
    dia, mes, ano = partes
    return f"{ano}-{mes.zfill(2)}-{dia.zfill(2)}"
