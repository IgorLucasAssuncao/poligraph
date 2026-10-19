import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dispensarSeguidosEncerrados, obterSeguidosEncerrados } from '../api';
import type { SeguidosEncerrados } from '../api';
import { useSessao } from '../sessao';
import { TEXTOS_DOS_AVISOS } from '../textos/avisos';
import './avisoDeSeguidosEncerrados.css';

const T = TEXTOS_DOS_AVISOS.encerrados;

/**
 * O aviso de que parlamentares saíram da lista de quem a pessoa segue, por terem deixado o mandato
 * (decisão do autor, 2026-10-18). Aparece no topo de qualquer página até a pessoa clicar em
 * "Entendi"; aí a API apaga o registro, que diz quem ela seguia.
 *
 * DECISÃO: Na virada, o aviso diz que começou a legislatura nova; no meio do mandato (renúncia,
 * cassação, licença), diz só que a pessoa deixou o mandato. O site não diz o motivo de cada um:
 * a lista oficial não traz.
 *
 * RISCO: Dado de quem a pessoa seguia, fora do cache de leituras.
 */
export function AvisoDeSeguidosEncerradosComponent() {
  const { usuario } = useSessao();
  const [encerrados, setEncerrados] = useState<SeguidosEncerrados | null>(null);

  useEffect(() => {
    if (!usuario) return;
    let atual = true;
    obterSeguidosEncerrados()
      .then((lidos) => atual && setEncerrados(lidos))
      .catch(() => atual && setEncerrados(null));
    return () => {
      atual = false;
    };
  }, [usuario]);

  if (!usuario || !encerrados || encerrados.parlamentares.length === 0) return null;

  const nomes = juntar(encerrados.parlamentares.map((p) => p.nome));

  return (
    <aside className="aviso-encerrados" role="status">
      <p>
        {encerrados.novaLegislatura !== null && <strong>{T.novaLegislatura(encerrados.novaLegislatura)} </strong>}
        {T.sairam(nomes, encerrados.parlamentares.length)}
      </p>
      <div className="aviso-encerrados-acoes">
        <Link to="/parlamentares" onClick={dispensar}>
          {T.procurar}
        </Link>
        <button type="button" className="botao-secundario" onClick={dispensar}>
          {T.entendi}
        </button>
      </div>
    </aside>
  );

  function dispensar() {
    setEncerrados(null);
    dispensarSeguidosEncerrados().catch(() => undefined);
  }
}

/** "A", "A e B", "A, B e C". */
function juntar(nomes: string[]): string {
  return nomes.length <= 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}
