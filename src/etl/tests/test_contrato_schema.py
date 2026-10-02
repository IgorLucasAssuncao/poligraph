"""RISCO: O contrato entre o EF e o Python.

O `CLAUDE.md` diz: **o EF é dono do schema, o Python nunca cria tabela.** Este arquivo
é o que faz essa frase valer alguma coisa.

ATENÇÃO: Foi escrito depois de o ETL passar por 104 testes verdes sem nunca conseguir falar
com o banco: o EF nomeia a tabela a partir do `DbSet`, que é plural (`votacoes`), e o
Python estava escrito no singular (`votacao`). **Todas as seis tabelas.** Os testes
passavam porque `test_persistencia.py` faz `CREATE TABLE` com os nomes que o próprio
Python usa — mediam consistência interna, não integração.

DECISÃO: Este teste lê o `PoligraphDb.cs` de verdade. Não há como os dois lados divergirem
sem ele ficar vermelho, e ele não precisa de container nenhum para isso.
"""

import re
from pathlib import Path

import pytest

_DATA = Path(__file__).resolve().parents[2] / "Poligraph.Data" / "Data"

CONTEXTO = _DATA / "PoligraphDb.cs"

# As entidades eram um arquivo só; agora são uma por arquivo, em Data/Entidades/.
ENTIDADES = sorted((_DATA / "Entidades").glob("*.cs"))


def fonte_das_entidades() -> str:
    """Concatena as classes de entidade, que hoje moram uma por arquivo."""
    assert ENTIDADES, f"nenhuma entidade em {_DATA / 'Entidades'} — o caminho mudou?"
    return chr(10).join(p.read_text(encoding="utf-8") for p in ENTIDADES)

RAIZ = Path(__file__).resolve().parents[1]

# ATENÇÃO: Os testes entram na varredura de propósito. Foi exatamente no DDL de
#    `test_persistencia.py` que os nomes errados sobreviveram — varrer só o código de
#    produção deixaria o esconderijo original intacto.
FONTES_PYTHON = sorted(
    p
    for p in [*(RAIZ / "poligraph_etl").rglob("*.py"), *(RAIZ / "tests").rglob("*.py")]
    if p.name != Path(__file__).name
)

# ATENÇÃO: `FROM data` aparece em `EXTRACT(YEAR FROM data)` — é coluna, não tabela.
NAO_SAO_TABELAS = {"data"}

PADRAO_TABELA = re.compile(
    # ATENÇÃO: `(?<!DISTINCT )` — em `e.pessoa_id IS DISTINCT FROM a.pessoa_id` o `FROM`
    #    não introduz tabela nenhuma; é operador de comparação.
    # ATENÇÃO: `(?!\.)` — `FROM a.pessoa_id` é referência a ALIAS. Sem isto o parser acusava
    #    uma tabela chamada `a`, que ninguém jamais criaria.
    r"(?<!DISTINCT )"
    r"\b(?:FROM|INTO|UPDATE|JOIN|CREATE\s+TABLE|REFERENCES|TRUNCATE)\s+"
    r"([a-z_][a-z0-9_]*)(?!\.)"
)

# ATENÇÃO: `TRUNCATE a, b, c` só teria a primeira capturada pelo padrão acima. Esta segunda
#    passada pega o resto da lista.
PADRAO_TRUNCATE = re.compile(r"\bTRUNCATE\s+([a-z_,\s]+)", re.IGNORECASE)


def snake_case(nome: str) -> str:
    """Reproduz o `UseSnakeCaseNamingConvention()` do EF sobre o nome do DbSet.

    ATENÇÃO: `PessoaFonteIds` → `pessoa_fonte_ids`, `NosMetrica` → `nos_metrica`.
    """
    return re.sub(r"(?<!^)(?=[A-Z])", "_", nome).lower()


def tabelas_do_ef() -> set[str]:
    fonte = CONTEXTO.read_text(encoding="utf-8")
    nomes = re.findall(r"public\s+DbSet<\w+>\s+(\w+)\s*=>", fonte)

    assert nomes, f"nenhum DbSet encontrado em {CONTEXTO} — o parser quebrou"
    return {snake_case(n) for n in nomes}


def tabelas_usadas_pelo_python() -> dict[str, list[str]]:
    """Tabela → arquivos que a citam, para o erro dizer onde consertar."""
    padrao = PADRAO_TABELA
    lista_apos_truncate = PADRAO_TRUNCATE

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
    # ATENÇÃO: Se o arquivo mudar de lugar, os testes abaixo passariam vazios e em silêncio.
    assert CONTEXTO.is_file(), f"não achei {CONTEXTO}"
    assert ENTIDADES, f"nenhuma entidade em {_DATA / 'Entidades'}"


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


