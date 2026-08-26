"""🔴 O contrato entre o EF e o Python.

O `CLAUDE.md` diz: **o EF é dono do schema, o Python nunca cria tabela.** Este arquivo
é o que faz essa frase valer alguma coisa.

⚠️ Foi escrito depois de o ETL passar por 104 testes verdes sem nunca conseguir falar
com o banco: o EF nomeia a tabela a partir do `DbSet`, que é plural (`votacoes`), e o
Python estava escrito no singular (`votacao`). **Todas as seis tabelas.** Os testes
passavam porque `test_persistencia.py` faz `CREATE TABLE` com os nomes que o próprio
Python usa — mediam consistência interna, não integração.

⭐ Este teste lê o `PoligraphDb.cs` de verdade. Não há como os dois lados divergirem
sem ele ficar vermelho, e ele não precisa de container nenhum para isso.
"""

import re
from pathlib import Path

import pytest

CONTEXTO = (
    Path(__file__).resolve().parents[2] / "Poligraph.Api" / "Data" / "PoligraphDb.cs"
)

RAIZ = Path(__file__).resolve().parents[1]

# ⚠️ Os testes entram na varredura de propósito. Foi exatamente no DDL de
#    `test_persistencia.py` que os nomes errados sobreviveram — varrer só o código de
#    produção deixaria o esconderijo original intacto.
FONTES_PYTHON = sorted(
    p
    for p in [*(RAIZ / "poligraph_etl").rglob("*.py"), *(RAIZ / "tests").rglob("*.py")]
    if p.name != Path(__file__).name
)

# ⚠️ `FROM data` aparece em `EXTRACT(YEAR FROM data)` — é coluna, não tabela.
NAO_SAO_TABELAS = {"data"}


def snake_case(nome: str) -> str:
    """Reproduz o `UseSnakeCaseNamingConvention()` do EF sobre o nome do DbSet.

    ⚠️ `PessoaFonteIds` → `pessoa_fonte_ids`, `NosMetrica` → `nos_metrica`.
    """
    return re.sub(r"(?<!^)(?=[A-Z])", "_", nome).lower()


def tabelas_do_ef() -> set[str]:
    fonte = CONTEXTO.read_text(encoding="utf-8")
    nomes = re.findall(r"public\s+DbSet<\w+>\s+(\w+)\s*=>", fonte)

    assert nomes, f"nenhum DbSet encontrado em {CONTEXTO} — o parser quebrou"
    return {snake_case(n) for n in nomes}


def tabelas_usadas_pelo_python() -> dict[str, list[str]]:
    """Tabela → arquivos que a citam, para o erro dizer onde consertar."""
    padrao = re.compile(
        r"\b(?:FROM|INTO|UPDATE|JOIN|CREATE\s+TABLE|REFERENCES|TRUNCATE)\s+"
        r"([a-z_][a-z0-9_]*)"
    )
    # ⚠️ `TRUNCATE a, b, c` só teria a primeira capturada pelo padrão acima. Esta
    #    segunda passada pega o resto da lista.
    lista_apos_truncate = re.compile(r"\bTRUNCATE\s+([a-z_,\s]+)", re.IGNORECASE)

    encontradas: dict[str, list[str]] = {}

    def anotar(tabela: str, arquivo: Path) -> None:
        if tabela and tabela not in NAO_SAO_TABELAS:
            encontradas.setdefault(tabela, []).append(arquivo.name)

    for arquivo in FONTES_PYTHON:
        texto = arquivo.read_text(encoding="utf-8")

        for tabela in padrao.findall(texto):
            anotar(tabela, arquivo)

        for lista in lista_apos_truncate.findall(texto):
            for tabela in lista.split(","):
                anotar(tabela.strip(), arquivo)

    return encontradas


def test_contexto_do_ef_existe():
    # ⚠️ Se o arquivo mudar de lugar, os testes abaixo passariam vazios e em silêncio.
    assert CONTEXTO.is_file(), f"não achei {CONTEXTO}"


def test_python_so_usa_tabelas_que_o_ef_criou():
    do_ef = tabelas_do_ef()
    usadas = tabelas_usadas_pelo_python()

    assert usadas, "o parser não achou SQL nenhum no ETL — verifique o padrão"

    orfas = {t: arqs for t, arqs in usadas.items() if t not in do_ef}

    assert not orfas, "\n".join(
        [
            "Tabela que o EF não cria — o ETL morreria com "
            '`relation "x" does not exist`:',
            *(f"  {t}  (em {', '.join(sorted(set(a)))})" for t, a in sorted(orfas.items())),
            "",
            f"O EF cria: {', '.join(sorted(do_ef))}",
        ]
    )


@pytest.mark.parametrize(
    ("dbset", "tabela"),
    [
        ("Votacoes", "votacoes"),
        ("Votos", "votos"),
        ("Pessoas", "pessoas"),
        ("PessoaFonteIds", "pessoa_fonte_ids"),
        ("Similaridades", "similaridades"),
        ("Execucoes", "execucoes"),
        ("ArestasGrafo", "arestas_grafo"),
        ("NosMetrica", "nos_metrica"),
    ],
)
def test_snake_case_reproduz_a_convencao_do_ef(dbset: str, tabela: str):
    """⭐ Conferido contra o banco em execução, não deduzido da documentação."""
    assert snake_case(dbset) == tabela
