"""Lê o snapshot de migrations do EF e extrai tabelas, colunas, chaves, índices únicos, CHECKs e FKs."""
import json
import re
from pathlib import Path

SNAPSHOT = Path(__file__).resolve().parents[2] / 'src' / 'Poligraph.Data' / 'Migrations' / 'PoligraphDbModelSnapshot.cs'
SAIDA = Path(__file__).with_name('modelo_do_banco.json')

texto = open(SNAPSHOT, encoding='utf-8-sig').read()


def blocos():
    """Cada `modelBuilder.Entity("X", b => { ... });`, com o corpo inteiro (chaves balanceadas)."""
    for m in re.finditer(r'modelBuilder\.Entity\("Poligraph\.Data\.(\w+)", b =>\s*\{', texto):
        i = m.end()
        nivel = 1
        while nivel:
            if texto[i] == '{':
                nivel += 1
            elif texto[i] == '}':
                nivel -= 1
            i += 1
        yield m.group(1), texto[m.end():i - 1]


def snake(nome):
    return re.sub(r'(?<!^)(?=[A-Z])', '_', nome).lower()


classes = {}
for classe, corpo in blocos():
    c = classes.setdefault(classe, {'classe': classe, 'colunas': {}, 'pk': [], 'unicos': [], 'checks': [], 'fks': []})
    for p in re.finditer(r'b\.Property<([\w?<>\[\]]+)>\("(\w+)"\)((?:\s*\.\w+\([^;]*?\))*);', corpo):
        tipo_cs, prop, resto = p.groups()
        coluna = re.search(r'HasColumnName\("(\w+)"\)', resto)
        tipo_db = re.search(r'HasColumnType\("([^"]+)"\)', resto)
        nula = tipo_cs.endswith('?') or (tipo_cs == 'string' and 'IsRequired()' not in resto)
        c['colunas'][prop] = {'nome': coluna.group(1) if coluna else snake(prop), 'tipo': tipo_db.group(1) if tipo_db else tipo_cs, 'nula': nula}
    k = re.search(r'b\.HasKey\(([^)]*)\)', corpo)
    if k:
        c['pk'] = re.findall(r'"(\w+)"', k.group(1))
    for u in re.finditer(r'b\.HasIndex\(([^)]*)\)((?:\s*\.\w+\([^;]*?\))*);', corpo):
        if 'IsUnique()' in u.group(2):
            c['unicos'].append(re.findall(r'"(\w+)"', u.group(1)))
    t = re.search(r'b\.ToTable\("(\w+)"', corpo)
    if t:
        c['tabela'] = t.group(1)
    for ck in re.finditer(r'HasCheckConstraint\("(\w+)", "((?:[^"\\]|\\.)*)"\)', corpo):
        c['checks'].append({'nome': ck.group(1), 'regra': ck.group(2).replace('\\"', '"')})
    for f in re.finditer(r'b\.HasOne\("Poligraph\.Data\.(\w+)", (?:"\w+"|null)\)((?:\s*\.\w+\([^;]*?\))*);', corpo):
        alvo, resto = f.groups()
        chaves = re.search(r'HasForeignKey\(([^)]*)\)', resto)
        principal = re.search(r'HasPrincipalKey\(([^)]*)\)', resto)
        if not chaves:
            continue
        c['fks'].append({
            'para': alvo,
            'colunas': re.findall(r'"(\w+)"', chaves.group(1)),
            'colunasDoAlvo': re.findall(r'"(\w+)"', principal.group(1)) if principal else None,
            'aoApagar': (re.search(r'DeleteBehavior\.(\w+)', resto) or [None, 'NoAction'])[1],
            'umParaUm': 'WithOne(' in resto,
            'obrigatoria': 'IsRequired()' in resto,
            'nome': (re.search(r'HasConstraintName\("(\w+)"\)', resto) or [None, ''])[1],
        })
    for f in re.finditer(r'b\.HasMany\("Poligraph\.Data\.(\w+)", (?:"\w+"|null)\)((?:\s*\.\w+\([^;]*?\))*);', corpo):
        filho, resto = f.groups()
        chaves = re.search(r'HasForeignKey\(([^)]*)\)', resto)
        if not chaves:
            continue
        classes.setdefault(filho, {'classe': filho, 'colunas': {}, 'pk': [], 'unicos': [], 'checks': [], 'fks': []})['fks'].append({
            'para': classe, 'colunas': re.findall(r'"(\w+)"', chaves.group(1)), 'colunasDoAlvo': None,
            'aoApagar': (re.search(r'DeleteBehavior\.(\w+)', resto) or [None, 'NoAction'])[1], 'umParaUm': False,
            'obrigatoria': 'IsRequired()' in resto, 'nome': (re.search(r'HasConstraintName\("(\w+)"\)', resto) or [None, ''])[1]})

tabelas = []
for classe, c in classes.items():
    if 'tabela' not in c:
        continue
    def col(prop):
        return c['colunas'].get(prop, {'nome': snake(prop)})['nome']
    fks = []
    for f in c['fks']:
        alvo = classes[f['para']]
        alvo_cols = f['colunasDoAlvo'] or alvo['pk']
        fks.append({'para': alvo['tabela'], 'colunas': [col(x) for x in f['colunas']],
                    'colunasDoAlvo': [alvo['colunas'].get(x, {'nome': snake(x)})['nome'] for x in alvo_cols],
                    'aoApagar': f['aoApagar'], 'obrigatoria': f['obrigatoria'], 'umParaUm': f['umParaUm'], 'nome': f['nome']})
    tabelas.append({
        'tabela': c['tabela'],
        'colunas': [{'nome': v['nome'], 'tipo': v['tipo'], 'nula': v['nula']} for v in c['colunas'].values()],
        'pk': [col(x) for x in c['pk']],
        'unicos': [[col(x) for x in u] for u in c['unicos']],
        'checks': c['checks'],
        'fks': fks,
    })
json.dump(sorted(tabelas, key=lambda t: t['tabela']), open(SAIDA, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