def test_o_parser_de_tabelas_nao_ficou_cego():
    """RISCO: A guarda das exclusões.

    ATENÇÃO: Toda exceção adicionada a um parser de detecção é uma chance de ele parar de
    detectar. Este teste fixa os dois lados: o que não **não** é tabela continua fora, e
    o que **é** continua dentro. Sem ele, apagar o corpo do padrão deixaria o contrato
    verde e inútil.
    """
    achadas = lambda sql: set(PADRAO_TABELA.findall(sql))  # noqa: E731

    # Não O que não é tabela
    assert achadas("WHERE e.pessoa_id IS DISTINCT FROM a.pessoa_id") == set()
    assert achadas("SELECT pessoa_id FROM autores_de_emenda a WHERE a.x = 1") == {
        "autores_de_emenda"
    }

    # RISCO: O caso que não **não** é coberto pelo `(?!\.)`: comparação sem alias. Aqui
    #    `valor_pago` é COLUNA, e sem o `(?<!DISTINCT )` o parser a acusaria de tabela
    #    inexistente. A mutação que apagou o lookbehind passou até esta linha existir.
    assert achadas("WHERE valor_empenhado IS DISTINCT FROM valor_pago") == set()

    # RISCO: E o caso que justifica o `(?!\.)`: `EXTRACT(YEAR FROM d.data)`. O `data` solto
    #    já estava em `NAO_SAO_TABELAS`, mas qualificado por alias ele escaparia da
    #    lista e viraria uma tabela `d`. Esta linha matou a segunda mutação.
    assert achadas("SELECT EXTRACT(YEAR FROM d.data) FROM despesas d") == {"despesas"}

    # DECISÃO: O que é — e precisa continuar sendo pego
    assert achadas("INSERT INTO emendas (ano)") == {"emendas"}
    assert achadas("UPDATE pessoas SET cpf_hash = %s") == {"pessoas"}
    assert achadas("JOIN pessoa_fonte_ids ON") == {"pessoa_fonte_ids"}
    assert achadas("SELECT * FROM tabela_que_nao_existe") == {"tabela_que_nao_existe"}


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
    """DECISÃO: Conferido contra o banco em execução, não deduzido da documentação."""
    assert snake_case(dbset) == tabela


# ═══════════════════════════════════════════════════════════════════
# RISCO: As COLUNAS — a lacuna da PL37, fechada depois de morder duas vezes
# ═══════════════════════════════════════════════════════════════════


def snake_case_de_propriedade(nome: str) -> str:
    """O `UseSnakeCaseNamingConvention()` do EF sobre o nome de uma propriedade.

    RISCO: A regra quebra por MAIÚSCULA, não por dígito. `Componente1` vira
    `componente1`, **sem** underscore antes do `1` — escrever `componente_1` no SQL do
    Python dá `UndefinedColumn`, e foi o que aconteceu.
    """
    return re.sub(r"(?<!^)(?=[A-Z])", "_", nome).lower()


def colunas_do_ef() -> dict[str, set[str]]:
    """Tabela → colunas, lidas das classes de entidade."""
    fonte = fonte_das_entidades()

    # DbSet<Entidade> Nome  →  qual classe vira qual tabela
    contexto = CONTEXTO.read_text(encoding="utf-8")
    tabela_de = {
        classe: snake_case(dbset)
        for classe, dbset in re.findall(r"public\s+DbSet<(\w+)>\s+(\w+)\s*=>", contexto)
    }

    por_tabela: dict[str, set[str]] = {}
    for classe, corpo in re.findall(
        r"public class (\w+)\s*\{(.*?)\n\}", fonte, re.DOTALL
    ):
        tabela = tabela_de.get(classe)
        if not tabela:
            continue

        # ATENÇÃO: `public required string NomeCivil` tem DOIS termos antes do nome. Sem
        #    aceitar modificadores, toda propriedade `required` sumia — e o teste
        #    acusava colunas legítimas como inexistentes.
        propriedades = re.findall(
            r"public\s+(?:required\s+|virtual\s+)*[\w<>?\[\],\s]+?\s+(\w+)\s*\{\s*get;",
            corpo,
        )
        por_tabela[tabela] = {snake_case_de_propriedade(p) for p in propriedades}

    return por_tabela


def test_o_parser_de_colunas_funciona():
    # ATENÇÃO: Sem esta guarda, um parser quebrado faria os testes abaixo passarem vazios.
    colunas = colunas_do_ef()

    assert "nos_metrica" in colunas
    assert "componente1" in colunas["nos_metrica"]
    assert "componente_1" not in colunas["nos_metrica"]


