"""TRATAMENTO — as regras puras, e só elas.

Funções puras de propósito: ⛔ não tocam banco nem rede, e são o que os testes unitários
cobrem. Cada uma nasceu de uma medição do discovery que virou regra.

| O que resolve | Por que existe |
|---|---|
| Domínio fechado do voto | ⚠️ "Obstrução" ⛔ **não** é abstenção — vira `None`, fora do cálculo |
| Categoria da votação | Define o **peso** na matriz de similaridade |
| 🔴 Polaridade | Em 14% das nominais "Sim" significa **rejeitar** |
| Hash de CPF | RNF-13 — normaliza **antes** de hashear, senão os lados ⛔ não casam |
| Dinheiro | 🔴 **Duas convenções incompatíveis** convivem: `"1.234"` vale 1234 numa e 1,234 na outra |
"""

import hashlib
import re
import unicodedata

# ═══════════════════════════════════════════════════════════════════
# RN-03 — domínio fechado do voto
# ═══════════════════════════════════════════════════════════════════

# ⚠️ "Obstrução" NÃO é abstenção. Em 2023 foi 2,50% dos votos — medir só 2025,
#    onde deu 0,2%, levaria a tratá-la como ruído. É manobra de bancada: o
#    parlamentar está presente e se recusa a votar. Vira NULL (fora do cálculo),
#    não 0 (abstenção declarada).
_VOTOS = {
    "sim": 1,
    "não": -1,
    "nao": -1,
    "abstenção": 0,
    "abstencao": 0,
    "obstrução": None,
    "obstrucao": None,
    "artigo 17": None,      # o presidente da sessão só vota em desempate
    "branco": None,
}


def normalizar_voto(bruto) -> int | None:
    """Converte o voto textual da Câmara para o domínio fechado {-1, 0, 1, None}.

    ⚠️ Devolver None significa "fora do cálculo", não "discordou". Tratar ausência
    como discordância faria o ranking medir presença em vez de afinidade.

    🔴 Não anotado como `str | None` de propósito: o que chega aqui vem do pandas, e
    célula vazia vira **`float('nan')`**, não `None` nem `""`. Foi assim que a
    ingestão real de 2025 morreu com `'float' object has no attribute 'strip'` — o
    `dtype=str` do `read_csv` não alcança o que o `na_values` transformou em nulo.
    """
    if bruto is None or not isinstance(bruto, str):
        return None

    chave = sem_acento(bruto.strip().lower())
    for texto, valor in _VOTOS.items():
        if chave == sem_acento(texto):
            return valor

    return None


# ═══════════════════════════════════════════════════════════════════
# RF-15 — categoria da votação
# ═══════════════════════════════════════════════════════════════════

