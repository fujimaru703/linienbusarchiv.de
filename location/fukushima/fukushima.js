"use strict";

    // =========================================================
    // 設定
    // =========================================================
    const GTFS_BASE = "./";

    // Cloudflare Workerは旧版の2本をそのまま使用
    const TRIP_UPDATE_URL =
      "https://crimson-night-b53e.fujimaru703.workers.dev/";

    const VEHICLE_POSITION_URL =
      "https://morning-sun-eb88.fujimaru703.workers.dev/";

    // 非営業・回送車両用 GAS Web API
    const GAS_FALLBACK_URL =
      "  // 非営業・回送車両用 GAS Web API
    const GAS_FALLBACK_URL =
      "https://script.google.com/macros/s/AKfycbyOyXgfURN7CXy4kmBp1iVjagqqmMB8rB7JCFp_h9a-6E2iijgaxfaVaEpW-IC14Z-U/exec";

    const UPDATE_INTERVAL = 15000;

    // バスロケ表示時間:
    // その日の始発10分前 ～ 終バスの終点到着20分後
    const SERVICE_START_MARGIN_SEC = 10 * 60;
    const SERVICE_END_MARGIN_SEC = 20 * 60;
    const SERVICE_TIMEZONE = "Asia/Tokyo";

    // =========================================================
    // 地図
    // =========================================================
    const CAMERA_STORAGE_KEY = "fukushima-map-camera-v1";

    function loadSavedCamera() {
      try {
        const raw = localStorage.getItem(CAMERA_STORAGE_KEY);
        if (!raw) return null;

        const saved = JSON.parse(raw);
        if (!Array.isArray(saved.center) || saved.center.length !== 2) return null;

        return saved;
      } catch (_) {
        return null;
      }
    }

    const savedCamera = loadSavedCamera();

    const map = new maplibregl.Map({
      container: "map",

      // 保存済み位置があればそこから再開。
      // 初回アクセス時だけ福島市中心・zoom 13。
      center: savedCamera?.center || [140.47, 37.75],
      zoom: Number.isFinite(savedCamera?.zoom) ? savedCamera.zoom : 13,
      bearing: Number.isFinite(savedCamera?.bearing) ? savedCamera.bearing : 0,
      pitch: Number.isFinite(savedCamera?.pitch) ? savedCamera.pitch : 0,

      minZoom: 6,
      maxZoom: 19,
      attributionControl: true,

      // 背景地図
      style: "https://tiles.openfreemap.org/styles/positron"
    });

    map.addControl(new maplibregl.NavigationControl({
      visualizePitch: true
    }), "bottom-right");

    function saveMapCamera() {
      try {
        const center = map.getCenter();

        localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify({
          center: [center.lng, center.lat],
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch()
        }));
      } catch (_) {}
    }

    // ユーザー操作が終わった時点のカメラ状態だけ保存する。
    // 15秒Realtime更新ではカメラ位置を変更しない。
    map.on("moveend", saveMapCamera);
    map.on("zoomend", saveMapCamera);
    map.on("rotateend", saveMapCamera);
    map.on("pitchend", saveMapCamera);
    map.on("zoom", updateVehicleNumberMarkerOffsets);

    // =========================================================
    // データ
    // =========================================================
    const routeNames = Object.create(null);
    const tripHeadsigns = Object.create(null);
    const tripShapeMap = Object.create(null);
    const tripServiceMap = Object.create(null);
    const tripServiceTimes = Object.create(null);

    let calendarRows = [];
    let calendarDateRows = [];
    const shapeMap = Object.create(null);
    const stopNames = Object.create(null);
    const stopDetails = Object.create(null);
    const scheduledTimes = Object.create(null);

    let tripDelays = Object.create(null);
    let latestVehicles = [];
    let fallbackVehicles = [];
    let staticGtfsLoaded = false;
    let updateRunning = false;
    let selectedTripId = null;
    let realtimeTimer = null;
    let vehicleFeaturesByTrip = new Map();
    let selectedStopNameMarkers = [];
    let vehicleInfoPanel = null;
    const vehicleNumberMarkers = new Map();

    const labelIconMap = new Map();
    const label290 = ['2007','8015','8016','8037','8038','8057','8058','8059','8077','8078','8079','8081','8101','8102','0873','0874','8127','8137','8138','8139','8140','8141','8143','8144','8145','8146','2006','0741','0743','0744','0774','0775','0803','8060','8061','7165','8080','80801','8098','8099','8100','8128','8129','8156','8157','8158','0887','0889','7216','0896','0897','8178','8179','8203','8204','8205','5007','5008'];
    label290.forEach(label => labelIconMap.set(label, 'icon/290.png'));

const labelergaev = ['7704','7705','7706'];
labelergaev.forEach(label => labelIconMap.set(label, 'icon/ergaev.png'));

const label557 = ['0557','2411','2412','2408'];
label557.forEach(label => labelIconMap.set(label, 'icon/557&2411.png'));

const label600 = ['8181'];
label600.forEach(label => labelIconMap.set(label, 'icon/600.png'));

const label875 = ['0875','8125'];
label875.forEach(label => labelIconMap.set(label, 'icon/875.png'));

const label1183 = ['1183'];
label1183.forEach(label => labelIconMap.set(label, 'icon/1183.png'));

const label1240 = ['1240'];
label1240.forEach(label => labelIconMap.set(label, 'icon/1240.png'));

const label1311 = ['1304','1311','1241'];
label1311.forEach(label => labelIconMap.set(label, 'icon/1311.png'));

const label1322 = ['1322'];
label1322.forEach(label => labelIconMap.set(label, 'icon/1322.png'));

const label1360 = ['1360'];
label1360.forEach(label => labelIconMap.set(label, 'icon/1360.png'));

const label1388 = ['1388'];
label1388.forEach(label => labelIconMap.set(label, 'icon/1388.png'));

const label1411 = ['1411'];
label1411.forEach(label => labelIconMap.set(label, 'icon/1411.png'));

const label1471 = ['1471'];
label1471.forEach(label => labelIconMap.set(label, 'icon/1471.png'));

const label1516 = ['0890','1527'];
label1516.forEach(label => labelIconMap.set(label, 'icon/1516&1527.png'));

const label1520 = ['1520'];
label1520.forEach(label => labelIconMap.set(label, 'icon/1520.png'));

const label1613 = ['1613'];
label1613.forEach(label => labelIconMap.set(label, 'icon/1613.png'));

const label1735 = ['1735'];
label1735.forEach(label => labelIconMap.set(label, 'icon/1735.png'));

const label1936 = ['1936','1944'];
label1936.forEach(label => labelIconMap.set(label, 'icon/1936&1944.png'));

const label2008 = ['2008'];
label2008.forEach(label => labelIconMap.set(label, 'icon/2008.png'));

const label2236 = ['2236'];
label2236.forEach(label => labelIconMap.set(label, 'icon/2236.png'));

const label2329 = ['0893','2328','2329','7128','2386'];
label2329.forEach(label => labelIconMap.set(label, 'icon/2329&7128.png'));

const label2339 = ['2339'];
label2339.forEach(label => labelIconMap.set(label, 'icon/2331&2339.png'));

const label2383 = ['2383'];
label2383.forEach(label => labelIconMap.set(label, 'icon/2383.png'));

const label2465 = ['2465'];
label2465.forEach(label => labelIconMap.set(label, 'icon/2465.png'));

const label2467 = ['2467'];
label2467.forEach(label => labelIconMap.set(label, 'icon/2467.png'));

const label2468 = ['2468','2469'];
label2468.forEach(label => labelIconMap.set(label, 'icon/2468&2469.png'));

