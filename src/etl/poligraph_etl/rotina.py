"""ROTINA — a carga agendada (Pendência 64): o que roda toda semana e todo mês, e em que ordem.

Sem ela, a ETL roda à mão, e qualquer "o que mudou" (Pendência 63) seria o que mudou desde a última
vez que alguém apertou o botão. Este módulo só DECIDE as etapas; quem as executa é o
`__main__`, com os mesmos comandos que já existem.

| Frequência | Etapas |
|---|---|
| `semanal` | `ingerir` e `senado` do ano corrente, `palavras-chave` das novas, `conferir` |
| `mensal` | as da semanal, `cota`, `emendas`, `analisar` das duas casas, `conferir` |

DECISÃO: a janela é a do dado, não a do relógio (plano/09 §4.1). Em janeiro e fevereiro o ano
anterior ainda recebe dado: a Câmara regera os arquivos de votação de todos os anos, a nota
de dezembro chega à cota com semanas de atraso, e a emenda do ano passado continua sendo
paga. Nesses meses o ano anterior entra junto.

ATENÇÃO: no VPS quem agenda é o Coolify (tarefa agendada no contêiner da ETL); o Aspire é só
desenvolvimento. O comando agendado é `python -m poligraph_etl rotina --frequencia semanal`.
"""

from dataclasses import dataclass, field
from datetime import date

FREQUENCIAS = ("semanal", "mensal")

MESES_QUE_OLHAM_O_ANO_ANTERIOR = 2


@dataclass(frozen=True)
class Etapa:
    """Um comando da ETL com os argumentos dele."""

    comando: str
    argumentos: dict = field(default_factory=dict)

    def __str__(self) -> str:
        partes = [self.comando]
        for chave, valor in self.argumentos.items():
            partes.append(f"--{chave}")
            partes.extend(str(v) for v in (valor if isinstance(valor, list) else [valor]))
        return " ".join(partes)


def etapas(frequencia: str, hoje: date) -> list[Etapa]:
    """As etapas da rotina, na ordem em que rodam.

    `conferir` fecha toda rotina: ERRO derruba o comando, e o Coolify mostra a tarefa como
    falha. Na mensal ele roda uma vez só, no fim, depois da análise.
    """
    if frequencia not in FREQUENCIAS:
        raise ValueError(f"Frequência desconhecida: {frequencia}. Use {' ou '.join(FREQUENCIAS)}.")

    anos = anos_com_dado_novo(hoje)
    lista = [
        Etapa("ingerir", {"anos": anos}),
        Etapa("senado", {"anos": anos}),
        Etapa("palavras-chave"),
    ]

    if frequencia == "mensal":
        lista += [
            Etapa("cota", {"anos": anos}),
            Etapa("emendas", {"anos": anos}),
            Etapa("analisar", {"casa": "CAMARA"}),
            Etapa("analisar", {"casa": "SENADO"}),
        ]

    lista.append(Etapa("conferir"))
    return lista


def anos_com_dado_novo(hoje: date) -> list[int]:
    """O ano corrente e, em janeiro e fevereiro, o anterior."""
    if hoje.month <= MESES_QUE_OLHAM_O_ANO_ANTERIOR:
        return [hoje.year - 1, hoje.year]
    return [hoje.year]