# A ordem importa: a primeira que casar vence. PROCEDIMENTAL vem primeiro
# porque "Requerimento de urgência para o Projeto..." contém as duas coisas.
_CATEGORIAS: list[tuple[str, str]] = [
    (
        "PROCEDIMENTAL",
        r"requerimento|urgencia|encerramento|adiamento|retirada de pauta"
        r"|inversao|intersticio|prejudicial|questao de ordem|preferencia"
        r"|votacao em globo|recurso",
    ),
    (
        "DESTAQUE_FORTE",
        # 🔴 Sinal INEQUÍVOCO de recorte. Avaliado ANTES do mérito, porque a mesma
        #    frase costuma citar as duas coisas.
        #
        # ⚠️ Os dois lookbehind são obrigatórios e **fixos** — `re` ⛔ não aceita
        #    lookbehind de tamanho variável. "Ressalvad**o o** destaque" (singular)
        #    aparecia em **38 votações** da 57ª e só o plural estava coberto.
        #
        # ⚠️ `destacad[oa]s?` é a forma do SENADO. `votacao nominal do §/art.` também:
        #    votar um dispositivo isolado é destaque, mesmo quando a frase termina em
        #    "…à Proposta de Emenda à Constituição".
        r"(?<!ressalvados os )(?<!ressalvado o )destaques?"
        r"|destacad[oa]s?"
        r"|mantido o texto|suprimido o texto"
        r"|votacao nominal d[ao] (§|art|paragrafo|inciso|caput|expressao)",
    ),
    (
        "MERITO",
        # 🔴 O que é voto de MÉRITO mesmo contendo a palavra "emenda".
        #
        # 📐 Medido em 2026-08-29, na legislatura 57 — cada linha é um defeito que
        #    existia, e todos silenciosos: a votação entrava na matriz com peso 0,7 em
        #    vez de 1,0 **e** ficava fora do universo de curadoria (RN-04).
        #
        # | Padrão | O que estava errado |
        # |---|---|
        # | 🔴 `proposta de emenda` | **73 votações de PEC** viravam DESTAQUE por conterem "emenda" — o voto mais substantivo que existe |
        # | `ressalvad… destaque` | O destaque foi citado para dizer que ⛔ NÃO estava em jogo |
        # | `subemenda substitutiva global` | A subemenda global **troca o texto inteiro**; ⛔ não é recorte |
        # | `emendas do senado` | O mérito das mudanças da outra casa. ⚠️ **Plural** — "a Emenda do Senado nº 1" é destaque |
        # ⚠️ `pec n` também: "Votação, em segundo turno, da PEC nº 72/2023" ⛔ não
        #    escreve o nome por extenso.
        r"proposta de emenda|\bpec n"
        r"|ressalvad[oa]s? [oa]s? destaques?"
        r"|subemenda substitutiva global"
        r"|emendas do senado",
    ),
    (
        "DESTAQUE",
        # ⚠️ Sinal FRACO, avaliado por último: "emenda" solto casa com coisa demais —
        #    inclusive com "Proposta de **Emenda** à Constituição". Só chega aqui o que
        #    ⛔ não foi resgatado pelo mérito acima.
        #
        # ⭐ Mas ele ⛔ NÃO pode sair: "Rejeitadas as Emendas de Plenário" e "Aprovada a
        #    Emenda." são destaques de verdade, e ⛔ nenhum padrão mais específico os
        #    alcança.
        r"emenda|subemenda",
    ),
    (
        "AUTORIDADE",
        r"indicacao|mensagem|autoridade|embaixador|nomeacao|prisao preventiva"
        r"|perda do mandato|representacao|decoro",
    ),
]


def classificar_categoria(descricao: str | None) -> str:
    """Classifica a votação. O default é SUBSTANTIVA — voto de mérito.

    🔴 **Categoria errada muda o PESO na matriz E o universo da curadoria.** Uma votação
    marcada DESTAQUE entra com 0,7 em vez de 1,0 e ⛔ não pode virar pergunta (RN-04) — e
    ⛔ nada disso dá erro, só um resultado plausível e menor.

    ⭐ **A ordem é o método**, e ⛔ não detalhe de implementação:

    | Passo | Por quê |
    |---|---|
    | 1. `PROCEDIMENTAL` | *"Requerimento de urgência para a PEC"* é rito, ⛔ não mérito |
    | 2. `DESTAQUE_FORTE` | Sinal inequívoco de recorte — *"destacada"*, *"mantido o texto"*, votar um `§` |
    | 3. `MERITO` | Resgata o que só parece destaque por conter "emenda" |
    | 4. `DESTAQUE` | Sinal fraco: "emenda" solto, o que sobrou |
    | 5. `AUTORIDADE` | Sabatina |

    ⚠️ Trocar 2 e 3 de lugar quebraria *"Votação nominal do §11 … à Proposta de Emenda à
    Constituição"*, que é destaque de um dispositivo dentro de uma PEC.
    """
    if not descricao:
        return "SUBSTANTIVA"

    texto = sem_acento(descricao.lower())

    for categoria, padrao in _CATEGORIAS:
        if re.search(padrao, texto):
            # ⭐ Os dois rótulos internos ⛔ não vazam para o banco: um é a mesma coisa
            #    que DESTAQUE, o outro é a decisão de ⛔ NÃO ser destaque.
            if categoria == "DESTAQUE_FORTE":
                return "DESTAQUE"
            if categoria == "MERITO":
                return "SUBSTANTIVA"

            return categoria

    return "SUBSTANTIVA"


# 🔴 O que RECONHECEMOS como voto de mérito, para separar "é substantiva" de "⛔ não
#    reconheci nada e caí no default".
#
# ⚠️ ⛔ NÃO entra em `classificar_categoria`: o default continua SUBSTANTIVA, e mudar
#    isso trocaria um erro silencioso por outro. Serve ao canário abaixo.
_SUBSTANTIVA_RECONHECIDA = (
    r"aprovad|rejeitad|votacao nominal d|mantid|prejudicad|retirad"
    r"|projeto de lei|medida provisoria|parecer|substitutivo|proposta"
)


