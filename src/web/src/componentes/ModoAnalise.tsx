import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { obterProcedencia } from '../api';
import type { CargaDeProcedencia, ConsultaDeProcedencia, Procedencia } from '../api';
import { LinkDeFonte } from './LinkDeFonte';

/**
 * Modo análise (Pendência 73): ligado, todo número que tem procedência vira botão e abre o painel
 * com o arquivo de onde veio, o hash e a regra da conta.
 *
 * DECISÃO: É a regra que o projeto já segue (mostrar o cálculo junto do número, e o número
 * exibido ser o usado) levada até o arquivo de origem. Desligado, o site fica como está.
 *
 * ATENÇÃO: A escolha fica no navegador, não na conta: vale para quem não entrou, e não é
 * dado pessoal que precise ir ao servidor.
 */
type Estado = {
  ligado: boolean;
  alternar: () => void;
  abrir: (consulta: ConsultaDeProcedencia, rotulo: string) => void;
};

const CHAVE = 'poligraph:modo-analise';

const ContextoDoModoAnalise = createContext<Estado>({
  ligado: false,
  alternar: () => {},
  abrir: () => {},
});

/** O estado do modo e o painel, um para o site inteiro. */
export function ProvedorDoModoAnalise({ children }: { children: ReactNode }) {
  const [ligado, setLigado] = useState(lerGuardado);
  const [aberto, setAberto] = useState<{ consulta: ConsultaDeProcedencia; rotulo: string } | null>(null);

  const alternar = useCallback(() => {
    setLigado((atual) => {
      guardar(!atual);
      return !atual;
    });
  }, []);

  const abrir = useCallback(
    (consulta: ConsultaDeProcedencia, rotulo: string) => setAberto({ consulta, rotulo }),
    [],
  );

  const estado = useMemo(() => ({ ligado, alternar, abrir }), [ligado, alternar, abrir]);

  return (
    <ContextoDoModoAnalise.Provider value={estado}>
      {children}
      <PainelDeProcedencia aberto={aberto} aoFechar={() => setAberto(null)} />
    </ContextoDoModoAnalise.Provider>
  );
}

export function useModoAnalise(): Estado {
  return useContext(ContextoDoModoAnalise);
}

/**
 * O interruptor do cabeçalho.
 *
 * DECISÃO: No cabeçalho, visível em toda tela, e não no menu: é o lugar que o sistema do vídeo
 * analisado usa (plano/10 §1), e escondido atrás de um clique ninguém descobre que existe.
 */
export function InterruptorDoModoAnalise() {
  const { ligado, alternar } = useModoAnalise();

  return (
    <button
      type="button"
      className="interruptor-analise"
      aria-pressed={ligado}
      title={ligado ? 'Desligar o modo análise' : 'Ligar o modo análise: cada número mostra de onde veio'}
      onClick={alternar}
    >
      <span className="interruptor-analise-trilho" aria-hidden="true" />
      <span>Análise</span>
    </button>
  );
}

/**
 * Um número da tela com a procedência dele.
 *
 * Desligado, devolve o número como está. Ligado, o número ganha sublinhado pontilhado e
 * abre o painel.
 *
 * RISCO: `children` precisa ser conteúdo de linha: um `<div>` dentro de `<button>` é HTML
 * inválido, e leitor de tela lê o botão pela metade.
 */
export function ComProcedencia({
  consulta,
  rotulo,
  children,
}: {
  consulta: ConsultaDeProcedencia;
  rotulo: string;
  children: ReactNode;
}) {
  const { ligado, abrir } = useModoAnalise();
  if (!ligado) return <>{children}</>;

  return (
    <button
      type="button"
      className="numero-com-procedencia"
      aria-label={`${rotulo}: ver de onde veio`}
      onClick={() => abrir(consulta, rotulo)}
    >
      {children}
    </button>
  );
}

/**
 * O painel lateral: como foi contado, e de que arquivos.
 *
 * DECISÃO: `<dialog>` nativo, como o tour e os modais do projeto: foco preso, Esc e papel de
 * diálogo sem biblioteca.
 */
function PainelDeProcedencia({
  aberto,
  aoFechar,
}: {
  aberto: { consulta: ConsultaDeProcedencia; rotulo: string } | null;
  aoFechar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [procedencia, setProcedencia] = useState<Procedencia | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (aberto && !elemento.open) elemento.showModal?.();
    if (!aberto && elemento.open) elemento.close();
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    setProcedencia(null);
    setErro(false);
    obterProcedencia(aberto.consulta)
      .then((p) => ativo && setProcedencia(p))
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, [aberto]);

  return (
    <dialog
      ref={dialogo}
      className="painel-procedencia"
      aria-labelledby="titulo-procedencia"
      onClose={aoFechar}
      onClick={(e) => e.target === dialogo.current && aoFechar()}
    >
      <header className="painel-procedencia-topo">
        <div>
          <p className="painel-procedencia-sobre">{aberto?.rotulo}</p>
          <h2 id="titulo-procedencia">De onde veio este número</h2>
        </div>
        <button type="button" className="botao-icone" aria-label="Fechar" onClick={aoFechar}>
          ✕
        </button>
      </header>

      <div className="painel-procedencia-corpo">
        {erro && <p className="ajuda">Não foi possível ler a procedência agora. Tente de novo em instantes.</p>}
        {!erro && !procedencia && aberto && <p className="ajuda">Lendo os arquivos de origem…</p>}
        {procedencia && <ConteudoDaProcedencia procedencia={procedencia} />}
      </div>
    </dialog>
  );
}

