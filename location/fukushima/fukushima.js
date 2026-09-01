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

    const UPDATE_INTERVAL = 15000;

    // =========================================================
    // 地図
    // =========================================================
    const map = new maplibregl.Map({
      container: "map",
      center: [140.47, 37.75],
      zoom: 13,
      minZoom: 6,
      maxZoom: 19,
      attributionControl: true,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap contributors"
          }
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm"
          }
        ]
      }
    });

    map.addControl(new maplibregl.NavigationControl({
      visualizePitch: true
    }), "bottom-right");

    // =========================================================
    // データ
    // =========================================================
    const routeNames = Object.create(null);
    const tripHeadsigns = Object.create(null);
    const tripShapeMap = Object.create(null);
    const shapeMap = Object.create(null);
    const stopNames = Object.create(null);
    const stopDetails = Object.create(null);
    const scheduledTimes = Object.create(null);

    let tripDelays = Object.create(null);
    let latestVehicles = [];
    let staticGtfsLoaded = false;
    let updateRunning = false;
    let realtimeTimer = null;
    let selectedTripId = null;
    let vehicleFeaturesByTrip = new Map();

    const labelIconMap = new Map();
    const label290 = ['2007','8015','8016','8037','8038','8057','8058','8059','8077','8078','8079','8081','8101','8102','0873','0874','8127','8137','8138','8139','8140','8141','8143','8144','8145','8146','2006','0741','0743','0744','0774','0775','0803','8060','8061','7165','8080','80801','8098','8099','8100','8128','8129','8156','8157','8158','0887','0889','7216','0896','0897','8178','8179'];
    label290.forEach(label => labelIconMap.set(label, 'icon/290.png'));

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

const label7701 = ['7701'];
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

const labelkanachumk = ['1623','1625','1668','1706','1769','1771','0562','1860','1863','0580','0581'];
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

const labelliesse = ['1382','1590','1859','0854','8147'];
labelliesse.forEach(label => labelIconMap.set(label, 'icon/liesse.png'));

const labelmk = ['0044','0672','0864','2009','2022','8019','8022','8073','8076','7199','7217','1541'];
labelmk.forEach(label => labelIconMap.set(label, 'icon/mk.png'));

const labelmk517 = ['2091','2103'];
labelmk517.forEach(label => labelIconMap.set(label, 'icon/mk517.png'));

const labelmk619 = ['2414','2416','2417','2418','2420'];
labelmk619.forEach(label => labelIconMap.set(label, 'icon/mk619.png'));

const labelmkf = ['0603','2548','2551','0501','0014'];
labelmkf.forEach(label => labelIconMap.set(label, 'icon/mk-f.png'));

const labelmp35silver = ['7106','7109','7111','7112','7114','7117','7119'];
labelmp35silver.forEach(label => labelIconMap.set(label, 'icon/mp35-silver.png'));

const labelmp37 = ['2039','2046','8006','7058','8007','8009','8010','8012','7078','7079','7084','7088','7089','7090','7091','7098','7099','7100','7129','7130','7136','7139','7143','7145','7151','7152','8096'];
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

const labelrinkomio = ['1336','1369','1379','0433','0451','1710','1720','2020','1732','1850','1854','1857','2041','8150','8025'];
labelrinkomio.forEach(label => labelIconMap.set(label, 'icon/rinko-mio.png'));

const labelserega = ['1537','1538'];
labelserega.forEach(label => labelIconMap.set(label, 'icon/serega(15~).png'));

const labeltkgmk = ['1472','1473','0879','0510','0878','8045','1660','0878','7133','7134','1833','1834','1926','1927','1928','1929','1930','2004','2005'];
labeltkgmk.forEach(label => labelIconMap.set(label, 'icon/tkg-mk.png'));

const labeltoeimklong = ['7046','1990','7047','1999'];
labeltoeimklong.forEach(label => labelIconMap.set(label, 'icon/toei-mk-long.png'));

const labelmiharu = ['0500'];
labelmiharu.forEach(label => labelIconMap.set(label, 'icon/miharu.png'));

const labelmiharu290 = ['0386'];
labelmiharu290.forEach(label => labelIconMap.set(label, 'icon/miharu290.png'));