# 🔴 A sigla do objeto, no começo de `ultimaAberturaVotacao_descricao`.
#
#    "Votação do **DTQ** 2 (PL): Destaque de Emenda de Plenário n. 2. (161, II)."
#
# ⭐ `DTQ` é código CONTROLADO da Câmara, ⛔ não prosa. É o único sinal estruturado que a
#    fonte oferece sobre o tipo do voto.
_SIGLA_DA_ABERTURA = re.compile(r"^vota[çc][ãa]o\s+d[oa]\s+([A-Z]{2,5})\b", re.IGNORECASE)


def sigla_do_objeto(abertura: str | None) -> str | None:
    """A sigla do objeto votado, se a descrição da abertura a declarar.

    ⛔ Devolve `None` quando ⛔ não há sigla — que é o caso mais comum, e ⛔ não é erro.
    """
    if not abertura:
        return None

    achado = _SIGLA_DA_ABERTURA.match(abertura.strip())

    return achado.group(1).upper() if achado else None


def divergencias_de_destaque(votacoes) -> list[tuple[str, str, str]]:
    """Onde a sigla da fonte diz **destaque** e a nossa classificação diz outra coisa.

    ## 🔴 Por que ⛔ NÃO substitui o classificador

    📐 Medido em 2026-08-29, sobre as 1.594 votações da Câmara:

    | | |
    |---|---:|
    | Com `ultimaAberturaVotacao_descricao` preenchido | 996 — **62,5%** |
    | Com sigla no começo | 314 |
    | ⛔ **Sem sigla** | **682** — e elas se dividem em SUBSTANTIVA (319) e PROCEDIMENTAL (331) |

    ⛔ **A sigla ⛔ não separa mérito de rito.** E o campo é da última ABERTURA da sessão,
    ⛔ não da votação: `2432423-87` e `2432423-88` compartilham a mesma. ⭐ Por isso ele é
    **cruzamento**, ⛔ não fonte da verdade.

    ## ⭐ O que ele pegou

    🔴 A votação `2613731-65` tinha descrição *"Resultado. Sim: 182; Não: 182"* — que ⛔
    não diz nada — e virou a pergunta `q-preco-abusivo`, marcada à mão como *"precisa de
    conferência"*. A abertura dizia:

    > *"Votação do **DTQ 2** (PL): Destaque de Emenda de Plenário n. 2. (161, II)."*

    ⛔ Voto num **destaque de emenda**, ⛔ não no projeto. A pergunta foi removida.

    ⚠️ Devolve `(id, nossa_categoria, abertura)` para leitura humana — ⛔ **não corrige
    sozinho**: 14 das 18 divergências são "Destaque de Preferência", que é dispositivo de
    rito dentro do trâmite de destaque, e classificá-las ⛔ não é decisão de regex.
    """
    divergentes = []

    for votacao in votacoes:
        abertura = votacao.get("abertura")
        if sigla_do_objeto(abertura) != "DTQ":
            continue
        if votacao.get("categoria") == "DESTAQUE":
            continue

        divergentes.append((votacao.get("id"), votacao.get("categoria"), abertura))

    return divergentes


def descricoes_nao_reconhecidas(descricoes) -> list[str]:
    """As descrições que ⛔ não casam com padrão NENHUM — nem de rito, nem de destaque,
    nem de mérito.

    ## 🔴 Por que existe

    ⚠️ **O default silencioso é o risco de todo classificador por texto.** Se a Câmara
    mudar a frase, tudo vira `SUBSTANTIVA` e ⛔ nada avisa — a votação entra na matriz
    com peso 1,0 e pode virar pergunta.

    ⭐ É o mesmo desenho de `ingestao_senado.siglas_desconhecidas`, que já protege o
    domínio do voto: valor novo ⛔ não derruba a ingestão, mas **aparece no log**.

    ## 📐 O que ele encontrou na primeira execução (2026-08-29)

    **4 de 2.015 descrições.** Duas ⛔ não são ruído:

    | Descrição | O que era |
    |---|---|
    | *"Resultado. Sim: 182; Não: 182"* | A votação do `q-preco-abusivo` — marcada **à mão** na curadoria como "precisa de conferência", justamente porque ⛔ não diz o que foi votado |
    | *"Votação, em segundo turno, da PEC nº 72/2023"* | PEC escrita pela **sigla**; o padrão só cobria "Proposta de Emenda" por extenso |

    ⭐ O canário achou sozinho o que a leitura humana tinha achado, e mais um.
    """
    orfas = []

    for descricao in descricoes:
        # ⚠️ `.strip()`: descrição só com espaço é AUSÊNCIA de descrição, ⛔ não frase
        #    que o padrão deixou passar. Sem isto o canário acusaria o vazio.
        if not (descricao or "").strip():
            continue

        texto = sem_acento(descricao.lower())
        if any(re.search(padrao, texto) for _, padrao in _CATEGORIAS):
            continue
        if re.search(_SUBSTANTIVA_RECONHECIDA, texto):
            continue

        orfas.append(descricao)

    return orfas


