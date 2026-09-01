"use strict";

// =========================================================
// Braga / TUB バスロケーションマップ
// =========================================================

const GTFS_BASE = "./";

// ★ここだけ自分のCloudflare Worker URLへ変更してください。
// 末尾の / はあってもなくても動きます。
// 例:
// const BRAGA_WORKER_URL = "https://braga-vehicles.example.workers.dev/";
const BRAGA_WORKER_URL = "https://misty-frost-9f0e.fujimaru703.workers.dev/";

const UPDATE_INTERVAL = 300000;
const CAMERA_STORAGE_KEY = "braga-map-camera-v3";
const DEFAULT_ICON_URL = "icon/bus-pictogram-50.png";

// GTFSにないAPI用line IDが今後必要になった場合だけ追加。
// 例: ["2T", "22F"]
const EXTRA_API_LINES = [];

// =========================================================
// カメラ状態
// =========================================================
function loadSavedCamera() {
  try {
    const raw = localStorage.getItem(CAMERA_STORAGE_KEY);
    if (!raw) return null;

    const saved = JSON.parse(raw);

    if (
      !Array.isArray(saved.center) ||
      saved.center.length !== 2 ||
      !Number.isFinite(Number(saved.center[0])) ||
      !Number.isFinite(Number(saved.center[1]))
    ) {
      return null;
    }

    return {
      center: [Number(saved.center[0]), Number(saved.center[1])],
      zoom: Number(saved.zoom),
      bearing: Number(saved.bearing),
      pitch: Number(saved.pitch)
    };
  } catch (_) {
    return null;
  }
}

const savedCamera = loadSavedCamera();

// =========================================================
// 地図
// =========================================================
const map = new maplibregl.Map({
  container: "map",

  // 初回だけBraga中心。以後は最後に見ていた位置を復元。
  center: savedCamera?.center || [-8.4200, 41.5505],
  zoom: Number.isFinite(savedCamera?.zoom) ? savedCamera.zoom : 13.5,
  bearing: Number.isFinite(savedCamera?.bearing) ? savedCamera.bearing : 0,
  pitch: Number.isFinite(savedCamera?.pitch) ? savedCamera.pitch : 60,

  minZoom: 6,
  maxZoom: 19,
  maxPitch: 85,
  attributionControl: true,

  // 福島版と同じ背景
  style: "https://tiles.openfreemap.org/styles/positron"
});

map.addControl(
  new maplibregl.NavigationControl({
    visualizePitch: true
  }),
  "bottom-right"
);

function saveMapCamera() {
  try {
    const center = map.getCenter();

    localStorage.setItem(
      CAMERA_STORAGE_KEY,
      JSON.stringify({
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch()
      })
    );
  } catch (_) {}
}

// Realtime更新側ではカメラを一切変更しない。
// ユーザー操作が終わったときだけ保存。
map.on("moveend", saveMapCamera);
map.on("zoomend", saveMapCamera);
map.on("rotateend", saveMapCamera);
map.on("pitchend", saveMapCamera);

// =========================================================
// 状態
// =========================================================
const routeNames = Object.create(null);
const routeShortNames = Object.create(null);

const tripHeadsigns = Object.create(null);
const tripRouteMap = Object.create(null);
const tripDirectionMap = Object.create(null);
const tripShapeMap = Object.create(null);

const shapeMap = Object.create(null);

const stopNames = Object.create(null);
const stopDetails = Object.create(null);

const scheduledTimes = Object.create(null);
const tripStops = Object.create(null);

// tripId -> [{ seq, stopId, scheduledText, shapeIndex }]
const tripStopShapeCache = new Map();

let apiLineIds = [];
let latestVehicles = [];
let updateRunning = false;
let realtimeTimer = null;

let selectedTripId = null;
let selectedBusId = null;

const vehicleFeaturesByBus = new Map();
const vehicleNumberMarkers = new Map();
let selectedStopNameMarkers = [];

// =========================================================
// DOM
// =========================================================
const statusDisplay = document.getElementById("statusDisplay");
const readableTimestamp = document.getElementById("readableTimestamp");
const vehicleInfoPanel = document.getElementById("vehicleInfoPanel");

