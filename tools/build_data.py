import json, csv, sys, os, openpyxl, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import uni_geo
D=sys.argv[1]; XL=sys.argv[2]; OUT=sys.argv[3]
out={}
# universities
unis=[]
for line in open(f"{D}/universities/processed/universities.jsonl"):
    u=json.loads(line)
    if not u.get("is_higher_ed"): continue
    loc=u.get("location") or {}
    if loc.get("lat") is None: continue
    r=u.get("research") or {}
    unis.append([u["id"],u.get("name_en") or u["name"],u["country"],round(loc["lat"],3),round(loc["lon"],3),u.get("city") or "",r.get("works_count") or 0,u.get("founded") or 0,u.get("name_ru") or "",u.get("name_national") or ""])
pos=uni_geo.display([(u[0],u[3],u[4]) for u in unis])
for u in unis:
    u[5]=uni_geo.fix(u[0],u[3],u[4],u[5])[2]; u[3],u[4],p=pos[u[0]]; u.append(p)  # idx 10: 1 campus, 0 city
out["unis"]=unis
uni_total=collections.Counter()
for line in open(f"{D}/universities/processed/universities.jsonl"):
    u=json.loads(line)
    if u.get("is_higher_ed"): uni_total[u["country"]]+=1
out["uniByCountry"]=uni_total
# medical
gj=json.load(open(f"{D}/uz_medical_facilities/processed/uz_medical_facilities.geojson"))
types=["hospital","clinic","doctors","primary","dentist","laboratory","other"]
tmap={}
med=[];tc=collections.Counter()
for f in gj["features"]:
    p=f["properties"];x,y=f["geometry"]["coordinates"]
    t=p.get("facility_type") or "other"
    tc[t]+=1
    med.append([round(y,3),round(x,3),t,0,p.get("region_code") or ""])  # readiness index is a licensed field: not published
out["med"]=med; out["medTypes"]=tc
# sample clinics for table (top readiness, no personal-name flag)
rows=[]
with open(f"{D}/uz_medical_facilities/processed/uz_medical_facilities.csv",encoding="utf-8-sig") as fh:
    for r in csv.DictReader(fh):
        if r["personal_name_flag"]=="True": continue
        rows.append(r)
# public sample: no names, no readiness score, no ranking (the index is a paid field)
rows=[r for r in rows if r["specialties"] and r["site_languages"]]
rows.sort(key=lambda r:r["uid"])
out["medTop"]=[{"type":r["facility_type"],"region":r["region_code"],"spec":r["specialties"].split(";")[:4],"langs":r["site_languages"]} for r in rows[:12]]
# publications
yrs=[]
for r in csv.reader(open(f"{D}/ca_publications/processed/summary/works_by_year.csv",encoding="utf-8-sig")):
    yrs.append(r)
out["worksByYear"]=yrs
out["pubCountries"]=[r for r in csv.reader(open(f"{D}/ca_publications/processed/summary/countries.csv",encoding="utf-8-sig"))]
out["languages"]=[r for r in csv.reader(open(f"{D}/ca_publications/processed/summary/languages.csv",encoding="utf-8-sig"))][:9]
out["partners"]=[r for r in csv.reader(open(f"{D}/ca_publications/processed/summary/partner_countries.csv",encoding="utf-8-sig"))][:9]
# research datasets (no authors)
wb=openpyxl.load_workbook(XL,read_only=True)
ws=wb["Настоящие данные"]
hdr=None;ds=[]
for row in ws.iter_rows(values_only=True):
    if hdr is None: hdr=row;continue
    d=dict(zip(hdr,row))
    if not d.get("Название"): continue
    ds.append({"w":d["Ссылка OpenAlex"],"t":d["Название"],"y":d["Год"],"r":d["Тип репозитория"],"lic":d["Лицензия"] or "","u":(d["Вузы ЦА"] or "").split(";")[0].strip(),"c":d["Страны ЦА"] or "","f":d["Область"] or "","doi":d["DOI"] or d["Открытая ссылка"] or "","ca":d["Упоминает ЦА в названии"]=="да"})
out["researchDatasets"]=ds
js="window.CORE_DATA="+json.dumps(out,ensure_ascii=False,separators=(",",":"))+";"
open(OUT,"w").write(js)
print(len(unis),len(med),len(ds),len(js)//1024,"KB", tc.most_common())
