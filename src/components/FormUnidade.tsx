import { useState } from 'react';
import { Save } from 'lucide-react';
import { CABECALHOS_UNIDADE as C, DISTRITOS, OPCOES_CADASTRO, SITUACOES_UNIDADE, TEXTOS } from '../data/planilha';
import type { Unidade } from '../lib/types';
import { formatarData, hojeISO, lerData } from '../lib/format';
import { CampoArea, CampoSelect, CampoTexto, Painel } from './ui';

export function unidadeVazia(): Unidade {
  return {
    id: '',
    distrito: '',
    bairro: '',
    rede: 'MUNICIPAL',
    inep: '',
    nome: '',
    situacao: 'ATIVA',
    tipo_unidade: '',
    distrito_anexo: '',
    tipo_predio: '',
    tipo_contrato: '',
    zona: 'URBANA',
    endereco: '',
    numero: '',
    complemento: '',
    cep: '',
    telefone: '',
    email: '',
    ato_criacao: '',
    ato_autorizacao: '',
    vigencia_ato: '',
    diretor: '',
    contato: '',
    matricula: '',
    secretario: '',
    matricula2: '',
    data_atualizacao: '',
    observacoes: '',
  };
}

/** Grupos de campos do cadastro (cabeçalhos idênticos aos da planilha). */
export const GRUPOS_UNIDADE: { titulo: string; campos: (keyof Unidade)[] }[] = [
  {
    titulo: 'Identificação',
    campos: ['nome', 'inep', 'distrito', 'bairro', 'rede', 'situacao', 'tipo_unidade', 'distrito_anexo'],
  },
  {
    titulo: C.endereco,
    campos: ['endereco', 'numero', 'complemento', 'cep', 'zona', 'tipo_predio', 'tipo_contrato', 'telefone', 'email'],
  },
  { titulo: 'Atos legais', campos: ['ato_criacao', 'ato_autorizacao', 'vigencia_ato'] },
  { titulo: 'Responsáveis', campos: ['diretor', 'contato', 'matricula', 'secretario', 'matricula2'] },
  { titulo: C.observacoes, campos: ['data_atualizacao', 'observacoes'] },
];

export function FormUnidade({
  inicial,
  aoSalvar,
  aoFechar,
}: {
  inicial: Unidade;
  aoSalvar: (u: Unidade) => Promise<void>;
  aoFechar: () => void;
}) {
  const nova = !inicial.id;
  const [u, setU] = useState<Unidade>({
    ...inicial,
    vigencia_ato: formatarData(inicial.vigencia_ato),
    data_atualizacao: hojeISO(),
  });
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const set = (campo: keyof Unidade) => (v: string) => setU((x) => ({ ...x, [campo]: v }));
  const valido = u.nome.trim() && u.distrito;

  async function salvar() {
    setTentou(true);
    if (!valido) return;
    setSalvando(true);
    try {
      await aoSalvar({ ...u, nome: u.nome.trim(), vigencia_ato: lerData(u.vigencia_ato) });
      aoFechar();
    } finally {
      setSalvando(false);
    }
  }

  const campo = (k: keyof Unidade) => {
    const rotulo = C[k as keyof typeof C];
    switch (k) {
      case 'nome':
        return (
          <CampoTexto
            key={k}
            rotulo={rotulo}
            valor={u.nome}
            aoMudar={set('nome')}
            obrigatorio
            largo
            erro={tentou && !u.nome.trim() ? 'Campo obrigatório.' : undefined}
          />
        );
      case 'distrito':
        return (
          <CampoSelect
            key={k}
            rotulo={rotulo}
            valor={u.distrito}
            aoMudar={set('distrito')}
            opcoes={DISTRITOS}
            obrigatorio
            erro={tentou && !u.distrito ? 'Campo obrigatório.' : undefined}
          />
        );
      case 'situacao':
        return <CampoSelect key={k} rotulo={rotulo} valor={u.situacao} aoMudar={set('situacao')} opcoes={SITUACOES_UNIDADE} />;
      case 'rede':
      case 'tipo_unidade':
      case 'tipo_predio':
      case 'tipo_contrato':
      case 'zona':
        return <CampoSelect key={k} rotulo={rotulo} valor={u[k]} aoMudar={set(k)} opcoes={OPCOES_CADASTRO[k]} />;
      case 'bairro':
      case 'distrito_anexo':
        return <CampoTexto key={k} rotulo={rotulo} valor={u[k]} aoMudar={set(k)} sugestoes={OPCOES_CADASTRO[k]} />;
      case 'vigencia_ato':
        return (
          <CampoTexto
            key={k}
            rotulo={rotulo}
            valor={u.vigencia_ato}
            aoMudar={set('vigencia_ato')}
            placeholder="DD/MM/AAAA"
            dica="Data (DD/MM/AAAA) ou texto, como DEFINITIVO."
          />
        );
      case 'data_atualizacao':
        return (
          <CampoTexto
            key={k}
            rotulo={rotulo}
            tipo="date"
            valor={u.data_atualizacao}
            aoMudar={set('data_atualizacao')}
            dica={inicial.data_atualizacao ? `Anterior: ${formatarData(inicial.data_atualizacao)}` : undefined}
          />
        );
      case 'observacoes':
        return <CampoArea key={k} rotulo={rotulo} valor={u.observacoes} aoMudar={set('observacoes')} />;
      case 'ato_criacao':
      case 'ato_autorizacao':
      case 'endereco':
      case 'complemento':
        return <CampoTexto key={k} rotulo={rotulo} valor={u[k]} aoMudar={set(k)} largo />;
      case 'email':
        return <CampoTexto key={k} rotulo={rotulo} tipo="email" valor={u.email} aoMudar={set('email')} />;
      default:
        return <CampoTexto key={k} rotulo={rotulo} valor={String(u[k] ?? '')} aoMudar={set(k)} />;
    }
  };

  return (
    <Painel
      titulo={nova ? 'Nova unidade' : u.nome || 'Unidade'}
      sub={TEXTOS.instrucoes.passos[0].descricao}
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" className="btn btn--neutro" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="button" className="btn btn--primario" onClick={() => void salvar()} disabled={salvando}>
            <Save size={16} aria-hidden /> Salvar
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        {GRUPOS_UNIDADE.map((g) => (
          <fieldset key={g.titulo} className="grupo-form">
            <h3>{g.titulo}</h3>
            <div className="grade-form">{g.campos.map(campo)}</div>
          </fieldset>
        ))}
        <button type="submit" hidden />
      </form>
    </Painel>
  );
}
