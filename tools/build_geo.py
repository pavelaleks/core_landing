import json,sys
t=json.load(open(sys.argv[1]))
sc=t["transform"]["scale"];tr=t["transform"]["translate"]
arcs=[]
for a in t["arcs"]:
    x=y=0;pts=[]
    for dx,dy in a:
        x+=dx;y+=dy;pts.append((x*sc[0]+tr[0],y*sc[1]+tr[1]))
    arcs.append(pts)
def arc(i):
    return arcs[i] if i>=0 else arcs[~i][::-1]
def ring(r):
    pts=[]
    for i in r:
        a=arc(i); pts.extend(a if not pts else a[1:])
    return pts
def simplify(pts,tol=0.015):
    out=[pts[0]]
    for p in pts[1:]:
        if abs(p[0]-out[-1][0])+abs(p[1]-out[-1][1])>tol: out.append(p)
    return out
want={"860":"UZ","398":"KZ","417":"KG","762":"TJ","795":"TM"}
res={}
for g in t["objects"]["countries"]["geometries"]:
    cid=str(g.get("id"))
    if cid not in want: continue
    polys=g["arcs"] if g["type"]=="MultiPolygon" else [g["arcs"]]
    rings=[]
    for p in polys:
        r=simplify(ring(p[0]))
        # clip roughly to view for big neighbours
        if want[cid] in ("RU","CN","IR","AF"):
            if not any(44<x<92 and 33<y<58 for x,y in r): continue
        if len(r)>3: rings.append([[round(x,2),round(y,2)] for x,y in r])
    res[want[cid]]=rings
open(sys.argv[2],"w").write("window.CORE_GEO="+json.dumps(res,separators=(",",":"))+";")
print({k:sum(len(r) for r in v) for k,v in res.items()})