# ═══════════════════════════════════════════════════════════════════
# 🔴 Achado #12 — a polaridade, detectável por padrão textual
# ═══════════════════════════════════════════════════════════════════


def inferir_polaridade(descricao: str | None) -> int:
    """Infere o que "Sim" significou nesta votação.

    🔴 O campo mais perigoso do sistema. Em 14% das votações nominais "Sim" quer
    dizer REJEITAR — e o erro não aparece na tela, aparece como um número plausível.

    ⚠️ Esta função é AUXÍLIO à curadoria, não substituto dela. O valor final de
    `pergunta.polaridade` é atribuído por pessoa (PL11).
    """
    if not descricao:
        return 1

    texto = sem_acento(descricao.lower())

    # "Mantido o texto" = o destaque supressivo foi REJEITADO.
    # Quem votou Sim quis MANTER, ou seja, votou CONTRA a supressão proposta.
    if "mantido o texto" in texto:
        return -1

    return 1


# ═══════════════════════════════════════════════════════════════════
# CPF — a armadilha do zero à esquerda
# ═══════════════════════════════════════════════════════════════════


def hash_de_cpf(bruto: str | int | None) -> str | None:
    """SHA-256 do CPF normalizado — é o que vai para o banco.

    🔴 **RNF-13: CPF ⛔ nunca em claro.** Mas o hash **não impede a conciliação**: basta
    hashear os dois lados com o mesmo algoritmo e comparar os hashes. O CPF em claro só
    precisa existir **em memória**, durante a ingestão.

    ⚠️ Normaliza ANTES de hashear, e isso não é detalhe: `012.345.678-90` e
    `01234567890` são o mesmo CPF e precisam dar o **mesmo** hash. Sem a normalização,
    a fonte que formata com pontos nunca casaria com a que não formata.
    """
    digitos = normalizar_cpf(bruto)

    return hashlib.sha256(digitos.encode()).hexdigest() if digitos else None


def normalizar_cpf(bruto: str | int | None) -> str | None:
    """Devolve o CPF com 11 dígitos, preservando zeros à esquerda.

    ⚠️ Ler CPF como número é o erro clássico: `01234567890` vira `1234567890` e o
    join com o TSE perde a pessoa em silêncio. Por isso o ETL lê tudo como texto.
    """
    if bruto is None:
        return None

    digitos = re.sub(r"\D", "", str(bruto))
    if not digitos:
        return None

    if len(digitos) > 11:
        return None

    return digitos.zfill(11)


# ═══════════════════════════════════════════════════════════════════
# 🔴 Dinheiro — e as DUAS convenções que convivem no projeto
# ═══════════════════════════════════════════════════════════════════
#
# ⚠️ Este bloco existe porque as fontes ⛔ **não** concordam sobre o que é um número:
#
# | Fonte | `VR` / `vlr` | Convenção |
# |---|---|---|
# | Portal da Transparência (emendas) | `- 26.002,00` | pt-BR — ponto é MILHAR |
# | TSE (prestação de contas) | `3170000,00` | pt-BR — vírgula é decimal |
# | Câmara (cota parlamentar, CEAP) | `1234.56` | ponto é DECIMAL |
#
# 🔴 **A mesma string `"1.234"` vale 1234 numa e 1,234 na outra** — mil vezes de
# diferença, sem erro nenhum. Foi por isso que as funções ganharam nomes que dizem a
# convenção, ⛔ não a fonte: escolher a errada tem de ser uma escolha visível.