/** A regra, a contagem e um cartão por arquivo. */
function ConteudoDaProcedencia({ procedencia }: { procedencia: Procedencia }) {
  const comCarga = procedencia.linhas - procedencia.linhasSemCarga;

  return (
    <>
      <section>
        <h3>Como foi contado</h3>
        <p>{procedencia.regra}</p>
        <p className="ajuda">
          <strong className="dado">{procedencia.linhas.toLocaleString('pt-BR')}</strong>{' '}
          {procedencia.linhas === 1 ? 'linha entrou' : 'linhas entraram'} na conta;{' '}
          <strong className="dado">{comCarga.toLocaleString('pt-BR')}</strong> com o arquivo de
          origem registrado.
        </p>
        {procedencia.linhasSemCarga > 0 && (
          <p className="ajuda">
            {procedencia.linhasSemCarga.toLocaleString('pt-BR')}{' '}
            {procedencia.linhasSemCarga === 1 ? 'linha foi gravada' : 'linhas foram gravadas'} antes
            do registro de procedência e não dizem de que arquivo vieram.
          </p>
        )}
      </section>

      <section>
        <h3>
          {procedencia.cargas.length === 1
            ? 'O arquivo de origem'
            : `Os ${procedencia.cargas.length} arquivos de origem`}
        </h3>
        {procedencia.cargas.length === 0 && (
          <p className="ajuda">Nenhuma linha deste número tem o arquivo de origem registrado.</p>
        )}
        <ul className="lista-cargas">
          {procedencia.cargas.map((carga) => (
            <li key={carga.id}>
              <CartaoDaCarga carga={carga} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/**
 * ATENÇÃO: A data é mostrada em UTC e diz isso: o hash prova a cópia baixada naquele instante,
 * e um horário local sem fuso seria ambíguo para quem confere de outro lugar.
 */
function CartaoDaCarga({ carga }: { carga: CargaDeProcedencia }) {
  return (
    <dl className="cartao-carga">
      <dt>Órgão</dt>
      <dd>{carga.orgao}</dd>
      <dt>Arquivo</dt>
      <dd className="cartao-carga-url">
        <LinkDeFonte href={carga.url}>{nomeDoArquivo(carga.url)}</LinkDeFonte>
      </dd>
      <dt>Baixado em</dt>
      <dd className="dado">{dataHoraUtc(carga.baixadoEm)}</dd>
      <dt>SHA-256</dt>
      <dd className="dado cartao-carga-hash">{carga.sha256}</dd>
      <dt>Tamanho</dt>
      <dd className="dado">{tamanho(carga.bytes)}</dd>
      {(carga.etagDaFonte || carga.modificadoNaFonte) && (
        <>
          <dt>Versão na fonte</dt>
          <dd className="dado">
            {[carga.modificadoNaFonte && dataHoraUtc(carga.modificadoNaFonte), carga.etagDaFonte]
              .filter(Boolean)
              .join(' · ')}
          </dd>
        </>
      )}
      <dt>Código que leu</dt>
      <dd className="dado">{carga.versao ?? 'anterior ao registro de versão'}</dd>
      <dt>Comando</dt>
      <dd className="dado">{carga.comando}</dd>
      <dt>Base legal</dt>
      <dd>{carga.baseLegal}</dd>
      <dt>Linhas deste arquivo</dt>
      <dd className="dado">{carga.linhas.toLocaleString('pt-BR')}</dd>
    </dl>
  );
}

function nomeDoArquivo(url: string): string {
  try {
    const caminho = new URL(url).pathname.split('/').filter(Boolean);
    return decodeURIComponent(caminho.at(-1) ?? url);
  } catch {
    return url;
  }
}

function dataHoraUtc(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return `${data.toLocaleString('pt-BR', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' })} UTC`;
}

function tamanho(bytes: number): string {
  if (bytes >= 1 << 20) return `${(bytes / (1 << 20)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
  if (bytes >= 1 << 10) return `${(bytes / (1 << 10)).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} KB`;
  return `${bytes} bytes`;
}

function lerGuardado(): boolean {
  try {
    return localStorage.getItem(CHAVE) === '1';
  } catch {
    return false;
  }
}

function guardar(ligado: boolean): void {
  try {
    localStorage.setItem(CHAVE, ligado ? '1' : '0');
  } catch {
    return;
  }
}