// =========================================================
// 基本
// =========================================================
function cleanId(v) {
  return String(v ?? "")
    .replace(/^"|"$/g, "")
    .trim();
}

function emptyFeatureCollection() {
  return {
    type: "FeatureCollection",
    features: []
  };
}

function setLoading(active, progress = 70) {
  const bar = document.getElementById("loadingBar");
  if (!bar) return;

  if (active) {
    bar.style.opacity = "1";
    bar.style.width = `${Math.max(8, Math.min(92, progress))}%`;
  } else {
    bar.style.width = "100%";

    setTimeout(() => {
      bar.style.opacity = "0";
      setTimeout(() => {
        bar.style.width = "0%";
      }, 250);
    }, 120);
  }
}

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
      continue;
    }

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

  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows;
}

function headerIndex(header) {
  const result = Object.create(null);
  header.forEach((name, index) => {
    result[cleanId(name)] = index;
  });
  return result;
}

async function fetchText(url) {
  const response = await fetch(url, {
    cache: "force-cache"
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }

  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    cache: "no-store"
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText}: ${text.slice(0, 250)}`
    );
  }

  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error(`JSONではありません: ${text.slice(0, 250)}`);
  }
}

// =========================================================
// GTFS
// =========================================================
async function loadStaticGtfs() {
  const [
    routesText,
    tripsText,
    stopsText,
    stopTimesText,
    shapesText
  ] = await Promise.all([
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

  // Workerへ渡すline一覧はroutes.txtから自動生成。
  apiLineIds = [
    ...new Set([
      ...Object.keys(routeNames),
      ...EXTRA_API_LINES.map(cleanId)
    ])
  ].filter(Boolean);
}

function parseRoutes(text) {
  const rows = parseCsv(text);
  if (!rows.length) return;

  const h = headerIndex(rows[0]);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const routeId = cleanId(row[h.route_id]);

    if (!routeId) continue;

    routeNames[routeId] =
      cleanId(row[h.route_long_name]) ||
      cleanId(row[h.route_short_name]) ||
      routeId;

    routeShortNames[routeId] =
      cleanId(row[h.route_short_name]) ||
      routeId;
  }
}

function parseTrips(text) {
  const rows = parseCsv(text);
  if (!rows.length) return;

  const h = headerIndex(rows[0]);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    const tripId = cleanId(row[h.trip_id]);
    if (!tripId) continue;

    tripRouteMap[tripId] = cleanId(row[h.route_id]);
    tripHeadsigns[tripId] = cleanId(row[h.trip_headsign]);
    tripDirectionMap[tripId] = Number(row[h.direction_id]);
    tripShapeMap[tripId] = cleanId(row[h.shape_id]);
  }
}

function parseStops(text) {
  const rows = parseCsv(text);
  if (!rows.length) return;

  const h = headerIndex(rows[0]);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    const stopId = cleanId(row[h.stop_id]);
    const lat = Number(row[h.stop_lat]);
    const lon = Number(row[h.stop_lon]);

    if (
      !stopId ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      continue;
    }

    const name = cleanId(row[h.stop_name]);

    stopNames[stopId] = name;
    stopDetails[stopId] = {
      name,
      lat,
      lon
    };
  }
}

function parseStopTimes(text) {
  const rows = parseCsv(text);
  if (!rows.length) return;

  const h = headerIndex(rows[0]);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    const tripId = cleanId(row[h.trip_id]);
    const stopId = cleanId(row[h.stop_id]);
    const seq = Number(row[h.stop_sequence]);
    const arrival = cleanId(row[h.arrival_time]);

    if (
      !tripId ||
      !stopId ||
      !Number.isFinite(seq)
    ) {
      continue;
    }

    if (!scheduledTimes[tripId]) {
      scheduledTimes[tripId] = Object.create(null);
    }

    scheduledTimes[tripId][seq] = arrival;

    if (!tripStops[tripId]) {
      tripStops[tripId] = [];
    }

    tripStops[tripId].push({
      seq,
      stopId,
      scheduledText: normalizeGtfsTime(arrival)
    });
  }

  for (const stops of Object.values(tripStops)) {
    stops.sort((a, b) => a.seq - b.seq);
  }
}

function parseShapes(text) {
  const rows = parseCsv(text);
  if (!rows.length) return;

  const h = headerIndex(rows[0]);
  const points = Object.create(null);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    const shapeId = cleanId(row[h.shape_id]);
    const lat = Number(row[h.shape_pt_lat]);
    const lon = Number(row[h.shape_pt_lon]);
    const seq = Number(row[h.shape_pt_sequence]);

    if (
      !shapeId ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      continue;
    }

    if (!points[shapeId]) {
      points[shapeId] = [];
    }

    points[shapeId].push({
      seq,
      lat,
      lon
    });
  }

  for (const [shapeId, list] of Object.entries(points)) {
    list.sort((a, b) => a.seq - b.seq);

    shapeMap[shapeId] = list.map(point => [
      point.lon,
      point.lat
    ]);
  }
}

function normalizeGtfsTime(raw) {
  if (!raw) return "--:--";

  const parts = String(raw)
    .split(":")
    .map(Number);

  if (
    parts.length < 2 ||
    !Number.isFinite(parts[0]) ||
    !Number.isFinite(parts[1])
  ) {
    return String(raw);
  }

  const hh = parts[0] % 24;
  const mm = parts[1];

  return (
    String(hh).padStart(2, "0") +
    ":" +
    String(mm).padStart(2, "0")
  );
}

// =========================================================
// Braga Worker
// =========================================================
function workerConfigured() {
  return (
    BRAGA_WORKER_URL &&
    !BRAGA_WORKER_URL.includes("REPLACE-ME")
  );
}

function buildVehicleApiUrl() {
  const base = BRAGA_WORKER_URL.replace(/\/?$/, "/");
  const url = new URL(base);

  url.searchParams.set(
    "lines",
    apiLineIds.join(",")
  );

  return url.toString();
}

async function loadVehicles() {
  if (!workerConfigured()) {
    throw new Error(
      "braga.js の BRAGA_WORKER_URL をCloudflare WorkerのURLへ変更してください"
    );
  }

  const data = await fetchJson(
    buildVehicleApiUrl()
  );

  if (!Array.isArray(data)) {
    throw new Error(
      "Workerの返り値が配列ではありません"
    );
  }

  latestVehicles = data
    .map(raw => {
      const lat = Number(raw?.lat);
      const lon = Number(raw?.lon);

      return {
        busId: cleanId(raw?.busId),
        lineId: cleanId(raw?.lineId),
        direction: Number(raw?.direction),
        tripId: cleanId(raw?.tripId),
        time: Number(raw?.time),
        lat,
        lon
      };
    })
    .filter(v =>
      v.busId &&
      Number.isFinite(v.lat) &&
      Number.isFinite(v.lon)
    );
}

// =========================================================
// Shape上の現在位置から「この先の停留所」を求める
// Braga APIにはcurrentStopSequenceがないため、
// GTFS shape上の位置で進行度を求める。
// =========================================================
function squaredDistance(lon1, lat1, lon2, lat2) {
  // Braga市内の短距離比較用。最近傍点探索なので平方距離で十分。
  const meanLat = (lat1 + lat2) * 0.5 * Math.PI / 180;
  const x = (lon1 - lon2) * Math.cos(meanLat);
  const y = lat1 - lat2;
  return x * x + y * y;
}

function nearestShapeIndex(coords, lon, lat, startIndex = 0) {
  if (!coords?.length) return -1;

  let bestIndex = -1;
  let bestDistance = Infinity;

  for (
    let i = Math.max(0, startIndex);
    i < coords.length;
    i++
  ) {
    const [shapeLon, shapeLat] = coords[i];
    const d = squaredDistance(
      shapeLon,
      shapeLat,
      lon,
      lat
    );

    if (d < bestDistance) {
      bestDistance = d;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function getTripStopsWithShapeIndex(tripId) {
  if (tripStopShapeCache.has(tripId)) {
    return tripStopShapeCache.get(tripId);
  }

  const shapeId = tripShapeMap[tripId];
  const coords = shapeMap[shapeId];
  const stops = tripStops[tripId] || [];

  if (!coords?.length || !stops.length) {
    tripStopShapeCache.set(tripId, []);
    return [];
  }

  let searchFrom = 0;

  const mapped = stops
    .map(stop => {
      const detail = stopDetails[stop.stopId];

      if (!detail) return null;

      // 停留所順にshapeを前方向へ探索することで、
      // 同じ道路を再度通るshapeでも順序が逆転しにくくする。
      let shapeIndex = nearestShapeIndex(
        coords,
        detail.lon,
        detail.lat,
        searchFrom
      );

      // 末端の特殊shapeなどで前方向に見つからない場合の保険。
      if (shapeIndex < 0) {
        shapeIndex = nearestShapeIndex(
          coords,
          detail.lon,
          detail.lat,
          0
        );
      }

      if (shapeIndex >= 0) {
        searchFrom = shapeIndex;
      }

      return {
        ...stop,
        name:
          detail.name ||
          stopNames[stop.stopId] ||
          "停留所名不明",
        lat: detail.lat,
        lon: detail.lon,
        shapeIndex
      };
    })
    .filter(Boolean);

  tripStopShapeCache.set(
    tripId,
    mapped
  );

  return mapped;
}

function getVehicleShapeIndex(vehicle) {
  const shapeId = tripShapeMap[vehicle.tripId];
  const coords = shapeMap[shapeId];

  if (!coords?.length) return -1;

  return nearestShapeIndex(
    coords,
    vehicle.lon,
    vehicle.lat,
    0
  );
}

function getFutureStopsInfo(vehicle) {
  if (!vehicle?.tripId) return [];

  const busShapeIndex =
    getVehicleShapeIndex(vehicle);

  const stops =
    getTripStopsWithShapeIndex(vehicle.tripId);

  if (!stops.length) return [];

  if (busShapeIndex < 0) {
    return stops;
  }

  const future = stops.filter(
    stop =>
      Number.isFinite(stop.shapeIndex) &&
      stop.shapeIndex > busShapeIndex
  );

  // shape末端で最近傍点が最終点になった場合は空で正常。
  return future;
}

function getNextStopInfo(vehicle) {
  return getFutureStopsInfo(vehicle)[0] || null;
}

// =========================================================
// GeoJSON
// =========================================================
function vehicleGeoJson() {
  vehicleFeaturesByBus.clear();

  const features = latestVehicles.map(
    (vehicle, index) => {
      const gtfsRouteId =
        tripRouteMap[vehicle.tripId] ||
        vehicle.lineId;

      const routeName =
        routeNames[gtfsRouteId] ||
        `Linha ${vehicle.lineId}`;

      const routeShortName =
        routeShortNames[gtfsRouteId] ||
        vehicle.lineId;

      const headsign =
        tripHeadsigns[vehicle.tripId] ||
        "行先不明";

      const feature = {
        type: "Feature",
        id: index,
        geometry: {
          type: "Point",
          coordinates: [
            vehicle.lon,
            vehicle.lat
          ]
        },
        properties: {
          busId: vehicle.busId,
          lineId: vehicle.lineId,
          direction: vehicle.direction,
          tripId: vehicle.tripId,
          routeName,
          routeShortName,
          headsign,
          apiTime: Number.isFinite(vehicle.time)
            ? vehicle.time
            : 0,
          iconUrl: DEFAULT_ICON_URL
        }
      };

      vehicleFeaturesByBus.set(
        vehicle.busId,
        feature
      );

      return feature;
    }
  );

  return {
    type: "FeatureCollection",
    features
  };
}

function selectedRouteGeoJson(tripId) {
  const shapeId = tripShapeMap[tripId];
  const coords = shapeMap[shapeId];

  if (!coords?.length) {
    return emptyFeatureCollection();
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: coords
        }
      }
    ]
  };
}

function futureStopsGeoJson(vehicle) {
  const future = getFutureStopsInfo(vehicle);

  return {
    type: "FeatureCollection",
    features: future.map(stop => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [
          stop.lon,
          stop.lat
        ]
      },
      properties: {
        stopId: stop.stopId,
        name: stop.name,
        scheduledText: stop.scheduledText
      }
    }))
  };
}

// =========================================================
// 車両画像
// =========================================================
async function loadImageToMap(url) {
  if (map.hasImage(url)) return;

  const image = await map.loadImage(url);

  if (!map.hasImage(url)) {
    map.addImage(
      url,
      image.data
    );
  }
}

// =========================================================
// 車番チップ
// =========================================================
function vehicleIconScaleAtZoom(zoom) {
  // 50px画像を基準に、地図を邪魔しないサイズに抑える
  if (zoom <= 8) return 0.26;
  if (zoom <= 13) {
    return (
      0.26 +
      (zoom - 8) *
        (0.46 - 0.26) /
        5
    );
  }
  if (zoom <= 16) {
    return (
      0.46 +
      (zoom - 13) *
        (0.62 - 0.46) /
        3
    );
  }
  if (zoom <= 19) {
    return (
      0.62 +
      (zoom - 16) *
        (0.82 - 0.62) /
        3
    );
  }

  return 0.82;
}

function vehicleNumberMarkerOffset() {
  const halfIcon =
    25 *
    vehicleIconScaleAtZoom(
      map.getZoom()
    );

  return [
    0,
    Math.round(halfIcon + 3)
  ];
}

function createVehicleNumberElement(busId) {
  const el = document.createElement("div");
  el.className = "braga-vehicle-number";
  el.textContent = busId || "?";
  return el;
}

function updateVehicleNumberMarkers(vehicles) {
  const alive = new Set();
  const offset =
    vehicleNumberMarkerOffset();

  for (const vehicle of vehicles) {
    const key = vehicle.busId;
    alive.add(key);

    let item =
      vehicleNumberMarkers.get(key);

    if (!item) {
      const element =
        createVehicleNumberElement(
          vehicle.busId
        );

      const marker =
        new maplibregl.Marker({
          element,
          anchor: "top",
          offset,
          pitchAlignment: "viewport",
          rotationAlignment: "viewport"
        })
          .setLngLat([
            vehicle.lon,
            vehicle.lat
          ])
          .addTo(map);

      item = {
        marker,
        element
      };

      vehicleNumberMarkers.set(
        key,
        item
      );
    } else {
      item.marker.setLngLat([
        vehicle.lon,
        vehicle.lat
      ]);

      item.marker.setOffset(offset);

      if (
        item.element.textContent !==
        vehicle.busId
      ) {
        item.element.textContent =
          vehicle.busId;
      }
    }
  }

  for (
    const [key, item]
    of vehicleNumberMarkers
  ) {
    if (alive.has(key)) continue;

    item.marker.remove();
    vehicleNumberMarkers.delete(key);
  }
}

function updateVehicleNumberMarkerOffsets() {
  const offset =
    vehicleNumberMarkerOffset();

  for (
    const { marker }
    of vehicleNumberMarkers.values()
  ) {
    marker.setOffset(offset);
  }
}

map.on(
  "zoom",
  updateVehicleNumberMarkerOffsets
);

// =========================================================
// この先の停留所名
// =========================================================
function clearSelectedStopNameMarkers() {
  for (
    const marker
    of selectedStopNameMarkers
  ) {
    marker.remove();
  }

  selectedStopNameMarkers = [];
}

function renderSelectedStopNameMarkers(vehicle) {
  clearSelectedStopNameMarkers();

  const stops =
    getFutureStopsInfo(vehicle);

  for (const stop of stops) {
    const el =
      document.createElement("div");

    el.className =
      "braga-stop-label";

    const name =
      document.createElement("div");

    name.className =
      "braga-stop-label__name";

    name.textContent =
      stop.name;

    const time =
      document.createElement("div");

    time.className =
      "braga-stop-label__time";

    time.textContent =
      stop.scheduledText;

    el.append(
      name,
      time
    );

    const marker =
      new maplibregl.Marker({
        element: el,
        anchor: "left",
        offset: [9, 0],
        pitchAlignment: "viewport",
        rotationAlignment: "viewport"
      })
        .setLngLat([
          stop.lon,
          stop.lat
        ])
        .addTo(map);

    selectedStopNameMarkers.push(
      marker
    );
  }
}

// =========================================================
// 左下情報パネル
// =========================================================
function hideVehicleInfoPanel() {
  vehicleInfoPanel.hidden = true;
  vehicleInfoPanel.replaceChildren();
}

function showVehicleInfoPanel(vehicle) {
  if (!vehicle) {
    hideVehicleInfoPanel();
    return;
  }

  const feature =
    vehicleFeaturesByBus.get(
      vehicle.busId
    );

  const p = feature?.properties || {};
  const next =
    getNextStopInfo(vehicle);

  const head =
    document.createElement("div");

  head.className = "vip-head";

  const img =
    document.createElement("img");

  img.className = "vip-icon";
  img.src = DEFAULT_ICON_URL;
  img.alt = "";

  const number =
    document.createElement("div");

  number.className = "vip-number";
  number.textContent =
    vehicle.busId || "?";
head.append(
    img,
    number
  );

  const route =
    document.createElement("div");

  route.className = "vip-route";

  const shortName =
    p.routeShortName ||
    vehicle.lineId;

  route.textContent =
    `${shortName}  ${p.routeName || ""}`.trim();

  const destination =
    document.createElement("div");

  destination.className =
    "vip-destination";

  destination.textContent =
    `→ ${p.headsign || "行先不明"}`;

  vehicleInfoPanel.replaceChildren(
    head,
    route,
    destination
  );

  if (next) {
    const nextBox =
      document.createElement("div");

    nextBox.className = "vip-next";

    const label =
      document.createElement("div");

    label.className =
      "vip-next-label";

    label.textContent =
      "次の停留所";

    const name =
      document.createElement("div");

    name.className =
      "vip-next-name";

    name.textContent =
      next.name;

    const time =
      document.createElement("div");

    time.className = "vip-time";
    time.textContent =
      next.scheduledText;

    nextBox.append(
      label,
      name,
      time
    );

    vehicleInfoPanel.appendChild(
      nextBox
    );
  }

  const note =
    document.createElement("div");

  note.className = "vip-note";
  note.textContent =
    "Braga APIには遅延秒数が含まれないため、時刻はGTFSの定刻を表示しています。";

  vehicleInfoPanel.appendChild(note);
  vehicleInfoPanel.hidden = false;
}

// =========================================================
// 3D地形
// =========================================================
function installTerrain() {
  // MapterhornはTerrarium形式・512pxのDEM。
  // TileJSON任せにせず明示して、さらにhillshadeも重ねて
  // 高低差が目で分かるようにする。
  const demSpec = {
    type: "raster-dem",
    tiles: [
      "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp"
    ],
    encoding: "terrarium",
    tileSize: 512,
    maxzoom: 14,
    attribution:
      '<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>'
  };

  if (!map.getSource("terrainSource")) {
    map.addSource(
      "terrainSource",
      demSpec
    );
  }

  if (!map.getSource("hillshadeSource")) {
    map.addSource(
      "hillshadeSource",
      demSpec
    );
  }

  // 1だとBraga中心部ではかなり控えめなので少し強調。
  map.setTerrain({
    source: "terrainSource",
    exaggeration: 1.6
  });

  if (!map.getLayer("terrain-hillshade")) {
    const layers =
      map.getStyle()?.layers || [];

    // 背景のすぐ上、道路・文字より下に入れる。
    const beforeId =
      layers.find(
        layer =>
          layer.type !== "background"
      )?.id;

    map.addLayer(
      {
        id: "terrain-hillshade",
        type: "hillshade",
        source: "hillshadeSource",
        paint: {
          "hillshade-exaggeration": 0.55,
          "hillshade-shadow-color": "#5b5147",
          "hillshade-highlight-color": "#ffffff",
          "hillshade-accent-color": "#8f867c"
        }
      },
      beforeId
    );
  }
}

// =========================================================
// MapLibreレイヤ
// =========================================================
function installLayers() {
  map.addSource(
    "selected-route",
    {
      type: "geojson",
      data: emptyFeatureCollection()
    }
  );

  map.addSource(
    "selected-stops",
    {
      type: "geojson",
      data: emptyFeatureCollection()
    }
  );

  map.addSource(
    "selected-vehicle",
    {
      type: "geojson",
      data: emptyFeatureCollection()
    }
  );

  map.addSource(
    "vehicles",
    {
      type: "geojson",
      data: emptyFeatureCollection()
    }
  );

  map.addLayer({
    id: "selected-route-outline",
    type: "line",
    source: "selected-route",
    paint: {
      "line-color": "#ffffff",
      "line-width": 9,
      "line-opacity": 0.92
    }
  });

  map.addLayer({
    id: "selected-route-line",
    type: "line",
    source: "selected-route",
    paint: {
      "line-color": "#2385d8",
      "line-width": 5,
      "line-opacity": 0.95
    }
  });

  map.addLayer({
    id: "selected-stops-circle",
    type: "circle",
    source: "selected-stops",
    paint: {
      "circle-radius": 5,
      "circle-color": "#ffffff",
      "circle-stroke-color": "#2385d8",
      "circle-stroke-width": 2
    }
  });

  map.addLayer({
    id: "selected-vehicle-halo",
    type: "circle",
    source: "selected-vehicle",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        8, 12,
        13, 18,
        19, 27
      ],
      "circle-color": "rgba(35,133,216,0.12)",
      "circle-stroke-color": "#2385d8",
      "circle-stroke-width": 2
    }
  });

  map.addLayer({
    id: "vehicles",
    type: "symbol",
    source: "vehicles",
    layout: {
      "icon-image": DEFAULT_ICON_URL,

      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        8, 0.26,
        13, 0.46,
        16, 0.62,
        19, 0.82
      ],

      "icon-allow-overlap": true,
      "icon-ignore-placement": true,

      // 3D表示でも常に画面正面を向く
      "icon-pitch-alignment": "viewport",
      "icon-rotation-alignment": "viewport"
    }
  });

  map.on(
    "mouseenter",
    "vehicles",
    () => {
      map.getCanvas().style.cursor =
        "pointer";
    }
  );

  map.on(
    "mouseleave",
    "vehicles",
    () => {
      map.getCanvas().style.cursor =
        "";
    }
  );

  map.on(
    "click",
    "vehicles",
    event => {
      const feature =
        event.features?.[0];

      if (!feature) return;

      event.originalEvent.cancelBubble =
        true;

      const busId =
        cleanId(
          feature.properties?.busId
        );

      const vehicle =
        latestVehicles.find(
          item =>
            item.busId === busId
        );

      if (!vehicle) return;

      selectVehicle(vehicle);
    }
  );

  map.on(
    "click",
    event => {
      const hits =
        map.queryRenderedFeatures(
          event.point,
          {
            layers: ["vehicles"]
          }
        );

      if (hits.length) return;

      clearVehicleSelection();
    }
  );
}

function selectVehicle(vehicle) {
  selectedBusId = vehicle.busId;
  selectedTripId = vehicle.tripId;

  const feature =
    vehicleFeaturesByBus.get(
      vehicle.busId
    );

  map
    .getSource("selected-vehicle")
    .setData(
      feature
        ? {
            type: "FeatureCollection",
            features: [
              JSON.parse(
                JSON.stringify(feature)
              )
            ]
          }
        : emptyFeatureCollection()
    );

  map
    .getSource("selected-route")
    .setData(
      selectedRouteGeoJson(
        vehicle.tripId
      )
    );

  map
    .getSource("selected-stops")
    .setData(
      futureStopsGeoJson(vehicle)
    );

  renderSelectedStopNameMarkers(
    vehicle
  );

  showVehicleInfoPanel(
    vehicle
  );

  // ここではflyTo/easeTo/fitBounds等を絶対に呼ばない。
  // 車両を選択しても現在の地図位置はそのまま。
}

function clearVehicleSelection() {
  selectedBusId = null;
  selectedTripId = null;

  hideVehicleInfoPanel();
  clearSelectedStopNameMarkers();

  if (
    map.getSource("selected-vehicle")
  ) {
    map
      .getSource("selected-vehicle")
      .setData(
        emptyFeatureCollection()
      );
  }

  if (
    map.getSource("selected-route")
  ) {
    map
      .getSource("selected-route")
      .setData(
        emptyFeatureCollection()
      );
  }

  if (
    map.getSource("selected-stops")
  ) {
    map
      .getSource("selected-stops")
      .setData(
        emptyFeatureCollection()
      );
  }
}

// =========================================================
// Realtime更新
// =========================================================
async function updateRealtime() {
  if (updateRunning) return;

  updateRunning = true;
  setLoading(true, 72);

  try {
    await loadVehicles();

    // ★更新するのはデータだけ。
    // center / zoom / pitch / bearing は一切変更しない。
    map
      .getSource("vehicles")
      .setData(
        vehicleGeoJson()
      );

    updateVehicleNumberMarkers(
      latestVehicles
    );

    if (selectedBusId) {
      const current =
        latestVehicles.find(
          vehicle =>
            vehicle.busId ===
            selectedBusId
        );

      if (current) {
        // selected tripが運行中に変わる可能性にも追従
        selectedTripId =
          current.tripId;

        const selectedFeature =
          vehicleFeaturesByBus.get(
            current.busId
          );

        map
          .getSource(
            "selected-vehicle"
          )
          .setData(
            selectedFeature
              ? {
                  type:
                    "FeatureCollection",
                  features: [
                    JSON.parse(
                      JSON.stringify(
                        selectedFeature
                      )
                    )
                  ]
                }
              : emptyFeatureCollection()
          );

        map
          .getSource(
            "selected-route"
          )
          .setData(
            selectedRouteGeoJson(
              current.tripId
            )
          );

        map
          .getSource(
            "selected-stops"
          )
          .setData(
            futureStopsGeoJson(
              current
            )
          );

        renderSelectedStopNameMarkers(
          current
        );

        showVehicleInfoPanel(
          current
        );
      } else {
        clearVehicleSelection();
      }
    }

    readableTimestamp.textContent =
      new Date().toLocaleString(
        "ja-JP"
      );

    statusDisplay.textContent =
      `${latestVehicles.length}台運行中`;

  } catch (error) {
    console.error(error);

    statusDisplay.textContent =
      workerConfigured()
        ? "リアルタイムデータ取得失敗"
        : "Worker URLを設定してください";

  } finally {
    updateRunning = false;
    setLoading(false);
  }
}

function startRealtimeTimer() {
  if (realtimeTimer !== null) {
    return;
  }

  realtimeTimer =
    window.setInterval(
      () => {
        if (!document.hidden) {
          updateRealtime();
        }
      },
      UPDATE_INTERVAL
    );
}

function stopRealtimeTimer() {
  if (realtimeTimer === null) {
    return;
  }

  clearInterval(realtimeTimer);
  realtimeTimer = null;
}

document.addEventListener(
  "visibilitychange",
  () => {
    if (document.hidden) {
      stopRealtimeTimer();
    } else {
      updateRealtime();
      startRealtimeTimer();
    }
  }
);

// =========================================================
// 起動
// =========================================================
map.on(
  "load",
  async () => {
    try {
      statusDisplay.textContent =
        "GTFS読込中...";

      setLoading(true, 32);

      await loadStaticGtfs();
      await loadImageToMap(
        DEFAULT_ICON_URL
      );

      // OpenFreeMap Positronの上に実際の標高地形を追加
      installTerrain();

      installLayers();

      if (!workerConfigured()) {
        statusDisplay.textContent =
          "Worker URLを設定してください";

        readableTimestamp.textContent =
          "--";

        setLoading(false);
        return;
      }

      statusDisplay.textContent =
        "リアルタイム情報取得中...";

      setLoading(true, 72);

      await updateRealtime();
      startRealtimeTimer();

    } catch (error) {
      console.error(error);

      statusDisplay.textContent =
        "初期化に失敗しました";

      setLoading(false);
    }
  }
);
