import { Link } from 'react-router-dom';
import type { ColetivoQueMandou, ParlamentarQueMandou } from '../api';
import { nomeProprio, reaisCompacto } from '../formato';
import { AvatarComponent } from './Avatar';
import { TermoComponent } from './Termo';

/**
 * Quem mandou dinheiro de emenda — a mesma apresentação na cidade e na entidade.
 *
 * RISCO: Bancada e comissão não são pessoas, e vêm em lista própria, explicadas: misturadas aos
 * deputados, "Bancada de Minas Gerais" lia como o nome de um político.
 */
export function LinhaDoParlamentarComponent({ parlamentar: p }: { parlamentar: ParlamentarQueMandou }) {
  const casa = p.casa === 'SENADO' ? 'Senado' : p.casa === 'CAMARA' ? 'Câmara' : null;
  const detalhe = [p.partido, p.uf, casa].filter(Boolean).join(' · ');

  return (
    <li className="autor-com-foto">
      <AvatarComponent nome={p.nome} fotoUrl={p.urlFoto} tamanho="pequeno" />
      <span className="autor-texto">
        {p.pessoaId ? (
          <Link className="autor-nome" to={`/parlamentar/${p.pessoaId}`}>
            {nomeProprio(p.nome)}
          </Link>
        ) : (
          <span className="autor-nome">{nomeProprio(p.nome)}</span>
        )}
        <span className="autor-detalhe">
          {detalhe || 'Sem página neste site'} · {p.emendas} {p.emendas === 1 ? 'emenda' : 'emendas'}
        </span>
      </span>
      <span className="valor">{reaisCompacto(p.recebido)}</span>
    </li>
  );
}

const ROTULO_DO_COLETIVO: Record<ColetivoQueMandou['tipo'], string> = {
  BANCADA: 'Bancada estadual',
  COMISSAO: 'Comissão',
  OUTRO: 'Autor coletivo',
};

/** Bancadas e comissões: autores que não são pessoas, cada um com o que é. */
export function ColetivosComponent({ coletivos }: { coletivos: ColetivoQueMandou[] }) {
  if (coletivos.length === 0) return null;

  const total = coletivos.reduce((soma, c) => soma + c.recebido, 0);

  return (
    <div data-tour="emendas-coletivos">
      <h3>Bancadas e comissões</h3>
      <p className="ajuda">
        {reaisCompacto(total)} vieram de grupos de parlamentares: a{' '}
        <TermoComponent nome="emendaDeBancada">bancada</TermoComponent> reúne os parlamentares de um estado, e a{' '}
        <TermoComponent nome="emendaDeComissao">comissão</TermoComponent> é um grupo de trabalho do Congresso.
      </p>

      <ul className="lista-autores">
        {coletivos.map((c) => (
          <li key={`${c.tipo}-${c.nome}`}>
            <span className="autor-nome">{nomeProprio(c.nome)}</span>
            <span className="autor-detalhe">
              {ROTULO_DO_COLETIVO[c.tipo]} · {c.emendas} {c.emendas === 1 ? 'emenda' : 'emendas'}
            </span>
            <span className="valor">{reaisCompacto(c.recebido)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
