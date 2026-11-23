import { esc, nf, date, pill } from "../ui/format.js";
export function createAccessPages({ store, view, DS, ds, myReq }) {
  function vCatalog() {
    var S = store.s;
    view.innerHTML = '<span class="kicker">Каталог · ' + DS.length + " набора</span><h1>Размеченные данные вузов</h1>" +
      '<p class="lead">Каждый набор — это открытые данные учёных, которые CORE привёл в порядок, разметил и описал. Откройте набор, чтобы увидеть, что именно мы сделали.</p>' +
      '<div class="grid3" style="margin-top:26px">' + DS.map(function (d) {
        var r = S.user && S.user.role === "buyer" ? myReq(d.slug) : null;
        return '<article class="card ds"><div class="meta"><span class="pill">' + esc(d.field_ru) + '</span><span class="pill">' + d.country + "</span>" + (r ? pill(r.status) : "") + "</div>" +
          "<h3>" + esc(d.title_ru) + "</h3><p>" + esc(d.uni_ru) + "</p>" +
          '<p><b style="color:var(--text)">' + nf(d.rows) + "</b> записей · " + d.columns + " полей</p>" +
          '<p>Для кого: ' + esc(d.buyers_ru) + "</p>" +
          '<a class="btn btn-ghost btn-sm" href="#ds/' + d.slug + '">Открыть →</a></article>';
      }).join("") + "</div>";
  }

  function vMy() {
    var S = store.s;
    var mine = S.requests.filter(function (r) { return r.org === S.user.org; }).sort(function (a, b) { return b.created - a.created; });
    view.innerHTML = "<h1>Мои заявки</h1>" + '<div class="card" style="margin-top:22px">' + (mine.length ? mine.map(function (r) {
      var d = ds(r.ds);
      return '<div class="item"><div><b>' + esc(d.title_ru) + '</b><div class="sub">' + r.id + " · " + date(r.created) + " · " + (r.use === "commercial" ? "коммерческое" : "исследование") + " · " + esc(r.purpose) + "</div></div>" +
        '<div class="acts">' + pill(r.status) + '<a class="btn btn-ghost btn-sm" href="#ds/' + r.ds + '">' + (r.status === "approved" ? "Скачать" : "Открыть") + "</a></div></div>";
    }).join("") : '<p class="empty">Заявок пока нет. <a class="mvp-link" href="#catalog">Откройте каталог</a> и запросите доступ к набору.</p>') + "</div>";
  }

  return { vCatalog, vMy };
}
