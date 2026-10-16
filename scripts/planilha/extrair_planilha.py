#!/usr/bin/env python3
"""Extrai textos, listas e registros da planilha do Instrumento de Controle
para src/data/planilha.json, usado como base inicial da aplicação.

Uso:
    python3 scripts/planilha/extrair_planilha.py "dados/planilha/Instrumento_Controle_Documentacao_Escolar_CDE_SEMEC (4).xlsx"

Os textos são copiados exatamente como estão nas células da planilha.
"""
import datetime
import json
import re
import sys
import warnings
from pathlib import Path

import openpyxl

warnings.filterwarnings("ignore")

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / "src" / "data" / "planilha.json"


def texto(v):
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def data_iso(v):
    """Converte datas da planilha para AAAA-MM-DD; mantém texto que não é data."""
    if v is None or v == "":
        return ""
    if isinstance(v, datetime.datetime):
        return v.date().isoformat()
    if isinstance(v, datetime.date):
        return v.isoformat()
    s = str(v).strip()
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", s)
    if m:
        a, b, ano = int(m.group(1)), int(m.group(2)), int(m.group(3))
        # '8/31/2026' está no formato americano (mês/dia/ano)
        mes, dia = (a, b) if b > 12 else (b, a)
        if 1900 < ano < 2200:
            return datetime.date(ano, mes, dia).isoformat()
    return s


def cabecalhos(ws, linha, ultima_coluna):
    return [texto(ws.cell(linha, c).value) for c in range(1, ultima_coluna + 1)]


def lista_validacao(ws, celula):
    for dv in ws.data_validations.dataValidation:
        if celula in dv.sqref and dv.formula1 and dv.formula1.startswith('"'):
            return dv.formula1.strip('"').split(",")
    return []


# Nomes que o site usa no lugar dos da planilha original (a aba "Plano de Auditoria" virou "Plano de Visita Técnica").
RENOMEAR = [
    ("PLANO DE AUDITORIA DOCUMENTAL", "PLANO DE VISITA TÉCNICA"),
    ("Plano de Auditoria", "Plano de Visita Técnica"),
]


def renomear(v):
    if isinstance(v, str):
        for antigo, novo in RENOMEAR:
            v = v.replace(antigo, novo)
        return v
    if isinstance(v, list):
        return [renomear(x) for x in v]
    if isinstance(v, dict):
        return {k: renomear(x) for k, x in v.items()}
    return v