def test_o_sql_do_etl_so_usa_colunas_que_o_ef_cria():
    """RISCO: Fecha a lacuna que deixou `componente_1` passar.

    ATENÇÃO: Confere só as colunas dos INSERTs, que é onde o erro é fatal e silencioso até a
    execução. Cobrir todo SELECT exigiria um parser de SQL de verdade.
    """
    do_ef = colunas_do_ef()
    padrao = re.compile(r"INSERT INTO\s+(\w+)\s*\(([^)]*)\)", re.IGNORECASE)

    erros: list[str] = []
    for arquivo in FONTES_PYTHON:
        texto = arquivo.read_text(encoding="utf-8")

        for tabela, lista in padrao.findall(texto):
            conhecidas = do_ef.get(tabela)
            if not conhecidas:
                continue

            for coluna in lista.split(","):
                # ATENÇÃO: tira comentários SQL de dentro da lista de colunas
                coluna = re.sub(r"--.*", "", coluna).strip()
                if coluna and coluna not in conhecidas:
                    erros.append(f"{arquivo.name}: {tabela}.{coluna}")

    assert not erros, "Coluna que o EF não cria:\n  " + "\n  ".join(erros)


# ═══════════════════════════════════════════════════════════════════
# RISCO: Os VALORES combinados entre C# e Python
# ═══════════════════════════════════════════════════════════════════
#
# ATENÇÃO: Nome de tabela e de coluna já estão cobertos acima. Falta a terceira forma de os
# dois lados divergirem: um **literal** que o Python grava e o C# compara.


def constantes_do_ef() -> dict[str, str]:
    """`public const string Nome = "VALOR";` lidos das entidades."""
    fonte = fonte_das_entidades()
    achadas = dict(
        re.findall(r'public\s+const\s+string\s+(\w+)\s*=\s*"([^"]*)"', fonte)
    )

    assert achadas, "nenhuma `const string` encontrada — o parser quebrou"
    return achadas


def test_o_nome_dos_fundos_e_o_mesmo_dos_dois_lados():
    """RISCO: O ETL GRAVA o texto; a API COMPARA com ele.

    ATENÇÃO: Uma letra de diferença faria `FundoEspecial` somar **zero** na ficha — número
    plausível, nenhuma exceção, e a conclusão do TCC sairia errada. Não há
    `CHECK` que pegue isto: qualquer texto é um valor válido na coluna.

    DECISÃO: E os dois fundos precisam continuar DIFERENTES entre si.
    """
    from poligraph_etl import receitas

    do_ef = constantes_do_ef()

    assert do_ef["FonteFundoEspecial"] == receitas.FUNDO_ESPECIAL
    assert do_ef["FonteFundoPartidario"] != do_ef["FonteFundoEspecial"]


def test_o_metodo_de_reconciliacao_respeita_o_check():
    """RISCO: `ck_autor_metodo` só aceita três valores.

    ATENÇÃO: O Python passa o método como string literal. Um valor fora do domínio derruba o
    lote inteiro no banco — e só na execução real, nunca no teste unitário.
    """
    permitidos = {"AUTOMATICO", "MANUAL", "NAO_RESOLVIDO"}

    # ATENÇÃO: Ancorado no NOME da constraint. Há três `metodo IN (...)` no contexto — em
    #    `pessoa_fonte_ids`, aqui e na correlação de notícias — e pegar "a primeira"
    #    comparava o domínio errado.
    fonte = CONTEXTO.read_text(encoding="utf-8")
    achado = re.search(r'"ck_autor_metodo"[^)]*?metodo IN \(([^)]*)\)', fonte, re.DOTALL)

    assert achado, "`ck_autor_metodo` não encontrada — a constraint sumiu ou mudou de nome"
    do_check = set(achado.group(1).replace("'", "").split(","))

    assert do_check == permitidos

    usados = set()
    for arquivo in FONTES_PYTHON:
        usados |= set(
            re.findall(
                r'resolver_autor\([^)]*?"(\w+)"\s*\)',
                arquivo.read_text(encoding="utf-8"),
                re.DOTALL,
            )
        )

    assert usados, "nenhuma chamada a `resolver_autor` encontrada — o parser quebrou"
    assert usados <= permitidos, f"método fora do CHECK: {usados - permitidos}"


def test_o_tipo_de_favorecido_respeita_o_check():
    """RISCO: `ck_favorecido_tipo` e o Python precisam falar os mesmos quatro valores.

    ATENÇÃO: Um valor a mais no Python derruba o lote no banco; um a menos deixa um tipo que o
    banco aceita e o ETL nunca grava — e a tela, que agrupa por ele, mostra zero.
    """
    from poligraph_etl import emendas

    fonte = CONTEXTO.read_text(encoding="utf-8")
    achado = re.search(r'"ck_favorecido_tipo",\s*"tipo IN \(([^)]*)\)', fonte)

    assert achado, "`ck_favorecido_tipo` não encontrada — a constraint sumiu ou mudou de nome"
    do_check = set(achado.group(1).replace("'", "").split(","))

    assert do_check == set(emendas.TIPOS_DE_FAVORECIDO)
