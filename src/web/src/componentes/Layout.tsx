import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Avatar } from './Avatar';
import {
  IconeConta,
  IconeExplorar,
  IconeInicio,
  IconeQuestionario,
  IconeSeguindo,
  IconeVoltar,
  Marca,
} from './Icones';
import { SugestoesParaSeguir } from './SugestoesParaSeguir';
import { useSessao } from '../sessao';

/**
 * Moldura de três colunas.
 *
 * ⚠️ A coluna da direita some abaixo de 1100px e a esquerda vira barra inferior abaixo
 * de 700px — a navegação nunca desaparece, só muda de lugar.
 */
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="layout">
      <BarraLateral />

      <main className="coluna-central">{children}</main>

      <aside className="coluna-direita">
        <SugestoesParaSeguir />
        <RodapeLateral />
      </aside>
    </div>
  );
}

/** Cabeçalho fixo da coluna central, com voltar opcional — padrão de timeline. */
export function CabecalhoDaColuna({
  titulo,
  subtitulo,
  comVoltar,
}: {
  titulo: string;
  subtitulo?: string;
  comVoltar?: boolean;
}) {
  const navegar = useNavigate();

  return (
    <header className="cabecalho-coluna">
      {comVoltar && (
        <button
          type="button"
          className="botao-icone"
          onClick={() => navegar(-1)}
          aria-label="Voltar"
        >
          <IconeVoltar />
        </button>
      )}

      <div>
        <h1>{titulo}</h1>
        {subtitulo && <p>{subtitulo}</p>}
      </div>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════════

function BarraLateral() {
  const { usuario, sair } = useSessao();

  return (
    <nav className="barra-lateral" aria-label="Navegação principal">
      <Link to="/" className="marca-link" aria-label="poligraph — início">
        <Marca />
        <span>poligraph</span>
      </Link>

      <div className="nav-itens">
        <ItemDeNavegacao para="/" rotulo="Início" icone={<IconeInicio />} />
        <ItemDeNavegacao para="/explorar" rotulo="Explorar" icone={<IconeExplorar />} />
        <ItemDeNavegacao para="/seguindo" rotulo="Seguindo" icone={<IconeSeguindo />} />
        <ItemDeNavegacao
          para="/questionario"
          rotulo="Questionário"
          icone={<IconeQuestionario />}
        />
        <ItemDeNavegacao para="/conta" rotulo="Conta" icone={<IconeConta />} />
      </div>

      <Link to="/questionario" className="botao-principal">
        Descobrir afinidade
      </Link>

      <div className="rodape-lateral-usuario">
        <Link to="/conta" className="usuario-mini">
          <Avatar nome={usuario?.nome ?? '?'} fotoUrl={usuario?.fotoUrl} tamanho="medio" />
          <span className="usuario-mini-nome">{usuario?.nome ?? 'Minha conta'}</span>
        </Link>
        <button type="button" className="botao-texto" onClick={sair}>
          Sair
        </button>
      </div>
    </nav>
  );
}

function ItemDeNavegacao({
  para,
  rotulo,
  icone,
}: {
  para: string;
  rotulo: string;
  icone: React.ReactNode;
}) {
  return (
    <NavLink to={para} end={para === '/'} className="nav-item">
      {icone}
      <span>{rotulo}</span>
    </NavLink>
  );
}

function RodapeLateral() {
  return (
    <div className="cartao-lateral cartao-legal">
      <p>
        Ferramenta acadêmica de comparação de votos.{' '}
        <strong>Não é recomendação de voto.</strong>
      </p>
      <p className="fontes">
        Dados abertos da Câmara dos Deputados · <Link to="/privacidade">Privacidade</Link>
      </p>
    </div>
  );
}