const label2489 = ['2489'];
label2489.forEach(label => labelIconMap.set(label, 'icon/2489.png'));

const label2594 = ['2594'];
label2594.forEach(label => labelIconMap.set(label, 'icon/2594.png'));

const label2940 = ['2940'];
label2940.forEach(label => labelIconMap.set(label, 'icon/2940.png'));

const label2941 = ['2941'];
label2941.forEach(label => labelIconMap.set(label, 'icon/2941.png'));

const label7077 = ['7077'];
label7077.forEach(label => labelIconMap.set(label, 'icon/7077.png'));

const label7085 = ['7085'];
label7085.forEach(label => labelIconMap.set(label, 'icon/7085.png'));

const label7110 = ['7110'];
label7110.forEach(label => labelIconMap.set(label, 'icon/7110.png'));

const label7701 = ['7701','7702','7703'];
label7701.forEach(label => labelIconMap.set(label, 'icon/7701.png'));

const label8008 = ['8008'];
label8008.forEach(label => labelIconMap.set(label, 'icon/8008.png'));

const label8014 = ['8014'];
label8014.forEach(label => labelIconMap.set(label, 'icon/8014.png'));

const label8075 = ['8075'];
label8075.forEach(label => labelIconMap.set(label, 'icon/8075.png'));

const label8109 = ['8109','8148','8160'];
label8109.forEach(label => labelIconMap.set(label, 'icon/8109.png'));

const label8122 = ['8122','8124'];
label8122.forEach(label => labelIconMap.set(label, 'icon/8122&8124.png'));

const label8155 = ['8155'];
label8155.forEach(label => labelIconMap.set(label, 'icon/8155.png'));

const labelkanachan = ['7097','7113','7115','7116'];
labelkanachan.forEach(label => labelIconMap.set(label, 'icon/kanachan.png'));

const labelkanachumio = ['8083','0865','8095'];
labelkanachumio.forEach(label => labelIconMap.set(label, 'icon/kanachu-mio.png'));

const labelkanachumk = ['1623','1625','1668','1706','1769','1771','0562','1860','1863','0580','0581','8186'];
labelkanachumk.forEach(label => labelIconMap.set(label, 'icon/kanachu-mk.png'));

const labelkanachump35 = ['1920','7032','1924','7034','1945','7118','7157','8066','8068'];
labelkanachump35.forEach(label => labelIconMap.set(label, 'icon/kanachu-mp35.png'));

const labelkanachump37 = ['7024','7028','1891','2001'];
labelkanachump37.forEach(label => labelIconMap.set(label, 'icon/kanachu-mp37.png'));

const labelkanehachi = ['0550','0660'];
labelkanehachi.forEach(label => labelIconMap.set(label, 'icon/kanehachi.png'));

const labelkantomidi = ['0672','2009','2022','8022'];
labelkantomidi.forEach(label => labelIconMap.set(label, 'icon/kanto-midi.png'));

const labelkeiohr = ['1544','1638','1641','1645','1646','1657','1698','1740','1764','7198'];
labelkeiohr.forEach(label => labelIconMap.set(label, 'icon/keio-hr.png'));

const labelkeiomklong = ['7047','7050','7052','7061','7064'];
labelkeiomklong.forEach(label => labelIconMap.set(label, 'icon/keio-mk-long.png'));

const labelklhr = ['7030','7033','1943','7036','7045','1974','2027','7213','0575'];
labelklhr.forEach(label => labelIconMap.set(label, 'icon/kl-hr.png'));

const labelkllt = ['1723','7072','1812','1822','1828','1843','8020','8032','8043'];
labelkllt.forEach(label => labelIconMap.set(label, 'icon/kl-lt.png'));

const labelkwskhr = ['7137','8123','8130'];
labelkwskhr.forEach(label => labelIconMap.set(label, 'icon/kwsk-hr.png'));

const labelliesse = ['1382','1590','1859','0854','8147','0905'];
labelliesse.forEach(label => labelIconMap.set(label, 'icon/liesse.png'));

const labelmk = ['0044','0672','0864','2009','2022','8019','8022','8073','8076','7199','7217','1541','8202','0672'];
labelmk.forEach(label => labelIconMap.set(label, 'icon/mk.png'));

const labelmk517 = ['2091','2103'];
labelmk517.forEach(label => labelIconMap.set(label, 'icon/mk517.png'));

const labelmk619 = ['2414','2416','2417','2418','2420'];
labelmk619.forEach(label => labelIconMap.set(label, 'icon/mk619.png'));

const labelmkf = ['0603','2548','2551','5005','0014'];
labelmkf.forEach(label => labelIconMap.set(label, 'icon/mk-f.png'));

const labelmp35silver = ['7106','7109','7111','7112','7114','7117','7119'];
labelmp35silver.forEach(label => labelIconMap.set(label, 'icon/mp35-silver.png'));

const labelmp37 = ['2039','2046','8006','7058','8007','8009','8010','8012','7078','7079','7084','7088','7089','7090','7091','7098','7099','7100','7129','7130','7136','7139','7143','7145','7151','7152','8096','8171'];
labelmp37.forEach(label => labelIconMap.set(label, 'icon/mp37.png'));

const labelmp37black = ['7082','7083','7093','7094','7095','7096'];
labelmp37black.forEach(label => labelIconMap.set(label, 'icon/mp37-black.png'));

const labelmp37silver = ['7080','7086','7087','7092'];
labelmp37silver.forEach(label => labelIconMap.set(label, 'icon/mp37-silver.png'));

const labelmp317 = ['2536','2585','2586','2588','2592','2593'];
labelmp317.forEach(label => labelIconMap.set(label, 'icon/mp317.png'));

const labelnankairj = ['8063','8064'];
labelnankairj.forEach(label => labelIconMap.set(label, 'icon/nankai-rj.png'));

const labelpdgkr = ['1836','1837','0997','0998','1091','1092','1196','1197','1217','7132','7148','7150','7153','8112','8069','0885'];
labelpdgkr.forEach(label => labelIconMap.set(label, 'icon/pdg-kr.png'));

const labelpdglr = ['0995','0996','8088','1089','1090','1192','1193','1194','1219','1220','1221','0997','0998','1091','1092','1196','1197','1217','1605','1835','8036','8041'];
labelpdglr.forEach(label => labelIconMap.set(label, 'icon/pdg-lr.png'));

const labelpkhr = ['8024','8033','8044','8074'];
labelpkhr.forEach(label => labelIconMap.set(label, 'icon/pk-hr.png'));

const labelrakuraku = ['0017','0018','0867','0021','8163','8162','0116','0117','0119','0120','0121','8169','0193','0236','0237','0238','2045','0299','0302','0397','0408','0406','0407','0409','8134','8135','0847'];
labelrakuraku.forEach(label => labelIconMap.set(label, 'icon/rakuraku.png'));

const labelrakurakuf = ['0017','0116'];
labelrakurakuf.forEach(label => labelIconMap.set(label, 'icon/rakuraku-f.png'));

const labelrinkomio = ['1336','1369','1379','5003','5004','1710','1720','2020','1732','1850','1854','1857','2041','8150','8025'];
labelrinkomio.forEach(label => labelIconMap.set(label, 'icon/rinko-mio.png'));

const labelserega = ['1537','1538','8002'];
labelserega.forEach(label => labelIconMap.set(label, 'icon/serega(15~).png'));

const labeltkgmk = ['1472','1473','0879','0510','0878','8045','1660','0878','7133','7134','1833','1834','1926','1927','1928','1929','1930','2004','2005'];
labeltkgmk.forEach(label => labelIconMap.set(label, 'icon/tkg-mk.png'));

