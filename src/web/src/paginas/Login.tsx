import { BotaoGoogle } from '../componentes/BotaoGoogle';
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
      <div className="cartao-login">
        <h1>poligraph</h1>
        <p className="chamada">
          Descubra quais deputados votam como você — pelo voto registrado, não pelo
          discurso.
        </p>

        <ul className="o-que-tem">
          <li>Perfil de cada deputado, com histórico de votos</li>
          <li>Quem vota parecido com quem</li>
          <li>Um questionário que compara você com os 513</li>
          <li>Notícias de quem você acompanha</li>
        </ul>

        <div className="acao-login">
          <BotaoGoogle aoEntrar={entrou} />
        </div>

        {/* ⚠️ Dito ANTES de entrar, não depois. */}
        <p className="aviso-privacidade">
          Ao entrar, guardamos seu nome, e-mail e foto do Google, e a lista de quem você
          acompanhar. <strong>A lista de quem você segue indica posição política</strong> e
          é tratada como dado sensível. Você pode apagar tudo a qualquer momento.{' '}
          <a href="/privacidade">Política de privacidade</a>
        </p>

        <p className="aviso-academico">
          Ferramenta acadêmica. <strong>Não é recomendação de voto.</strong>
        </p>
      </div>
    </div>
  );
}