const label234 = ['8168','8167','8168','0429','0430','0431','8039','7135','7144','8159','7163','8072','7164','7166','8086','7171','8089','8090','8085','7172','8097','7181','8103','7182','8107','7186','8113','7187','8126','8133'];
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

    // =========================================================
    // 静的GTFS: 初回に1回だけ読む
    // =========================================================
    async function loadStaticGtfs() {
      const [routesText, tripsText, stopsText, stopTimesText, shapesText] =
        await Promise.all([
          fetchText(GTFS_BASE + "routes.txt"),
          fetchText(GTFS_BASE + "trips.txt"),
          fetchText(GTFS_BASE + "stops.txt"),
          fetchText(GTFS_BASE + "stop_times.txt"),
          fetchText(GTFS_BASE + "shapes.txt")
        ]);

      parseRoutes(routesText);
      parseTrips(tripsText);
      parseStops(stopsText);
      parseStopTimes(stopTimesText);
      parseShapes(shapesText);

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

    function parseStopTimes(text) {
      const rows = parseCsv(text);
      if (!rows.length) return;
      const h = headerIndex(rows[0]);
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const tripId = cleanId(r[h.trip_id]);
        const seq = Number(r[h.stop_sequence]);
        if (!tripId || !Number.isFinite(seq)) continue;

        if (!scheduledTimes[tripId]) scheduledTimes[tripId] = Object.create(null);
        scheduledTimes[tripId][seq] = cleanId(r[h.arrival_time]);
      }
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
          label: cleanId(v?.vehicle?.label) || "?",
          lat,
          lon,
          bearing: Number(p.bearing)
        });
      }

      latestVehicles = vehicles;
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

      const features = latestVehicles.map((v, idx) => {
        const delay = getDelayForVehicle(v);
        const routeName = routeNames[v.routeId] || "路線名不明";
        const headsign = tripHeadsigns[v.tripId] || "行先不明";

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
            delayText: formatDelay(delay),
            iconKey: v.label,
            bearing: Number.isFinite(v.bearing) ? v.bearing : 0
          }
        };

        if (v.tripId) vehicleFeaturesByTrip.set(v.tripId, f);
        return f;
      });

      return {
        type: "FeatureCollection",
        features
      };
    }

    function refreshAllStopsSource() {
      if (!map || !map.getSource) return;
      const src = map.getSource("all-stops");
      if (src) src.setData(allStopsGeoJson());
    }

    function allStopsGeoJson() {
      return {
        type: "FeatureCollection",
        features: Object.entries(stopDetails).map(([stopId, stop]) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [stop.lon, stop.lat]
          },
          properties: {
            stopId,
            name: stop.name || stopNames[stopId] || "停留所名不明"
          }
        }))
      };
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
              delayText: stop.delayText,
              label: `${stop.name}
予定 ${stop.scheduledText}  ${stop.delayText}`
            }
          };
        })
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

      // 実際に画面へ出る車両分だけロード。通常は数個～数十個。
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

      map.addSource("all-stops", {
        type: "geojson",
        data: allStopsGeoJson()
      });

      setTimeout(refreshAllStopsSource, 0);
      map.addSource("selected-route", {
        type: "geojson",
        data: emptyFeatureCollection()
      });

      map.addSource("selected-stops", {
        type: "geojson",
        data: emptyFeatureCollection()
      });

      map.addLayer({
        id: "all-stops-circle",
        type: "circle",
        source: "all-stops",
        minzoom: 14,
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            15, 2.5,
            17, 4,
            19, 5.5
          ],
          "circle-color": "#ffffff",
          "circle-stroke-color": "#6f7f89",
          "circle-stroke-width": 1.5,
          "circle-opacity": 0.95
        }
      });

      map.addLayer({
        id: "all-stops-label",
        type: "symbol",
        source: "all-stops",
        minzoom: 15,
        layout: {
          "text-field": ["coalesce", ["get", "name"], "停留所"],
          "text-size": [
            "interpolate", ["linear"], ["zoom"],
            15, 10,
            17, 11,
            19, 12
          ],
          "text-anchor": "left",
          "text-offset": [0.8, 0],
          "text-allow-overlap": false,
          "text-ignore-placement": false,
          "text-optional": true
        },
        paint: {
          "text-color": "#26343c",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2
        }
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

      // 停留所はPNGマーカーではなく軽いcircleで表示
      map.addLayer({
        id: "selected-stops-circle",
        type: "circle",
        source: "selected-stops",
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            10, 3,
            15, 6,
            18, 8
          ],
          "circle-color": "#ffffff",
          "circle-stroke-color": "#1e90ff",
          "circle-stroke-width": 2
        }
      });

      map.addLayer({
        id: "selected-stops-label",
        type: "symbol",
        source: "selected-stops",
        minzoom: 10,
        layout: {
          "text-field": ["concat", ["get", "name"], "\n", ["get", "scheduledText"]],
          "text-size": 11,
          "text-anchor": "left",
          "text-offset": [0.8, 0],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "text-optional": false
        },
        paint: {
          "text-color": "#111111",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2
        }
      });

      map.addLayer({
        id: "selected-vehicle-halo",
        type: "circle",
        source: "selected-vehicle",
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            8, 13,
            13, 18,
            18, 24
          ],
          "circle-color": "rgba(49,168,223,0.14)",
          "circle-stroke-color": "rgba(23,105,170,0.82)",
          "circle-stroke-width": 3,
          "circle-blur": 0.15
        }
      });

      map.addLayer({
        id: "selected-stops-delay",
        type: "symbol",
        source: "selected-stops",
        minzoom: 10,
        layout: {
          "text-field": ["get", "delayLateText"],
          "text-size": 11,
          "text-anchor": "left",
          "text-offset": [0.8, 1.15],
          "text-allow-overlap": false,
          "text-optional": true
        },
        paint: {
          "text-color": "#d93025",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2
        }
      });

      map.addLayer({
        id: "selected-stops-ontime",
        type: "symbol",
        source: "selected-stops",
        minzoom: 10,
        layout: {
          "text-field": ["get", "delayOnTimeText"],
          "text-size": 11,
          "text-anchor": "left",
          "text-offset": [0.8, 1.15],
          "text-allow-overlap": false,
          "text-optional": true
        },
        paint: {
          "text-color": "#16834b",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2
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
          "icon-rotation-alignment": "map"
        }
      });

      map.on("mouseenter", "vehicles", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "vehicles", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("mouseenter", "all-stops-circle", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "all-stops-circle", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", "all-stops-circle", e => {
        const f = e.features?.[0];
        if (!f) return;

        e.originalEvent.cancelBubble = true;

        new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          offset: 8
        })
          .setLngLat(f.geometry.coordinates)
          .setHTML(`
            <div style="padding:10px 12px;font-size:12px;font-weight:800;">
              ${escapeHtml(f.properties?.name || "停留所")}
            </div>
          `)
          .addTo(map);
      });

      map.on("click", "vehicles", e => {
        const f = e.features?.[0];
        if (!f) return;

        e.originalEvent.cancelBubble = true;

        const p = f.properties || {};
        selectedTripId = p.tripId || null;

        map.getSource("selected-vehicle").setData({
          type: "FeatureCollection",
          features: [JSON.parse(JSON.stringify(f))]
        });

        const current = latestVehicles.find(v => v.tripId === selectedTripId);
        const seq = Number(current?.seq);

        map.getSource("selected-route")
          .setData(selectedRouteGeoJson(selectedTripId));

        map.getSource("selected-stops")
          .setData(futureStopsGeoJson(selectedTripId, seq));

        const vehiclePopup = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true
        })
          .setLngLat(f.geometry.coordinates)
          .setHTML(buildBusPopupHtml(p))
          .addTo(map);

        makePopupDraggable(vehiclePopup);
      });

      map.on("click", e => {
        // 車両クリック以外なら選択ルートを消す
        const hit = map.queryRenderedFeatures(e.point, {
          layers: ["vehicles", "all-stops-circle"]
        });
        if (hit.length) return;

        selectedTripId = null;
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

    function delayStatusClass(sec, future = false) {
      return Number(sec) < 60
        ? (future ? "bus-popup__future-ontime" : "bus-popup__ontime")
        : (future ? "bus-popup__future-delay" : "bus-popup__delay-red");
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

    function makePopupDraggable(popup) {
      const root = popup.getElement?.();
      if (!root) return;

      root.classList.add("bus-popup-draggable");

      const handle = root.querySelector(".bus-popup__hero");
      if (!handle) return;

      let startX = 0;
      let startY = 0;
      let offsetX = 0;
      let offsetY = 0;
      let dragging = false;
      let pointerId = null;

      const applyOffset = () => {
        root.style.translate = `${offsetX}px ${offsetY}px`;
      };

      handle.addEventListener("pointerdown", e => {
        if (e.button !== undefined && e.button !== 0) return;

        dragging = true;
        pointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;

        root.classList.add("is-dragging");
        handle.setPointerCapture?.(pointerId);
        e.preventDefault();
        e.stopPropagation();
      });

      handle.addEventListener("pointermove", e => {
        if (!dragging || e.pointerId !== pointerId) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        startX = e.clientX;
        startY = e.clientY;

        offsetX += dx;
        offsetY += dy;
        applyOffset();

        e.preventDefault();
        e.stopPropagation();
      });

      const endDrag = e => {
        if (!dragging) return;
        if (pointerId !== null && e.pointerId !== undefined && e.pointerId !== pointerId) return;

        dragging = false;
        root.classList.remove("is-dragging");

        try {
          if (pointerId !== null) handle.releasePointerCapture?.(pointerId);
        } catch (_) {}

        pointerId = null;
      };

      handle.addEventListener("pointerup", endDrag);
      handle.addEventListener("pointercancel", endDrag);
    }

    function buildBusPopupHtml(p) {
      const current = latestVehicles.find(v => v.tripId === p.tripId);
      const currentSeq = Number(current?.seq);
      const next = getNextStopInfo(p.tripId, currentSeq);
      const futureStops = getFutureStopsInfo(p.tripId, currentSeq);
      const iconUrl = getVehicleIconUrl(p.label);
      const dropdownId = `future-${String(p.tripId || "").replace(/[^a-zA-Z0-9_-]/g, "_")}-${Date.now()}`;

      const futureStopsHtml = futureStops.length
        ? futureStops.map(stop => `
            <div class="bus-popup__future-stop">
              <div class="bus-popup__future-stop-main">
                <div class="bus-popup__future-name">${escapeHtml(stop.name)}</div>
                <div class="bus-popup__future-time-line">
                  ${escapeHtml(stop.scheduledText)}
                  <span class="${delayStatusClass(stop.delay, true)}">${escapeHtml(stop.delayText)}</span>
                </div>
              </div>
            </div>
          `).join("")
        : `<div class="bus-popup__future-empty">この先の停留所情報はありません</div>`;

      return `
        <div class="bus-popup">
          <div class="bus-popup__hero">
            <div class="bus-popup__vehicle-row">
              <div class="bus-popup__vehicle-icon-wrap">
                <img class="bus-popup__vehicle-icon"
                     src="${escapeHtml(iconUrl)}"
                     alt="">
              </div>
              <div class="bus-popup__vehicle-meta">
                <div class="bus-popup__vehicle">${escapeHtml(p.label)}</div>
              </div>
            </div>
          </div>

          <div class="bus-popup__body">
            <div class="bus-popup__route">${escapeHtml(p.routeName)}</div>

            <div class="bus-popup__destination">
              <span>${escapeHtml(p.headsign)}</span>
            </div>

            ${next ? `
              <button
                type="button"
                class="bus-popup__next-toggle"
                aria-expanded="false"
                aria-controls="${dropdownId}"
                onclick="
                  const el=document.getElementById('${dropdownId}');
                  const open=!el.classList.contains('is-open');
                  el.classList.toggle('is-open',open);
                  this.setAttribute('aria-expanded',String(open));
                ">
                <div class="bus-popup__next">
                  <div class="bus-popup__next-label">次の停留所</div>
                  <div class="bus-popup__next-name">${escapeHtml(next.name)}</div>
                  <div class="bus-popup__next-time">
                    ${escapeHtml(next.scheduledText)}
                    <span class="${delayStatusClass(next.delay)}">${escapeHtml(next.delayText)}</span>
                  </div>
                  <span class="bus-popup__next-chevron">⌄</span>
                </div>
              </button>

              <div id="${dropdownId}" class="bus-popup__future-inline">
                ${futureStopsHtml}
              </div>
            ` : ""}


          </div>
        </div>
      `;
    }

    function escapeHtml(v) {
      return String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    // =========================================================
    // リアルタイム更新
    // =========================================================
    async function updateRealtime() {
      if (updateRunning) return;
      updateRunning = true;

      const status = document.getElementById("statusDisplay");
      setLoading(true, 68);

      try {
        await Promise.all([
          loadDelays(),
          loadVehicles()
        ]);

        await ensureVehicleIcons(latestVehicles);
        map.getSource("vehicles").setData(vehicleGeoJson());

        // 選択中の便だけルート/停留所を更新
        if (selectedTripId) {
          const current = latestVehicles.find(v => v.tripId === selectedTripId);

          if (current) {
            const selectedFeature = vehicleFeaturesByTrip.get(selectedTripId);
            map.getSource("selected-vehicle").setData(
              selectedFeature
                ? { type: "FeatureCollection", features: [selectedFeature] }
                : emptyFeatureCollection()
            );

            map.getSource("selected-route")
              .setData(selectedRouteGeoJson(selectedTripId));

            map.getSource("selected-stops")
              .setData(futureStopsGeoJson(selectedTripId, Number(current.seq)));
          } else {
            selectedTripId = null;
            map.getSource("selected-vehicle").setData(emptyFeatureCollection());
            map.getSource("selected-route").setData(emptyFeatureCollection());
            map.getSource("selected-stops").setData(emptyFeatureCollection());
          }
        }

        document.getElementById("readableTimestamp").textContent =
          new Date().toLocaleString("ja-JP");

        status.textContent = `LIVE  ${latestVehicles.length}台運行中`;
      } catch (e) {
        console.error(e);
        status.textContent = "リアルタイムデータ取得失敗";
      } finally {
        updateRunning = false;
        setLoading(false);
      }
    }


    function startRealtimeTimer() {
      if (realtimeTimer !== null) return;
      realtimeTimer = window.setInterval(() => {
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

        // 静的GTFSだけを初回に1回ロード。
        // 車両画像は実際に運行中のものだけ後から読み込む。
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
