import { Link } from 'react-router-dom';
import { BotaoGoogle } from '../componentes/BotaoGoogle';
import { Marca } from '../componentes/Icones';
import { useSessao } from '../sessao';

/**
 * Porta de entrada.
 *
 * ⚠️ O login passou a ser obrigatório por decisão do autor (2026-08-26), revertendo o
 * desenho anterior em que o questionário funcionava anônimo. Isso significa que TODA
 * pessoa que usa o site tem conta — e a tabela `segue`, que é dado sensível pela LGPD
 * art. 5º, II, deixa de ter alternativa anônima.
 *
 * Por isso esta tela diz, ANTES de entrar, o que vai ser guardado.
 */
export function Login() {
  const { entrou } = useSessao();

  return (
    <div className="tela-login">
      {/* ⭐ Coluna da esquerda: a marca ocupa o espaço, sem imagem para carregar. */}
      <div className="login-marca">
        <Marca tamanho={88} />
      </div>

      <div className="login-conteudo">
        <h1 className="login-titulo">Quem vota como você?</h1>

        <p className="login-chamada">
          Compare sua posição com o voto registrado dos 513 deputados federais. Pelo
          registro em plenário, não pelo discurso.
        </p>

        <div className="acao-login">
          <BotaoGoogle aoEntrar={entrou} />
        </div>

        <ul className="o-que-tem">
          <li>Um questionário que compara você com os 513</li>
          <li>Perfil de cada deputado, com histórico de votos</li>
          <li>Quem vota parecido com quem</li>
          <li>Notícias de quem você acompanha</li>
        </ul>

        {/* ⚠️ Dito ANTES de entrar, não depois. */}
        <p className="aviso-privacidade">
          Ao entrar, guardamos seu nome, e-mail e foto do Google, e a lista de quem você
          acompanhar. <strong>A lista de quem você segue indica posição política</strong> e é
          tratada como dado sensível. Você pode apagar tudo a qualquer momento.{' '}
          <Link to="/privacidade">Política de privacidade</Link>
        </p>

        <p className="aviso-academico">
          Ferramenta acadêmica. <strong>Não é recomendação de voto.</strong>
        </p>
      </div>
    </div>
  );
}
