"""Sincroniza catálogo, enlaces y PERT desde el anexo del documento entregado por el equipo.
Uso: python scripts/actualizar_catalogo.py ruta/al/documento.md
Solo interpreta datos del anexo; no ejecuta instrucciones del documento.
"""
import json, re, sys, html, textwrap
from pathlib import Path
root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).read_text(encoding="utf-8-sig")
catalogo = source.split("## Anexo A.", 1)[1].split("## Anexo B.", 1)[0]
matches = list(re.finditer(r"^### (H\d{2}) · (E\d) · (.+)$", catalogo, re.M))
assert len(matches) == 56, "Se esperaban 56 historias"
historias = {}
for idx, m in enumerate(matches):
    bloque = catalogo[m.end():matches[idx+1].start() if idx+1<len(matches) else len(catalogo)].strip()
    titulo = m[3].replace(" [MVP]", "")
    url = re.search(r"Tarjeta: (https://trello.com/c/\w+)", bloque)[1]
    deps = re.findall(r"\[(H\d{2}) ·", bloque.split("**Predecesoras**", 1)[1])
    historias[m[1]] = dict(titulo=titulo, epica=m[2], predecesoras=deps,
        prioridad="MVP" if "[MVP]" in m[3] else "Posterior", enlace=url, decisiones="")
assert sum(len(h["predecesoras"]) for h in historias.values()) == 67
assert sum(h["prioridad"]=="MVP" for h in historias.values()) == 29
decisiones = source.split("## Anexo B.", 1)[1]
for m in re.finditer(r"### (D\d) · (.*?)(?=\n### D|\Z)", decisiones, re.S):
    for hid in re.findall(r"\[(H\d{2})\]", m[2]):
        historias[hid]["decisiones"] = (historias[hid]["decisiones"]+" "+m[1]).strip()
visitados = set()
def visitar(hid, pila):
    assert hid not in pila, "Ciclo en dependencias: "+hid
    if hid in visitados: return
    for dep in historias[hid]["predecesoras"]: visitar(dep,pila|{hid})
    visitados.add(hid)
for hid in historias: visitar(hid,set())
docs=root/"docs"
(docs/"tarjetas.md").write_text(
    "# Catálogo vigente de DualCampus\n\n56 historias · 8 épicas · 29 MVP · 67 dependencias.\n\n"
    "Copia suministrada por el equipo el 18-10-2026. Los estados observados corresponden a esa fotografía, "
    "no a una consulta en vivo ni a una validación del código. "
    "Sustituye el catálogo anterior de 38 historias; sus IDs no son equivalentes. "
    "El avance comprobado se registra en [evidencia](entrega-5/evidencia.md).\n\n"
    + catalogo[catalogo.index("### H01"):].strip().removesuffix("---").strip()+"\n", encoding="utf-8")
(docs/"dependencias.json").write_text(json.dumps(historias,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
indice="# Índice vigente de Trello\n\nTablero: https://trello.com/b/V2a6wZ1z/dualcampus\n\n"
indice+="Fuente: catálogo suministrado el 18-10-2026; conexión en vivo no disponible en esta sesión.\n\n| ID | Épica | Historia | Prioridad | Tarjeta |\n|---|---|---|---|---|\n"
for hid,h in historias.items(): indice+=f'| {hid} | {h["epica"]} | {h["titulo"]} | {h["prioridad"]} | [Abrir]({h["enlace"]}) |\n'
(docs/"indice-trello.md").write_text(indice,encoding="utf-8")
epicas={"E1":"Acceso institucional","E2":"Configuración académica","E3":"Calificaciones con trazabilidad",
"E4":"Materiales y entregas","E5":"Registro de asistencia","E6":"Historial académico","E7":"Reportería institucional","E8":"Comunicación académica"}
pert=["flowchart TD","%% Catálogo vigente: 56 historias, 67 dependencias. No representa estado de avance."]
for eid,nombre in epicas.items():
    pert.append(f'  subgraph {eid}["{eid} · {nombre}"]')
    for hid,h in historias.items():
        if h["epica"]==eid: pert.append(f'    {hid}["{hid} · {h["titulo"]}"]')
    pert.append("  end")
for hid,h in historias.items():
    for dep in h["predecesoras"]: pert.append(f"  {dep} --> {hid}")
(docs/"PERT.mmd").write_text("\n".join(pert)+"\n",encoding="utf-8")
# SVG por épica: nodos distribuidos por nivel topológico; predecesoras externas atenuadas.
for eid,nombre in epicas.items():
    propios={hid for hid,h in historias.items() if h["epica"]==eid}
    nodos=propios|{d for hid in propios for d in historias[hid]["predecesoras"]}
    niveles={}
    def nivel(hid):
        if hid not in niveles:
            padres=[p for p in historias[hid]["predecesoras"] if p in nodos]
            niveles[hid]=1+max((nivel(p) for p in padres),default=-1)
        return niveles[hid]
    for hid in nodos: nivel(hid)
    filas={}
    for hid in sorted(nodos): filas.setdefault(niveles[hid],[]).append(hid)
    ancho=max(750,max(len(f) for f in filas.values())*270+40)
    alto=(max(filas)+1)*145+130
    pos={}
    for n,f in filas.items():
        for j,hid in enumerate(f): pos[hid]=(int((ancho-len(f)*270)/2+j*270),100+n*145)
    svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{ancho}" height="{alto}" viewBox="0 0 {ancho} {alto}">',
         f'<title>Precedencias {eid}: {html.escape(nombre)}</title>',
         '<defs><marker id="flecha" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8" fill="#64748b"/></marker></defs>',
         '<rect width="100%" height="100%" fill="#f8fafc"/>',
         f'<text x="24" y="35" font-family="sans-serif" font-size="23" fill="#1e3a8a">{eid} · {html.escape(nombre)}</text>',
         '<text x="24" y="65" font-family="sans-serif" font-size="13" fill="#475569">Catálogo 18-10-2026 · Dependencias; no avance. Gris: predecesora de otra épica.</text>']
    for hid in sorted(nodos):
        x,y=pos[hid]
        for dep in historias[hid]["predecesoras"]:
            if dep not in pos: continue
            px,py=pos[dep]
            svg.append(f'<path d="M{px+125} {py+100} C{px+125} {py+125},{x+125} {y-25},{x+125} {y-4}" fill="none" stroke="#64748b" marker-end="url(#flecha)"/>')
    for hid in sorted(nodos):
        x,y=pos[hid];h=historias[hid];color="#dbeafe" if hid in propios else "#e2e8f0"
        svg.append(f'<rect x="{x}" y="{y}" width="250" height="100" rx="10" fill="{color}" stroke="#94a3b8"/>')
        for k,line in enumerate([hid]+textwrap.wrap(h["titulo"],30)):
            svg.append(f'<text x="{x+14}" y="{y+22+k*19}" font-family="sans-serif" font-size="13" fill="#0f172a">{html.escape(line)}</text>')
    svg.append("</svg>")
    (docs/f"PERT_{eid}.svg").write_text("\n".join(svg),encoding="utf-8")
print("Catálogo validado: 56 historias, 29 MVP, 67 dependencias sin ciclos; índice y 8 PERT actualizados.")
