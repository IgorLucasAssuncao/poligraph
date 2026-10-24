import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ColetivoQueMandou, ParlamentarQueMandou } from '../api';
import { nomeProprio, reaisCompacto } from '../formato';
import { AvatarComponent } from './Avatar';
import { BotaoMostrarMaisComponent } from './BotaoMostrarMais';
import { COLETIVOS_POR_VEZ } from '../constantes';
import { TEXTOS_DOS_COMPONENTES as T } from '../textos/componentes';

/**
 * Quem mandou dinheiro de emenda — a mesma apresentação na cidade e na entidade.
 *
 * RISCO: Bancada e comissão não são pessoas, e vêm em lista própria, explicadas: misturadas aos
 * deputados, "Bancada de Minas Gerais" lia como o nome de um político.
 */
export function LinhaDoParlamentarComponent({ parlamentar: p }: { parlamentar: ParlamentarQueMandou }) {
  const casa = p.casa === 'SENADO' ? T.autores.senado : p.casa === 'CAMARA' ? T.autores.camara : null;
  const detalhe = [p.partido, p.uf, casa].filter(Boolean).join(' · ');

  return (
    <li className="autor-com-foto">
      <AvatarComponent nome={p.nome} fotoUrl={p.urlFoto} tamanho="pequeno" />
      <span className="autor-texto">
        {p.idPessoa ? (
          <Link className="autor-nome" to={`/parlamentar/${p.idPessoa}`}>
            {nomeProprio(p.nome)}
          </Link>
        ) : (
          <span className="autor-nome">{nomeProprio(p.nome)}</span>
        )}
        <span className="autor-detalhe">
          {detalhe || (p.idPessoa ? '' : T.autores.semPagina)}
          {(detalhe || !p.idPessoa) && ' · '}
          {T.autores.emendas(p.emendas)}
        </span>
      </span>
      <span className="valor">{reaisCompacto(p.recebido)}</span>
    </li>
  );
}

const ROTULO_DO_COLETIVO: Record<ColetivoQueMandou['tipo'], string> = {
  BANCADA: T.autores.coletivos.BANCADA,
  COMISSAO: T.autores.coletivos.COMISSAO,
  OUTRO: T.autores.coletivos.OUTRO,
};


/** Bancadas e comissões: autores que não são pessoas, cada um com o que é. */
export function ColetivosComponent({ coletivos }: { coletivos: ColetivoQueMandou[] }) {
  const [exibidos, setExibidos] = useState(COLETIVOS_POR_VEZ);
  if (coletivos.length === 0) return null;

  const total = coletivos.reduce((soma, c) => soma + c.recebido, 0);

  return (
    <div>
      <p className="ajuda">{T.autores.grupos(reaisCompacto(total))}</p>

      <ul className="lista-autores">
        {coletivos.slice(0, exibidos).map((c) => (
          <li key={`${c.tipo}-${c.nome}`}>
            <span className="autor-nome">{nomeProprio(c.nome)}</span>
            <span className="autor-detalhe">
              {ROTULO_DO_COLETIVO[c.tipo]} · {c.emendas} {c.emendas === 1 ? 'emenda' : 'emendas'}
            </span>
            <span className="valor">{reaisCompacto(c.recebido)}</span>
          </li>
        ))}
      </ul>

      <BotaoMostrarMaisComponent
        proximos={Math.min(COLETIVOS_POR_VEZ, coletivos.length - exibidos)}
        restantes={Math.max(0, coletivos.length - exibidos)}
        carregando={false}
        erro={false}
        aoClicar={() => setExibidos((n) => n + COLETIVOS_POR_VEZ)}
      />
    </div>
  );
}
