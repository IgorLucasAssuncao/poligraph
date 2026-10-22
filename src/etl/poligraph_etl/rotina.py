"""ROTINA — a carga agendada (Pendência 64): o que roda toda semana e todo mês, e em que ordem.

Sem ela, a ETL roda à mão, e qualquer "o que mudou" (Pendência 63) seria o que mudou desde a última
vez que alguém apertou o botão. Este módulo só DECIDE as etapas; quem as executa é o
`__main__`, com os mesmos comandos que já existem.

| Frequência | Etapas |
|---|---|
| `semanal` | `ingerir`, `senado`, `em-exercicio` (a lista oficial de quem está no mandato) e `simbolicas` do ano corrente, `palavras-chave` das novas, `conferir` |
| `mensal` | as da semanal, `cota`, `emendas`, `sedes-brasilapi` (CNPJs novos das emendas), `convenios`, `governo`, `defesa-civil`, `compras-centralizadas`, `viagens`, `compras`, `sancoes`, `populacao`, `analisar` das duas casas, `conferir` |
| mensal de jan, abr, jul e out | também `municipios`: o cadastro de CNPJ da Receita, gigabytes, uma vez por trimestre |
| mensal de nov e dez de ano de eleição geral | também `mandatos`, `fundo`, `patrimonio` e `redes` da eleição: o TSE fecha a prestação de contas depois do segundo turno |
| mensal de nov e dez de ano de eleição municipal | também `mandatos`, `fundo`, `patrimonio` e `redes` da eleição: os prefeitos e vices eleitos, e a campanha deles (Pendência 90) |
| mensal de maio | também `siconfi` do ano anterior: o município declara a DCA ao Tesouro até 30 de abril (Pendência 90, fase 5) |
| toda rotina, depois do `conferir` | `limpar-cache`: as regras de `limpeza` (2026-10-15) |

DECISÃO (2026-10-03, auditoria das fontes): toda fonte periódica que o site mostra entra aqui, no
ritmo em que a fonte muda. Fica fora só a malha do IBGE dos mapas, que é arquivo do front
(`web/public/malhas`) e se regenera uma vez por ano com `python -m poligraph_etl.malhas`.

DECISÃO: a janela é a do dado, não a do relógio (plano/09 §4.1). Em janeiro e fevereiro o ano
anterior ainda recebe dado: a Câmara regera os arquivos de votação de todos os anos, a nota
de dezembro chega à cota com semanas de atraso, e a emenda do ano passado continua sendo
paga. Nesses meses o ano anterior entra junto.

ATENÇÃO: no VPS quem agenda é o Coolify (tarefa agendada no contêiner da ETL); o Aspire é só
desenvolvimento. O comando agendado é `python -m poligraph_etl rotina --frequencia semanal`.
"""

from dataclasses import dataclass, field
from datetime import date
from .tipos import TipoCasa

FREQUENCIAS = ("semanal", "mensal")

MESES_QUE_OLHAM_O_ANO_ANTERIOR = 2

MESES_DO_CADASTRO_DA_RECEITA = (1, 4, 7, 10)

MESES_DEPOIS_DA_ELEICAO = (11, 12)

PRIMEIRA_ELEICAO_GERAL = 2002

INTERVALO_ENTRE_ELEICOES_GERAIS = 4


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

    `limpar-cache` vem depois dele: rotina que falhou deixa o cache como estava, para a
    próxima reaproveitar o que já foi baixado.
    """
    if frequencia not in FREQUENCIAS:
        raise ValueError(f"Frequência desconhecida: {frequencia}. Use {' ou '.join(FREQUENCIAS)}.")

    anos = anos_com_dado_novo(hoje)
    lista = [
        Etapa("ingerir", {"anos": anos}),
        Etapa("senado", {"anos": anos}),
        Etapa("em-exercicio"),
        Etapa("simbolicas", {"anos": anos}),
        Etapa("palavras-chave"),
    ]

    if frequencia == "mensal":
        lista += [
            Etapa("cota", {"anos": anos}),
            Etapa("emendas", {"anos": anos}),
            Etapa("sedes-brasilapi"),
            Etapa("convenios"),
            Etapa("governo", {"anos": anos, "eleicao": ultima_eleicao_geral(hoje)}),
            Etapa("defesa-civil", {"anos": anos}),
            Etapa("compras-centralizadas", {"anos": anos}),
            Etapa("viagens", {"anos": anos}),
            Etapa("compras", {"anos": anos}),
            Etapa("sancoes"),
            Etapa("populacao"),
        ]
        if hoje.month in MESES_DO_CADASTRO_DA_RECEITA:
            lista.append(Etapa("municipios"))
        if hoje.month == MES_DA_DCA:
            lista.append(Etapa("siconfi", {"anos": [hoje.year - 1]}))
        if hoje.year % 2 == 0 and hoje.month in MESES_DEPOIS_DA_ELEICAO:
            lista.append(Etapa("mandatos", {"eleicoes": [hoje.year]}))
            lista.append(Etapa("fundo", {"eleicao": hoje.year}))
            lista += [
                Etapa("patrimonio", {"anos": [hoje.year]}),
                Etapa("redes", {"anos": [hoje.year]}),
            ]
        lista += [
            Etapa("analisar", {"casa": TipoCasa.CAMARA}),
            Etapa("analisar", {"casa": TipoCasa.SENADO}),
        ]

    lista += [Etapa("conferir"), Etapa("limpar-cache")]
    return lista


MES_DA_DCA = 5
"""Maio: o prazo da Declaração de Contas Anuais ao Tesouro é 30 de abril (LC 101/2000, art. 51, § 1º, I)."""


def anos_com_dado_novo(hoje: date) -> list[int]:
    """O ano corrente e, em janeiro e fevereiro, o anterior."""
    if hoje.month <= MESES_QUE_OLHAM_O_ANO_ANTERIOR:
        return [hoje.year - 1, hoje.year]
    return [hoje.year]


def eh_ano_de_eleicao_geral(ano: int) -> bool:
    """Presidente, governador, senador e deputado: 2018, 2022, 2026..."""
    return ano >= PRIMEIRA_ELEICAO_GERAL and (ano - PRIMEIRA_ELEICAO_GERAL) % INTERVALO_ENTRE_ELEICOES_GERAIS == 0


def ultima_eleicao_geral(hoje: date) -> int:
    """A eleição que deu o governo em exercício: a de outubro só vale a partir do janeiro seguinte."""
    ano = hoje.year - 1
    while not eh_ano_de_eleicao_geral(ano):
        ano -= 1
    return ano