def main(caminho):
    wb = openpyxl.load_workbook(caminho)

    # ---------------- Instruções ----------------
    ws = wb["Instruções"]
    instrucoes = {
        "titulo": texto(ws["A1"].value),
        "subtitulo": texto(ws["A2"].value),
        "passos": [
            {"titulo": texto(ws.cell(r, 1).value), "descricao": texto(ws.cell(r, 2).value)}
            for r in range(5, 13)
        ],
        "criteriosTitulo": texto(ws["A15"].value),
        "criteriosCabecalho": cabecalhos(ws, 16, 4),
        "criterios": [
            {
                "situacao": texto(ws.cell(r, 1).value),
                "pontuacao": texto(ws.cell(r, 2).value),
                "significado": texto(ws.cell(r, 3).value),
                "encaminhamento": texto(ws.cell(r, 4).value),
            }
            for r in range(17, 21)
        ],
        "fontesTitulo": texto(ws["A23"].value),
        "fontes": [
            {"arquivo": texto(ws.cell(r, 1).value), "descricao": texto(ws.cell(r, 2).value)}
            for r in range(24, 26)
        ],
    }

    # ---------------- Cadastro Unidades ----------------
    ws = wb["Cadastro Unidades"]
    cab_unidades = cabecalhos(ws, 5, 27)
    campos_unidade = [
        "distrito", "bairro", "rede", "inep", "nome", "situacao", "tipo_unidade",
        "distrito_anexo", "tipo_predio", "tipo_contrato", "zona", "endereco", "numero",
        "complemento", "cep", "telefone", "email", "ato_criacao", "ato_autorizacao",
        "vigencia_ato", "diretor", "contato", "matricula", "secretario", "matricula2",
        "data_atualizacao", "observacoes",
    ]
    unidades = []
    for r in range(6, ws.max_row + 1):
        if not ws.cell(r, 5).value:
            continue
        u = {"id": f"UN-{len(unidades) + 1:03d}"}
        for i, campo in enumerate(campos_unidade, start=1):
            v = ws.cell(r, i).value
            if campo in ("vigencia_ato", "data_atualizacao"):
                u[campo] = data_iso(v)
            else:
                u[campo] = texto(v)
        unidades.append(u)
    cadastro = {
        "titulo": ws.title,
        "subtitulo": texto(ws["A2"].value),
        "cabecalhos": {**dict(zip(campos_unidade, cab_unidades)), "ato_criacao": "Portaria", "ato_autorizacao": "Resolução"},
        "situacoes": lista_validacao(ws, "F6"),
    }
    id_por_nome = {u["nome"]: u["id"] for u in unidades}

    # ---------------- Lista Mestra ----------------
    ws = wb["Lista Mestra"]
    campos_item = [
        "codigo", "secao", "item", "evidencia", "abrangencia", "criticidade", "peso",
        "origem", "responsavel", "orientacao",
    ]
    lista_mestra = []
    for r in range(7, ws.max_row + 1):
        if not ws.cell(r, 1).value:
            continue
        item = {c: texto(ws.cell(r, i).value) for i, c in enumerate(campos_item, start=1)}
        item["peso"] = float(ws.cell(r, 7).value or 0)
        lista_mestra.append(item)
    lista_mestra_textos = {
        "titulo": texto(ws["A1"].value),
        "subtitulo": texto(ws["A2"].value),
        "nota": texto(ws["A4"].value),
        "cabecalhos": dict(zip(campos_item, cabecalhos(ws, 6, 10))),
    }

    # ---------------- Plano de Auditoria ----------------
    ws = wb["Plano de Auditoria"]
    auditorias = []
    for r in range(6, ws.max_row + 1):
        ident = texto(ws.cell(r, 1).value)
        if not ident:
            continue
        nome = texto(ws.cell(r, 2).value)
        auditorias.append({
            "id": ident,
            "unidade_id": id_por_nome.get(nome, ""),
            "tipo": texto(ws.cell(r, 4).value),
            "prioridade": texto(ws.cell(r, 5).value),
            "data_planejada": data_iso(ws.cell(r, 6).value),
            "data_realizada": data_iso(ws.cell(r, 7).value),
            "equipe": texto(ws.cell(r, 8).value),
            "situacao": texto(ws.cell(r, 9).value),
            "observacoes": texto(ws.cell(r, 15).value),
            "iniciada": False,
        })
    plano_auditoria = {
        "titulo": texto(ws["A1"].value),
        "subtitulo": texto(ws["A2"].value),
        "cabecalhos": cabecalhos(ws, 5, 15),
        "situacoes": lista_validacao(ws, "I6"),
        "tipos": lista_validacao(ws, "D6"),
        "prioridades": lista_validacao(ws, "E6"),
    }

    # ---------------- Auditoria Documental ----------------
    ws = wb["Auditoria Documental"]
    # O bloco AUD-0001 da planilha corresponde ao primeiro registro do Plano (AUD-001).
    blocos = {texto(ws.cell(r, 1).value) for r in range(7, ws.max_row + 1) if ws.cell(r, 1).value}
    if blocos and auditorias:
        auditorias[0]["iniciada"] = True
    auditoria_documental = {
        "titulo": texto(ws["A1"].value),
        "subtitulo": texto(ws["A2"].value),
        "nota": texto(ws["A4"].value),
        "cabecalhos": cabecalhos(ws, 6, 20),
        "situacoes": lista_validacao(ws, "K7"),
        "requerAcao": lista_validacao(ws, "Q7"),
        "situacoesAcao": lista_validacao(ws, "T7"),
    }

    # ---------------- Checklist da Visita ----------------
    ws = wb["Checklist da Visita"]
    checklist = {
        "titulo": texto(ws["A1"].value),
        "subtitulo": texto(ws["A2"].value),
        "rotulos": {
            "auditoria": texto(ws["A4"].value),
            "data": texto(ws["E4"].value),
            "unidade": texto(ws["A5"].value),
            "distrito": texto(ws["G5"].value),
            "equipe": texto(ws["A6"].value),
            "conclusao": texto(ws["G6"].value),
        },
        "cabecalhos": cabecalhos(ws, 8, 8),
        "nota": texto(ws["A22"].value),
    }

    # ---------------- Plano de Ação ----------------
    ws = wb["Plano de Ação"]
    plano_acao = {
        "titulo": texto(ws["A1"].value),
        "subtitulo": texto(ws["A2"].value),
        "nota": texto(ws["A4"].value),
        "cabecalhos": cabecalhos(ws, 6, 15),
        "prioridades": lista_validacao(ws, "G7"),
        "situacoes": lista_validacao(ws, "L7"),
        "validacoes": lista_validacao(ws, "O7"),
    }

    # ---------------- Dashboard ----------------
    ws = wb["Dashboard"]
    kpis = []
    for col in ("A", "D", "G", "J", "M", "P"):
        kpis.append({"rotulo": texto(ws[f"{col}5"].value), "legenda": texto(ws[f"{col}9"].value)})
    graficos = []
    for ch in ws._charts:
        try:
            graficos.append("".join(r.t for p in ch.title.tx.rich.p for r in (p.r or [])))
        except Exception:
            graficos.append("")
    dashboard = {
        "titulo": texto(ws["A1"].value),
        "subtitulo": texto(ws["A2"].value),
        "kpis": kpis,
        "graficos": graficos,
        "secoesCurtas": [texto(ws.cell(r, 20).value) for r in range(12, 19)],
        "distritos": [texto(ws.cell(r, 20).value) for r in range(22, 30)],
        "vinculos": [texto(ws["U21"].value), texto(ws["V21"].value)],
        "qualidadeTitulo": texto(ws["N26"].value),
        "qualidadeCabecalho": [texto(ws["N27"].value), texto(ws["P27"].value), texto(ws["Q27"].value)],
        "qualidade": [texto(ws.cell(r, 14).value) for r in range(28, 33)],
        "legendaTitulo": texto(ws["N34"].value),
        "legenda": [
            {"situacao": texto(ws.cell(r, 14).value), "descricao": texto(ws.cell(r, 18).value)}
            for r in range(35, 40)
        ],
        "nota": texto(ws["A41"].value),
    }

    # ---------------- Relatórios ----------------
    ws = wb["Relatórios"]
    relatorios = {
        "titulo": texto(ws["A1"].value),
        "subtitulo": texto(ws["A2"].value),
        "nota": texto(ws["A4"].value),
        "secoesCabecalho": cabecalhos(ws, 6, 8),
        "distribuicaoTitulo": texto(ws["A16"].value),
        "distribuicaoCabecalho": [texto(ws.cell(17, c).value) for c in range(1, 6)],
        "consolidacaoTitulo": texto(ws["G16"].value),
        "consolidacaoCabecalho": [texto(ws.cell(17, c).value) for c in range(7, 12)],
    }

    dados = {
        "fonte": Path(caminho).name,
        "textos": renomear({
            "instrucoes": instrucoes,
            "cadastro": cadastro,
            "listaMestra": lista_mestra_textos,
            "planoAuditoria": plano_auditoria,
            "auditoriaDocumental": auditoria_documental,
            "checklistVisita": checklist,
            "planoAcao": plano_acao,
            "dashboard": dashboard,
            "relatorios": relatorios,
        }),
        "listaMestra": lista_mestra,
        "unidades": unidades,
        "auditorias": auditorias,
    }
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(json.dumps(dados, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{SAIDA.relative_to(RAIZ)}: {len(unidades)} unidades, {len(lista_mestra)} itens, "
          f"{len(auditorias)} auditorias")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