const labeltoeimklong = ['7046','1990','7047','1999'];
labeltoeimklong.forEach(label => labelIconMap.set(label, 'icon/toei-mk-long.png'));

const labelmiharu = ['0500'];
labelmiharu.forEach(label => labelIconMap.set(label, 'icon/miharu.png'));

const labelmiharu290 = ['0386'];
labelmiharu290.forEach(label => labelIconMap.set(label, 'icon/miharu290.png'));

const label234 = ['7146','5002','0430','0431','8039','7135','7144','8159','7163','8072','7164','7166','8086','7171','8089','8090','8085','7172','8097','7181','8103','7182','8107','7186','8113','7187','8126','8133','8185','8167','8168','8200'];
label234.forEach(label => labelIconMap.set(label, 'icon/234.png'));


    function cleanId(v) {
      return String(v ?? "").replace(/^"|"$/g, "").trim();
    }

    // =========================================================
    // CSV
    // 簡易split(",")ではなく、引用符入りCSVにも対応
    // =========================================================
    function parseCsv(text) {
      const rows = [];
      let row = [];
      let field = "";
      let quoted = false;

      for (let i = 0; i < text.length; i++) {
        const c = text[i];

        if (quoted) {
          if (c === '"') {
            if (text[i + 1] === '"') {
              field += '"';
              i++;
            } else {
              quoted = false;
            }
          } else {
            field += c;
          }
        } else {
          if (c === '"') {
            quoted = true;
          } else if (c === ",") {
            row.push(field);
            field = "";
          } else if (c === "\n") {
            row.push(field.replace(/\r$/, ""));
            rows.push(row);
            row = [];
            field = "";
          } else {
            field += c;
          }
        }
      }

      if (field.length || row.length) {
        row.push(field.replace(/\r$/, ""));
        rows.push(row);
      }

      return rows;
    }

    async function fetchText(url) {
      const r = await fetch(url, { cache: "force-cache" });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${url}`);
      return r.text();
    }

    async function fetchJson(url) {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${url}`);
      return r.json();
    }

    // calendar.txt / calendar_dates.txt は、無いGTFSでも動くよう任意読込。
    async function fetchOptionalText(url) {
      try {
        const r = await fetch(url, { cache: "force-cache" });
        if (!r.ok) return "";
        return r.text();
      } catch (_) {
        return "";
      }
    }

    // =========================================================
    // 静的GTFS: 初回に1回だけ読む
    // =========================================================
    async function loadStaticGtfs() {
      const [
        routesText,
        tripsText,
        stopsText,
        stopTimesText,
        shapesText,
        calendarText,
        calendarDatesText
      ] = await Promise.all([
        fetchText(GTFS_BASE + "routes.txt"),
        fetchText(GTFS_BASE + "trips.txt"),
        fetchText(GTFS_BASE + "stops.txt"),
        fetchText(GTFS_BASE + "stop_times.txt"),
        fetchText(GTFS_BASE + "shapes.txt"),
        fetchOptionalText(GTFS_BASE + "calendar.txt"),
        fetchOptionalText(GTFS_BASE + "calendar_dates.txt")
      ]);

      parseRoutes(routesText);
      parseTrips(tripsText);
      parseStops(stopsText);
      parseStopTimes(stopTimesText);
      parseShapes(shapesText);
      parseCalendar(calendarText);
      parseCalendarDates(calendarDatesText);

      staticGtfsLoaded = true;
    }

    function headerIndex(header) {
      const map = Object.create(null);
      header.forEach((v, i) => map[v] = i);
      return map;
    }

    function parseRoutes(text) {
      const rows = parseCsv(text);
      if (!rows.length) return;
      const h = headerIndex(rows[0]);
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const id = cleanId(r[h.route_id]);
        if (!id) continue;
        routeNames[id] = cleanId(r[h.route_long_name] || r[h.route_short_name]);
      }
    }

    function parseTrips(text) {
      const rows = parseCsv(text);
      if (!rows.length) return;
      const h = headerIndex(rows[0]);
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const tripId = cleanId(r[h.trip_id]);
        if (!tripId) continue;
        tripHeadsigns[tripId] = cleanId(r[h.trip_headsign]);
        tripShapeMap[tripId] = cleanId(r[h.shape_id]);
        tripServiceMap[tripId] =
          h.service_id != null ? cleanId(r[h.service_id]) : "";
      }
    }

    function parseStops(text) {
      const rows = parseCsv(text);
      if (!rows.length) return;
      const h = headerIndex(rows[0]);
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const stopId = cleanId(r[h.stop_id]);
        const lat = Number(r[h.stop_lat]);
        const lon = Number(r[h.stop_lon]);
        if (!stopId || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        const name = cleanId(r[h.stop_name]);
        stopNames[stopId] = name;
        stopDetails[stopId] = { name, lat, lon };
      }
    }

    function gtfsTimeToSeconds(raw) {
      const parts = String(raw ?? "").split(":").map(Number);
      if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) {
        return NaN;
      }

      const hh = parts[0];
      const mm = parts[1];
      const ss = Number.isFinite(parts[2]) ? parts[2] : 0;
      return hh * 3600 + mm * 60 + ss;
    }

    function parseStopTimes(text) {
      const rows = parseCsv(text);
      if (!rows.length) return;
      const h = headerIndex(rows[0]);

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const tripId = cleanId(r[h.trip_id]);
        const seq = Number(r[h.stop_sequence]);
        if (!tripId || !Number.isFinite(seq)) continue;

        const arrival = cleanId(r[h.arrival_time]);
        const departure =
          h.departure_time != null
            ? cleanId(r[h.departure_time])
            : arrival;

        if (!scheduledTimes[tripId]) scheduledTimes[tripId] = Object.create(null);
        scheduledTimes[tripId][seq] = arrival;

        if (!tripServiceTimes[tripId]) {
          tripServiceTimes[tripId] = {
            firstSeq: Infinity,
            firstDepartureSec: NaN,
            lastSeq: -Infinity,
            lastArrivalSec: NaN
          };
        }

        const t = tripServiceTimes[tripId];
        const departureSec = gtfsTimeToSeconds(departure || arrival);
        const arrivalSec = gtfsTimeToSeconds(arrival || departure);

        if (seq < t.firstSeq) {
          t.firstSeq = seq;
          t.firstDepartureSec = departureSec;
        }

        if (seq > t.lastSeq) {
          t.lastSeq = seq;
          t.lastArrivalSec = arrivalSec;
        }
      }
    }

    function parseCalendar(text) {
      calendarRows = [];
      if (!text) return;

      const rows = parseCsv(text);
      if (!rows.length) return;
      const h = headerIndex(rows[0]);

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const serviceId = cleanId(r[h.service_id]);
        if (!serviceId) continue;

        calendarRows.push({
          serviceId,
          monday: Number(r[h.monday]) === 1,
          tuesday: Number(r[h.tuesday]) === 1,
          wednesday: Number(r[h.wednesday]) === 1,
          thursday: Number(r[h.thursday]) === 1,
          friday: Number(r[h.friday]) === 1,
          saturday: Number(r[h.saturday]) === 1,
          sunday: Number(r[h.sunday]) === 1,
          startDate: cleanId(r[h.start_date]),
          endDate: cleanId(r[h.end_date])
        });
      }
    }

    function parseCalendarDates(text) {
      calendarDateRows = [];
      if (!text) return;

      const rows = parseCsv(text);
      if (!rows.length) return;
      const h = headerIndex(rows[0]);

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const serviceId = cleanId(r[h.service_id]);
        const date = cleanId(r[h.date]);
        const exceptionType = Number(r[h.exception_type]);

        if (!serviceId || !date || !Number.isFinite(exceptionType)) continue;
        calendarDateRows.push({ serviceId, date, exceptionType });
      }
    }

    function japanNowParts(date = new Date()) {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: SERVICE_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
      }).formatToParts(date);

      const get = type => parts.find(p => p.type === type)?.value || "";
      const year = get("year");
      const month = get("month");
      const day = get("day");

      return {
        dateKey: `${year}${month}${day}`,
        weekday: get("weekday").toLowerCase(),
        seconds:
          Number(get("hour")) * 3600 +
          Number(get("minute")) * 60 +
          Number(get("second"))
      };
    }

    function activeServiceIdsForToday(nowParts) {
      const active = new Set();

      // calendar.txt がある場合は曜日・有効期間で絞る。
      if (calendarRows.length) {
        for (const row of calendarRows) {
          if (row.startDate && nowParts.dateKey < row.startDate) continue;
          if (row.endDate && nowParts.dateKey > row.endDate) continue;
          if (row[nowParts.weekday]) active.add(row.serviceId);
        }
      } else {
        // calendar.txt が無いGTFSでは trips.txt にある全service_idを候補にする。
        for (const serviceId of Object.values(tripServiceMap)) {
          if (serviceId) active.add(serviceId);
        }
      }

      // calendar_dates.txt の例外を反映。1=追加、2=運休。
      for (const row of calendarDateRows) {
        if (row.date !== nowParts.dateKey) continue;
        if (row.exceptionType === 1) active.add(row.serviceId);
        if (row.exceptionType === 2) active.delete(row.serviceId);
      }

      return active;
    }

    function getTodayServiceWindow() {
      const nowParts = japanNowParts();
      const activeServices = activeServiceIdsForToday(nowParts);
      const hasServiceIds = Object.values(tripServiceMap).some(Boolean);

      let firstDepartureSec = Infinity;
      let lastArrivalSec = -Infinity;

      for (const [tripId, times] of Object.entries(tripServiceTimes)) {
        const serviceId = tripServiceMap[tripId];

        // service_id が使える場合だけ、その日の運行便に絞る。
        if (hasServiceIds && serviceId && !activeServices.has(serviceId)) continue;

        if (Number.isFinite(times.firstDepartureSec)) {
          firstDepartureSec = Math.min(firstDepartureSec, times.firstDepartureSec);
        }

        if (Number.isFinite(times.lastArrivalSec)) {
          lastArrivalSec = Math.max(lastArrivalSec, times.lastArrivalSec);
        }
      }

      if (!Number.isFinite(firstDepartureSec) || !Number.isFinite(lastArrivalSec)) {
        return null;
      }

      return {
        nowSec: nowParts.seconds,
        startSec: firstDepartureSec - SERVICE_START_MARGIN_SEC,
        endSec: lastArrivalSec + SERVICE_END_MARGIN_SEC
      };
    }

    function isBusLocationOperating() {
      const window = getTodayServiceWindow();

      // 時刻表を判定できなかった場合は、誤停止を避けて従来どおり動かす。
      if (!window) return true;

      return window.nowSec >= window.startSec && window.nowSec <= window.endSec;
    }

    // fallbackは
    // ・通常のバスロケ運行時間中
    // ・その日の最終便終了後～24:00
    // ・00:00～03:59
    // に動かす。
    //
    // 04:00～その日の運行開始前はGASも呼ばない。
    function isFallbackLocationOperating() {
      const nowParts = japanNowParts();
      const hour = Math.floor(nowParts.seconds / 3600);

      if (hour < 4) return true;

      const window = getTodayServiceWindow();
      if (!window) return true;

      if (window.nowSec >= window.startSec && window.nowSec <= window.endSec) {
        return true;
      }

      return window.nowSec > window.endSec;
    }

    function clearRealtimeDisplayForOffHours() {
      latestVehicles = [];
      fallbackVehicles = [];
      tripDelays = Object.create(null);
      selectedTripId = null;

      updateVehicleNumberMarkers([]);
      clearSelectedStopNameMarkers();

      if (vehicleInfoPanel) {
        vehicleInfoPanel.style.display = "none";
        vehicleInfoPanel.replaceChildren();
      }

      for (const sourceId of [
        "vehicles",
        "selected-vehicle",
        "selected-route",
        "selected-stops"
      ]) {
        const source = map.getSource(sourceId);
        if (source) source.setData(emptyFeatureCollection());
      }
    }

    function showOutOfService() {
      clearRealtimeDisplayForOffHours();

      const status = document.getElementById("statusDisplay");
      if (status) status.textContent = "現在は運行時間外です";

      const timestamp = document.getElementById("readableTimestamp");
      if (timestamp) timestamp.textContent = "--";

      setLoading(false);
    }

    function parseShapes(text) {
      const rows = parseCsv(text);
      if (!rows.length) return;
      const h = headerIndex(rows[0]);
      const points = Object.create(null);

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const shapeId = cleanId(r[h.shape_id]);
        const lat = Number(r[h.shape_pt_lat]);
        const lon = Number(r[h.shape_pt_lon]);
        const seq = Number(r[h.shape_pt_sequence]);

        if (!shapeId || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        if (!points[shapeId]) points[shapeId] = [];
        points[shapeId].push({ seq, lat, lon });
      }

      for (const [shapeId, arr] of Object.entries(points)) {
        arr.sort((a, b) => a.seq - b.seq);
        // MapLibre/GeoJSONは [lon, lat]
        shapeMap[shapeId] = arr.map(p => [p.lon, p.lat]);
      }
    }

    // =========================================================
    // GTFS-RT
    // =========================================================
    async function loadDelays() {
      const data = await fetchJson(TRIP_UPDATE_URL);
      const delays = Object.create(null);

      for (const entity of data.entity || []) {
        const trip = entity?.tripUpdate?.trip;
        const updates = entity?.tripUpdate?.stopTimeUpdate;
        const tripId = cleanId(trip?.tripId);

        if (!tripId || !Array.isArray(updates)) continue;

        const delayMap = Object.create(null);

        for (const update of updates) {
          const seq = Number(update?.stopSequence);
          if (!Number.isFinite(seq)) continue;

          const stopId = cleanId(update?.stopId);
          let delay = 0;

          if (update?.departure?.delay != null) delay = Number(update.departure.delay) || 0;
          else if (update?.arrival?.delay != null) delay = Number(update.arrival.delay) || 0;

          delayMap[seq] = {
            delay,
            stopId,
            arrivalTime: update?.arrival?.time ?? null,
            departureTime: update?.departure?.time ?? null
          };
        }

        delays[tripId] = delayMap;
      }

      tripDelays = delays;
    }

    async function loadVehicles() {
      const data = await fetchJson(VEHICLE_POSITION_URL);
      const vehicles = [];

      for (const entity of data.entity || []) {
        const v = entity?.vehicle;
        const p = v?.position;

        if (!p) continue;

        const lat = Number(p.latitude);
        const lon = Number(p.longitude);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        vehicles.push({
          tripId: cleanId(v?.trip?.tripId),
          routeId: cleanId(v?.trip?.routeId),
          seq: Number(v?.currentStopSequence),

          // Cloudflareのlabel = Bus-Vision側vehicleCd
          label: cleanId(v?.vehicle?.label) || "?",

          lat,
          lon,
          bearing: Number(p.bearing),
          isFallback: false
        });
      }

      latestVehicles = vehicles;
    }


    // =========================================================
    // GAS fallback
    // =========================================================
    async function loadFallbackVehicles() {

      if (!isFallbackLocationOperating()) {
        fallbackVehicles = [];
        return;
      }

      // Cloudflareに現在出ている車両はGAS側で除外する。
      const activeVehicleCds = latestVehicles
        .map(v => cleanId(v.label))
        .filter(Boolean);

      const url =
        GAS_FALLBACK_URL +
        "?active=" +
        encodeURIComponent(activeVehicleCds.join(","));

      const data = await fetchJson(url);

      if (!data?.success) {
        throw new Error(data?.error || "GAS fallback API error");
      }

      const vehicles = [];

      for (const v of data.vehicles || []) {
        const lat = Number(v?.latitude);
        const lon = Number(v?.longitude);
        const vehicleCd = cleanId(v?.vehicleCd);

        if (!vehicleCd) continue;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        vehicles.push({
          tripId: "",
          routeId: "",
          seq: NaN,

          // vehicleCdをそのまま車番表示に使用
          label: vehicleCd,

          lat,
          lon,
          bearing: 0,

          isFallback: true,
          fallbackRoute: cleanId(v?.route) || "路線名不明",
          fallbackDestination: cleanId(v?.destination) || "行先不明",
          fallbackTerminalTime: cleanId(v?.terminalTime),

          // GASのO列 map_url
          fallbackMapUrl: cleanId(v?.mapUrl),

          positionAge: Number(v?.positionAge)
        });
      }

      fallbackVehicles = vehicles;
    }


    function displayedVehicles() {
      return [
        ...latestVehicles,
        ...fallbackVehicles
      ];
    }

    // =========================================================
    // 表示用
    // =========================================================
    function formatDelay(sec) {
      sec = Number(sec) || 0;
      if (sec < 60) return "ほぼ定刻";
      const min = Math.floor(sec / 60);
      const rem = Math.abs(Math.floor(sec % 60));
      return `${min}分${rem}秒遅れ`;
    }

    function getDelayForVehicle(v) {
      if (!v.tripId || !Number.isFinite(v.seq)) return 0;

      // 旧版のロジックを維持。次停留所情報を優先。
      const mapForTrip = tripDelays[v.tripId];
      if (!mapForTrip) return 0;

      return mapForTrip[v.seq + 1]?.delay ??
             mapForTrip[v.seq]?.delay ??
             0;
    }

    function vehicleGeoJson() {
      vehicleFeaturesByTrip.clear();

      const features = displayedVehicles().map((v, idx) => {
        const delay = v.isFallback ? 0 : getDelayForVehicle(v);
        const routeName = v.isFallback
          ? (v.fallbackRoute || "路線名不明")
          : (routeNames[v.routeId] || "路線名不明");
        const headsign = v.isFallback
          ? (v.fallbackDestination || "行先不明")
          : (tripHeadsigns[v.tripId] || "行先不明");

        const f = {
          type: "Feature",
          id: idx,
          geometry: {
            type: "Point",
            coordinates: [v.lon, v.lat]
          },
          properties: {
            tripId: v.tripId,
            routeId: v.routeId,
            routeName,
            headsign,
            label: v.label,
            delay,
            delayText: v.isFallback ? "非営業" : formatDelay(delay),
            iconKey: v.label,
            bearing: Number.isFinite(v.bearing) ? v.bearing : 0,
            isFallback: v.isFallback ? 1 : 0,
            terminalTime: v.fallbackTerminalTime || "",
            mapUrl: v.fallbackMapUrl || "",
            positionAge: Number.isFinite(v.positionAge) ? v.positionAge : -1
          }
        };

        if (!v.isFallback && v.tripId) {
          vehicleFeaturesByTrip.set(v.tripId, f);
        }
        return f;
      });

      return {
        type: "FeatureCollection",
        features
      };
    }

    function clearSelectedStopNameMarkers() {
      for (const marker of selectedStopNameMarkers) {
        marker.remove();
      }
      selectedStopNameMarkers = [];
    }

    function renderSelectedStopNameMarkers(tripId, currentSeq) {
      clearSelectedStopNameMarkers();

      const stops = getFutureStopsInfo(tripId, currentSeq);

      for (const stop of stops) {
        const detail = stopDetails[stop.stopId];
        if (!detail) continue;

        const el = document.createElement("div");
        el.style.pointerEvents = "none";
        el.style.whiteSpace = "nowrap";
        el.style.fontFamily = "system-ui, -apple-system, 'Segoe UI', sans-serif";
        el.style.lineHeight = "1.12";

        const name = document.createElement("div");
        name.textContent = stop.name;
        name.style.fontSize = "11px";
        name.style.fontWeight = "800";
        name.style.color = "#17232b";
        name.style.textShadow =
          "-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0 0 3px #fff";

        const meta = document.createElement("div");
        meta.style.marginTop = "2px";
        meta.style.fontSize = "9px";
        meta.style.fontWeight = "700";
        meta.style.textShadow =
          "-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0 0 3px #fff";

        const time = document.createElement("span");
        time.textContent = stop.scheduledText;
        time.style.color = "#56636c";

        const status = document.createElement("span");
        status.textContent = ` ${stop.delayText}`;
        status.style.color = stop.delay < 60 ? "#16834b" : "#d93025";
        status.style.fontWeight = "900";

        meta.append(time, status);
        el.append(name, meta);

        const marker = new maplibregl.Marker({
          element: el,
          anchor: "left",
          offset: [9, 0]
        })
          .setLngLat([detail.lon, detail.lat])
          .addTo(map);

        selectedStopNameMarkers.push(marker);
      }
    }

    function ensureVehicleInfoPanel() {
      if (vehicleInfoPanel) return vehicleInfoPanel;

      const style = document.createElement("style");
      style.textContent = `
        #vehicleInfoPanel {
          position: fixed;
          left: 14px;
          bottom: 14px;
          z-index: 30;
          width: min(300px, calc(100vw - 28px));
          box-sizing: border-box;
          padding: 11px 12px;
          border: 1px solid rgba(31, 52, 65, .15);
          border-radius: 13px;
          background: rgba(255, 255, 255, .94);
          box-shadow: 0 8px 28px rgba(21, 42, 56, .18);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
          color: #17232b;
          display: none;
          pointer-events: auto;
        }

        #vehicleInfoPanel .vip-head {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 8px;
        }

        #vehicleInfoPanel .vip-icon {
          width: 38px;
          height: 38px;
          object-fit: contain;
          image-rendering: auto;
          flex: 0 0 38px;
        }

        #vehicleInfoPanel .vip-number {
          font-size: 18px;
          line-height: 1;
          font-weight: 900;
        }

        #vehicleInfoPanel .vip-route {
          font-size: 12px;
          line-height: 1.35;
          font-weight: 800;
          margin-bottom: 3px;
        }

        #vehicleInfoPanel .vip-destination {
          font-size: 10px;
          line-height: 1.35;
          color: #5a6972;
          margin-bottom: 9px;
        }

        #vehicleInfoPanel .vip-next {
          padding: 8px 9px;
          border-radius: 9px;
          background: #f4f8fa;
          border: 1px solid #e3ebef;
        }

        #vehicleInfoPanel .vip-next-label {
          font-size: 8px;
          line-height: 1.2;
          color: #76848c;
          font-weight: 800;
        }

        #vehicleInfoPanel .vip-next-name {
          margin-top: 2px;
          font-size: 11px;
          line-height: 1.3;
          font-weight: 900;
        }

        #vehicleInfoPanel .vip-time {
          margin-top: 3px;
          font-size: 10px;
          font-weight: 700;
          color: #5e6c74;
        }

        #vehicleInfoPanel .vip-status {
          margin-left: 6px;
          font-weight: 900;
        }

        #vehicleInfoPanel .vip-status.is-ontime {
          color: #16834b;
        }

        #vehicleInfoPanel .vip-status.is-late {
          color: #d93025;
        }

        @media (max-width: 640px) {
          #vehicleInfoPanel {
            left: 8px;
            bottom: 8px;
            width: min(245px, calc(100vw - 16px));
            padding: 8px 9px;
            border-radius: 11px;
          }

          #vehicleInfoPanel .vip-head {
            gap: 7px;
            margin-bottom: 6px;
          }

          #vehicleInfoPanel .vip-icon {
            width: 32px;
            height: 32px;
            flex-basis: 32px;
          }

          #vehicleInfoPanel .vip-number {
            font-size: 16px;
          }

          #vehicleInfoPanel .vip-route {
            font-size: 11px;
          }

          #vehicleInfoPanel .vip-destination,
          #vehicleInfoPanel .vip-time {
            font-size: 9px;
          }

          #vehicleInfoPanel .vip-next {
            padding: 7px 8px;
          }

          #vehicleInfoPanel .vip-next-name {
            font-size: 10px;
          }
        }
      `;
      document.head.appendChild(style);

      vehicleInfoPanel = document.createElement("div");
      vehicleInfoPanel.id = "vehicleInfoPanel";
      vehicleInfoPanel.setAttribute("aria-live", "polite");
      document.body.appendChild(vehicleInfoPanel);

      return vehicleInfoPanel;
    }

    function hideVehicleInfoPanel() {
      const panel = ensureVehicleInfoPanel();
      panel.style.display = "none";
      panel.replaceChildren();
    }

    function showVehicleInfoPanel(vehicleProperties, currentSeq) {
      const panel = ensureVehicleInfoPanel();

      const next = getNextStopInfo(vehicleProperties.tripId, currentSeq);
      const iconUrl = getVehicleIconUrl(vehicleProperties.label);

      const head = document.createElement("div");
      head.className = "vip-head";

      const img = document.createElement("img");
      img.className = "vip-icon";
      img.src = iconUrl;
      img.alt = "";

      const number = document.createElement("div");
      number.className = "vip-number";
      number.textContent = vehicleProperties.label || "?";

      head.append(img, number);

      /*
       * fallback（非営業・回送）表示
       *
       * 0890
       * 回送
       *
       * 直前の運行
       * 新白河・石川線
       * → 石川町役場
       * 09:40
       * 非営業・位置 16秒前
       */
      if (Number(vehicleProperties.isFallback) === 1) {
        const deadhead = document.createElement("div");
        deadhead.className = "vip-route";
        deadhead.textContent = "回送";

        panel.replaceChildren(head, deadhead);

        const nextBox = document.createElement("div");
        nextBox.className = "vip-next";

        const label = document.createElement("div");
        label.className = "vip-next-label";
        label.textContent = "直前の運行";

        const route = document.createElement("div");
        route.className = "vip-next-name";
        route.textContent =
          vehicleProperties.routeName || "路線名不明";

        const destination = document.createElement("div");
        destination.className = "vip-destination";
        destination.style.marginBottom = "3px";
        destination.textContent =
          `→ ${vehicleProperties.headsign || "行先不明"}`;

        const terminalTime = document.createElement("div");
        terminalTime.className = "vip-time";
        terminalTime.textContent =
          vehicleProperties.terminalTime || "終着時刻不明";

        const status = document.createElement("div");
        status.className = "vip-time";

        const age = Number(vehicleProperties.positionAge);
        status.textContent =
          Number.isFinite(age) && age >= 0
            ? `非営業・位置 ${age}秒前`
            : "非営業";

        nextBox.append(
          label,
          route,
          destination,
          terminalTime,
          status
        );

        panel.appendChild(nextBox);

        const mapUrl =
          String(vehicleProperties.mapUrl || "").trim();

        if (mapUrl) {
          const trackingLink = document.createElement("a");
          trackingLink.href = mapUrl;
          trackingLink.target = "_blank";
          trackingLink.rel = "noopener noreferrer";
          trackingLink.textContent = "回送追跡";
          trackingLink.style.display = "block";
          trackingLink.style.marginTop = "10px";
          trackingLink.style.textAlign = "center";
          trackingLink.style.fontWeight = "700";
          trackingLink.style.textDecoration = "none";
          trackingLink.style.padding = "9px 12px";
          trackingLink.style.border = "1px solid currentColor";
          trackingLink.style.borderRadius = "8px";

          panel.appendChild(trackingLink);
        }

        panel.style.display = "block";
        return;
      }

      /*
       * 通常運行中
       */
      const route = document.createElement("div");
      route.className = "vip-route";
      route.textContent = vehicleProperties.routeName || "路線名不明";

      const destination = document.createElement("div");
      destination.className = "vip-destination";
      destination.textContent = `→ ${vehicleProperties.headsign || "行先不明"}`;

      panel.replaceChildren(head, route, destination);

      if (next) {
        const nextBox = document.createElement("div");
        nextBox.className = "vip-next";

        const label = document.createElement("div");
        label.className = "vip-next-label";
        label.textContent = "次の停留所";

        const name = document.createElement("div");
        name.className = "vip-next-name";
        name.textContent = next.name;

        const time = document.createElement("div");
        time.className = "vip-time";
        time.textContent = next.scheduledText;

        const status = document.createElement("span");
        status.className =
          "vip-status " + (next.delay < 60 ? "is-ontime" : "is-late");
        status.textContent = next.delayText;

        time.appendChild(status);
        nextBox.append(label, name, time);
        panel.appendChild(nextBox);
      }

      panel.style.display = "block";
    }

    function vehicleIconScaleAtZoom(zoom) {
      if (zoom <= 8) return 0.35;
      if (zoom <= 13) return 0.35 + (zoom - 8) * (0.65 - 0.35) / 5;
      if (zoom <= 16) return 0.65 + (zoom - 13) * (0.90 - 0.65) / 3;
      if (zoom <= 19) return 0.90 + (zoom - 16) * (1.15 - 0.90) / 3;
      return 1.15;
    }

    function vehicleNumberMarkerOffset() {
      // 50pxアイコンの下端より少し下に車番チップを置く
      const halfIcon = 25 * vehicleIconScaleAtZoom(map.getZoom());
      return [0, Math.round(halfIcon + 3)];
    }

    function createVehicleNumberElement(label) {
      const el = document.createElement("div");

      el.textContent = label || "?";
      el.style.pointerEvents = "none";
      el.style.whiteSpace = "nowrap";
      el.style.padding = "1px 4px";
      el.style.border = "1px solid rgba(38, 52, 60, .16)";
      el.style.borderRadius = "4px";
      el.style.background = "rgba(255, 255, 255, .90)";
      el.style.boxShadow = "0 1px 4px rgba(21, 42, 56, .12)";
      el.style.color = "#26343c";
      el.style.fontFamily = "system-ui, -apple-system, 'Segoe UI', sans-serif";
      el.style.fontSize = "9px";
      el.style.fontWeight = "800";
      el.style.lineHeight = "1.15";
      el.style.letterSpacing = ".1px";
      el.style.backdropFilter = "blur(3px)";
      el.style.webkitBackdropFilter = "blur(3px)";
      el.style.userSelect = "none";
      el.style.webkitUserSelect = "none";

      return el;
    }

    function vehicleMarkerKey(v) {
      // 車番が基本的に一意なので車番優先。無い場合のみtrip_idを使う。
      return cleanId(v?.label) || cleanId(v?.tripId) || `${v?.lat},${v?.lon}`;
    }

    function updateVehicleNumberMarkers(vehicles) {
      const alive = new Set();
      const offset = vehicleNumberMarkerOffset();

      for (const v of vehicles || []) {
        if (!Number.isFinite(v.lat) || !Number.isFinite(v.lon)) continue;

        const key = vehicleMarkerKey(v);
        alive.add(key);

        let item = vehicleNumberMarkers.get(key);

        if (!item) {
          const element = createVehicleNumberElement(v.label);

          const marker = new maplibregl.Marker({
            element,
            anchor: "top",
            offset,
            pitchAlignment: "viewport",
            rotationAlignment: "viewport"
          })
            .setLngLat([v.lon, v.lat])
            .addTo(map);

          item = { marker, element };
          vehicleNumberMarkers.set(key, item);
        } else {
          item.marker.setLngLat([v.lon, v.lat]);
          item.marker.setOffset(offset);

          const nextText = v.label || "?";
          if (item.element.textContent !== nextText) {
            item.element.textContent = nextText;
          }
        }
      }

      for (const [key, item] of vehicleNumberMarkers) {
        if (alive.has(key)) continue;
        item.marker.remove();
        vehicleNumberMarkers.delete(key);
      }
    }

    function updateVehicleNumberMarkerOffsets() {
      const offset = vehicleNumberMarkerOffset();
      for (const { marker } of vehicleNumberMarkers.values()) {
        marker.setOffset(offset);
      }
    }

    function emptyFeatureCollection() {
      return {
        type: "FeatureCollection",
        features: []
      };
    }

    function selectedRouteGeoJson(tripId) {
      const shapeId = tripShapeMap[tripId];
      const coords = shapeMap[shapeId];

      if (!coords?.length) return emptyFeatureCollection();

      return {
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: coords
          }
        }]
      };
    }

    function futureStopsGeoJson(tripId, currentSeq) {
      const future = getFutureStopsInfo(tripId, currentSeq);

      return {
        type: "FeatureCollection",
        features: future.map(stop => {
          const detail = stopDetails[stop.stopId];
          if (!detail) return null;

          return {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [detail.lon, detail.lat]
            },
            properties: {
              stopId: stop.stopId,
              name: stop.name,
              scheduledText: stop.scheduledText,
              delay: stop.delay,
              delayText: stop.delayText,
              delayLateText: stop.delay >= 60 ? stop.delayText : "",
              delayOnTimeText: stop.delay < 60 ? "定刻" : ""
            }
          };
        }).filter(Boolean)
      };
    }

    // =========================================================
    // 車両アイコン画像をMapLibreへ登録
    // 同じPNGは一度しかロードしない
    // =========================================================
    async function loadImageToMap(url) {
      if (map.hasImage(url)) return;
      try {
        const img = await map.loadImage(url);
        if (!map.hasImage(url)) map.addImage(url, img.data);
      } catch (e) {
        console.warn("アイコン読込失敗:", url, e);
      }
    }

    function iconUrlForLabel(label) {
      return labelIconMap.get(String(label ?? "").trim()) || "icon/yokokamo.png";
    }

    async function ensureVehicleIcons(vehicles) {
      const urls = new Set(["icon/yokokamo.png"]);

      for (const v of vehicles || []) {
        urls.add(iconUrlForLabel(v.label));
      }

      await Promise.all([...urls].map(loadImageToMap));
    }

    function iconExpression() {
      const expr = ["match", ["get", "iconKey"]];

      for (const [label, url] of labelIconMap.entries()) {
        expr.push(label, url);
      }

      expr.push("icon/yokokamo.png");
      return expr;
    }

    // =========================================================
    // MapLibreレイヤ
    // =========================================================
    function installLayers() {
      map.addSource("vehicles", {
        type: "geojson",
        data: emptyFeatureCollection()
      });

      map.addSource("selected-vehicle", {
        type: "geojson",
        data: emptyFeatureCollection()
      });

      map.addSource("selected-route", {
        type: "geojson",
        data: emptyFeatureCollection()
      });

      map.addSource("selected-stops", {
        type: "geojson",
        data: emptyFeatureCollection()
      });

      map.addLayer({
        id: "route-outline",
        type: "line",
        source: "selected-route",
        paint: {
          "line-color": "#ffffff",
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            8, 5,
            14, 11,
            18, 16
          ],
          "line-opacity": 0.95
        }
      });

      map.addLayer({
        id: "route-line",
        type: "line",
        source: "selected-route",
        paint: {
          "line-color": "#1e90ff",
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            8, 2,
            14, 6,
            18, 9
          ]
        }
      });

      // 全停留所: 拡大時に表示。ルート線より上に置く。

      // 停留所はPNGマーカーではなく軽いcircleで表示
      map.addLayer({
        id: "selected-stops-circle",
        type: "circle",
        source: "selected-stops",
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            10, 3,
            14, 4.5,
            17, 6,
            19, 7
          ],
          "circle-color": "#ffffff",
          "circle-stroke-color": "#1e90ff",
          "circle-stroke-width": 2
        }
      });


      map.addLayer({
        id: "vehicles",
        type: "symbol",
        source: "vehicles",
        layout: {
          "icon-image": iconExpression(),
          "icon-size": [
            "interpolate", ["linear"], ["zoom"],
            8, 0.35,
            13, 0.65,
            16, 0.9,
            19, 1.15
          ],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-pitch-alignment": "viewport",
          "icon-rotation-alignment": "viewport"
        }
      });

      map.on("mouseenter", "vehicles", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "vehicles", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", "vehicles", e => {
        const f = e.features?.[0];
        if (!f) return;

        e.originalEvent.cancelBubble = true;

        const p = f.properties || {};

        map.getSource("selected-vehicle").setData({
          type: "FeatureCollection",
          features: [JSON.parse(JSON.stringify(f))]
        });

        // fallback車両には現在のGTFS trip_idが無いので、
        // 直前便の情報だけパネル表示してルート・停留所は出さない。
        if (Number(p.isFallback) === 1) {
          selectedTripId = null;
          clearSelectedStopNameMarkers();
          map.getSource("selected-route").setData(emptyFeatureCollection());
          map.getSource("selected-stops").setData(emptyFeatureCollection());
          showVehicleInfoPanel(p, NaN);
          return;
        }

        selectedTripId = p.tripId || null;

        const current = latestVehicles.find(v => v.tripId === selectedTripId);
        const seq = Number(current?.seq);

        map.getSource("selected-route")
          .setData(selectedRouteGeoJson(selectedTripId));

        map.getSource("selected-stops")
          .setData(futureStopsGeoJson(selectedTripId, seq));

        renderSelectedStopNameMarkers(selectedTripId, seq);
        showVehicleInfoPanel(p, seq);
      });

      map.on("click", e => {
        const vehicleHit = map.queryRenderedFeatures(e.point, {
          layers: ["vehicles"]
        });
        if (vehicleHit.length) return;

        selectedTripId = null;
        hideVehicleInfoPanel();
        clearSelectedStopNameMarkers();
        map.getSource("selected-vehicle").setData(emptyFeatureCollection());
        map.getSource("selected-route").setData(emptyFeatureCollection());
        map.getSource("selected-stops").setData(emptyFeatureCollection());
      });
    }

    function getVehicleIconUrl(label) {
      return labelIconMap.get(String(label ?? "")) || "icon/yokokamo.png";
    }


    function formatPlusDelay(sec) {
      sec = Math.max(0, Number(sec) || 0);
      if (sec < 60) return "定刻";

      const min = Math.floor(sec / 60);
      const rem = Math.floor(sec % 60);

      if (rem === 0) return `+${min}分`;
      return `+${min}分${String(rem).padStart(2, "0")}秒`;
    }

    function scheduledTimeText(tripId, seq) {
      const raw = scheduledTimes[tripId]?.[seq];
      if (!raw) return "予定時刻不明";
      const parts = String(raw).split(":").map(Number);
      if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) {
        return raw;
      }
      const hh = parts[0] % 24;
      const mm = parts[1];
      return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }

    function getFutureStopsInfo(tripId, currentSeq) {
      const updates = tripDelays[tripId];
      if (!updates) return [];

      return Object.keys(updates)
        .map(Number)
        .filter(seq => Number.isFinite(seq) && seq > Number(currentSeq))
        .sort((a, b) => a - b)
        .map(seq => {
          const info = updates[seq];
          const stopId = cleanId(info?.stopId);
          const stop = stopDetails[stopId];
          if (!stop) return null;

          const delay = Math.max(0, Number(info?.delay) || 0);

          return {
            seq,
            stopId,
            name: stop.name || stopNames[stopId] || "停留所名不明",
            scheduledText: scheduledTimeText(tripId, seq),
            delay,
            delayText: formatPlusDelay(delay)
          };
        })
        .filter(Boolean);
    }

    function getNextStopInfo(tripId, currentSeq) {
      return getFutureStopsInfo(tripId, currentSeq)[0] || null;
    }

    function setLoading(active, progress = 72) {
      const bar = document.getElementById("loadingBar");
      if (!bar) return;

      if (active) {
        bar.style.opacity = "1";
        bar.style.width = `${Math.max(8, Math.min(92, progress))}%`;
      } else {
        bar.style.width = "100%";
        setTimeout(() => {
          bar.style.opacity = "0";
          setTimeout(() => { bar.style.width = "0%"; }, 260);
        }, 140);
      }
    }

    // =========================================================
    // リアルタイム更新
    // =========================================================
    async function updateRealtime() {
      if (updateRunning) return;

      const normalOperating = isBusLocationOperating();
      const fallbackOperating = isFallbackLocationOperating();

      // 04:00～始発前など、通常位置もfallbackも不要な時間帯。
      if (!normalOperating && !fallbackOperating) {
        showOutOfService();
        return;
      }

      updateRunning = true;

      const status = document.getElementById("statusDisplay");
      setLoading(true, 68);

      // 現在の車両状態をMapLibreへ反映する共通処理。
      async function renderCurrentVehicles() {
        const allVehicles = displayedVehicles();

        await ensureVehicleIcons(allVehicles);

        map.getSource("vehicles").setData(vehicleGeoJson());
        updateVehicleNumberMarkers(allVehicles);

        // 選択中の通常便だけルート/停留所を更新
        if (selectedTripId) {
          const current =
            latestVehicles.find(
              v => v.tripId === selectedTripId
            );

          if (current) {
            const selectedFeature =
              vehicleFeaturesByTrip.get(selectedTripId);

            map.getSource("selected-vehicle").setData(
              selectedFeature
                ? {
                    type: "FeatureCollection",
                    features: [selectedFeature]
                  }
                : emptyFeatureCollection()
            );

            map.getSource("selected-route")
              .setData(
                selectedRouteGeoJson(selectedTripId)
              );

            map.getSource("selected-stops")
              .setData(
                futureStopsGeoJson(
                  selectedTripId,
                  Number(current.seq)
                )
              );

            renderSelectedStopNameMarkers(
              selectedTripId,
              Number(current.seq)
            );

            const selectedProperties =
              selectedFeature?.properties;

            if (selectedProperties) {
              showVehicleInfoPanel(
                selectedProperties,
                Number(current.seq)
              );
            }
          } else {
            hideVehicleInfoPanel();

            selectedTripId = null;
            clearSelectedStopNameMarkers();

            map.getSource("selected-vehicle")
              .setData(emptyFeatureCollection());

            map.getSource("selected-route")
              .setData(emptyFeatureCollection());

            map.getSource("selected-stops")
              .setData(emptyFeatureCollection());
          }
        }

        document.getElementById(
          "readableTimestamp"
        ).textContent =
          new Date().toLocaleString("ja-JP");
      }

      function updateStatusText() {
        if (normalOperating) {
          status.textContent =
            `LIVE  ${latestVehicles.length}台運行中` +
            (
              fallbackVehicles.length
                ? ` / 非営業 ${fallbackVehicles.length}台`
                : ""
            );
        } else {
          status.textContent =
            fallbackVehicles.length
              ? `非営業車両 ${fallbackVehicles.length}台`
              : "現在は営業運行終了後です";
        }
      }

      try {

        if (normalOperating) {
          // =====================================================
          // 第1段階:
          // Cloudflareの通常営業車だけ先に取得して即表示する。
          // GAS fallbackを待たせない。
          // =====================================================
          await Promise.all([
            loadDelays(),
            loadVehicles()
          ]);

          // 前回のfallbackを一旦消して、
          // 最新の通常車だけを先に描画する。
          fallbackVehicles = [];

          await renderCurrentVehicles();
          updateStatusText();

          // 通常車が見えた時点でローディングを解除。
          setLoading(false);

        } else {
          // 最終便終了後～04:00:
          // Cloudflare Workerは呼ばない。
          latestVehicles = [];
          tripDelays = Object.create(null);
        }

        // =======================================================
        // 第2段階:
        // GAS fallbackは後から取得して地図へ追加する。
        // 通常車の初回表示をブロックしない。
        // =======================================================
        if (fallbackOperating) {
          try {
            await loadFallbackVehicles();

            await renderCurrentVehicles();
            updateStatusText();

          } catch (fallbackError) {
            console.error(
              "fallback取得失敗:",
              fallbackError
            );

            fallbackVehicles = [];

            // 通常営業中なら既に通常車は表示済み。
            // 営業終了後の場合だけ空状態を反映する。
            if (!normalOperating) {
              await renderCurrentVehicles();
              updateStatusText();
            }
          }
        } else {
          fallbackVehicles = [];

          if (!normalOperating) {
            await renderCurrentVehicles();
            updateStatusText();
          }
        }

        // 営業終了後はfallback取得完了までローディングを維持しているので、
        // ここで解除する。
        if (!normalOperating) {
          setLoading(false);
        }

      } catch (e) {
        console.error(e);
        status.textContent =
          "リアルタイムデータ取得失敗";
        setLoading(false);

      } finally {
        updateRunning = false;
      }
    }

    function startRealtimeTimer() {
      if (realtimeTimer !== null) return;

      realtimeTimer = window.setInterval(() => {
        // 15秒ごとに時刻判定するが、運行時間外はupdateRealtime内で
        // Workerアクセス前に終了するためCloudflareへのリクエストは発生しない。
        if (!document.hidden) updateRealtime();
      }, UPDATE_INTERVAL);
    }

    function stopRealtimeTimer() {
      if (realtimeTimer === null) return;
      clearInterval(realtimeTimer);
      realtimeTimer = null;
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopRealtimeTimer();
      } else {
        updateRealtime();
        startRealtimeTimer();
      }
    });

    // =========================================================
    // 起動
    // =========================================================
    map.on("load", async () => {
      const status = document.getElementById("statusDisplay");

      try {
        status.textContent = "GTFS読込中...";
        setLoading(true, 35);

        // 静的GTFSは初回だけ。車両画像は運行中のものだけ後から読む。
        await loadStaticGtfs();
        await loadImageToMap("icon/yokokamo.png");

        installLayers();

        status.textContent = "リアルタイム情報取得中...";
        setLoading(true, 72);
        await updateRealtime();

        startRealtimeTimer();
      } catch (e) {
        console.error(e);
        status.textContent = "初期化に失敗しました";
        setLoading(false);
      }
    });
