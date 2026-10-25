"""Extrai as rotas da API: método, caminho, proteção, handler, serviço chamado, tabelas lidas e gravadas, cache e código."""
import glob
import json
import os
import re
from pathlib import Path

API = str(Path(__file__).resolve().parents[2] / 'src' / 'api' / 'Poligraph.Api')
SAIDA = Path(__file__).with_name('rotas.json')

contexto = open(os.path.join(API, '..', 'Poligraph.Data', 'Data', 'PoligraphDb.cs'), encoding='utf-8-sig').read()
DBSET = {nome: re.sub(r'(?<!^)(?=[A-Z])', '_', nome).lower() for nome in re.findall(r'DbSet<\w+> (\w+) =>', contexto)}

fontes = {p: open(p, encoding='utf-8-sig').read() for p in glob.glob(os.path.join(API, '**', '*.cs'), recursive=True) if os.sep + 'obj' + os.sep not in p}


def corpo_a_partir(texto, inicio):
    """O corpo de um método: chaves balanceadas, ou uma expressão `=>` até o `;` no nível zero."""
    i = inicio
    nivel = 1
    while nivel:
        if texto[i] == '(':
            nivel += 1
        elif texto[i] == ')':
            nivel -= 1
        i += 1
    while i < len(texto) and texto[i] != '{' and texto[i:i + 2] != '=>':
        if texto[i] == ';':
            return ''
        i += 1
    if i >= len(texto):
        return ''
    if texto[i] == '=':
        nivel = 0
        j = i
        while True:
            c = texto[j]
            if c in '({[':
                nivel += 1
            elif c in ')}]':
                nivel -= 1
            elif c == ';' and nivel == 0:
                return texto[i:j + 1]
            j += 1
    nivel = 0
    j = i
    while True:
        if texto[j] == '{':
            nivel += 1
        elif texto[j] == '}':
            nivel -= 1
            if nivel == 0:
                return texto[i:j + 1]
        j += 1


def resumo_antes(texto, posicao):
    """O `///` logo acima de uma declaração, em texto corrido."""
    linhas = texto[:posicao].rstrip().split('\n')
    doc = []
    for l in reversed(linhas[:-1] if not linhas[-1].strip().startswith('///') else linhas):
        if l.strip().startswith('///'):
            doc.append(l.strip()[3:].strip())
        elif l.strip().startswith('[') or l.strip() == '':
            if doc:
                break
            continue
        else:
            break
    texto_doc = ' '.join(reversed(doc))
    texto_doc = re.sub(r'<see cref="([^"]+)"\s*/>', r'\1', texto_doc)
    texto_doc = re.sub(r'<c>(.*?)</c>', r'\1', texto_doc)
    texto_doc = re.sub(r'</?(summary|remarks|para|b|i)>', ' ', texto_doc)
    texto_doc = re.sub(r'<param name="\w+">.*?</param>', '', texto_doc)
    return re.sub(r'\s+', ' ', texto_doc).strip()


def classe_e_arquivo(nome_da_classe):
    for p, t in fontes.items():
        m = re.search(r'(?:public|internal) (?:sealed )?(?:static )?class ' + nome_da_classe + r'\b', t)
        if m:
            return p, t
    return None, None


def declaracao(texto, nome):
    """A declaração do método: a ocorrência do nome cujo trecho desde o último `;`, `{` ou `}` começa por modificador e não tem atribuição."""
    for m in re.finditer(r'(?<![.\w])' + re.escape(nome) + r'\s*\(', texto):
        inicio = max(texto.rfind(';', 0, m.start()), texto.rfind('}', 0, m.start()), texto.rfind('{', 0, m.start()))
        trecho = texto[inicio + 1:m.start()]
        sem_doc = '\n'.join(l for l in trecho.split('\n') if not l.strip().startswith('///') and not l.strip().startswith('['))
        mods = list(re.finditer(r'^\s*(public|private|internal|protected)\b', sem_doc, re.M))
        if mods and '=' not in sem_doc and 'new ' not in sem_doc and 'return' not in sem_doc:
            linha_do_modificador = re.search(r'^[ \t]*(public|private|internal|protected)\b[^\n]*', trecho, re.M)
            return m, inicio + 1 + (linha_do_modificador.start() if linha_do_modificador else 0)
    return None, None


def metodo(texto, nome):
    m, inicio_decl = declaracao(texto, nome)
    if not m:
        return None, None
    return corpo_a_partir(texto, m.end()), resumo_antes(texto, inicio_decl)


