import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Avatar } from './Avatar';
import {
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
 * A moldura do site.
 *
 * ⚠️ Antes era o trilho lateral esquerdo do Twitter, e o site inteiro lia como clone.
 * O que substitui é a estrutura de site institucional: faixa de procedência, cabeçalho
 * de largura total com navegação horizontal, corpo, rodapé de largura total.
 *
 * ⭐ E ocupa a tela inteira de propósito. A versão centralizada com `max-width` deixava
 * calha morta dos dois lados — que é a assinatura visual da rede social, não a de um
 * serviço de consulta pública.
 */
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <FaixaDeProcedencia />
      <CabecalhoDoSite />

      <div className="corpo">
        <main className="coluna-central">{children}</main>

        <aside className="coluna-direita">
          <SugestoesParaSeguir />
        </aside>
      </div>

      <RodapeDoSite />
    </div>
  );
}

/** Cabeçalho fixo da coluna central, com voltar opcional. */
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

/**
 * ⭐ A faixa declara a procedência do dado antes de qualquer outra coisa na página.
 *
 * É o dispositivo que sites de órgão público usam para isso, e aqui ele não é
 * decoração: a credibilidade deste trabalho depende inteiramente de o visitante saber
 * que o número vem do registro nominal da Câmara, não de opinião nossa.
 */
function FaixaDeProcedencia() {
  return (
    <div className="faixa-procedencia">
      <div className="faixa-conteudo">
        <span>Dados abertos da Câmara dos Deputados · 57ª legislatura</span>
        <span className="faixa-natureza">Trabalho de conclusão de curso</span>
      </div>
    </div>
  );
}

function CabecalhoDoSite() {
  const { usuario, sair } = useSessao();

  return (
    <header className="cabecalho-site">
      <div className="cabecalho-conteudo">
        <Link to="/" className="marca-link" aria-label="poligraph — início">
          <Marca />
          <span className="marca-texto">
            poligraph
            <small>afinidade por voto registrado</small>
          </span>
        </Link>

        <nav className="nav-principal" aria-label="Navegação principal">
          <ItemDeNavegacao para="/" rotulo="Início" icone={<IconeInicio />} />
          <ItemDeNavegacao para="/explorar" rotulo="Explorar" icone={<IconeExplorar />} />
          <ItemDeNavegacao para="/seguindo" rotulo="Seguindo" icone={<IconeSeguindo />} />
          <ItemDeNavegacao
            para="/questionario"
            rotulo="Questionário"
            icone={<IconeQuestionario />}
          />
        </nav>

        <div className="cabecalho-conta">
          <Link to="/conta" className="usuario-mini">
            <Avatar nome={usuario?.nome ?? '?'} fotoUrl={usuario?.fotoUrl} tamanho="pequeno" />
            <span className="usuario-mini-nome">{usuario?.nome?.split(' ')[0] ?? 'Conta'}</span>
          </Link>
          <button type="button" className="botao-texto" onClick={sair}>
            Sair
          </button>
        </div>
      </div>
    </header>
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
    <NavLink to={para} end={para === '/'} className="nav-item" viewTransition>
      {icone}
      <span>{rotulo}</span>
    </NavLink>
  );
}

/**
 * 🔴 O aviso da RNF-14 vive aqui, e por isso aparece em TODA tela — não só na de
 * resultado, que era onde estava antes.
 */
function RodapeDoSite() {
  return (
    <footer className="rodape-site">
      <div className="rodape-conteudo">
        <section>
          <h2>O que é</h2>
          <p>
            Compara sua posição com o voto registrado em plenário dos deputados federais. A
            afinidade sai do comportamento revelado de voto, não de autodeclaração
            ideológica.
          </p>
        </section>

        <section>
          <h2>Procedência</h2>
          <p>
            Registro nominal de votação publicado nos Dados Abertos da Câmara dos
            Deputados. Nenhum voto é editado: a curadoria reescreve a ementa e registra a
            polaridade da votação.
          </p>
        </section>

        <section>
          <h2>Seus dados</h2>
          <p>
            <Link to="/privacidade">Política de privacidade</Link>
            <br />
            <Link to="/conta">Apagar minha conta</Link>
          </p>
        </section>
      </div>

      <div className="rodape-aviso">
        <p>
          Ferramenta acadêmica de comparação de votos.{' '}
          <strong>Não é recomendação de voto</strong> e não representa o programa completo
          de nenhum parlamentar.
        </p>
      </div>
    </footer>
  );
}