def valor_pt_br(bruto: str | None) -> float:
    """`"- 26.002,00"` → `-26002.0`. Ponto é MILHAR, vírgula é decimal.

    🔴 **Três armadilhas num campo só**, todas vistas no dado real:

    1. `float()` direto estoura em `"12.599,10"` — e, pior, `float("12.599")` daria
       **12,599** em vez de 12.599: três ordens de grandeza abaixo, **sem erro**
    2. O sinal negativo vem **antes e separado**: `"- 26.002,00"`. Empenho negativo é
       **cancelamento**, e é caso normal — ⛔ não descartar
    3. Campo vazio, `"#NULO"` e `"#NULO#"` aparecem nas duas fontes pt-BR
    """
    texto = (bruto or "").strip()
    if not texto or texto.upper().startswith("#"):
        return 0.0

    negativo = texto.startswith("-")
    digitos = texto.lstrip("-").strip().replace(".", "").replace(",", ".")

    try:
        valor = float(digitos)
    except ValueError:
        return 0.0

    return -valor if negativo else valor


def valor_com_ponto(bruto: str | None) -> float:
    """`"1234.56"` → `1234.56`. O ponto é DECIMAL — convenção da CEAP.

    ⚠️ Conferido no arquivo real da cota: ⛔ **não** tem separador de milhar. Passar
    um valor pt-BR por aqui daria um número mil vezes menor, calado.
    """
    texto = (bruto or "").strip()
    if not texto or texto.startswith("#"):
        return 0.0

    try:
        return float(texto.replace(",", "."))
    except ValueError:
        return 0.0


# ═══════════════════════════════════════════════════════════════════

def sem_acento_maiusculo(texto: str | None) -> str:
    """Forma canônica para comparar nomes entre fontes.

    ⚠️ O Portal manda `SOSTENES CAVALCANTE`; a Câmara guarda `Sóstenes Cavalcante`. Sem
    remover acento E normalizar a caixa E colapsar espaço, os dois nunca casariam — e o
    sintoma seria "não achou", ⛔ nunca um erro.
    """
    return " ".join(sem_acento(texto or "").upper().split())


def inteiro(valor) -> int:
    """Inteiro tolerante, ⛔ nunca exceção. Zero para o que não converte.

    🔴 Passa por `float` de propósito. Existiam duas versões disto, e a de `cota.py`
    fazia `int(valor or 0)` — que devolve **0** para `"2024.0"`, em silêncio, sem
    estourar. Um `numAno` com decimal viraria ano zero e a despesa seria arquivada no
    lugar errado sem nenhum sinal. As fontes trocam de formato numérico sem avisar:
    a cota usa ponto decimal, o TSE e o Portal usam vírgula.
    """
    try:
        return int(float(valor))
    except (TypeError, ValueError):
        return 0


def inteiro_ou_nulo(valor) -> int | None:
    """Como `inteiro`, mas zero vira `None` — para coluna anulável."""
    return inteiro(valor) or None


def sem_acento(texto: str) -> str:
    """Remove os diacríticos, preservando a caixa.

    ⚠️ Público porque tem dois consumidores. Era privado, e a consequência foi uma
    cópia idêntica em `noticias.py` — o custo de esconder algo que outro módulo precisa.
    """
    return "".join(
        caractere for caractere in unicodedata.normalize("NFD", texto)
        if unicodedata.category(caractere) != "Mn"
    )


_CPF_NO_TEXTO = re.compile(r"(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)")


def sem_cpf(texto: str | None) -> str | None:
    """Tira CPF de um nome: `"FULANO DE TAL 12345678900"` → `"FULANO DE TAL"`.

    🔴 O nome empresarial de MEI é o nome do dono seguido do CPF, e é assim que a Câmara
    publica o fornecedor da cota. 📐 Medido em 2026-09-25: 3.310 lançamentos, R$ 9,70 mi,
    gravados com o CPF em claro — e a ficha os mostrava.

    Casa exatamente 11 dígitos, com ou sem pontuação: os 14 de um CNPJ ⛔ são cortados.
    """
    if texto is None:
        return None
    limpo = re.sub(r"\s{2,}", " ", _CPF_NO_TEXTO.sub(" ", texto)).strip(" -/")
    return limpo or None