def analisar_metodo(classe, nome, vistos=None):
    """Tabelas lidas e gravadas, cache, chamadas a auxiliares, seguindo os privados da mesma classe."""
    vistos = vistos if vistos is not None else set()
    if (classe, nome) in vistos:
        return set(), set(), set(), ''
    vistos.add((classe, nome))
    _, texto = classe_e_arquivo(classe)
    if not texto:
        return set(), set(), set(), ''
    corpo, _ = metodo(texto, nome)
    if not corpo:
        return set(), set(), set(), ''
    le, grava, extras = set(), set(), set()
    for dbset in re.findall(r'_db\.(\w+)', corpo) + re.findall(r'\bdb\.(\w+)', corpo):
        if dbset in DBSET:
            le.add(DBSET[dbset])
    for m in re.finditer(r'_db\.(\w+)\.(Add|AddRange|Remove|RemoveRange)\(|_db\.(\w+)[^;]*?\.(ExecuteDeleteAsync|ExecuteUpdateAsync)', corpo):
        alvo = m.group(1) or m.group(3)
        if alvo in DBSET:
            grava.add(DBSET[alvo])
    if '_leitura.ObterAsync' in corpo or '_cache.GetOrCreate' in corpo:
        extras.add('cache')
    if 'ExecucaoVigente.' in corpo:
        le.add('execucoes')
    if 'Legislaturas.CorrenteAsync' in corpo:
        le.add('votacoes')
    for chamada in set(re.findall(r'(?<![.\w])([A-Z]\w+)\s*\(', corpo)):
        if chamada != nome and declaracao(texto, chamada)[0]:
            l2, g2, e2, _ = analisar_metodo(classe, chamada, vistos)
            le |= l2
            grava |= g2
            extras |= e2
    for campo, outro in re.findall(r'(_\w+)\.(\w+Async)\(', corpo):
        tipo = re.search(r'private readonly (\w+) ' + re.escape(campo) + r'\b', texto)
        if tipo and tipo.group(1).startswith('Servico'):
            l2, g2, e2, _ = analisar_metodo(tipo.group(1), outro, vistos)
            le |= l2
            grava |= g2
            extras |= e2
    return le, grava, extras, corpo


rotas = []
for caminho in sorted(glob.glob(os.path.join(API, 'Endpoints', '*.cs'))):
    texto = open(caminho, encoding='utf-8-sig').read()
    grupos = dict(re.findall(r'var (\w+) = app\.MapGroup\("([^"]+)"\)', texto))
    grupo_protegido = {v: ('RequireAuthorization' in texto.split(f'var {v} = app.MapGroup')[1].split(';')[0]) for v in grupos}
    grupo_csrf = {v: ('ExigirCabecalhoDoSite' in texto.split(f'var {v} = app.MapGroup')[1].split(';')[0]) for v in grupos}
    for m in re.finditer(r'(\w+)\.Map(Get|Post|Put|Delete)\("([^"]*)", (?:\(Delegate\))?(\w+)\)([^;]*);', texto):
        alvo, verbo, rota, handler, resto = m.groups()
        prefixo = grupos.get(alvo, '')
        caminho_rota = (prefixo + ('' if rota == '/' else rota)) or rota
        if alvo == 'app':
            caminho_rota = rota
        corpo, doc = metodo(texto, handler)
        parametros = re.search(r'\b' + handler + r'\s*\(([^)]*)\)', texto[texto.find('Task<IResult> ' + handler) if 'Task<IResult> ' + handler in texto else 0:])
        params = parametros.group(1) if parametros else ''
        servicos = dict((nome, tipo) for tipo, nome in re.findall(r'\b(Servico\w+|CacheDeLeitura|PoligraphDb)\s+(\w+)', params))
        le, grava, extras = set(), set(), set()
        chamadas = []
        docs_servico = []
        codigo = ''
        for var, met in re.findall(r'\b(\w+)\.(\w+)\(', corpo or ''):
            if var in servicos and servicos[var].startswith('Servico'):
                l2, g2, e2, c2 = analisar_metodo(servicos[var], met)
                le |= l2
                grava |= g2
                extras |= e2
                chamadas.append(f'{servicos[var]}.{met}')
                _, t = classe_e_arquivo(servicos[var])
                if t:
                    _, d = metodo(t, met)
                    if d:
                        docs_servico.append(d)
                if c2 and len(c2) > len(codigo):
                    codigo = c2
        for dbset in re.findall(r'\bdb\.(\w+)', corpo or ''):
            if dbset in DBSET:
                le.add(DBSET[dbset])
        for m2 in re.finditer(r'\bdb\.(\w+)\.(Add|Remove)\(|\bdb\.(\w+)[^;]*?\.(ExecuteDeleteAsync|ExecuteUpdateAsync)', corpo or ''):
            a2 = m2.group(1) or m2.group(3)
            if a2 in DBSET:
                grava.add(DBSET[a2])
        if not codigo and corpo:
            codigo = corpo
        protegida = 'RequireAuthorization' in resto or grupo_protegido.get(alvo, False)
        rotas.append({
            'metodo': verbo.upper(), 'rota': caminho_rota, 'arquivo': os.path.basename(caminho), 'handler': handler,
            'doc': doc, 'docServico': docs_servico, 'chamadas': chamadas,
            'le': sorted(le - grava), 'grava': sorted(grava), 'cache': 'cache' in extras,
            'login': protegida, 'csrf': grupo_csrf.get(alvo, False) or 'ExigirCabecalhoDoSite' in resto,
            'parametros': [p.strip() for p in params.split(',') if p.strip() and not re.search(r'Servico|CancellationToken|PoligraphDb|HttpContext|ClaimsPrincipal|CacheDeLeitura|ILogger|IOptions|IConfiguration|TimeProvider|IDataProtect|IAntiforgery', p)],
            'codigo': '\n'.join(l for l in (codigo or '').split('\n') if not l.strip().startswith('///'))[:2600],
        })

json.dump(rotas, open(SAIDA, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
