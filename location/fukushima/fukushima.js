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

    // 非営業・回送車両 + 当日充当履歴 Cloudflare Worker
    const BUSVISION_FALLBACK_BASE =
      "https://fukushima-busvision-fallback.fujimaru703.workers.dev";

    const FALLBACK_URL =
      BUSVISION_FALLBACK_BASE + "/fallback";

    const VEHICLE_HISTORY_URL =
      BUSVISION_FALLBACK_BASE + "/history";

    // 運用予測 Worker
    // 通常カードは1段だけ取得し、詳細はクリック時だけ全ツリーを取得する。
    const UNYO_PREDICT_URL =
      "https://unyo-predict.fujimaru703.workers.dev/predict";

    const UNYO_PREDICT_TREE_URL =
      "https://unyo-predict.fujimaru703.workers.dev/predict-tree";

    const RARE_VEHICLES_URL =
      "https://unyo-predict.fujimaru703.workers.dev/rare-vehicles";

    const RARE_VEHICLES_REFRESH_MS =
      2 * 60 * 1000;

    const RARE_VEHICLES_STORAGE_KEY =
      "fukushima-rare-vehicles-v1";

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

    // =========================================================
    // 営業所・駐在・工場・待機場所
    // =========================================================
    // coordinates は [経度, 緯度] の順。
    // 最後の点は自動で先頭点につなぐので、同じ座標を重ねて書かなくてOK。
    //
    // 例:
    // {
    //   id: "fukushima_depot",
    //   name: "福島営業所",
    //   type: "depot",
    //   coordinates: [
    //     [140.000000, 37.000000],
    //     [140.000500, 37.000000],
    //     [140.000500, 37.000500],
    //     [140.000000, 37.000500]
    //   ]
    // }
    //
    // type:
    //   depot     = 営業所
    //   resident  = 駐在
    //   factory   = 工場
    //   standby   = 待機場所
    const VEHICLE_PLACE_AREAS = [
  {
    id: "fukushima_branch_1",
    groupId: "fukushima_branch",
    name: "福島支社",
    type: "depot",
    coordinates: [
      [140.48560163967073, 37.76578746615627],
      [140.48724117129012, 37.76515301834614],
      [140.48774032516573, 37.76597292335163],
      [140.4873524687918, 37.76612285365541],
      [140.48725763838192, 37.765970674398744],
      [140.4860092554468, 37.7664383750413]
    ]
  },
  {
    id: "fukushima_branch_2",
    groupId: "fukushima_branch",
    name: "福島支社",
    type: "depot",
    coordinates: [
      [140.48660923961762, 37.76533438979335],
      [140.48629218008114, 37.76490406115595],
      [140.48577251717896, 37.765117490116936],
      [140.48570307840217, 37.76491862481465],
      [140.4858271305667, 37.76486402534369],
      [140.4857139476299, 37.7647681012626],
      [140.4854586813651, 37.764474815048835],
      [140.48529698537067, 37.76420942895705],
      [140.48548330511846, 37.764141297900224],
      [140.48554650609017, 37.76425095642758],
      [140.48575909117687, 37.764167252595946],
      [140.48577497326298, 37.764190339142466],
      [140.4864851350741, 37.76391781894447],
      [140.4872081134929, 37.765098762564904]
    ]
  },
  {
  id: "shida_chuzai",
  name: "志田駐在",
  type: "depot",
  coordinates: [
    [140.36130298579025, 37.76494370618494],
    [140.36028228117695, 37.765179471168196],
    [140.36053745733028, 37.76551609687374],
    [140.36133647766036, 37.765068523034415]
  ]
 },
  {
  id: "yanagawa_chuzai",
  name: "梁川駐在",
  type: "depot",
  coordinates: [
    [140.60904318733012, 37.864840489667245],
    [140.60856659017097, 37.86490276630051],
    [140.60846141010825, 37.864996181151746],
    [140.60850633076004, 37.86529026416943],
    [140.60912535925408, 37.86521501362664]
  ]
 },
  {
  id: "yuno_chuzai",
  name: "湯野駐在",
  type: "depot",
  coordinates: [
    [140.4561101081075, 37.829548435300005],
    [140.45653301809517, 37.82949045585072],
    [140.45651110566055, 37.82935372801383],
    [140.45608600442947, 37.82940565000703]
  ]
},
  {
  id: "kakeda_chuzai",
  name: "掛田駐在",
  type: "depot",
  coordinates: [
    [140.5935650701446, 37.785414753667496],
    [140.59247015378318, 37.78533529867879],
    [140.59247522284042, 37.78547417793097],
    [140.59296269717726, 37.78562908140437],
    [140.59349156881478, 37.785645105883106]
  ]
},
  {
  id: "horai_chuzai",
  name: "蓬莱営業所",
  type: "depot",
  coordinates: [
    [140.46193403030853, 37.6938999239208],
    [140.4627497965737, 37.69397059518371],
    [140.46280003438335, 37.69363238209714],
    [140.4621987755721, 37.693583795389515]
  ]
},
{
  id: "kawamata_shucchojo",
  name: "川俣出張所",
  type: "depot",
  coordinates: [
    [140.61341534382203, 37.66600704125173],
    [140.61417164475108, 37.66592570431153],
    [140.61415491771632, 37.66633333389491],
    [140.6134798623847, 37.666350357819546],
    [140.61337472102332, 37.666288882517776],
    [140.61331020246067, 37.66617538951921],
    [140.61340459072827, 37.666153636674686]
  ]
},
 {
  id: "soma_eigyosho_1",
  groupId: "soma_eigyosho",
  name: "相馬営業所",
  type: "depot",
  coordinates: [
    [140.92338879457978, 37.806312988260714],
    [140.9237603948668, 37.806618555043734],
    [140.92402035557836, 37.80640938369518],
    [140.92362941872972, 37.80612787890144]
  ]
},
{
  id: "soma_eigyosho_2",
  groupId: "soma_eigyosho",
  name: "相馬営業所",
  type: "depot",
  coordinates: [
    [140.9236719789958, 37.806069220255495],
    [140.92373964869495, 37.80600264217268],
    [140.9238952168148, 37.80605403247871],
    [140.9239991524121, 37.80611972725084],
    [140.92389454626257, 37.80623257377947]
  ]
},
{
  id: "soma_eigyosho_3",
  groupId: "soma_eigyosho",
  name: "相馬営業所",
  type: "depot",
  coordinates: [
    [140.92435512976243, 37.80334118457468],
    [140.92455830709136, 37.803363966669785],
    [140.92451338009076, 37.80369933949356],
    [140.92429343895583, 37.80367602768807]
  ]
},
 {
  id: "nihonmatsu_eigyosho",
  name: "二本松営業所",
  type: "depot",
  coordinates: [
    [140.4468552518882, 37.58890032455077],
    [140.44724743256876, 37.588802241864975],
    [140.44738684563458, 37.589004601790776],
    [140.44762267521753, 37.58944132568214],
    [140.44753277333396, 37.58957244559135],
    [140.44724612964717, 37.58956005631848],
    [140.44693473036926, 37.58952805068733],
    [140.44685004018908, 37.58921935050618]
  ]
},
 {
  id: "kitahara_chuzai",
  name: "北原駐在",
  type: "depot",
  coordinates: [
    [140.9856175083316, 37.627345895196314],
    [140.98565965781955, 37.62799088659788],
    [140.98605556193493, 37.627828745109476],
    [140.9858523411913, 37.627292245016044]
  ]
},
 {
  id: "michinoeki_soma",
  name: "道の駅相馬",
  type: "standby",
  coordinates: [
    [140.9823420653686, 37.63574930921486],
    [140.9822952295093, 37.63602898529245],
    [140.98305472993076, 37.6361041668542],
    [140.9831066291262, 37.63585055408135]
  ]
},
 {
  id: "idai_taikijo",
  name: "医大待機場",
  type: "standby",
  coordinates: [
    [140.4654402371755, 37.68823565295176],
    [140.46571565594024, 37.68822161307281],
    [140.46571903531157, 37.68797424334121],
    [140.46541320220476, 37.688013688840186]
  ]
},
 {
  id: "kamihama_standby",
  name: "上浜車庫",
  type: "standby",
  coordinates: [
    [140.47634260913438, 37.75302198764269],
    [140.4769601877523, 37.75313332473289],
    [140.47700645585792, 37.75349172298759]
  ]
},
 {
  id: "ohara_1",
  name: "大原待機1",
  type: "standby",
  coordinates: [
    [140.46775885262775, 37.75194014113562],   // 1 固定
    [140.4677003847887, 37.75119410353984],    // 2 固定
    [140.4679667110218, 37.75118374572281],    // 3 新指定
    [140.46802517886084, 37.751929783318595]   // 4 補正
  ]
},
 {
  id: "ohara_2",
  name: "大原待機2",
  type: "standby",
  coordinates: [
    [140.4680567868037, 37.75101756220593],   // 北西 固定
    [140.4689536430127, 37.75098824222339],   // 北東 固定
    [140.46894626693802, 37.75089651905876],  // 南東 補正
    [140.468049410729, 37.7509258390413]      // 南西 固定
  ]
},
 {
  id: "higashiguchi",
  name: "東口待機場",
  type: "standby",
  labelPosition: [140.46081551285454, 37.75478668460329],
  coordinates: [
    [140.4607295285751, 37.75485468241704],   // 左上
    [140.46086699178443, 37.754853622089264], // 右上
    [140.46090186050094, 37.75465534053256],  // 右下
    [140.4607643972916, 37.75465640086033]    // 左下
  ]
},
 {
  id: "nishiguchi_standby",
  name: "西口待機場",
  type: "standby",
  coordinates: [
    [140.45792803199166, 37.75556108247229],
    [140.45820094675364, 37.755552599930716],
    [140.45820027620138, 37.7553622726485],
    [140.45792736143943, 37.75537128537207]
  ]
},
 {
  id: "azuma_park_parking",
  name: "あづま総合運動公園駐車場",
  type: "standby",
  coordinates: [
    [140.36154932354796, 37.72499949237927],
    [140.36154216289157, 37.72511418360606],
    [140.36190513646707, 37.7254998711974],
    [140.36196415692996, 37.725528517155595],
    [140.3622572471831, 37.72552745619438],
    [140.36232029176844, 37.72548979206131],
    [140.36231720636286, 37.72501340832406],
    [140.36225417445223, 37.72494976297947],
    [140.36165527148566, 37.72495248086349]
  ]
},
 {
  id: "fukko_seibi_fukushima_factory",
  name: "福交整備福島工場",
  type: "factory",
  coordinates: [
    [140.47378832922112, 37.79125607337608],
    [140.47380107223222, 37.79103982992651],
    [140.473577103939, 37.79102768485991],
    [140.4736932332229, 37.79041270294795],
    [140.4733896687648, 37.790073302144805],
    [140.4733962540137, 37.789688726507364],
    [140.473923343422, 37.78965555753653],
    [140.4738696583914, 37.789913195199574],
    [140.4739887415579, 37.79011606494725],
    [140.47412149000266, 37.7902302271439],
    [140.4741429640156, 37.79041149783483],
    [140.4741128451876, 37.7908054556474],
    [140.47408746680867, 37.79093658666026],
    [140.4740864907171, 37.79093658666359],
    [140.47405135142324, 37.791008322942716],
    [140.4738834636855, 37.79125361421132]
  ]
}
        
];

    const VEHICLE_PLACE_VISIBILITY_STORAGE_KEY =
      "fukushima-vehicle-place-visibility-v1";

    let vehiclePlaceVisible = (() => {
      try {
        const saved =
          localStorage.getItem(
            VEHICLE_PLACE_VISIBILITY_STORAGE_KEY
          );

        // 初回は表示ON。
        return saved === null
          ? false
          : saved === "1";
      } catch (_) {
        return true;
      }
    })();

    function normalizeVehiclePlaceRing(coordinates) {
      if (!Array.isArray(coordinates)) return [];

      const ring =
        coordinates
          .map(point => {
            if (
              !Array.isArray(point) ||
              point.length < 2
            ) {
              return null;
            }

            const lng = Number(point[0]);
            const lat = Number(point[1]);

            if (
              !Number.isFinite(lng) ||
              !Number.isFinite(lat)
            ) {
              return null;
            }

            return [lng, lat];
          })
          .filter(Boolean);

      if (ring.length < 3) {
        return [];
      }

      const first = ring[0];
      const last = ring[ring.length - 1];

      if (
        first[0] !== last[0] ||
        first[1] !== last[1]
      ) {
        ring.push([...first]);
      }

      return ring;
    }

    function vehiclePlaceAreasGeoJson() {
      return {
        type: "FeatureCollection",
        features:
          VEHICLE_PLACE_AREAS
            .map(place => {
              const ring =
                normalizeVehiclePlaceRing(
                  place?.coordinates
                );

              if (ring.length < 4) {
                return null;
              }

              return {
                type: "Feature",
                properties: {
                  id:
                    String(place?.id || ""),
                  groupId:
                    String(place?.groupId || place?.id || ""),
                  name:
                    String(place?.name || "名称未設定"),
                  placeType:
                    String(place?.type || "standby")
                },
                geometry: {
                  type: "Polygon",
                  coordinates: [ring]
                }
              };
            })
            .filter(Boolean)
      };
    }


    function vehiclePlacePolygonCentroid(coordinates) {
      const ring = normalizeVehiclePlaceRing(coordinates);
      if (ring.length < 4) return null;

      let twiceArea = 0;
      let cx = 0;
      let cy = 0;

      for (let i = 0; i < ring.length - 1; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[i + 1];
        const cross = x1 * y2 - x2 * y1;

        twiceArea += cross;
        cx += (x1 + x2) * cross;
        cy += (y1 + y2) * cross;
      }

      if (Math.abs(twiceArea) < 1e-12) {
        const pts = ring.slice(0, -1);
        if (!pts.length) return null;

        return [
          pts.reduce((sum, p) => sum + p[0], 0) / pts.length,
          pts.reduce((sum, p) => sum + p[1], 0) / pts.length
        ];
      }

      const factor = 1 / (3 * twiceArea);
      return [
        cx * factor,
        cy * factor
      ];
    }

    function vehiclePlaceLabelsGeoJson() {
      const groups = new Map();

      for (const place of VEHICLE_PLACE_AREAS) {
        const center =
  Array.isArray(place?.labelPosition) &&
  place.labelPosition.length >= 2 &&
  Number.isFinite(Number(place.labelPosition[0])) &&
  Number.isFinite(Number(place.labelPosition[1]))
    ? [
        Number(place.labelPosition[0]),
        Number(place.labelPosition[1])
      ]
    : vehiclePlacePolygonCentroid(
        place?.coordinates
      );

        if (!center) continue;

        const groupId =
          String(
            place?.groupId ||
            place?.id ||
            ""
          );

        if (!groupId) continue;

        if (!groups.has(groupId)) {
          groups.set(groupId, {
            id: groupId,
            name:
              String(
                place?.name ||
                "名称未設定"
              ),
            placeType:
              String(
                place?.type ||
                "standby"
              ),
            centers: []
          });
        }

        groups.get(groupId).centers.push(center);
      }

      return {
        type: "FeatureCollection",
        features:
          [...groups.values()]
            .map(group => {
              const lng =
                group.centers
                  .reduce(
                    (sum, p) =>
                      sum + p[0],
                    0
                  ) /
                group.centers.length;

              const lat =
                group.centers
                  .reduce(
                    (sum, p) =>
                      sum + p[1],
                    0
                  ) /
                group.centers.length;

              return {
                type: "Feature",
                properties: {
                  id: group.id,
                  name: group.name,
                  placeType:
                    group.placeType
                },
                geometry: {
                  type: "Point",
                  coordinates:
                    [lng, lat]
                }
              };
            })
      };
    }

    function setVehiclePlaceVisibility(visible) {
      vehiclePlaceVisible = Boolean(visible);

      const visibility =
        vehiclePlaceVisible
          ? "visible"
          : "none";

      for (const layerId of [
        "vehicle-place-fill",
        "vehicle-place-line",
        "vehicle-place-label"
      ]) {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(
            layerId,
            "visibility",
            visibility
          );
        }
      }

      try {
        localStorage.setItem(
          VEHICLE_PLACE_VISIBILITY_STORAGE_KEY,
          vehiclePlaceVisible ? "1" : "0"
        );
      } catch (_) {}

      updateVehiclePlaceToggleButton();
    }

    let vehiclePlaceToggleButton = null;

    function updateVehiclePlaceToggleButton() {
      if (!vehiclePlaceToggleButton) return;

      vehiclePlaceToggleButton.textContent =
        vehiclePlaceVisible
          ? "場所 ON"
          : "場所 OFF";

      vehiclePlaceToggleButton.title =
        vehiclePlaceVisible
          ? "営業所・駐在・待機場所を非表示"
          : "営業所・駐在・待機場所を表示";

      vehiclePlaceToggleButton.setAttribute(
        "aria-pressed",
        vehiclePlaceVisible ? "true" : "false"
      );
    }

    class VehiclePlaceToggleControl {
      onAdd(mapInstance) {
        this.map = mapInstance;

        this.container =
          document.createElement("div");

        this.container.className =
          "maplibregl-ctrl maplibregl-ctrl-group";

        const button =
          document.createElement("button");

        button.type = "button";
        button.style.width = "auto";
        button.style.minWidth = "62px";
        button.style.padding = "0 8px";
        button.style.fontSize = "11px";
        button.style.fontWeight = "700";
        button.setAttribute(
          "aria-label",
          "営業所・駐在・待機場所の表示切替"
        );

        button.addEventListener(
          "click",
          () => {
            setVehiclePlaceVisibility(
              !vehiclePlaceVisible
            );
          }
        );

        vehiclePlaceToggleButton = button;
        updateVehiclePlaceToggleButton();

        this.container.appendChild(button);
        return this.container;
      }

      onRemove() {
        if (
          vehiclePlaceToggleButton &&
          this.container?.contains(
            vehiclePlaceToggleButton
          )
        ) {
          vehiclePlaceToggleButton = null;
        }

        this.container?.remove();
        this.map = undefined;
      }
    }

    function installVehiclePlaceLayers() {
      if (
        !map.getSource(
          "vehicle-place-areas"
        )
      ) {
        map.addSource(
          "vehicle-place-areas",
          {
            type: "geojson",
            data:
              vehiclePlaceAreasGeoJson()
          }
        );
      } else {
        map.getSource(
          "vehicle-place-areas"
        )?.setData(
          vehiclePlaceAreasGeoJson()
        );
      }

      const visibility =
        vehiclePlaceVisible
          ? "visible"
          : "none";

      if (
        !map.getLayer(
          "vehicle-place-fill"
        )
      ) {
        map.addLayer({
          id: "vehicle-place-fill",
          type: "fill",
          source: "vehicle-place-areas",
          layout: {
            visibility
          },
          paint: {
            "fill-color": [
              "match",
              ["get", "placeType"],
              "depot", "#516b7a",
              "resident", "#6e7f89",
              "factory", "#7b6d62",
              "standby", "#667d70",
              "#697b85"
            ],
            "fill-opacity": 0.16
          }
        });
      }

      if (
        !map.getLayer(
          "vehicle-place-line"
        )
      ) {
        map.addLayer({
          id: "vehicle-place-line",
          type: "line",
          source: "vehicle-place-areas",
          layout: {
            visibility
          },
          paint: {
            "line-color": [
              "match",
              ["get", "placeType"],
              "depot", "#405968",
              "resident", "#596d78",
              "factory", "#6b5c51",
              "standby", "#4e6758",
              "#536873"
            ],
            "line-width": 2,
            "line-opacity": 0.9
          }
        });
      }

      if (
        !map.getSource(
          "vehicle-place-label-points"
        )
      ) {
        map.addSource(
          "vehicle-place-label-points",
          {
            type: "geojson",
            data:
              vehiclePlaceLabelsGeoJson()
          }
        );
      } else {
        map.getSource(
          "vehicle-place-label-points"
        )?.setData(
          vehiclePlaceLabelsGeoJson()
        );
      }

      if (
        !map.getLayer(
          "vehicle-place-label"
        )
      ) {
        map.addLayer({
          id: "vehicle-place-label",
          type: "symbol",
          source:
            "vehicle-place-label-points",

          // ズームレベルによる非表示制限なし。

          layout: {
            visibility,
            "text-field":
              ["get", "name"],

            // 広域側ではやや小さく、中距離で少し大きく。
            "text-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              10, 11,
              12, 12,
              14, 14,
              15.4, 15
            ],

            "text-font": [
              "Noto Sans Regular"
            ],

            "text-allow-overlap":
              true,
            "text-ignore-placement":
              true,

            // 3D表示でも文字は地面に寝かせず画面正面を向く。
            "text-pitch-alignment":
              "viewport",
            "text-rotation-alignment":
              "viewport",

            // 実際の浮き上がり量は pitchchange 側で動的変更する。
            "text-offset":
              [0, 0]
          },

          paint: {
            "text-color":
              "#1f3038",
            "text-halo-color":
              "rgba(255,255,255,1)",
            "text-halo-width":
              3,
            "text-halo-blur":
              0.4
          }
        });
      }
    }



    function updateVehiclePlaceLabelPitchOffset() {
      if (!map.getLayer("vehicle-place-label")) return;

      const pitch = Number(map.getPitch()) || 0;

      // 2Dでは中央、3Dになるほど上へ浮かせる。
      const y =
        pitch >= 55 ? -2.6 :
        pitch >= 40 ? -1.9 :
        pitch >= 25 ? -1.2 :
        pitch >= 10 ? -0.55 :
        0;

      map.setLayoutProperty(
        "vehicle-place-label",
        "text-offset",
        [0, y]
      );
    }

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

    class BasemapToggleControl {
      onAdd(mapInstance) {
        this.map = mapInstance;
        this.isSatellite = false;

        this.container = document.createElement("div");
        this.container.className = "maplibregl-ctrl maplibregl-ctrl-group";

        this.button = document.createElement("button");
        this.button.type = "button";
        this.button.title = "衛星写真に切り替え";
        this.button.setAttribute("aria-label", "衛星写真に切り替え");
        this.button.style.width = "auto";
        this.button.style.minWidth = "54px";
        this.button.style.padding = "0 8px";
        this.button.style.fontSize = "11px";
        this.button.style.fontWeight = "700";
        this.button.textContent = "衛星写真";

        this.button.addEventListener("click", () => {
          this.isSatellite = !this.isSatellite;

          if (this.map.getLayer("gsi-seamlessphoto")) {
            this.map.setLayoutProperty(
              "gsi-seamlessphoto",
              "visibility",
              this.isSatellite ? "visible" : "none"
            );
          }

          this.button.textContent =
            this.isSatellite ? "地図" : "衛星写真";
          this.button.title =
            this.isSatellite ? "通常地図に戻す" : "衛星写真に切り替え";
          this.button.setAttribute(
            "aria-label",
            this.isSatellite ? "通常地図に戻す" : "衛星写真に切り替え"
          );
        });

        this.container.appendChild(this.button);
        return this.container;
      }

      onRemove() {
        this.container?.remove();
        this.map = undefined;
      }
    }

    map.addControl(new BasemapToggleControl(), "top-right");
    map.addControl(new VehiclePlaceToggleControl(), "top-right");


    // 車番検索UI
    let vehicleSearchInput = null;
    let vehicleSearchDropdown = null;
    let vehicleSearchResultMarker = null;

    class VehicleSearchControl {
      onAdd(mapInstance) {
        this.map = mapInstance;

        const container = document.createElement("div");
        container.className =
          "maplibregl-ctrl vehicle-search-control";
        container.style.cssText = `
          position:relative;
          display:flex;
          align-items:center;
          gap:4px;
          padding:5px;
          border-radius:8px;
          background:rgba(255,255,255,.96);
          box-shadow:0 1px 5px rgba(0,0,0,.18);
          font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
        `;

        const input = document.createElement("input");
        input.type = "search";
        input.placeholder = "車番検索";
        input.setAttribute("aria-label", "車番検索");
        input.autocomplete = "off";
        input.inputMode = "numeric";
        input.style.cssText = `
          width:96px;
          height:28px;
          box-sizing:border-box;
          border:1px solid #cfd9df;
          border-radius:6px;
          padding:0 7px;
          outline:none;
          font-size:11px;
          font-weight:800;
          color:#26343c;
          background:#fff;
        `;

        const dropdown = document.createElement("div");
        dropdown.style.cssText = `
          position:absolute;
          left:5px;
          top:38px;
          width:96px;
          max-height:190px;
          overflow-y:auto;
          display:none;
          box-sizing:border-box;
          border:1px solid #cfd9df;
          border-radius:7px;
          background:rgba(255,255,255,.98);
          box-shadow:0 6px 18px rgba(0,0,0,.16);
          z-index:20;
          padding:3px;
        `;

        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "検索";
        button.title = "車番を検索";
        button.style.cssText = `
          height:28px;
          border:1px solid #cbd8df;
          border-radius:6px;
          padding:0 8px;
          background:#f6f9fa;
          color:#26343c;
          font-size:10px;
          font-weight:900;
          cursor:pointer;
        `;

        const runSearch = () => {
          searchVehicleByNumber(input.value);
        };

        button.addEventListener("click", runSearch);

        input.addEventListener("keydown", e => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          runSearch();
        });

        input.addEventListener("input", () => {
          const value =
            cleanId(input.value);

          // 検索欄を空にしたら、検索で付けたフォーカスも解除する。
          if (!value) {
            clearVehicleSearchFocus();
          }

          renderVehicleSearchDropdown(
            input.value
          );
        });

        input.addEventListener("focus", () => {
          renderVehicleSearchDropdown(
            input.value
          );
        });

        input.addEventListener("blur", () => {
          // 候補クリックを先に通す。
          setTimeout(() => {
            if (vehicleSearchDropdown) {
              vehicleSearchDropdown.style.display = "none";
            }
          }, 120);
        });

        // 地図のドラッグ等へイベントが漏れないようにする。
        for (const type of [
          "mousedown",
          "dblclick",
          "touchstart",
          "wheel"
        ]) {
          container.addEventListener(
            type,
            e => e.stopPropagation()
          );
        }

        container.append(input, button, dropdown);

        vehicleSearchInput = input;
        vehicleSearchDropdown = dropdown;

        return container;
      }

      onRemove() {
        vehicleSearchInput = null;
        vehicleSearchDropdown = null;
        this.map = undefined;
      }
    }


    map.addControl(
      new VehicleSearchControl(),
      "top-left"
    );


    // 検索バー/候補以外をクリックしたら検索フォーカス解除。
    document.addEventListener("click", e => {
      const control =
        document.querySelector(".vehicle-search-control");

      if (
        control &&
        control.contains(e.target)
      ) {
        return;
      }

      // 車両ポップアップ内の操作では車両選択を解除しない。
      // 「次便予測」をクリックして詳細ツリーを開いた時も、
      // 元の車両ポップアップをそのまま残す。
      if (
        vehicleInfoPanel &&
        vehicleInfoPanel.contains(e.target)
      ) {
        return;
      }

      // 詳細予測ツリー内を操作している間も、
      // 背後の車両ポップアップ/選択状態を維持する。
      const predictionOverlay =
        document.getElementById(
          "unyoPredictionOverlay"
        );

      if (
        predictionOverlay &&
        predictionOverlay.contains(e.target)
      ) {
        return;
      }

      // 検索中の目印や詳細表示がある時だけ解除する。
      if (
        vehicleSearchResultMarker ||
        selectedTripId ||
        (
          vehicleInfoPanel &&
          vehicleInfoPanel.style.display !== "none"
        )
      ) {
        clearVehicleSearchFocus();
      }
    });

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
    map.on("pitch", () => {
      updateVehiclePlaceLabelPitchOffset();
    });
    map.on("pitchend", () => {
      updateVehiclePlaceLabelPitchOffset();
    });
    map.on("zoom", () => {
      updateVehicleNumberMarkerOffsets();
    });

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
    let retainedVehicles = [];
    let staticGtfsLoaded = false;
    let updateRunning = false;
    let selectedTripId = null;
    let realtimeTimer = null;
    let vehicleFeaturesByTrip = new Map();
    let selectedStopNameMarkers = [];
    let vehicleInfoPanel = null;
    const vehicleNumberMarkers = new Map();

    const rareVehicleMarkers = new Map();

    let rareVehicleSet =
      loadRareVehiclesFromStorage();

    let rareVehiclesLastFetch = 0;
    let rareVehiclesFetchRunning = false;

    // 車番ごとの当日充当履歴。プルダウンを初めて開いた時だけ取得する。
    const vehicleHistoryCache = new Map();
    let expandedHistoryVehicleCd = null;

    const labelIconMap = new Map();
const label290 = ['2007','8015','8016','8037','8038','8057','8058','8059','8077','8078','8079','8081','8101','8102','0873','0874','8127','8138','8141','8143','8145','2006','0741','0743','0744','0774','0775','0803','8060','8061','7165','8080','80801','8098','8099','8100','8128','8129','8156','8157','8158','0887','0889','7216','0896','0897','8178','8179','8203','8204','8205','5007','5008'];
    label290.forEach(label => labelIconMap.set(label, 'icon/290-v2.png'));

const labelergaev = ['7704','7705','7706'];
labelergaev.forEach(label => labelIconMap.set(label, 'icon/ergaev-v2.png'));

const label557 = ['0557','2411','2412','2408'];
label557.forEach(label => labelIconMap.set(label, 'icon/557&2411-v2.png'));

const label8137 = ['8137'];
label8137.forEach(label => labelIconMap.set(label, 'icon/8137miura.png'));

const label8139 = ['8139'];
label8139.forEach(label => labelIconMap.set(label, 'icon/8139.png'));

const label8140 = ['8140'];
label8140.forEach(label => labelIconMap.set(label, 'icon/8140hgakuin.png'));

const label8144 = ['8144'];
label8144.forEach(label => labelIconMap.set(label, 'icon/8144fdaigaku.png'));

const label8145 = ['8145'];
label8145.forEach(label => labelIconMap.set(label, 'icon/8145oyama.png'));

const label8146 = ['8146'];
label8146.forEach(label => labelIconMap.set(label, 'icon/8146.png'));

const label8181 = ['8181'];
label8181.forEach(label => labelIconMap.set(label, 'icon/8181-v2.png'));

const label875 = ['0875','8125'];
label875.forEach(label => labelIconMap.set(label, 'icon/875-v2.png'));

const label1183 = ['1183'];
label1183.forEach(label => labelIconMap.set(label, 'icon/1183-v2.png'));

const label1240 = ['1240'];
label1240.forEach(label => labelIconMap.set(label, 'icon/1240-v2.png'));

const label1311 = ['1304','1311','1241'];
label1311.forEach(label => labelIconMap.set(label, 'icon/1311-v2.png'));

const label1322 = ['1322'];
label1322.forEach(label => labelIconMap.set(label, 'icon/1322-v2.png'));

const label1360 = ['1360'];
label1360.forEach(label => labelIconMap.set(label, 'icon/1360-v2.png'));

const label1388 = ['1388'];
label1388.forEach(label => labelIconMap.set(label, 'icon/1388-v2.png'));

const label1411 = ['1411'];
label1411.forEach(label => labelIconMap.set(label, 'icon/1411-v2.png'));

const label1471 = ['1471'];
label1471.forEach(label => labelIconMap.set(label, 'icon/1471-v2.png'));

const label1516 = ['0890','1527'];
label1516.forEach(label => labelIconMap.set(label, 'icon/1516&1527-v2.png'));

const label1520 = ['1520'];
label1520.forEach(label => labelIconMap.set(label, 'icon/1520-v2.png'));

const label1613 = ['1613'];
label1613.forEach(label => labelIconMap.set(label, 'icon/1613-v2.png'));

const label1735 = ['1735'];
label1735.forEach(label => labelIconMap.set(label, 'icon/1735-v2.png'));

const label1936 = ['1936','1944'];
label1936.forEach(label => labelIconMap.set(label, 'icon/1936&1944-v2.png'));

const label2008 = ['2008'];
label2008.forEach(label => labelIconMap.set(label, 'icon/2008-v2.png'));

const label2417 = ['2417'];
label2417.forEach(label => labelIconMap.set(label, 'icon/2417-v2.png'));

const label2420 = ['2420'];
label2420.forEach(label => labelIconMap.set(label, 'icon/2420-v2.png'));

const label2236 = ['2236'];
label2236.forEach(label => labelIconMap.set(label, 'icon/2236-v2.png'));

const label2329 = ['0893','2328','2329','7128','2386'];
label2329.forEach(label => labelIconMap.set(label, 'icon/2329&7128-v2.png'));

const label2339 = ['2339'];
label2339.forEach(label => labelIconMap.set(label, 'icon/2331&2339-v2.png'));

const label2383 = ['2383'];
label2383.forEach(label => labelIconMap.set(label, 'icon/2383-v2.png'));

const label2465 = ['2465'];
label2465.forEach(label => labelIconMap.set(label, 'icon/2465-v2.png'));

const label2467 = ['2467'];
label2467.forEach(label => labelIconMap.set(label, 'icon/2467-v2.png'));

const label2468 = ['2468','2469'];
label2468.forEach(label => labelIconMap.set(label, 'icon/2468&2469-v2.png'));

const label2489 = ['2551','5005'];
label2489.forEach(label => labelIconMap.set(label, 'icon/2489-v2.png'));

const label2594 = ['2594'];
label2594.forEach(label => labelIconMap.set(label, 'icon/2594-v2.png'));

const label2940 = ['2940'];
label2940.forEach(label => labelIconMap.set(label, 'icon/2940-v2.png'));

const label2941 = ['2941'];
label2941.forEach(label => labelIconMap.set(label, 'icon/2941-v2.png'));

const label7079 = ['7079'];
label7079.forEach(label => labelIconMap.set(label, 'icon/7079-v2.png'));

const label7085 = ['7085'];
label7085.forEach(label => labelIconMap.set(label, 'icon/7085-v2.png'));

const label7110 = ['7110'];
label7110.forEach(label => labelIconMap.set(label, 'icon/7110-v2.png'));

const label7701 = ['7701','7702','7703'];
label7701.forEach(label => labelIconMap.set(label, 'icon/7701-v2.png'));

const label8008 = ['8008','8136'];
label8008.forEach(label => labelIconMap.set(label, 'icon/8008-v2.png'));

const label8014 = ['8014'];
label8014.forEach(label => labelIconMap.set(label, 'icon/8014-v2.png'));

const label8075 = ['8075'];
label8075.forEach(label => labelIconMap.set(label, 'icon/8075-v2.png'));

const label8109 = ['8109','8148','8160'];
label8109.forEach(label => labelIconMap.set(label, 'icon/8109-v2.png'));

const label8122 = ['8122','8124'];
label8122.forEach(label => labelIconMap.set(label, 'icon/8122&8124-v2.png'));

const label1706 = ['1706','1769'];
label1706.forEach(label => labelIconMap.set(label, 'icon/1706-v2.png'));

const label8150 = ['8150'];
label8150.forEach(label => labelIconMap.set(label, 'icon/8150-v2.png'));

const label8155 = ['8155'];
label8155.forEach(label => labelIconMap.set(label, 'icon/8155-v2.png'));

const label8186 = ['8186'];
label8186.forEach(label => labelIconMap.set(label, 'icon/8186.png'));

const label8171 = ['8171'];
label8171.forEach(label => labelIconMap.set(label, 'icon/8171.png'));

const label7097 = ['7097'];
label7097.forEach(label => labelIconMap.set(label, 'icon/7097-v2.png'));

const labelkanachan = ['7113','7115','7116'];
labelkanachan.forEach(label => labelIconMap.set(label, 'icon/kanachan-v2.png'));

const labelkanachumio = ['8083','0865','8095'];
labelkanachumio.forEach(label => labelIconMap.set(label, 'icon/kanachu-mio-v2.png'));

const labelkanachumk = ['1623','1625','1668','1771','0562','1860','1863','0580','0581'];
labelkanachumk.forEach(label => labelIconMap.set(label, 'icon/kanachu-mk-v2.png'));

const labelkanachump35 = ['1920','7032','1924','7034','1945','7118','7157','8066','8068'];
labelkanachump35.forEach(label => labelIconMap.set(label, 'icon/kanachu-mp35-v2.png'));

const labelkanachump37 = ['7024','7028','1891','2001'];
labelkanachump37.forEach(label => labelIconMap.set(label, 'icon/kanachu-mp37-v2.png'));

const labelkanehachi = ['0550','0660'];
labelkanehachi.forEach(label => labelIconMap.set(label, 'icon/kanehachi-v2.png'));

const labelkantomidi = ['0672','2009','2022','8022'];
labelkantomidi.forEach(label => labelIconMap.set(label, 'icon/kanto-midi-v2.png'));

const labelkeiohr = ['1544','1638','1641','1645','1646','1657','1698','1740','1764','7198'];
labelkeiohr.forEach(label => labelIconMap.set(label, 'icon/keio-hr-v2.png'));

const labelkeiomklong = ['7047','7050','7052','7061','7064'];
labelkeiomklong.forEach(label => labelIconMap.set(label, 'icon/keio-mk-long-v2.png'));

const labelklhr = ['7030','7033','1943','7036','7045','1974','2027','7213','0575'];
labelklhr.forEach(label => labelIconMap.set(label, 'icon/kl-hr-v2.png'));

const labelkllt = ['1723','7072','1812','1822','1828','1843','8020','8032','8043'];
labelkllt.forEach(label => labelIconMap.set(label, 'icon/kl-lt-v2.png'));

const labelkwskhr = ['7137','8123','8130'];
labelkwskhr.forEach(label => labelIconMap.set(label, 'icon/kwsk-hr-v2.png'));

const labelliesse = ['1382','1590','1859','0854','8147','0905'];
labelliesse.forEach(label => labelIconMap.set(label, 'icon/liesse-v2.png'));

const labelmk = ['8199','0672','0864','2009','2022','8019','8022','8073','8076','7199','7217','1541','8202','0672'];
labelmk.forEach(label => labelIconMap.set(label, 'icon/mk-v2.png'));

const labelmk517 = ['2091','2103'];
labelmk517.forEach(label => labelIconMap.set(label, 'icon/mk517-v2.png'));

const labelmk619 = ['2414','2416','2418'];
labelmk619.forEach(label => labelIconMap.set(label, 'icon/mk619-v2.png'));

const labelmkf = ['0603','2548','0014'];
labelmkf.forEach(label => labelIconMap.set(label, 'icon/mk-f-v2.png'));

const labelmp35silver = ['7106','7109','7111','7112','7114','7117','7119'];
labelmp35silver.forEach(label => labelIconMap.set(label, 'icon/mp35-silver-v2.png'));

const labelmp37 = ['2039','2046','8006','7058','8007','8009','8010','8012','7077','7078','7084','7088','7089','7090','7091','7098','7099','7100','7129','7130','7136','7139','7143','7145','7151','7152','8096'];
labelmp37.forEach(label => labelIconMap.set(label, 'icon/mp37-v2.png'));

const labelmp37black = ['7082','7083','7093','7094','7095','7096'];
labelmp37black.forEach(label => labelIconMap.set(label, 'icon/mp37-black-v2.png'));

const labelmp37silver = ['7080','7086','7087','7092'];
labelmp37silver.forEach(label => labelIconMap.set(label, 'icon/mp37-silver-v2.png'));

const labelmp317 = ['2536','2585','2586','2588','2592','2593'];
labelmp317.forEach(label => labelIconMap.set(label, 'icon/mp317-v2.png'));

const labelnankairj = ['8063','8064'];
labelnankairj.forEach(label => labelIconMap.set(label, 'icon/nankai-rj-v2.png'));

const labelpdgkr = ['1836','1837','0997','0998','1091','1092','1196','1197','1217','8182','7148','7150','7153','8112','8069','0885','8039'];
labelpdgkr.forEach(label => labelIconMap.set(label, 'icon/pdg-kr-v2.png'));

const labelpdglr = ['0995','0996','8088','1089','1090','1192','1193','1194','1219','1220','1221','0997','1091','1092','1196','1197','1217','1605','1835','8036','8041'];
labelpdglr.forEach(label => labelIconMap.set(label, 'icon/pdg-lr-v2.png'));

const labelpkhr = ['8024','8033','8044','8074'];
labelpkhr.forEach(label => labelIconMap.set(label, 'icon/pk-hr-v2.png'));

const labelrakuraku = ['0018','0021','8163','8162','0116','8188','0119','0120','0121','8169','0193','0236','0237','0238','2045','0299','0302','0397','0408','0406','0407','0409','8134','8135','0017','0847','0867'];
labelrakuraku.forEach(label => labelIconMap.set(label, 'icon/rakuraku-v3.png'));

const labelrakurakuf = ['0017','0116'];
labelrakurakuf.forEach(label => labelIconMap.set(label, 'icon/rakuraku-f-v3.png'));

const labelrinkomio = ['1336','1369','1379','5003','5004','1710','1720','2020','1732','1850','1854','1857','2041','8025'];
labelrinkomio.forEach(label => labelIconMap.set(label, 'icon/rinko-mio-v2.png'));

const labelserega = ['1537','1538',,'8001','8002'];
labelserega.forEach(label => labelIconMap.set(label, 'icon/serega(15~)-v2.png'));

const labeltkgmk = ['1472','1473','0879','5006','0878','8045','1660','0878','7133','8183','1833','1834','1926','1927','1928','1929','1930','2004','2005'];
labeltkgmk.forEach(label => labelIconMap.set(label, 'icon/tkg-mk-v2.png'));

const labeltoeimklong = ['7046','1990','7047','1999'];
labeltoeimklong.forEach(label => labelIconMap.set(label, 'icon/toei-mk-long-v2.png'));

const labelmiharu = ['0500'];
labelmiharu.forEach(label => labelIconMap.set(label, 'icon/miharu-v2.png'));

const labelmiharu290 = ['0386'];
labelmiharu290.forEach(label => labelIconMap.set(label, 'icon/miharu290-v2.png'));

const label234 = ['7146','5002','0430','0431','7135','7144','8159','7163','8072','7164','7166','8086','7171','8089','8090','8085','7172','8097','7181','8103','7182','8107','7186','8113','7187','8126','8133','8185','8167','8168','8200'];
label234.forEach(label => labelIconMap.set(label, 'icon/234-v2.png'));

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

      // 前日最終位置を04:00～17:59も取得できるようfallback APIを維持する。
      if (hour < 18) return true;

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
      retainedVehicles = [];
      tripDelays = Object.create(null);
      selectedTripId = null;

      updateVehicleNumberMarkers([]);
      clearVehicleSearchResultMarker();
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
    // Cloudflare fallback
    // =========================================================
    async function loadFallbackVehicles() {

      if (!isFallbackLocationOperating()) {
        fallbackVehicles = [];
        return;
      }

      const data = await fetchJson(FALLBACK_URL);

      if (!data?.success) {
        throw new Error(data?.error || "Cloudflare fallback API error");
      }

      const activeVehicleCds = new Set(
        latestVehicles
          .map(v => cleanId(v.label))
          .filter(Boolean)
      );

      const vehicles = [];

      for (const v of data.vehicles || []) {
        const lat = Number(v?.latitude);
        const lon = Number(v?.longitude);
        const vehicleCd = cleanId(v?.vehicleCd);

        if (!vehicleCd) continue;

        // 念のためPages側でも通常GTFS-RTと重複表示しない。
        if (activeVehicleCds.has(vehicleCd)) continue;

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        if (lat === 0 && lon === 0) continue;

        vehicles.push({
          // fallback Worker が返す「前便」の trip_id。画面には表示せず運用予測の起点に使う。
          tripId: cleanId(v?.tripId),
          routeId: "",
          seq: NaN,

          label: vehicleCd,

          lat,
          lon,
          bearing: 0,

          isFallback: true,
          fallbackRoute: cleanId(v?.route) || "路線名不明",
          fallbackRouteName:
            cleanId(v?.routeName) || cleanId(v?.route) || "路線名不明",
          fallbackDestination: cleanId(v?.destination) || "行先不明",
          fallbackShihatsuName: cleanId(v?.shihatsuName),
          fallbackShihatsuTime: cleanId(v?.shihatsuTime),
          fallbackTerminalTime: cleanId(v?.terminalTime),
          fallbackMapUrl: cleanId(v?.mapUrl),
          fallbackPlanForecastResultCd:
            cleanId(v?.planForecastResultCd),
          positionAge: Number(v?.positionAge)
        });
      }

      fallbackVehicles = vehicles;

      const retained = [];

      for (const v of data.retainedVehicles || []) {
        const lat = Number(v?.latitude);
        const lon = Number(v?.longitude);
        const vehicleCd = cleanId(v?.vehicleCd);

        if (!vehicleCd) continue;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        if (lat === 0 && lon === 0) continue;

        retained.push({
          tripId: "",
          routeId: "",
          seq: NaN,
          label: vehicleCd,
          lat,
          lon,
          bearing: 0,
          isFallback: false,
          isRetained: true,

          // 04:00～05:59は通常色、
          // 06:00～17:59はグレー表示。
          isRetainedGray:
            v?.grayOut === true ||
            v?.grayOut === 1 ||
            v?.grayOut === "1"
        });
      }

      retainedVehicles = retained;
    }

    function displayedVehicles() {
      // 今日側の車番を常に優先。
      // Worker側でも除外しているが、フロント側でも二重表示を防ぐ。
      const activeVehicleCds = new Set(
        [
          ...latestVehicles,
          ...fallbackVehicles
        ]
          .map(v => cleanId(v?.label))
          .filter(Boolean)
      );

      const retained = retainedVehicles.filter(
        v => !activeVehicleCds.has(cleanId(v?.label))
      );

      return [
        ...latestVehicles,
        ...fallbackVehicles,
        ...retained
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
        const delay = (v.isFallback || v.isRetained) ? 0 : getDelayForVehicle(v);
        const routeName = v.isRetained
          ? ""
          : v.isFallback
            ? (v.fallbackRouteName || v.fallbackRoute || "路線名不明")
            : (routeNames[v.routeId] || "路線名不明");
        const headsign = v.isRetained
          ? ""
          : v.isFallback
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
            delayText: v.isRetained
              ? "前日最終位置"
              : (v.isFallback ? "非営業" : formatDelay(delay)),
            iconKey: v.label,
            bearing: Number.isFinite(v.bearing) ? v.bearing : 0,
            isFallback: v.isFallback ? 1 : 0,
            isRetained: v.isRetained ? 1 : 0,
            isRetainedGray:
              v.isRetainedGray ? 1 : 0,
            shihatsuName: v.fallbackShihatsuName || "",
            shihatsuTime: v.fallbackShihatsuTime || "",
            terminalTime: v.fallbackTerminalTime || "",
            mapUrl: v.fallbackMapUrl || "",
            planForecastResultCd: v.fallbackPlanForecastResultCd || "",
            positionAge: Number.isFinite(v.positionAge) ? v.positionAge : -1
          }
        };

        if (!v.isFallback && !v.isRetained && v.tripId) {
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

        if (stop.delay < 60) {
          // 定刻扱いは従来どおり
          const status = document.createElement("span");
          status.textContent = ` ${stop.delayText}`;
          status.style.color = "#16834b";
          status.style.fontWeight = "900";

          meta.append(time, status);
        } else {
          // 遅延時だけ、元の予定時刻を取消線にして
          // 遅延を加味した予定到着時刻を赤字で横に表示
          time.style.textDecoration = "line-through";
          time.style.textDecorationThickness = "1px";

          const expected = document.createElement("span");
          const adjustedMapTime =
            adjustedTimeText(stop.scheduledText, stop.delay);
          expected.textContent =
            ` ${adjustedMapTime.replace(/:\\d{2}$/, "")}`;
          expected.style.color = "#d93025";
          expected.style.fontWeight = "900";

          meta.append(time, expected);
        }
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

        #vehicleInfoPanel .vip-scheduled-time {
          text-decoration: line-through;
          text-decoration-thickness: 1px;
          opacity: .75;
        }

        #vehicleInfoPanel .vip-expected-time {
          margin-left: 7px;
          font-weight: 900;
        }

        #vehicleInfoPanel .vip-expected-time.is-ontime {
          color: #16834b;
        }

        #vehicleInfoPanel .vip-expected-time.is-late {
          color: #d93025;
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

        #vehicleInfoPanel .vip-actions {
          margin-top: 8px;
        }

        #vehicleInfoPanel .vip-track-button,
        #vehicleInfoPanel .vip-history-toggle {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d9e4ea;
          border-radius: 8px;
          background: #ffffff;
          color: #21313a;
          font: inherit;
          font-size: 10px;
          font-weight: 850;
          line-height: 1.2;
          padding: 6px 7px;
          cursor: pointer;
          text-align: left;
        }

        #vehicleInfoPanel .vip-track-button {
          display: block;
          text-decoration: none;
          background: #eef7ff;
          border-color: #cfe5f6;
          margin-bottom: 6px;
        }

        #vehicleInfoPanel .vip-history-toggle {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d9e4ea;
          border-radius: 8px;
          background: #ffffff;
          color: #21313a;
          font: inherit;
          font-size: 10px;
          font-weight: 850;
          line-height: 1.2;
          padding: 7px 9px;
          cursor: pointer;
          text-align: left;
        }


        #vehicleInfoPanel .vip-history-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        #vehicleInfoPanel .vip-history {
          margin-top: 6px;
          max-height: min(280px, 42vh);
          overflow: auto;
          border: 1px solid #e3ebef;
          border-radius: 8px;
          background: #f8fafb;
        }

        #vehicleInfoPanel .vip-history-loading,
        #vehicleInfoPanel .vip-history-empty,
        #vehicleInfoPanel .vip-history-error {
          padding: 9px;
          font-size: 9px;
          color: #687780;
        }

        #vehicleInfoPanel .vip-history-item {
          padding: 8px 9px;
          border-bottom: 1px solid #e3ebef;
        }

        #vehicleInfoPanel .vip-history-item:last-child {
          border-bottom: 0;
        }

        #vehicleInfoPanel .vip-history-time {
          font-size: 9px;
          font-weight: 900;
          color: #30414a;
        }

        #vehicleInfoPanel .vip-history-route {
          margin-top: 2px;
          font-size: 10px;
          font-weight: 900;
          line-height: 1.3;
        }

        #vehicleInfoPanel .vip-history-path {
          margin-top: 2px;
          font-size: 9px;
          line-height: 1.35;
          color: #62727b;
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
            gap: 5px;
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
      expandedHistoryVehicleCd = null;
    }

    function formatHistoryClock(value) {
      const s = cleanId(value);
      const m = s.match(/^(\d{1,2}):(\d{2})/);
      if (!m) return s || "--:--";
      return `${String(Number(m[1]) % 24).padStart(2, "0")}:${m[2]}`;
    }

    function renderVehicleHistoryList(container, history) {
      container.replaceChildren();

      if (!Array.isArray(history) || !history.length) {
        const empty = document.createElement("div");
        empty.className = "vip-history-empty";
        empty.textContent = "本日の充当履歴はありません";
        container.appendChild(empty);
        return;
      }

      for (const trip of history) {
        const item = document.createElement("div");
        item.className = "vip-history-item";

        const route = document.createElement("div");
        route.className = "vip-history-route";
        route.textContent =
          trip.routeName ||
          trip.route ||
          "路線名不明";

        const path = document.createElement("div");
        path.className = "vip-history-path";
        path.textContent =
          `${trip.shihatsuName || "始発不明"} ` +
          `${formatHistoryClock(trip.shihatsuTime)} → ` +
          `${trip.destination || "行先不明"} ` +
          `${formatHistoryClock(trip.terminalTime)}`;

        item.append(route, path);

        container.appendChild(item);
      }
    }

    async function loadAndRenderVehicleHistory(vehicleCd, container) {
      const key = cleanId(vehicleCd);
      if (!key) return;

      if (vehicleHistoryCache.has(key)) {
        renderVehicleHistoryList(
          container,
          vehicleHistoryCache.get(key)
        );
        return;
      }

      container.replaceChildren();
      const loading = document.createElement("div");
      loading.className = "vip-history-loading";
      loading.textContent = "充当履歴を読み込み中...";
      container.appendChild(loading);

      try {
        const data = await fetchJson(
          VEHICLE_HISTORY_URL +
          "?vehicleCd=" +
          encodeURIComponent(key)
        );

        if (!data?.success) {
          throw new Error(
            data?.error ||
            "履歴APIエラー"
          );
        }

        const history =
          Array.isArray(data.history)
            ? data.history
            : [];

        vehicleHistoryCache.set(
          key,
          history
        );

        // パネルを閉じたり別車両へ移動した後に返ってきた場合は
        // 古いcontainerを更新しない。
        if (
          !container.isConnected ||
          expandedHistoryVehicleCd !== key
        ) {
          return;
        }

        renderVehicleHistoryList(
          container,
          history
        );
      } catch (e) {
        console.error("充当履歴取得失敗:", e);

        if (!container.isConnected) return;

        container.replaceChildren();
        const error = document.createElement("div");
        error.className = "vip-history-error";
        error.textContent = "充当履歴を取得できませんでした";
        container.appendChild(error);
      }
    }

    function appendVehicleActions(panel, vehicleProperties) {
      const vehicleCd =
        cleanId(vehicleProperties.label);

      if (!vehicleCd) return;

      const actions = document.createElement("div");
      actions.className = "vip-actions";

      // fallback車両では、その回送を追跡しているBus-Vision地図を開ける。
      const mapUrl =
        cleanId(vehicleProperties.mapUrl);

      if (
        Number(vehicleProperties.isFallback) === 1 &&
        mapUrl
      ) {
        const track = document.createElement("a");
        track.className = "vip-track-button";
        track.href = mapUrl;
        track.target = "_blank";
        track.rel = "noopener noreferrer";
        track.textContent = "回送追跡";
        actions.appendChild(track);
      }

      // 充当履歴プルダウンは廃止。
      // 過去便は運用予測ツリー側で確認できるため、
      // 車両ポップアップはシンプルに保つ。
      if (!actions.childElementCount) {
        return;
      }

      panel.appendChild(actions);
    }


    // =========================================================
    // 運用予測表示
    // =========================================================
    function getPredictionRootNodes(data) {
      if (Array.isArray(data?.predictions)) return data.predictions;
      if (Array.isArray(data?.tree)) return data.tree;
      if (Array.isArray(data?.children)) return data.children;
      if (Array.isArray(data?.root?.children)) return data.root.children;
      return [];
    }

    function getPredictionChildren(node) {
      let children = [];

      if (Array.isArray(node?.children)) {
        children = node.children;
      } else if (Array.isArray(node?.predictions)) {
        children = node.predictions;
      } else if (Array.isArray(node?.next)) {
        children = node.next;
      }

      // 明示的な終端・取得打切りノードには、その先を足さない。
      if (
        isPredictionServiceEnd(node) ||
        isPredictionStopped(node)
      ) {
        return children;
      }

      if (children.length) {
        return children;
      }

      // Workerから子が1件も返らなかった通常ノードは、
      // 画面上で枝が突然消えないよう「運行終了」を明示する。
      //
      // stopped=true の場合は上で除外されるため、
      // 取得失敗/上限打切りを運行終了と誤表示しない。
      return [{
        service_end: true,
        ui_synthetic_end: true,
        probability: 100,
        cumulative_probability:
          Number.isFinite(
            Number(node?.cumulative_probability)
          )
            ? Number(node.cumulative_probability)
            : 100,
        count:
          Number.isFinite(Number(node?.count))
            ? Number(node.count)
            : null,
        n:
          Number.isFinite(Number(node?.n))
            ? Number(node.n)
            : null,
        // 現在便の直後を画面側で「運行終了」と補う場合は、
        // 現在便まで実際に辿った累積実績を最優先で引き継ぐ。
        //
        // 例:
        //   現在便 n=77/77
        //   → 運行終了 100% n=77/77
        //
        // cumulative_count が 0/0 で入っていても、
        // actual_cumulative_* がある場合はこちらを優先する。
        cumulative_count:
          Number.isFinite(
            Number(
              node?.actual_cumulative_count ??
              node?.cumulative_count ??
              node?.count
            )
          )
            ? Number(
                node?.actual_cumulative_count ??
                node?.cumulative_count ??
                node?.count
              )
            : null,
        cumulative_n:
          Number.isFinite(
            Number(
              node?.actual_cumulative_n ??
              node?.cumulative_n ??
              node?.n
            )
          )
            ? Number(
                node?.actual_cumulative_n ??
                node?.cumulative_n ??
                node?.n
              )
            : null
      }];
    }

    function isPredictionServiceEnd(node) {
      if (!node) return false;
      if (node.service_end === true) return true;
      if (node.type === "service_end") return true;
      if (node.status === "service_end") return true;
      if (node.end === true) return true;
      return false;
    }

    function isPredictionStopped(node) {
      return Boolean(
        node?.stopped === true ||
        node?.type === "prediction_stopped"
      );
    }

    function predictionStoppedLabel(node) {
      const reason = String(node?.reason || "");

      if (reason === "max_depth") return "予測取得打切り";
      if (reason === "max_nodes") return "予測取得打切り";
      if (reason === "history_gap") return "予測取得打切り";

      return "予測取得打切り";
    }

    function predictionProbability(node) {
      const p = Number(node?.probability);
      return Number.isFinite(p) ? p : 0;
    }

    function formatPredictionProbability(node) {
      const p = predictionProbability(node);
      return `${Number.isInteger(p) ? p : p.toFixed(1)}%`;
    }

    function formatPredictionN(node) {
      const count = Number(node?.count);
      const n = Number(node?.n);

      if (Number.isFinite(count) && Number.isFinite(n)) {
        return `(n=${count}/${n})`;
      }

      if (Number.isFinite(n)) {
        return `(n=${n})`;
      }

      return "";
    }

    function predictionRouteName(node) {
      return cleanId(node?.route_name || node?.routeName) || "路線名不明";
    }

    function predictionFromStop(node) {
      return cleanId(node?.from_stop || node?.fromStop) || "始発不明";
    }

    function predictionToStop(node) {
      return cleanId(node?.to_stop || node?.toStop) || "終点不明";
    }

    function predictionFromTime(node) {
      return formatHistoryClock(node?.from_time || node?.fromTime);
    }

    function predictionToTime(node) {
      return formatHistoryClock(node?.to_time || node?.toTime);
    }

    function getMostLikelyPrediction(nodes) {
      if (!Array.isArray(nodes) || !nodes.length) return null;

      return [...nodes].sort(
        (a, b) => predictionProbability(b) - predictionProbability(a)
      )[0] || null;
    }

    function predictionPathText(node) {
      const probability = formatPredictionProbability(node);
      const nText = formatPredictionN(node);

      if (isPredictionServiceEnd(node)) {
        return [probability, nText].filter(Boolean).join(" ");
      }

      return (
        `${predictionFromStop(node)} ${predictionFromTime(node)} → ` +
        `${predictionToStop(node)} ${predictionToTime(node)}   ` +
        [probability, nText].filter(Boolean).join(" ")
      );
    }


    function buildPredictionPopupTitle(vehicleCd) {
      const id = cleanId(vehicleCd);
      return id
        ? `${id}号車 次便予測`
        : "次便予測";
    }

    function setPredictionPopupTitle(overlay, vehicleCd) {
      const title = buildPredictionPopupTitle(vehicleCd);
      overlay.dataset.vehicleCd = cleanId(vehicleCd);
      overlay.dataset.predictionTitle = title;

      const titleEl =
        overlay.querySelector(".unyo-prediction-title");

      if (titleEl) {
        titleEl.textContent = title;
      }
    }

    async function ensureHtml2Canvas() {
      if (window.html2canvas) {
        return window.html2canvas;
      }

      if (window.__html2canvasPromise) {
        return await window.__html2canvasPromise;
      }

      window.__html2canvasPromise =
        new Promise((resolve, reject) => {
          const script =
            document.createElement("script");

          script.src =
            "https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js";
          script.async = true;

          script.onload = () => {
            if (window.html2canvas) {
              resolve(window.html2canvas);
            } else {
              reject(new Error("html2canvasの読み込みに失敗しました"));
            }
          };

          script.onerror = () => {
            reject(new Error("html2canvasの読み込みに失敗しました"));
          };

          document.head.appendChild(script);
        });

      return await window.__html2canvasPromise;
    }

    function predictionShareToast(message) {
      let toast =
        document.getElementById("predictionShareToast");

      if (!toast) {
        toast = document.createElement("div");
        toast.id = "predictionShareToast";
        toast.style.cssText = `
          position: fixed;
          left: 50%;
          bottom: 18px;
          transform: translateX(-50%);
          z-index: 2000;
          max-width: min(92vw, 520px);
          padding: 10px 14px;
          border-radius: 12px;
          background: rgba(20, 31, 39, .92);
          color: #fff;
          font-size: 12px;
          line-height: 1.45;
          font-weight: 700;
          box-shadow: 0 8px 24px rgba(0,0,0,.25);
          opacity: 0;
          pointer-events: none;
          transition: opacity .18s ease;
          text-align: center;
        `;
        document.body.appendChild(toast);
      }

      toast.textContent = message;
      toast.style.opacity = "1";

      clearTimeout(window.__predictionShareToastTimer);
      window.__predictionShareToastTimer =
        setTimeout(() => {
          toast.style.opacity = "0";
        }, 2400);
    }

    function predictionShareFilename(vehicleCd) {
      const id =
        cleanId(vehicleCd) || "bus";
      const now =
        new Date();

      const pad =
        n => String(n).padStart(2, "0");

      const stamp =
        `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_` +
        `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

      return `${id}_next_prediction_${stamp}.png`;
    }

    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "prediction.png";
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    }

    async function copyImageBlobToClipboard(blob) {
      try {
        if (
          !navigator.clipboard ||
          typeof window.ClipboardItem === "undefined"
        ) {
          return false;
        }

        await navigator.clipboard.write([
          new ClipboardItem({
            "image/png": blob
          })
        ]);

        return true;
      } catch (e) {
        console.warn("画像コピー失敗:", e);
        return false;
      }
    }

    function copyComputedStylesDeep(source, target) {
      if (!source || !target) return;

      const sourceStyle =
        window.getComputedStyle(source);

      // ブラウザが実際に描画している計算済みCSSを
      // 保存用クローンへ直接固定する。
      for (const prop of sourceStyle) {
        try {
          target.style.setProperty(
            prop,
            sourceStyle.getPropertyValue(prop),
            sourceStyle.getPropertyPriority(prop)
          );
        } catch (_) {}
      }

      const sourceChildren =
        source.children || [];

      const targetChildren =
        target.children || [];

      const count =
        Math.min(
          sourceChildren.length,
          targetChildren.length
        );

      for (let i = 0; i < count; i++) {
        copyComputedStylesDeep(
          sourceChildren[i],
          targetChildren[i]
        );
      }
    }


    async function capturePredictionPopupBlob() {
      const overlay =
        ensurePredictionPopup();

      const popup =
        overlay.querySelector(".unyo-prediction-popup");

      if (!popup) {
        throw new Error("共有対象が見つかりません");
      }

      const html2canvas =
        await ensureHtml2Canvas();

      // 画面表示中のポップアップは max-height / overflow により
      // 途中で切れるため、保存用に一時クローンを作って
      // スクロール内の全内容を展開した状態で画像化する。
      const exportHost =
        document.createElement("div");

      exportHost.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        z-index: -2147483647;
        pointer-events: none;
        background: #ffffff;
      `;

      const clone =
        popup.cloneNode(true);

      // cloneNodeだけではブラウザの計算済みスタイルが完全には
      // 引き継がれず、html2canvas側で枠色・影・背景などが
      // 変わることがあるため、画面上の実描画スタイルを固定する。
      copyComputedStylesDeep(
        popup,
        clone
      );

      const cloneBody =
        clone.querySelector(".unyo-prediction-body");

      const cloneStage =
        clone.querySelector(".unyo-flow-stage");

      // 元の実寸を保存用クローンへ反映する。
      const sourceBody =
        popup.querySelector(".unyo-prediction-body");

      const sourceStage =
        popup.querySelector(".unyo-flow-stage");

      if (cloneBody && sourceBody) {
        cloneBody.scrollTop = 0;
        cloneBody.scrollLeft = 0;

        cloneBody.style.maxHeight = "none";
        cloneBody.style.height = "auto";
        cloneBody.style.overflow = "visible";
        cloneBody.style.overflowX = "visible";
        cloneBody.style.overflowY = "visible";
      }

      if (cloneStage && sourceStage) {
        const exportWidth =
          Math.max(
            sourceStage.scrollWidth || 0,
            sourceStage.offsetWidth || 0,
            Number(sourceStage.dataset.rawWidth || 0)
          );

        const exportHeight =
          Math.max(
            sourceStage.scrollHeight || 0,
            sourceStage.offsetHeight || 0,
            Number(sourceStage.dataset.rawHeight || 0)
          );

        cloneStage.style.width =
          `${exportWidth}px`;
        cloneStage.style.height =
          `${exportHeight}px`;

        cloneStage.dataset.rawWidth =
          String(exportWidth);
        cloneStage.dataset.rawHeight =
          String(exportHeight);

        const cloneCanvas =
          cloneStage.querySelector(".unyo-flow-canvas");

        if (cloneCanvas) {
          cloneCanvas.style.transform = "scale(1)";
          cloneCanvas.style.transformOrigin = "0 0";
          cloneCanvas.style.width =
            `${exportWidth}px`;
          cloneCanvas.style.height =
            `${exportHeight}px`;
          cloneCanvas.style.minWidth =
            `${exportWidth}px`;
        }
      }

      for (
        const svg of
          clone.querySelectorAll(
            ".unyo-flow-svg"
          )
      ) {
        svg.style.overflow = "visible";
      }

      if (cloneStage) {
        cloneStage.style.setProperty(
          "background",
          "#ffffff",
          "important"
        );
      }

      const cloneCanvasForExport =
        clone.querySelector(".unyo-flow-canvas");

      if (cloneCanvasForExport) {
        // 座標は動かさない。表示時のズームだけ解除して全体をそのまま保存。
        cloneCanvasForExport.style.setProperty(
          "transform",
          "scale(1)",
          "important"
        );
        cloneCanvasForExport.style.setProperty(
          "transform-origin",
          "0 0",
          "important"
        );
        cloneCanvasForExport.style.setProperty(
          "background",
          "#ffffff",
          "important"
        );
      }

      // 保存時は画面幅の制限を完全に外し、
      // ツリー全体の横幅・縦幅に合わせてポップアップ自体を拡張する。
      const exportBody =
        clone.querySelector(".unyo-prediction-body");

      const exportStage =
        clone.querySelector(".unyo-flow-stage");

      const exportRawWidth =
        exportStage
          ? Math.max(
              Number(exportStage.dataset.rawWidth || 0),
              exportStage.scrollWidth || 0,
              exportStage.offsetWidth || 0
            )
          : 0;

      const exportRawHeight =
        exportStage
          ? Math.max(
              Number(exportStage.dataset.rawHeight || 0),
              exportStage.scrollHeight || 0,
              exportStage.offsetHeight || 0
            )
          : 0;

      // bodyのpadding分を含めて余裕を確保。
      const exportHorizontalPadding = 48;
      const exportVerticalPadding = 48;

      if (exportBody) {
        exportBody.scrollLeft = 0;
        exportBody.scrollTop = 0;

        exportBody.style.setProperty(
          "width",
          `${Math.ceil(exportRawWidth + exportHorizontalPadding)}px`,
          "important"
        );

        exportBody.style.setProperty(
          "max-width",
          "none",
          "important"
        );

        exportBody.style.setProperty(
          "min-width",
          "0",
          "important"
        );

        exportBody.style.setProperty(
          "height",
          `${Math.ceil(exportRawHeight + exportVerticalPadding)}px`,
          "important"
        );

        exportBody.style.setProperty(
          "max-height",
          "none",
          "important"
        );

        exportBody.style.setProperty(
          "overflow",
          "visible",
          "important"
        );

        exportBody.style.setProperty(
          "overflow-x",
          "visible",
          "important"
        );

        exportBody.style.setProperty(
          "overflow-y",
          "visible",
          "important"
        );

        // 保存画像では画面用のドット背景やスクロール領域の色を使わない。
        exportBody.style.setProperty(
          "background",
          "#ffffff",
          "important"
        );
        exportBody.style.setProperty(
          "background-image",
          "none",
          "important"
        );
      }

      clone.style.setProperty(
        "width",
        `${Math.ceil(exportRawWidth + exportHorizontalPadding + 26)}px`,
        "important"
      );
      clone.style.setProperty(
        "max-width",
        "none",
        "important"
      );
      clone.style.setProperty(
        "min-width",
        "0",
        "important"
      );
      clone.style.setProperty(
        "height",
        "auto",
        "important"
      );
      clone.style.setProperty(
        "max-height",
        "none",
        "important"
      );
      clone.style.setProperty(
        "overflow",
        "visible",
        "important"
      );
      clone.style.setProperty(
        "background",
        "#ffffff",
        "important"
      );
      clone.style.setProperty(
        "background-image",
        "none",
        "important"
      );

      // html2canvasで特に差が出やすい当日充当/現在便の外箱は、
      // 画面側と同じ値を明示しておく。
      for (
        const card of
          clone.querySelectorAll(
            ".unyo-flow-card-actual:not(.unyo-flow-card-place)"
          )
      ) {
        // html2canvas は inset box-shadow を全面塗りとして
        // 誤描画することがあるため、保存時だけ border-left で再現。
        card.style.borderWidth = "2px";
        card.style.borderStyle = "solid";
        card.style.borderColor = "#4f8a69";
        card.style.borderLeftWidth = "6px";
        card.style.borderLeftColor = "#4f8a69";
        card.style.background = "#f2f8f4";
        card.style.backgroundColor = "#f2f8f4";
        card.style.boxShadow =
          "0 3px 9px rgba(37,57,69,.13)";
        card.style.opacity = "1";
      }

      // 施設カードもhtml2canvasで左帯が崩れないよう、
      // 保存時だけ inset shadow を border-left へ置き換える。
      for (
        const card of
          clone.querySelectorAll(
            ".unyo-flow-card-place"
          )
      ) {
        const isArrival =
          card.classList.contains(
            "unyo-flow-card-place-arrival"
          );

        const isDeparture =
          card.classList.contains(
            "unyo-flow-card-place-departure"
          );

        const isInferred =
          card.classList.contains(
            "unyo-flow-card-place-inferred"
          );

        const borderColor =
          isArrival
            ? "#557d69"
            : isDeparture
              ? "#806d54"
              : "#667985";

        const leftColor =
          isInferred
            ? "#a08b68"
            : borderColor;

        const background =
          isInferred
            ? "#fbf9f5"
            : isArrival
              ? "#f2f8f4"
              : isDeparture
                ? "#faf7f2"
                : "#f5f8f9";

        card.style.borderWidth =
          "2px";

        card.style.borderStyle =
          isInferred
            ? "dashed"
            : "solid";

        card.style.borderColor =
          borderColor;

        card.style.borderLeftWidth =
          "6px";

        card.style.borderLeftStyle =
          "solid";

        card.style.borderLeftColor =
          leftColor;

        card.style.background =
          background;

        card.style.backgroundColor =
          background;

        card.style.boxShadow =
          "0 3px 9px rgba(37,57,69,.12)";

        card.style.opacity =
          "1";
      }


      for (
        const card of
          clone.querySelectorAll(
            ".unyo-flow-card-current.unyo-flow-card-actual:not(.unyo-flow-card-place)"
          )
      ) {
        card.style.borderWidth = "2px";
        card.style.borderStyle = "solid";
        card.style.borderColor = "#365a6b";
        card.style.borderLeftWidth = "6px";
        card.style.borderLeftColor = "#365a6b";
        card.style.background = "#eef7fa";
        card.style.backgroundColor = "#eef7fa";
        card.style.boxShadow =
          "0 0 0 2px rgba(54,90,107,.20), 0 5px 14px rgba(37,57,69,.18)";
      }

      exportHost.appendChild(clone);
      document.body.appendChild(exportHost);

      try {
        const rect =
          clone.getBoundingClientRect();

        const captureWidth =
          Math.ceil(
            Math.max(
              rect.width,
              clone.scrollWidth,
              clone.offsetWidth
            )
          );

        const captureHeight =
          Math.ceil(
            Math.max(
              rect.height,
              clone.scrollHeight,
              clone.offsetHeight
            )
          );

        // スマホブラウザは巨大canvasを作ると、
        // 右端/下端が無言で切れることがある。
        // そのため「全範囲が必ず1枚に入る」範囲で
        // 可能な限り高いscaleを自動計算する。
        const isMobileExport =
          window.matchMedia(
            "(max-width: 640px)"
          ).matches;

        // iOS/Safariを含め安全側に倒した上限。
        // PCは余裕を持たせる。
        const maxCanvasSide =
          isMobileExport
            ? 8192
            : 16384;

        const maxCanvasArea =
          isMobileExport
            ? 16 * 1024 * 1024
            : 64 * 1024 * 1024;

        const deviceScale =
          Math.min(
            Math.max(
              window.devicePixelRatio || 1,
              1
            ),
            isMobileExport ? 2 : 3
          );

        const scaleByWidth =
          maxCanvasSide /
          Math.max(1, captureWidth);

        const scaleByHeight =
          maxCanvasSide /
          Math.max(1, captureHeight);

        const scaleByArea =
          Math.sqrt(
            maxCanvasArea /
            Math.max(
              1,
              captureWidth *
              captureHeight
            )
          );

        const exportScale =
          Math.max(
            0.35,
            Math.min(
              deviceScale,
              scaleByWidth,
              scaleByHeight,
              scaleByArea
            )
          );

        console.log(
          "prediction export:",
          {
            captureWidth,
            captureHeight,
            exportScale,
            isMobileExport
          }
        );

        const canvas =
          await html2canvas(
            clone,
            {
              backgroundColor: "#ffffff",
              useCORS: true,
              scale: exportScale,
              width: captureWidth,
              height: captureHeight,
              windowWidth: captureWidth,
              windowHeight: captureHeight,
              scrollX: 0,
              scrollY: 0,
              onclone: clonedDoc => {
                for (const el of clonedDoc.querySelectorAll("[data-export-hide='1']")) {
                  el.remove();
                }
              }
            }
          );

        const blob =
          await new Promise((resolve, reject) => {
            canvas.toBlob(
              value => {
                if (value) {
                  resolve(value);
                } else {
                  reject(new Error("画像化に失敗しました"));
                }
              },
              "image/png"
            );
          });

        return blob;
      } finally {
        exportHost.remove();
      }
    }

    async function sharePredictionImage(kind) {
      const overlay =
        ensurePredictionPopup();

      const vehicleCd =
        cleanId(overlay.dataset.vehicleCd);

      try {
        const blob =
          await capturePredictionPopupBlob();

        const filename =
          predictionShareFilename(vehicleCd);

        downloadBlob(blob, filename);
        predictionShareToast("画像を保存しました");
      } catch (e) {
        console.error("予測画像保存失敗:", e);
        predictionShareToast("画像保存に失敗しました");
      }
    }

    function ensurePredictionPopup() {
      let overlay = document.getElementById("unyoPredictionOverlay");
      if (overlay) return overlay;

      if (!document.getElementById("unyoPredictionTreeStyle")) {
        const style = document.createElement("style");
        style.id = "unyoPredictionTreeStyle";
        style.textContent = `
          .unyo-prediction-popup {
            width: min(94vw, 1180px);
            max-height: min(88vh, 820px);
            overflow: hidden;
            box-sizing: border-box;
            padding: 13px;
            border: 1px solid rgba(31, 52, 65, .15);
            border-radius: 14px;
            background: rgba(255,255,255,.98);
            box-shadow: 0 12px 38px rgba(21,42,56,.24);
            font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
            color: #17232b;
          }

          .unyo-prediction-head-actions {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            justify-content: flex-end;
            gap: 6px;
          }

          .unyo-prediction-share {
            border: 1px solid #d7e3e9;
            background: #f7fbfc;
            color: #35505c;
            border-radius: 999px;
            padding: 5px 10px;
            font-size: 11px;
            line-height: 1.2;
            font-weight: 800;
            cursor: pointer;
          }

          .unyo-prediction-share:hover {
            background: #eef5f7;
          }

          .unyo-prediction-close {
            border: 0;
            background: transparent;
            font-size: 22px;
            line-height: 1;
            cursor: pointer;
            padding: 2px 5px;
            color: #52616a;
          }

          .unyo-prediction-body {
            position: relative;
            max-height: calc(88vh - 78px);
            overflow-y: auto;
            overflow-x: scroll;
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
            cursor: grab;
            padding: 8px 12px 18px 8px;
            background:
              radial-gradient(circle at 1px 1px, rgba(112,132,144,.15) 1px, transparent 0);
            background-size: 18px 18px;
            border-radius: 10px;
          }

          .unyo-flow-canvas {
            position: relative;
            box-sizing: border-box;
            min-width: 100%;
          }

          .unyo-flow-svg {
            position: absolute;
            inset: 0;
            overflow: visible;
            pointer-events: none;
            z-index: 1;
          }

          .unyo-flow-card {
            position: absolute;
            z-index: 2;
            width: 180px;
            min-height: 52px;
            box-sizing: border-box;
            padding: 7px 9px;
            border-radius: 8px;
            border: 1px solid #dbe6eb;
            background: rgba(255,255,255,.98);
            box-shadow: 0 2px 7px rgba(37,57,69,.10);
          }

          .unyo-flow-card-current {
            border-width: 2px;
            border-color: #365a6b;
            background: #f4fafc;
            box-shadow:
              0 0 0 2px rgba(54,90,107,.18),
              0 4px 12px rgba(37,57,69,.16);
          }

          /* 今日この車が実際に担当した便。
             未充当の履歴候補とは外箱から見分けられるようにする。 */
          .unyo-flow-card-actual {
            border-width: 2px;
            border-color: #4f8a69;
            background: #f2f8f4;
            box-shadow:
              inset 4px 0 0 #4f8a69,
              0 3px 9px rgba(37,57,69,.13);
            opacity: 1;
          }

          /* 現在便は「本日充当」よりさらに強く表示 */
          .unyo-flow-card-current.unyo-flow-card-actual {
            border-width: 2px;
            border-color: #365a6b;
            background: #eef7fa;
            box-shadow:
              inset 4px 0 0 #365a6b,
              0 0 0 2px rgba(54,90,107,.20),
              0 5px 14px rgba(37,57,69,.18);
          }

          .unyo-flow-actual-badge {
            background: #4f8a69 !important;
            color: #fff !important;
            border-color: #4f8a69 !important;
          }

          .unyo-flow-actual-label {
            display: inline-flex;
            align-items: center;
            width: fit-content;
            margin-top: 4px;
            padding: 1px 5px;
            border-radius: 999px;
            background: #e2f1e7;
            border: 1px solid #b9d8c4;
            color: #356548;
            font-size: 7px;
            line-height: 1.2;
            font-weight: 900;
            letter-spacing: .02em;
          }

          .unyo-flow-card-current .unyo-flow-actual-label {
            background: #dfeef3;
            border-color: #b8d2dc;
            color: #365a6b;
          }

          /* 営業所・駐在・工場・待機場所の到着/出発 */
          .unyo-flow-card-place,
          .unyo-flow-card-place.unyo-flow-card-actual {
            border-width: 2px;
            border-style: solid;
            border-color: #667985;
            background: #f5f8f9;
            box-shadow:
              inset 4px 0 0 #667985,
              0 3px 9px rgba(37,57,69,.12);
            opacity: 1;
          }

          .unyo-flow-card-place-arrival,
          .unyo-flow-card-place-arrival.unyo-flow-card-actual {
            border-color: #557d69;
            background: #f2f8f4;
            box-shadow:
              inset 4px 0 0 #557d69,
              0 3px 9px rgba(37,57,69,.12);
          }

          .unyo-flow-card-place-departure,
          .unyo-flow-card-place-departure.unyo-flow-card-actual {
            border-color: #806d54;
            background: #faf7f2;
            box-shadow:
              inset 4px 0 0 #806d54,
              0 3px 9px rgba(37,57,69,.12);
          }

          .unyo-flow-card-place-inferred,
          .unyo-flow-card-place-inferred.unyo-flow-card-actual {
            border-style: dashed;
            border-color: #85765f;
            background: #fbf9f5;
            box-shadow:
              inset 4px 0 0 #a08b68,
              0 3px 9px rgba(37,57,69,.10);
          }

          .unyo-flow-place-name {
            font-size: 10px;
          }

          .unyo-flow-place-badge {
            color: #fff;
            background: #667985;
          }

          .unyo-flow-card-place-arrival .unyo-flow-place-badge {
            background: #557d69;
          }

          .unyo-flow-card-place-departure .unyo-flow-place-badge {
            background: #806d54;
          }

          .unyo-flow-card-place-inferred .unyo-flow-place-badge {
            background: #6f5738;
            color: #fff;
            border: 1px solid #58442c;
            padding: 2px 8px;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: .06em;
            box-shadow: 0 1px 3px rgba(0,0,0,.16);
          }

          .unyo-flow-card-place-entry {
            border-color: #686f88;
            background: #f5f5fa;
            box-shadow:
              inset 4px 0 0 #686f88,
              0 3px 9px rgba(37,57,69,.12);
          }

          .unyo-flow-card-place-entry .unyo-flow-place-badge {
            background: #686f88;
          }

          .unyo-flow-card-place-no-operation {
            border-color: #8b8f93;
            background: #f7f7f7;
            box-shadow:
              inset 4px 0 0 #8b8f93,
              0 3px 9px rgba(37,57,69,.10);
          }

          .unyo-flow-card-place-no-operation .unyo-flow-name {
            font-size: 10px;
            color: #555f65;
          }

          .unyo-flow-card-place-unknown {
            min-height: 72px;
            border-color: #9a6d56;
            background: #fbf5f1;
            box-shadow:
              inset 4px 0 0 #9a6d56,
              0 3px 9px rgba(37,57,69,.11);
          }

          .unyo-flow-place-message {
            white-space: normal;
            overflow: visible;
            text-overflow: clip;
            line-height: 1.35;
            font-size: 8.5px;
            color: #624b40;
          }

          .unyo-flow-place-unknown-label {
            margin-top: 5px;
            font-size: 10px;
            line-height: 1.2;
            font-weight: 900;
            color: #8a442a;
          }

          .unyo-flow-place-time {
            margin-top: 5px;
            font-size: 9px;
            line-height: 1.2;
            font-weight: 900;
            color: #53636b;
          }

          .unyo-flow-card-end {
            width: 110px;
            min-height: 42px;
            background: #f4f6f7;
          }

          .unyo-flow-card-occupied {
            background: #f7f8f8;
            border-style: dashed;
          }

          .unyo-flow-topline {
            display: flex;
            align-items: center;
            gap: 5px;
            min-width: 0;
          }

          .unyo-flow-name {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 9px;
            line-height: 1.25;
            font-weight: 900;
          }

          .unyo-flow-badge {
            flex: 0 0 auto;
            padding: 1px 5px;
            border-radius: 999px;
            background: #eaf0f3;
            font-size: 8px;
            line-height: 1.15;
            font-weight: 900;
            color: #435761;
          }

          .unyo-flow-current-badge {
            background: #526b78;
            color: #fff;
          }

          .unyo-flow-path {
            margin-top: 3px;
            font-size: 8px;
            font-weight: 700;
            line-height: 1.35;
            color: #61717a;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .unyo-flow-sample {
            margin-top: 2px;
            font-size: 7.5px;
            line-height: 1.2;
            color: #7a8991;
          }

          .unyo-flow-assigned {
            display: block;
            margin-top: 3px;
            color: #16834b;
            font-size: 8px;
            line-height: 1.25;
            font-weight: 900;
          }

          .unyo-flow-route-struck {
            text-decoration: line-through;
            text-decoration-thickness: 1px;
            opacity: .62;
          }

          .unyo-flow-edge {
            fill: none;
            stroke: #9badb6;
            stroke-width: 2;
            stroke-linecap: round;
          }

          .unyo-flow-edge-actual {
            stroke: #a5b0b6;
            stroke-width: 1.5;
          }

          .unyo-flow-edge-main {
            stroke: #708792;
            stroke-width: 3;
          }

          .unyo-flow-edge-rare {
            stroke: #b4c0c6;
            stroke-width: 1.5;
            stroke-dasharray: 5 5;
          }

          .unyo-flow-edge-occupied {
            stroke: #86aa96;
            stroke-width: 2;
            stroke-dasharray: 6 4;
          }

          .unyo-flow-stage {
            position: relative;
            box-sizing: border-box;
          }

          .unyo-flow-canvas {
            transform-origin: 0 0;
          }

          @media (max-width: 640px) {
            .unyo-prediction-popup {
              width: calc(100vw - 12px);
              max-height: calc(100vh - 12px);
              padding: 9px;
            }

            .unyo-prediction-body {
              max-height: calc(100vh - 78px);
              padding: 5px 7px 12px 5px;
              overflow-x: auto;
            }

            .unyo-prediction-title {
              font-size: 12px !important;
            }

            .unyo-prediction-head-actions {
              gap: 4px;
            }

            .unyo-prediction-share {
              padding: 4px 8px;
              font-size: 10px;
            }
          }
        `;
        document.head.appendChild(style);
      }

      overlay = document.createElement("div");
      overlay.id = "unyoPredictionOverlay";
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 8px;
        box-sizing: border-box;
        background: rgba(15, 27, 35, .34);
      `;

      const box = document.createElement("div");
      box.className = "unyo-prediction-popup";

      const head = document.createElement("div");
      head.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 9px;
      `;

      const title = document.createElement("div");
      title.className = "unyo-prediction-title";
      title.textContent = "次便予測";
      title.style.cssText = "font-size:14px;font-weight:900;";

      const headActions = document.createElement("div");
      headActions.className = "unyo-prediction-head-actions";
      headActions.setAttribute("data-export-hide", "1");

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "unyo-prediction-share";
      saveBtn.textContent = "画像保存";
      saveBtn.addEventListener("click", () => {
        sharePredictionImage("save");
      });

      const close = document.createElement("button");
      close.type = "button";
      close.className = "unyo-prediction-close";
      close.textContent = "×";
      close.setAttribute("aria-label", "閉じる");
      close.setAttribute("data-export-hide", "1");

      headActions.append(
        saveBtn,
        close
      );

      const body = document.createElement("div");
      body.className = "unyo-prediction-body";

      close.addEventListener("click", () => {
        overlay.style.display = "none";
      });

      overlay.addEventListener("click", e => {
        if (e.target === overlay) overlay.style.display = "none";
      });

      head.append(title, headActions);
      box.append(head, body);
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      return overlay;
    }

    function getPredictionZoom(body) {
      const value = Number(body?.dataset?.predictionZoom);
      return Number.isFinite(value) ? value : 1;
    }

    function setPredictionZoom(body, zoom, keepCenter = true) {
      const stage = body?.querySelector(".unyo-flow-stage");
      const canvas = stage?.querySelector(".unyo-flow-canvas");
      if (!stage || !canvas) return;

      const oldZoom = getPredictionZoom(body);
      const nextZoom = Math.max(0.28, Math.min(1.6, Number(zoom) || 1));

      let centerX = 0;
      let centerY = 0;

      if (keepCenter && oldZoom > 0) {
        centerX = (body.scrollLeft + body.clientWidth / 2) / oldZoom;
        centerY = (body.scrollTop + body.clientHeight / 2) / oldZoom;
      }

      const rawWidth = Number(stage.dataset.rawWidth || 0);
      const rawHeight = Number(stage.dataset.rawHeight || 0);

      canvas.style.transform = `scale(${nextZoom})`;
      // 縮小してツリー幅が画面内に収まっても、
      // PCの横スクロールバーを消さない。
      // 見た目のツリーは縮小するが、スクロール領域は最低でも
      // body幅より少し広く維持する。
      const scaledWidth =
        Math.max(1, rawWidth * nextZoom);

      const minScrollableWidth =
        Math.max(
          1,
          body.clientWidth + 80
        );

      stage.style.width =
        `${Math.max(scaledWidth, minScrollableWidth)}px`;

      // ズーム時に最下段カードが表示領域の端で切れないよう、
      // スクロール領域の下側へ十分な余白を確保する。
      const scaledHeight =
        Math.max(1, rawHeight * nextZoom);

      const bottomScrollPadding =
        Math.max(
          90,
          Math.round(body.clientHeight * 0.22)
        );

      stage.style.height =
        `${scaledHeight + bottomScrollPadding}px`;

      body.dataset.predictionZoom = String(nextZoom);

      if (keepCenter && oldZoom > 0) {
        body.scrollLeft = Math.max(
          0,
          centerX * nextZoom - body.clientWidth / 2
        );
        body.scrollTop = Math.max(
          0,
          centerY * nextZoom - body.clientHeight / 2
        );
      }
    }

    function fitPredictionTree(body) {
      const stage = body?.querySelector(".unyo-flow-stage");
      if (!stage) return;

      const rawWidth = Number(stage.dataset.rawWidth || 0);
      const rawHeight = Number(stage.dataset.rawHeight || 0);

      if (!rawWidth || !rawHeight) return;

      const availableWidth = Math.max(1, body.clientWidth - 12);
      const availableHeight = Math.max(1, body.clientHeight - 12);

      const fitZoom = Math.min(
        availableWidth / rawWidth,
        availableHeight / rawHeight,
        1
      );

      setPredictionZoom(
        body,
        Math.max(0.28, fitZoom),
        false
      );

      body.scrollLeft = 0;
      body.scrollTop = 0;
    }

    function installPredictionZoomGestures(body) {
      if (body.dataset.zoomGesturesInstalled === "1") return;
      body.dataset.zoomGesturesInstalled = "1";

      // PC: ホイールだけでズーム。
      // 上方向 = 拡大 / 下方向 = 縮小
      body.addEventListener(
        "wheel",
        e => {
          e.preventDefault();

          const step =
            e.deltaY < 0
              ? 0.08
              : -0.08;

          setPredictionZoom(
            body,
            getPredictionZoom(body) + step
          );
        },
        { passive: false }
      );

      // PC: 左クリックを押したままドラッグでパン移動。
      let isMousePanning = false;
      let panStartX = 0;
      let panStartY = 0;
      let panStartScrollLeft = 0;
      let panStartScrollTop = 0;

      body.addEventListener(
        "mousedown",
        e => {
          // 左クリックのみ。
          if (e.button !== 0) return;

          isMousePanning = true;
          panStartX = e.clientX;
          panStartY = e.clientY;
          panStartScrollLeft = body.scrollLeft;
          panStartScrollTop = body.scrollTop;

          body.style.cursor = "grabbing";
          body.style.userSelect = "none";

          e.preventDefault();
        }
      );

      window.addEventListener(
        "mousemove",
        e => {
          if (!isMousePanning) return;

          const dx =
            e.clientX - panStartX;

          const dy =
            e.clientY - panStartY;

          body.scrollLeft =
            panStartScrollLeft - dx;

          body.scrollTop =
            panStartScrollTop - dy;

          e.preventDefault();
        },
        { passive: false }
      );

      window.addEventListener(
        "mouseup",
        () => {
          if (!isMousePanning) return;

          isMousePanning = false;
          body.style.cursor = "grab";
          body.style.userSelect = "";
        }
      );

      // ウィンドウ外へマウスが出ても掴みっぱなしにしない。
      window.addEventListener(
        "blur",
        () => {
          if (!isMousePanning) return;

          isMousePanning = false;
          body.style.cursor = "grab";
          body.style.userSelect = "";
        }
      );

      // スマホ: 2本指ピンチでズーム。
      let pinchStartDistance = 0;
      let pinchStartZoom = 1;

      const distance = touches => {
        if (!touches || touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.hypot(dx, dy);
      };

      body.addEventListener(
        "touchstart",
        e => {
          if (e.touches.length !== 2) return;
          pinchStartDistance = distance(e.touches);
          pinchStartZoom = getPredictionZoom(body);
        },
        { passive: true }
      );

      body.addEventListener(
        "touchmove",
        e => {
          if (e.touches.length !== 2 || !pinchStartDistance) return;
          e.preventDefault();

          const currentDistance = distance(e.touches);
          const ratio = currentDistance / pinchStartDistance;

          setPredictionZoom(
            body,
            pinchStartZoom * ratio
          );
        },
        { passive: false }
      );

      body.addEventListener(
        "touchend",
        e => {
          if (e.touches.length < 2) {
            pinchStartDistance = 0;
          }
        },
        { passive: true }
      );
    }

    function buildDayPredictionFlowLayout(
      data
    ) {
      let idSeq = 0;

      const makeEntry = (
        node,
        depth,
        parentId = null
      ) => ({
        id:
          `unyo-flow-${++idSeq}`,
        node,
        depth,
        parentId,
        currentNode:
          Boolean(node?.current_node),
        actualNode:
          Boolean(node?.day_actual),
        children: [],
        x: 0,
        y: 0
      });

      const build =
        (
          node,
          depth,
          parentId = null
        ) => {
          const entry =
            makeEntry(
              node,
              depth,
              parentId
            );

          entry.children =
            getPredictionChildren(
              node
            ).map(
              child =>
                build(
                  child,
                  depth + 1,
                  entry.id
                )
            );

          return entry;
        };

      const rootEntry =
        build(
          data.day_tree,
          0,
          null
        );

      const entries = [];
      const edges = [];
      let currentEntry = null;

      const collect =
        entry => {
          entries.push(entry);

          if (entry.currentNode) {
            currentEntry =
              entry;
          }

          for (
            const child of
              entry.children
          ) {
            edges.push({
              from: entry,
              to: child,
              actualEdge:
                Boolean(
                  entry.actualNode ||
                  child.actualNode ||
                  child.node
                    ?.confirmed_actual ||
                  child.node
                    ?.other_vehicle_actual
                )
            });

            collect(child);
          }
        };

      collect(rootEntry);

      const CARD_W = 180;
      const CARD_H = 52;
      const END_W = 110;
      const END_H = 42;
      const COL_GAP = 45;
      const ROW_GAP = 12;
      const PAD_X = 14;
      const PAD_Y = 12;

      const cardWidth =
        entry =>
          (
            isPredictionServiceEnd(
              entry.node
            ) ||
            isPredictionStopped(
              entry.node
            )
          )
            ? END_W
            : CARD_W;

      const cardHeight =
        entry => {
          if (
            isPredictionServiceEnd(
              entry.node
            ) ||
            isPredictionStopped(
              entry.node
            )
          ) {
            return END_H;
          }

          if (
            entry?.node?.event_type ===
              "unknown_place"
          ) {
            return 72;
          }

          return CARD_H;
        };

      let nextLeafY =
        PAD_Y;

      const placeY =
        entry => {
          if (
            !entry.children.length
          ) {
            entry.y =
              nextLeafY;

            nextLeafY +=
              cardHeight(entry) +
              ROW_GAP;
            return;
          }

          entry.children.forEach(
            placeY
          );

          const first =
            entry.children[0];

          const last =
            entry.children[
              entry.children.length - 1
            ];

          entry.y =
            (
              (
                first.y +
                cardHeight(first) / 2
              ) +
              (
                last.y +
                cardHeight(last) / 2
              )
            ) / 2 -
            cardHeight(entry) / 2;
        };

      placeY(rootEntry);

      let maxDepth = 0;

      for (const entry of entries) {
        maxDepth =
          Math.max(
            maxDepth,
            entry.depth
          );

        entry.x =
          PAD_X +
          entry.depth *
          (
            CARD_W +
            COL_GAP
          );
      }

      const width =
        PAD_X * 2 +
        maxDepth *
        (
          CARD_W +
          COL_GAP
        ) +
        CARD_W;

      const height =
        Math.max(
          nextLeafY +
          PAD_Y,
          CARD_H +
          PAD_Y * 2
        );

      return {
        rootEntry,
        currentEntry:
          currentEntry ||
          rootEntry,
        actualEntries:
          entries.filter(
            entry =>
              entry.actualNode
          ),
        entries,
        edges,
        width,
        height,
        cardWidth,
        cardHeight
      };
    }


    function buildPredictionFlowLayout(data) {
      if (data?.day_tree) {
        return buildDayPredictionFlowLayout(
          data
        );
      }

      const roots = getPredictionRootNodes(data);
      const current = data?.current || null;
      const actualHistory =
        Array.isArray(data?.actual_history)
          ? data.actual_history
          : [];

      let idSeq = 0;

      const makeEntry = (
        node,
        depth,
        parentId = null,
        currentNode = false,
        actualNode = false
      ) => ({
        id: `unyo-flow-${++idSeq}`,
        node,
        depth,
        parentId,
        currentNode,
        actualNode,
        children: [],
        x: 0,
        y: 0
      });

      const currentEntry = current
        ? makeEntry(
            current,
            0,
            null,
            true,
            false
          )
        : makeEntry(
            {
              route_name: "現在便",
              virtual_root: true
            },
            0,
            null,
            true,
            false
          );

      currentEntry.children =
        roots.map(node =>
          buildPredictionFlowBranch(
            node,
            1,
            currentEntry.id,
            makeEntry
          )
        );

      // 今日終了済みの実績は、
      // 現在便より左側へ時系列で一直線に配置。
      const actualEntries =
        actualHistory.map(
          (node, index) =>
            makeEntry(
              node,
              index - actualHistory.length,
              null,
              false,
              true
            )
        );

      const entries = [];
      const edges = [];

      for (
        let i = 0;
        i < actualEntries.length;
        i++
      ) {
        const from =
          actualEntries[i];

        const to =
          i + 1 <
          actualEntries.length
            ? actualEntries[i + 1]
            : currentEntry;

        entries.push(from);

        edges.push({
          from,
          to,
          actualEdge: true
        });
      }

      const collectPrediction =
        entry => {
          entries.push(entry);

          for (
            const child of entry.children
          ) {
            edges.push({
              from: entry,
              to: child,
              actualEdge: false
            });

            collectPrediction(child);
          }
        };

      collectPrediction(
        currentEntry
      );

      const CARD_W = 180;
      const CARD_H = 52;
      const END_W = 110;
      const END_H = 42;
      const COL_GAP = 45;
      const ROW_GAP = 12;
      const PAD_X = 14;
      const PAD_Y = 12;

      const cardWidth =
        entry =>
          (
            isPredictionServiceEnd(
              entry.node
            ) ||
            isPredictionStopped(
              entry.node
            )
          )
            ? END_W
            : CARD_W;

      const cardHeight =
        entry =>
          (
            isPredictionServiceEnd(
              entry.node
            ) ||
            isPredictionStopped(
              entry.node
            )
          )
            ? END_H
            : CARD_H;

      let nextLeafY =
        PAD_Y;

      const placeY =
        entry => {
          if (
            !entry.children.length
          ) {
            entry.y =
              nextLeafY;

            nextLeafY +=
              cardHeight(entry) +
              ROW_GAP;

            return entry.y;
          }

          entry.children.forEach(
            placeY
          );

          const first =
            entry.children[0];

          const last =
            entry.children[
              entry.children.length - 1
            ];

          const firstCenter =
            first.y +
            cardHeight(first) / 2;

          const lastCenter =
            last.y +
            cardHeight(last) / 2;

          entry.y =
            (
              firstCenter +
              lastCenter
            ) / 2 -
            cardHeight(entry) / 2;

          return entry.y;
        };

      placeY(
        currentEntry
      );

      // 実績側は横一直線。
      for (
        const entry of actualEntries
      ) {
        entry.y =
          currentEntry.y;
      }

      let minDepth = 0;
      let maxDepth = 0;

      for (
        const entry of entries
      ) {
        minDepth =
          Math.min(
            minDepth,
            entry.depth
          );

        maxDepth =
          Math.max(
            maxDepth,
            entry.depth
          );
      }

      for (
        const entry of entries
      ) {
        entry.x =
          PAD_X +
          (
            entry.depth -
            minDepth
          ) *
          (
            CARD_W +
            COL_GAP
          );
      }

      const width =
        PAD_X * 2 +
        (
          maxDepth -
          minDepth
        ) *
        (
          CARD_W +
          COL_GAP
        ) +
        CARD_W;

      const height =
        Math.max(
          nextLeafY +
            PAD_Y,
          currentEntry.y +
            cardHeight(
              currentEntry
            ) +
            PAD_Y
        );

      return {
        rootEntry:
          currentEntry,
        currentEntry,
        actualEntries,
        entries,
        edges,
        width,
        height,
        cardWidth,
        cardHeight
      };
    }

    function buildPredictionFlowBranch(
      node,
      depth,
      parentId,
      makeEntry
    ) {
      const entry = makeEntry(node, depth, parentId, false);

      // 他車充当枝は「確定実績」だけ先へ伸ばす。
      // API側でも未確定予測は除外済みだが、Pages側でも二重に防ぐ。
      const children =
        getPredictionChildren(node);

      if (node?.occupied_by_other) {
        entry.children =
          children
            .filter(
              child =>
                child?.confirmed_actual ||
                child?.other_vehicle_actual
            )
            .map(
              child =>
                buildPredictionFlowBranch(
                  child,
                  depth + 1,
                  entry.id,
                  makeEntry
                )
            );
      } else {
        entry.children =
          children.map(
            child =>
              buildPredictionFlowBranch(
                child,
                depth + 1,
                entry.id,
                makeEntry
              )
          );
      }

      return entry;
    }

    function formatCumulativeProbability(node) {
      const value = Number(node?.cumulative_probability);

      if (!Number.isFinite(value)) {
        return "";
      }

      return `累積 ${Number.isInteger(value) ? value : value.toFixed(1)}%`;
    }

    function formatCumulativeN(node) {
      const count =
        Number(node?.cumulative_count);

      const n =
        Number(node?.cumulative_n);

      if (
        Number.isFinite(count) &&
        Number.isFinite(n)
      ) {
        return `n=${count}/${n}`;
      }

      return "";
    }

    function isPredictionPlaceEvent(node) {
      return Boolean(
        node?.place_event === true ||
        node?.type === "place_event" ||
        node?.type === "place_departure"
      );
    }


    function predictionPlaceEventLabel(node) {
      const eventType =
        cleanId(node?.event_type);

      const inferred =
        Boolean(node?.inferred);

      if (eventType === "arrival") {
        return inferred
          ? "到着（推定）"
          : "到着";
      }

      if (eventType === "departure") {
        return inferred
          ? "出庫"
          : "出発";
      }

      if (eventType === "entry") {
        return "入庫";
      }

      if (eventType === "no_operation") {
        return "前日運用なし";
      }

      if (eventType === "unknown_place") {
        return "入庫場所不明";
      }

      const label =
        cleanId(node?.event_label);

      if (label) {
        return label;
      }

      return "施設イベント";
    }


    function createPredictionPlaceEventCard(
      entry,
      item
    ) {
      const node =
        entry.node;

      const eventType =
        cleanId(node?.event_type);

      item.classList.add(
        "unyo-flow-card-place"
      );

      if (eventType === "arrival") {
        item.classList.add(
          "unyo-flow-card-place-arrival"
        );
      } else if (
        eventType === "departure"
      ) {
        item.classList.add(
          "unyo-flow-card-place-departure"
        );
      } else if (
        eventType === "entry"
      ) {
        item.classList.add(
          "unyo-flow-card-place-entry"
        );
      } else if (
        eventType === "no_operation"
      ) {
        item.classList.add(
          "unyo-flow-card-place-no-operation"
        );
      } else if (
        eventType === "unknown_place"
      ) {
        item.classList.add(
          "unyo-flow-card-place-unknown"
        );
      }

      if (node?.inferred) {
        item.classList.add(
          "unyo-flow-card-place-inferred"
        );
      }

      const top =
        document.createElement("div");

      top.className =
        "unyo-flow-topline";

      const name =
        document.createElement("div");

      name.className =
        "unyo-flow-name unyo-flow-place-name";

      name.textContent =
        cleanId(node?.place_name) ||
        "施設";

      const badge =
        document.createElement("span");

      badge.className =
        "unyo-flow-badge unyo-flow-place-badge";

      badge.textContent =
        predictionPlaceEventLabel(
          node
        );

      if (
        eventType === "no_operation"
      ) {
        name.textContent =
          "前日運用なし";

        top.append(name);
      } else if (
        eventType === "unknown_place"
      ) {
        name.classList.add(
          "unyo-flow-place-message"
        );

        top.append(name);
        item.appendChild(top);

        const unknown =
          document.createElement("div");

        unknown.className =
          "unyo-flow-place-unknown-label";

        unknown.textContent =
          "入庫場所不明";

        item.appendChild(
          unknown
        );

        return item;
      } else {
        top.append(
          name,
          badge
        );
      }

      item.appendChild(top);

      const displayTime =
        cleanId(
          node?.display_time
        );

      if (displayTime) {
        const time =
          document.createElement("div");

        time.className =
          "unyo-flow-place-time";

        time.textContent =
          displayTime;

        item.appendChild(time);
      }

      return item;
    }


    function createPredictionFlowCard(entry) {
      const node = entry.node;
      const item = document.createElement("div");
      item.className = "unyo-flow-card";
      item.dataset.flowId = entry.id;

      if (entry.currentNode) {
        item.classList.add("unyo-flow-card-current");
      }

      if (entry.actualNode) {
        item.classList.add("unyo-flow-card-actual");
      }

      if (
        isPredictionServiceEnd(node) ||
        isPredictionStopped(node)
      ) {
        item.classList.add("unyo-flow-card-end");
      }

      if (node?.occupied_by_other) {
        item.classList.add("unyo-flow-card-occupied");
      }

      // 施設到着/出発は通常の便カードとは別表示。
      // 「本日充当」、系統、停留所、確率、n は表示しない。
      if (isPredictionPlaceEvent(node)) {
        return createPredictionPlaceEventCard(
          entry,
          item
        );
      }

      const top = document.createElement("div");
      top.className = "unyo-flow-topline";

      const name = document.createElement("div");
      name.className = "unyo-flow-name";

      const badge = document.createElement("span");
      badge.className = "unyo-flow-badge";

      if (entry.currentNode) {
        badge.classList.add("unyo-flow-current-badge");
        badge.textContent = "現在便";
      } else if (entry.actualNode) {
        badge.classList.add(
          "unyo-flow-actual-badge"
        );

        const actualCumulativeRaw =
          node
            ?.actual_cumulative_probability;

        const actualCumulative =
          Number(
            actualCumulativeRaw
          );

        if (
          entry.depth !== 0 &&
          actualCumulativeRaw !== null &&
          actualCumulativeRaw !== undefined &&
          actualCumulativeRaw !== "" &&
          Number.isFinite(
            actualCumulative
          )
        ) {
          const percent =
            Number.isInteger(
              actualCumulative
            )
              ? actualCumulative
              : actualCumulative
                  .toFixed(1);

          badge.textContent =
            actualCumulative < 5
              ? `${percent}% レア✨`
              : `${percent}%`;
        } else {
          badge.textContent = "";
        }
      } else {
        const cumulative =
          Number(node?.cumulative_probability);

        if (
          Number.isFinite(
            cumulative
          )
        ) {
          const percent =
            Number.isInteger(
              cumulative
            )
              ? cumulative
              : cumulative
                  .toFixed(1);

          const confirmed =
            Boolean(
              node
                ?.confirmed_actual ||
              node
                ?.other_vehicle_actual
            );

          badge.textContent =
            confirmed &&
            cumulative < 5
              ? `${percent}% レア✨`
              : `${percent}%`;
        } else {
          badge.textContent = "";
        }
      }

      if (isPredictionServiceEnd(node)) {
        name.textContent = "運行終了";
      } else if (isPredictionStopped(node)) {
        name.textContent =
          predictionStoppedLabel(node);
        name.style.color = "#b35a00";
      } else if (entry.currentNode && node?.virtual_root) {
        name.textContent = "現在便";
      } else if (node?.occupied_by_other) {
        const struck = document.createElement("span");
        struck.className = "unyo-flow-route-struck";
        struck.textContent = predictionRouteName(node);
        name.appendChild(struck);
      } else {
        name.textContent = predictionRouteName(node);
      }

      // 初便など、表示する確率文字が無い場合は
      // 空のbadge自体をDOMに出さない。
      // CSSの背景だけが「—」のように残るのを防ぐ。
      if (badge.textContent) {
        top.append(name, badge);
      } else {
        top.append(name);
      }

      item.appendChild(top);

      if (entry.actualNode) {
        const actualLabel =
          document.createElement("div");

        actualLabel.className =
          "unyo-flow-actual-label";

        actualLabel.textContent =
          entry.currentNode
            ? "本日充当・現在"
            : "本日充当";

        item.appendChild(
          actualLabel
        );
      }

      if (
        !isPredictionServiceEnd(node) &&
        !isPredictionStopped(node) &&
        !node?.virtual_root
      ) {
        const path = document.createElement("div");
        path.className = "unyo-flow-path";
        path.textContent =
          `${predictionFromStop(node)} ${predictionFromTime(node)} → ` +
          `${predictionToStop(node)} ${predictionToTime(node)}`;
        path.title = path.textContent;
        item.appendChild(path);
      }

      if (
        entry.currentNode &&
        !node?.virtual_root
      ) {
        // 現在便も、ここまで実際に辿った運用パターンの
        // サンプル数 n=count/total を表示する。
        //
        // day_treeでは現在便にも actual_cumulative_* が
        // 入っているのでそれを最優先し、無い場合だけ
        // cumulative_* をフォールバックとして使う。
        const currentCountRaw =
          node?.actual_cumulative_count ??
          node?.cumulative_count;

        const currentNRaw =
          node?.actual_cumulative_n ??
          node?.cumulative_n;

        const currentCount =
          Number(currentCountRaw);

        const currentN =
          Number(currentNRaw);

        if (
          currentCountRaw !== null &&
          currentCountRaw !== undefined &&
          currentNRaw !== null &&
          currentNRaw !== undefined &&
          Number.isFinite(currentCount) &&
          Number.isFinite(currentN)
        ) {
          const sample =
            document.createElement("div");

          sample.className =
            "unyo-flow-sample";

          sample.textContent =
            `n=${currentCount}/${currentN}`;

          item.appendChild(sample);
        }
      } else if (
        entry.actualNode &&
        entry.depth !== 0 &&
        !node?.virtual_root
      ) {
        const actualCountRaw =
          node?.actual_cumulative_count;

        const actualNRaw =
          node?.actual_cumulative_n;

        const actualCount =
          Number(actualCountRaw);

        const actualN =
          Number(actualNRaw);

        if (
          actualCountRaw !== null &&
          actualCountRaw !== undefined &&
          actualNRaw !== null &&
          actualNRaw !== undefined &&
          Number.isFinite(actualCount) &&
          Number.isFinite(actualN)
        ) {
          const sample =
            document.createElement("div");

          sample.className =
            "unyo-flow-sample";

          sample.textContent =
            `n=${actualCount}/${actualN}`;

          item.appendChild(sample);
        }
      } else if (
        !entry.currentNode &&
        !node?.virtual_root
      ) {
        const sample =
          document.createElement("div");

        sample.className =
          "unyo-flow-sample";

        const nText =
          formatCumulativeN(node);

        sample.textContent =
          nText;

        item.appendChild(sample);
      }

      if (node?.occupied_by_other) {
        const assigned =
          document.createElement(
            "span"
          );

        assigned.className =
          "unyo-flow-assigned";

        assigned.textContent =
          `${cleanId(node?.assigned_vehicle) || "?"}号車が充当`;

        item.appendChild(
          assigned
        );

      }

      return item;
    }

    function predictionEdgeClass(node) {
      if (node?.occupied_by_other) {
        return "unyo-flow-edge unyo-flow-edge-occupied";
      }

      const p = predictionProbability(node);

      if (p >= 80) {
        return "unyo-flow-edge unyo-flow-edge-main";
      }

      if (p > 0 && p < 10) {
        return "unyo-flow-edge unyo-flow-edge-rare";
      }

      return "unyo-flow-edge";
    }

    function renderPredictionFlowTree(data, container) {
      const layout = buildPredictionFlowLayout(data);

      const canvas = document.createElement("div");
      canvas.className = "unyo-flow-canvas";
      canvas.style.width = `${layout.width}px`;
      canvas.style.height = `${layout.height}px`;

      const svg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );
      svg.classList.add("unyo-flow-svg");
      svg.setAttribute("width", layout.width);
      svg.setAttribute("height", layout.height);
      svg.setAttribute(
        "viewBox",
        `0 0 ${layout.width} ${layout.height}`
      );

      for (const edge of layout.edges) {
        const from = edge.from;
        const to = edge.to;

        const x1 =
          from.x + layout.cardWidth(from);
        const y1 =
          from.y + layout.cardHeight(from) / 2;
        const x2 = to.x;
        const y2 =
          to.y + layout.cardHeight(to) / 2;

        const bend =
          Math.max(38, (x2 - x1) * 0.48);

        const path = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path"
        );

        path.setAttribute(
          "d",
          `M ${x1} ${y1} ` +
          `C ${x1 + bend} ${y1}, ` +
          `${x2 - bend} ${y2}, ` +
          `${x2} ${y2}`
        );

        path.setAttribute(
          "class",
          edge.actualEdge
            ? "unyo-flow-edge unyo-flow-edge-actual"
            : predictionEdgeClass(to.node)
        );

        svg.appendChild(path);
      }

      canvas.appendChild(svg);

      for (const entry of layout.entries) {
        const card = createPredictionFlowCard(entry);
        card.style.left = `${entry.x}px`;
        card.style.top = `${entry.y}px`;
        canvas.appendChild(card);
      }

      const stage = document.createElement("div");
      stage.className = "unyo-flow-stage";
      stage.dataset.rawWidth = String(layout.width);
      stage.dataset.rawHeight = String(layout.height);
      stage.style.width = `${layout.width}px`;
      stage.style.height = `${layout.height}px`;
      stage.appendChild(canvas);

      container.appendChild(stage);
      installPredictionZoomGestures(container);
    }

    function showPredictionPopup(data, vehicleCd = "") {
      const overlay = ensurePredictionPopup();
      setPredictionPopupTitle(
        overlay,
        vehicleCd
      );

      const body = overlay.querySelector(".unyo-prediction-body");
      body.replaceChildren();

      const nodes = getPredictionRootNodes(data);

      if (!nodes.length) {
        const empty = document.createElement("div");
        empty.textContent = "運用予測データはありません";
        empty.style.cssText =
          "font-size:11px;color:#687780;padding:8px 2px;";
        body.appendChild(empty);
      } else {
        renderPredictionFlowTree(data, body);
      }

      overlay.style.display = "flex";

      if (nodes.length) {
        requestAnimationFrame(() => {
          const isMobile = window.matchMedia("(max-width: 640px)").matches;
          const preferredZoom = isMobile ? 0.58 : 0.72;

          setPredictionZoom(body, preferredZoom, false);

          const stage = body.querySelector(".unyo-flow-stage");
          if (stage) {
            const scaledWidth = stage.getBoundingClientRect().width;
            const scaledHeight = stage.getBoundingClientRect().height;

            // まだ極端に大きい場合だけ、自動でさらに縮める。
            if (
              scaledWidth > body.clientWidth * 2.2 ||
              scaledHeight > body.clientHeight * 2.2
            ) {
              const rawWidth = Number(stage.dataset.rawWidth || 0);
              const rawHeight = Number(stage.dataset.rawHeight || 0);
              const z = Math.min(
                preferredZoom,
                (body.clientWidth * 1.9) / rawWidth,
                (body.clientHeight * 1.9) / rawHeight
              );

              setPredictionZoom(body, Math.max(0.32, z), false);
            }
          }

          const currentCard =
            body.querySelector(
              ".unyo-flow-card-current"
            );

          if (currentCard) {
            const zoom =
              getPredictionZoom(body);

            const currentCenter =
              (
                currentCard.offsetLeft +
                currentCard.offsetWidth / 2
              ) *
              zoom;

            body.scrollLeft =
              Math.max(
                0,
                currentCenter -
                  body.clientWidth * 0.42
              );
          } else {
            body.scrollLeft = 0;
          }

          body.scrollTop = 0;
        });
      }
    }

    function treeHasSelfRareActual(
      node
    ) {
      if (!node) {
        return false;
      }

      const isSelfActual =
        Boolean(
          node?.day_actual
        );

      if (isSelfActual) {
        const countRaw =
          node
            ?.actual_cumulative_count;

        const probabilityRaw =
          node
            ?.actual_cumulative_probability;

        const count =
          Number(countRaw);

        const probability =
          Number(
            probabilityRaw
          );

        if (
          node?.rare_pattern ===
            true ||
          (
            countRaw !== null &&
            countRaw !== undefined &&
            Number.isFinite(
              count
            ) &&
            count === 0
          ) ||
          (
            probabilityRaw !== null &&
            probabilityRaw !== undefined &&
            Number.isFinite(
              probability
            ) &&
            probability < 5
          )
        ) {
          return true;
        }
      }

      for (
        const child of
          getPredictionChildren(
            node
          )
      ) {
        if (
          treeHasSelfRareActual(
            child
          )
        ) {
          return true;
        }
      }

      return false;
    }


    function registerRareVehicleFromOwnTree(
      data,
      vehicleCd
    ) {
      vehicleCd =
        cleanId(
          vehicleCd
        );

      if (
        !vehicleCd ||
        !data?.day_tree ||
        !treeHasSelfRareActual(
          data.day_tree
        )
      ) {
        return;
      }

      if (
        rareVehicleSet.has(
          vehicleCd
        )
      ) {
        return;
      }

      // 詳細ツリー自身が「この車の本日実績はレア」と確定した場合は、
      // /rare-vehicles の一括集計結果を待たず、その場で地図✨へ反映。
      // day_actualだけを見るため他車の兄弟枝で誤判定しない。
      rareVehicleSet.add(
        vehicleCd
      );

      saveRareVehiclesToStorage(
        rareVehicleSet
      );

      updateRareVehicleMarkers([
        ...latestVehicles,
        ...fallbackVehicles,
        ...retainedVehicles
      ]);
    }


    async function loadAndShowPredictionTree(tripId, vehicleCd, isFallback = false) {
      const overlay = ensurePredictionPopup();
      const body = overlay.querySelector(".unyo-prediction-body");

      body.replaceChildren();

      const loading = document.createElement("div");
      loading.textContent = "この先の予測を読み込み中...";
      loading.style.cssText =
        "font-size:11px;color:#687780;padding:8px 2px;";
      body.appendChild(loading);

      overlay.style.display = "flex";

      try {
        const response = await fetch(
          UNYO_PREDICT_TREE_URL +
          "?trip_id=" +
          encodeURIComponent(tripId) +
          (vehicleCd
            ? "&vehicle=" + encodeURIComponent(vehicleCd)
            : "") +
          (isFallback
            ? "&fallback=1"
            : ""),
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error(`predict-tree HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data?.ok) {
          throw new Error(
            data?.error || "predict-tree API error"
          );
        }

        // ツリー側で自車の0%/5%未満実績が確認できたなら、
        // 一括APIの判定ズレがあっても地図✨を確実に付ける。
        registerRareVehicleFromOwnTree(
          data,
          vehicleCd
        );

        showPredictionPopup(
          data,
          vehicleCd
        );
      } catch (e) {
        console.error("詳細運用予測取得失敗:", e);

        body.replaceChildren();

        const error = document.createElement("div");
        error.textContent =
          "この先の予測を取得できませんでした";
        error.style.cssText =
          "font-size:11px;color:#687780;padding:8px 2px;";
        body.appendChild(error);
      }
    }

    async function appendNextTripPrediction(panel, vehicleProperties) {
      const tripId = cleanId(vehicleProperties?.tripId);
      if (!tripId) return;

      const isFallback =
        Number(vehicleProperties?.isFallback) === 1;

      const box = document.createElement("div");
      box.className = "vip-next";
      box.style.marginTop = "6px";

      const label = document.createElement("div");
      label.className = "vip-next-label";
      label.textContent = "次便予測";

      const name = document.createElement("div");
      name.className = "vip-next-name";
      name.textContent = "予測を読み込み中...";

      const path = document.createElement("div");
      path.className = "vip-time";
      path.textContent = "";

      box.append(label, name, path);
      panel.appendChild(box);

      try {
        const vehicleCd = cleanId(vehicleProperties?.label);

        const response = await fetch(
          UNYO_PREDICT_URL +
          "?trip_id=" +
          encodeURIComponent(tripId) +
          (vehicleCd
            ? "&vehicle=" + encodeURIComponent(vehicleCd)
            : "") +
          (isFallback
            ? "&fallback=1"
            : ""),
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error(`predict HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data?.ok) {
          throw new Error(data?.error || "predict API error");
        }

        // パネルを閉じた後や別車両へ切り替えた後の遅延レスポンスを無視する。
        if (!box.isConnected) return;

        const nodes = getPredictionRootNodes(data);
        const best = getMostLikelyPrediction(nodes);

        if (!best) {
          name.textContent = "予測なし";
          path.textContent = "";
          return;
        }

        name.replaceChildren();

        if (isPredictionServiceEnd(best)) {
          name.textContent = "運行終了";
        } else if (best?.occupied_by_other) {
          const routeText = document.createElement("span");
          routeText.textContent = predictionRouteName(best);
          routeText.style.textDecoration = "line-through";
          routeText.style.textDecorationThickness = "1px";
          routeText.style.opacity = ".72";

          const assignedText = document.createElement("span");
          assignedText.textContent =
            ` ${cleanId(best?.assigned_vehicle) || "?"}号車が充当`;
          assignedText.style.marginLeft = "6px";
          assignedText.style.color = "#16834b";
          assignedText.style.fontWeight = "900";
          assignedText.style.textDecoration = "none";

          name.append(routeText, assignedText);
        } else {
          name.textContent = predictionRouteName(best);
        }

        path.textContent = predictionPathText(best);

        // 通常表示では /predict の1段分しか取得していない。
        // さらに先はクリックされた時だけ /predict-tree を取得する。
        box.style.cursor = "pointer";
        box.title = "クリックしてさらに先の予測を表示";
        box.tabIndex = 0;
        box.setAttribute("role", "button");

        const open = () =>
          loadAndShowPredictionTree(
            tripId,
            vehicleCd,
            isFallback
          );

        box.addEventListener("click", open);
        box.addEventListener("keydown", e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        });
      } catch (e) {
        console.error("運用予測取得失敗:", e);
        if (!box.isConnected) return;
        name.textContent = "予測を取得できませんでした";
        path.textContent = "";
      }
    }


    function showVehicleInfoPanel(vehicleProperties, currentSeq) {
      const panel = ensureVehicleInfoPanel();

      const isRetained =
        Number(vehicleProperties.isRetained) === 1;

      const isRetainedGray =
        Number(vehicleProperties.isRetainedGray) === 1;

      const isFallback =
        Number(vehicleProperties.isFallback) === 1;

      // 前日残留車は4:00～17:59の間、通常色/グレーを問わず簡易ポップアップを表示。
      // 便情報・次便予測・回送追跡は表示しない。
      if (isRetained) {

        const iconUrl =
          getVehicleIconUrl(
            vehicleProperties.label
          );

        const head =
          document.createElement("div");
        head.className = "vip-head";

        const img =
          document.createElement("img");
        img.className = "vip-icon";
        img.src = iconUrl;
        img.alt = "";
        if (isRetainedGray) {
          img.style.filter = "grayscale(1)";
          img.style.opacity = "0.55";
        }

        const number =
          document.createElement("div");
        number.className = "vip-number";
        number.textContent =
          vehicleProperties.label || "?";

        head.append(img, number);

        const previousDay =
          document.createElement("div");
        previousDay.className = "vip-route";
        previousDay.textContent = "前日の最終位置";


        panel.replaceChildren(
          head,
          previousDay,
        );

        panel.style.display = "block";
        return;
      }

      const next =
        isFallback
          ? null
          : getNextStopInfo(
              vehicleProperties.tripId,
              currentSeq
            );

      const iconUrl =
        getVehicleIconUrl(
          vehicleProperties.label
        );

      const head =
        document.createElement("div");
      head.className = "vip-head";

      const img =
        document.createElement("img");
      img.className = "vip-icon";
      img.src = iconUrl;
      img.alt = "";

      const number =
        document.createElement("div");
      number.className = "vip-number";
      number.textContent =
        vehicleProperties.label || "?";

      head.append(img, number);

      const route =
        document.createElement("div");
      route.className = "vip-route";

      const destination =
        document.createElement("div");
      destination.className =
        "vip-destination";

      if (isFallback) {
        route.textContent = "回送";

        panel.replaceChildren(
          head,
          route
        );
      } else {
        route.textContent =
          vehicleProperties.routeName ||
          "路線名不明";

        destination.textContent =
          `→ ${
            vehicleProperties.headsign ||
            "行先不明"
          }`;

        panel.replaceChildren(
          head,
          route,
          destination
        );
      }

      if (isFallback) {
        const nextBox =
          document.createElement("div");
        nextBox.className = "vip-next";

        const label =
          document.createElement("div");
        label.className =
          "vip-next-label";
        label.textContent =
          "前便";

        const lastRoute =
          document.createElement("div");
        lastRoute.className =
          "vip-next-name";
        lastRoute.textContent =
          vehicleProperties.routeName ||
          "路線名不明";

        const path =
          document.createElement("div");
        path.className =
          "vip-time";

        const startName =
          cleanId(
            vehicleProperties.shihatsuName
          ) || "始発情報不明";

        const startTime =
          formatHistoryClock(
            vehicleProperties.shihatsuTime
          );

        const endName =
          cleanId(
            vehicleProperties.headsign
          ) || "行先不明";

        const endTime =
          formatHistoryClock(
            vehicleProperties.terminalTime
          );

        path.textContent =
          `${startName} ${startTime} → ` +
          `${endName} ${endTime}`;

        nextBox.append(
          label,
          lastRoute,
          path
        );

        panel.appendChild(nextBox);
      }

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

        const scheduled =
          document.createElement("span");
        scheduled.className =
          next.delay >= 60
            ? "vip-scheduled-time"
            : "";
        scheduled.textContent =
          next.scheduledText;

        const expected =
          document.createElement("span");
        expected.className =
          "vip-expected-time " +
          (
            next.delay < 60
              ? "is-ontime"
              : "is-late"
          );
        expected.textContent =
          adjustedTimeText(
            next.scheduledText,
            next.delay
          );

        const status =
          document.createElement("span");
        status.className =
          "vip-status " +
          (
            next.delay < 60
              ? "is-ontime"
              : "is-late"
          );

        status.textContent =
          next.delayText;

        time.append(
          scheduled,
          expected,
          status
        );

        nextBox.append(
          label,
          name,
          time
        );

        panel.appendChild(nextBox);
      }

      // 通常運行中は現在便のtripId、fallback回送中は前便のtripIdを起点に、
      // どちらの車両にも同じデザインの「次便予測」を表示する。
      appendNextTripPrediction(
        panel,
        vehicleProperties
      );

      appendVehicleActions(
        panel,
        vehicleProperties
      );

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

    function loadRareVehiclesFromStorage() {
      try {
        const raw =
          localStorage.getItem(
            RARE_VEHICLES_STORAGE_KEY
          );

        if (!raw) {
          return new Set();
        }

        const data =
          JSON.parse(raw);

        const vehicles =
          Array.isArray(data?.vehicles)
            ? data.vehicles
            : [];

        return new Set(
          vehicles
            .map(
              value =>
                cleanId(value)
            )
            .filter(Boolean)
        );
      } catch (_) {
        return new Set();
      }
    }

    function saveRareVehiclesToStorage(
      set
    ) {
      try {
        localStorage.setItem(
          RARE_VEHICLES_STORAGE_KEY,
          JSON.stringify({
            savedAt:
              Date.now(),
            vehicles:
              [...set]
          })
        );
      } catch (_) {}
    }


    function rareVehicleMarkerOffset() {
      const halfIcon =
        25 * vehicleIconScaleAtZoom(map.getZoom());

      return [
        Math.round(halfIcon * 0.72),
        -Math.round(halfIcon * 0.72)
      ];
    }

    function createRareVehicleElement() {
      const el = document.createElement("div");
      el.textContent = "✨";
      el.style.pointerEvents = "none";
      el.style.fontSize = "16px";
      el.style.lineHeight = "1";
      el.style.filter =
        "drop-shadow(0 1px 2px rgba(0,0,0,.35))";
      el.style.userSelect = "none";
      el.style.webkitUserSelect = "none";
      return el;
    }

    function updateRareVehicleMarkers(vehicles) {
      const alive = new Set();
      const offset = rareVehicleMarkerOffset();

      for (const v of vehicles || []) {
        if (!Number.isFinite(v.lat) || !Number.isFinite(v.lon)) continue;

        const vehicleCd = cleanId(v.label);
        if (!vehicleCd || !rareVehicleSet.has(vehicleCd)) continue;

        const key = vehicleMarkerKey(v);
        alive.add(key);

        let item = rareVehicleMarkers.get(key);

        if (!item) {
          const element = createRareVehicleElement();

          const marker = new maplibregl.Marker({
            element,
            anchor: "center",
            offset,
            pitchAlignment: "viewport",
            rotationAlignment: "viewport"
          })
            .setLngLat([v.lon, v.lat])
            .addTo(map);

          item = { marker, element };
          rareVehicleMarkers.set(key, item);
        } else {
          item.marker.setLngLat([v.lon, v.lat]);
          item.marker.setOffset(offset);
        }
      }

      for (const [key, item] of rareVehicleMarkers) {
        if (alive.has(key)) continue;
        item.marker.remove();
        rareVehicleMarkers.delete(key);
      }
    }

    function updateRareVehicleMarkerOffsets() {
      const offset = rareVehicleMarkerOffset();

      for (const { marker } of rareVehicleMarkers.values()) {
        marker.setOffset(offset);
      }
    }

    async function refreshRareVehicles(
      force = false
    ) {
      const now =
        Date.now();

      if (
        rareVehiclesFetchRunning
      ) {
        return;
      }

      if (
        !force &&
        now -
          rareVehiclesLastFetch <
          RARE_VEHICLES_REFRESH_MS
      ) {
        return;
      }

      rareVehiclesLastFetch =
        now;

      rareVehiclesFetchRunning =
        true;

      try {
        const response =
          await fetch(
            RARE_VEHICLES_URL,
            {
              cache:
                "no-store"
            }
          );

        if (!response.ok) {
          throw new Error(
            `rare vehicles HTTP ${response.status}`
          );
        }

        const data =
          await response.json();

        const nextSet =
          new Set(
            (
              data?.vehicles ||
              []
            )
              .map(
                row =>
                  cleanId(
                    row?.vehicle_cd
                  )
              )
              .filter(
                Boolean
              )
          );

        // 内容が同じならDOM/Markerを触らない。
        let changed =
          nextSet.size !==
          rareVehicleSet.size;

        if (!changed) {
          for (
            const vehicleCd of
              nextSet
          ) {
            if (
              !rareVehicleSet.has(
                vehicleCd
              )
            ) {
              changed =
                true;
              break;
            }
          }
        }

        if (changed) {
          rareVehicleSet =
            nextSet;

          saveRareVehiclesToStorage(
            rareVehicleSet
          );

          updateVehicleNumberMarkers(
            displayedVehicles()
          );
        }
      } catch (e) {
        // 失敗時は現在のレア車番表示を維持する。
        console.warn(
          "rare vehicles load failed",
          e
        );
      } finally {
        rareVehiclesFetchRunning =
          false;
      }
    }


    function applyVehicleNumberStyle(el, isRare, isRetained = false) {
      if (!el) return;

      if (isRetained) {
        el.style.border = "1px solid rgba(112, 121, 128, .40)";
        el.style.background = "rgba(224, 227, 229, .92)";
        el.style.boxShadow = "0 1px 4px rgba(40, 48, 54, .10)";
        el.style.color = "#747d83";
        el.style.fontWeight = "800";
      } else if (isRare) {
        // レア運用中:
        // ✨を出さず、アイコン下の車番ラベルだけ金色系に変える。
        el.style.border = "1px solid rgba(184, 134, 11, .72)";
        el.style.background = "rgba(255, 248, 214, .96)";
        el.style.boxShadow = "0 1px 5px rgba(152, 108, 0, .22)";
        el.style.color = "#7a5700";
        el.style.fontWeight = "900";
      } else {
        el.style.border = "1px solid rgba(38, 52, 60, .16)";
        el.style.background = "rgba(255, 255, 255, .90)";
        el.style.boxShadow = "0 1px 4px rgba(21, 42, 56, .12)";
        el.style.color = "#26343c";
        el.style.fontWeight = "800";
      }
    }


    function createVehicleNumberElement(label, isRare = false, isRetained = false) {
      const el = document.createElement("div");

      el.textContent = label || "?";
      el.style.pointerEvents = "none";
      el.style.whiteSpace = "nowrap";
      el.style.padding = "1px 4px";
      el.style.borderRadius = "4px";
      el.style.fontFamily = "system-ui, -apple-system, 'Segoe UI', sans-serif";
      el.style.fontSize = "9px";
      el.style.lineHeight = "1.15";
      el.style.letterSpacing = ".1px";
      el.style.backdropFilter = "blur(3px)";
      el.style.webkitBackdropFilter = "blur(3px)";
      el.style.userSelect = "none";
      el.style.webkitUserSelect = "none";

      applyVehicleNumberStyle(el, isRare, isRetained);

      return el;
    }


    function getVehicleSearchLabels() {
      return [...new Set(
        displayedVehicles()
          .map(v => cleanId(v?.label))
          .filter(Boolean)
      )]
        .sort((a, b) =>
          a.localeCompare(
            b,
            "ja",
            { numeric: true }
          )
        );
    }


    function renderVehicleSearchDropdown(rawQuery = "") {
      if (!vehicleSearchDropdown) return;

      const query =
        cleanId(rawQuery).toLowerCase();

      const labels =
        getVehicleSearchLabels()
          .filter(label =>
            !query ||
            label.toLowerCase().includes(query)
          )
          .slice(0, 30);

      vehicleSearchDropdown.replaceChildren();

      if (!labels.length) {
        vehicleSearchDropdown.style.display = "none";
        return;
      }

      for (const label of labels) {
        const item =
          document.createElement("button");

        item.type = "button";
        item.textContent = label;
        item.style.cssText = `
          display:block;
          width:100%;
          box-sizing:border-box;
          border:0;
          border-radius:5px;
          background:transparent;
          color:#26343c;
          padding:6px 7px;
          text-align:left;
          font:800 11px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;
          cursor:pointer;
        `;

        item.addEventListener("mouseenter", () => {
          item.style.background = "#eef4f7";
        });

        item.addEventListener("mouseleave", () => {
          item.style.background = "transparent";
        });

        item.addEventListener("mousedown", e => {
          e.preventDefault();

          if (vehicleSearchInput) {
            vehicleSearchInput.value = label;
          }

          vehicleSearchDropdown.style.display = "none";
          searchVehicleByNumber(label);
        });

        vehicleSearchDropdown.appendChild(item);
      }

      vehicleSearchDropdown.style.display = "block";
    }


    function updateVehicleSearchSuggestions(
      vehicles
    ) {
      // 自前プルダウンは displayedVehicles() から都度生成する。
      // 表示中ならリアルタイム更新に合わせて候補も更新する。
      if (
        vehicleSearchDropdown &&
        vehicleSearchDropdown.style.display === "block"
      ) {
        renderVehicleSearchDropdown(
          vehicleSearchInput?.value || ""
        );
      }
    }


    function clearVehicleSearchResultMarker() {
      if (!vehicleSearchResultMarker) return;

      vehicleSearchResultMarker.remove();
      vehicleSearchResultMarker = null;
    }


    function createVehicleSearchResultElement(
      label
    ) {
      const wrap =
        document.createElement("div");

      const searchIconSize =
        window.matchMedia("(max-width: 640px)").matches
          ? 52
          : 62;

      // アイコン本体だけをMarkerの基準ボックスにする。
      // 車番ラベルはボックス外へ出し、元アイコンと座標中心を合わせる。
      wrap.style.cssText = `
        position:relative;
        width:${searchIconSize}px;
        height:${searchIconSize}px;
        pointer-events:none;
        z-index:9999;
      `;

      const img =
        document.createElement("img");

      const iconUrl =
        labelIconMap.get(
          cleanId(label)
        ) ||
        "icon/default-bus.png";

      img.src = iconUrl;
      img.alt = "";
      img.draggable = false;
      img.style.cssText = `
        position:absolute;
        left:0;
        top:0;
        width:${searchIconSize}px;
        height:${searchIconSize}px;
        object-fit:contain;
        filter:drop-shadow(0 3px 7px rgba(0,0,0,.32));
        user-select:none;
        -webkit-user-select:none;
      `;

      const badge =
        document.createElement("div");

      badge.textContent = label || "?";
      badge.style.cssText = `
        position:absolute;
        left:50%;
        top:${searchIconSize + 2}px;
        transform:translateX(-50%);
        padding:2px 6px;
        border:1px solid rgba(38,52,60,.18);
        border-radius:5px;
        background:rgba(255,255,255,.96);
        color:#26343c;
        box-shadow:0 2px 7px rgba(0,0,0,.18);
        font:900 10px/1.15 system-ui,-apple-system,"Segoe UI",sans-serif;
        white-space:nowrap;
      `;

      wrap.append(img, badge);
      return wrap;
    }


    function featureForVehicle(v) {
      if (!v) return null;

      const delay =
        (v.isFallback || v.isRetained)
          ? 0
          : getDelayForVehicle(v);

      const routeName =
        v.isRetained
          ? ""
          : v.isFallback
            ? (
                v.fallbackRouteName ||
                v.fallbackRoute ||
                "路線名不明"
              )
            : (
                routeNames[v.routeId] ||
                "路線名不明"
              );

      const headsign =
        v.isRetained
          ? ""
          : v.isFallback
            ? (
                v.fallbackDestination ||
                "行先不明"
              )
            : (
                tripHeadsigns[v.tripId] ||
                "行先不明"
              );

      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [
            Number(v.lon),
            Number(v.lat)
          ]
        },
        properties: {
          tripId: v.tripId || "",
          routeId: v.routeId || "",
          routeName,
          headsign,
          label: v.label || "?",
          delay,
          delayText:
            v.isRetained
              ? "前日最終位置"
              : (
                  v.isFallback
                    ? "非営業"
                    : formatDelay(delay)
                ),
          iconKey: v.label || "",
          bearing:
            Number.isFinite(v.bearing)
              ? v.bearing
              : 0,
          isFallback:
            v.isFallback ? 1 : 0,
          isRetained:
            v.isRetained ? 1 : 0,
          isRetainedGray:
            v.isRetainedGray ? 1 : 0,
          shihatsuName:
            v.fallbackShihatsuName || "",
          shihatsuTime:
            v.fallbackShihatsuTime || "",
          terminalTime:
            v.fallbackTerminalTime || "",
          mapUrl:
            v.fallbackMapUrl || "",
          planForecastResultCd:
            v.fallbackPlanForecastResultCd || "",
          positionAge:
            Number.isFinite(v.positionAge)
              ? v.positionAge
              : -1
        }
      };
    }


    function selectVehicleFromSearch(v) {
      if (!v) return;

      const feature =
        featureForVehicle(v);

      if (!feature) return;

      const p =
        feature.properties || {};

      clearVehicleSearchResultMarker();

      vehicleSearchResultMarker =
        new maplibregl.Marker({
          element:
            createVehicleSearchResultElement(
              p.label
            ),
          anchor: "center"
        })
          .setLngLat([
            Number(v.lon),
            Number(v.lat)
          ])
          .addTo(map);

      // 検索対象の場所へ移動。
      // 既に十分拡大している場合は現在ズームを維持。
      map.easeTo({
        center: [
          Number(v.lon),
          Number(v.lat)
        ],
        zoom:
          Math.max(
            map.getZoom(),
            16
          ),
        duration: 650
      });

      const selectedSource =
        map.getSource("selected-vehicle");

      if (selectedSource) {
        selectedSource.setData({
          type: "FeatureCollection",
          features: [feature]
        });
      }

      if (Number(p.isRetained) === 1) {
        selectedTripId = null;
        clearSelectedStopNameMarkers();

        map.getSource("selected-route")
          ?.setData(emptyFeatureCollection());

        map.getSource("selected-stops")
          ?.setData(emptyFeatureCollection());

        showVehicleInfoPanel(p, NaN);
        return;
      }

      if (Number(p.isFallback) === 1) {
        selectedTripId = null;
        clearSelectedStopNameMarkers();

        map.getSource("selected-route")
          ?.setData(emptyFeatureCollection());

        map.getSource("selected-stops")
          ?.setData(emptyFeatureCollection());

        showVehicleInfoPanel(
          p,
          NaN
        );
        return;
      }

      selectedTripId =
        p.tripId || null;

      const seq =
        Number(v.seq);

      map.getSource("selected-route")
        ?.setData(
          selectedRouteGeoJson(
            selectedTripId
          )
        );

      map.getSource("selected-stops")
        ?.setData(
          futureStopsGeoJson(
            selectedTripId,
            seq
          )
        );

      renderSelectedStopNameMarkers(
        selectedTripId,
        seq
      );

      showVehicleInfoPanel(
        p,
        seq
      );
    }


    function clearVehicleSearchFocus() {
      clearVehicleSearchResultMarker();

      selectedTripId = null;
      clearSelectedStopNameMarkers();

      map.getSource("selected-vehicle")
        ?.setData(emptyFeatureCollection());

      map.getSource("selected-route")
        ?.setData(emptyFeatureCollection());

      map.getSource("selected-stops")
        ?.setData(emptyFeatureCollection());

      hideVehicleInfoPanel();

      if (vehicleSearchDropdown) {
        vehicleSearchDropdown.style.display = "none";
      }
    }


    function searchVehicleByNumber(rawValue) {
      const query =
        cleanId(rawValue);

      if (!query) return;

      const vehicles =
        displayedVehicles();

      // まず完全一致。
      let target =
        vehicles.find(
          v =>
            cleanId(v?.label) ===
            query
        );

      // 完全一致しない場合は前方一致1件を採用。
      if (!target) {
        target =
          vehicles.find(
            v =>
              cleanId(v?.label)
                .startsWith(query)
          );
      }

      if (!target) {
        if (vehicleSearchInput) {
          vehicleSearchInput.setCustomValidity(
            "現在表示中の車両に該当する車番がありません"
          );
          vehicleSearchInput.reportValidity();

          setTimeout(() => {
            vehicleSearchInput?.setCustomValidity("");
          }, 1200);
        }
        return;
      }

      if (vehicleSearchInput) {
        vehicleSearchInput.setCustomValidity("");
        vehicleSearchInput.value =
          cleanId(target.label);
      }

      selectVehicleFromSearch(
        target
      );
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

        const vehicleCd = cleanId(v.label);
        const isRetained =
          v?.isRetained === true;

        const isRetainedGray =
          v?.isRetainedGray === true;

        const isRare =
          !isRetained &&
          !!vehicleCd &&
          rareVehicleSet.has(vehicleCd);

        let item = vehicleNumberMarkers.get(key);

        if (!item) {
          const element = createVehicleNumberElement(
            v.label,
            isRare,
            isRetainedGray
          );

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

          // rareVehicleSetが更新された場合も、
          // Markerを作り直さずその場で見た目だけ切り替える。
          applyVehicleNumberStyle(
            item.element,
            isRare,
            isRetainedGray
          );
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
      return labelIconMap.get(String(label ?? "").trim()) || "icon/yokokamo-v2.png";
    }

    async function ensureVehicleIcons(vehicles) {
      const urls = new Set(["icon/yokokamo-v2.png"]);

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

      expr.push("icon/yokokamo-v2.png");
      return expr;
    }

    // =========================================================
    // MapLibreレイヤ
    // =========================================================
    function installLayers() {
      // 国土地理院 全国最新写真（シームレス）
      // 通常地図の上、バス・ルート等の下に重ねる。
      map.addSource("gsi-seamlessphoto", {
        type: "raster",
        tiles: [
          "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg"
        ],
        tileSize: 256,
        minzoom: 14,
        maxzoom: 18,
        attribution: "国土地理院"
      });

      map.addLayer({
        id: "gsi-seamlessphoto",
        type: "raster",
        source: "gsi-seamlessphoto",
        layout: {
          visibility: "none"
        },
        paint: {
          "raster-opacity": 1
        }
      });
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
          "icon-size": window.matchMedia("(max-width: 640px)").matches
            ? [
                "interpolate", ["linear"], ["zoom"],
                8, 0.30,
                13, 0.55,
                16, 0.76,
                19, 0.98
              ]
            : [
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
        },
        paint: {
          "icon-opacity": [
            "case",
            ["==", ["get", "isRetainedGray"], 1],
            0.32,
            1
          ]
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

        // 前日残留車はルート・停留所を出さず、4:00～17:59は通常色/グレーを問わず
        // 前日データ用の簡易ポップアップを表示する。回送追跡も表示しない。
        if (Number(p.isRetained) === 1) {
          selectedTripId = null;
          clearSelectedStopNameMarkers();
          map.getSource("selected-route").setData(emptyFeatureCollection());
          map.getSource("selected-stops").setData(emptyFeatureCollection());
          showVehicleInfoPanel(p, NaN);
          return;
        }

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
      return labelIconMap.get(String(label ?? "")) || "icon/yokokamo-v2.png";
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

    function adjustedTimeText(scheduledText, delaySec) {
      const m = String(scheduledText ?? "").match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (!m) return scheduledText || "--:--";

      const hh = Number(m[1]);
      const mm = Number(m[2]);
      const ss = Number(m[3] || 0);
      const delay = Math.max(0, Number(delaySec) || 0);

      // 予定時刻 + 遅延秒数を、最終的に「分」へ四捨五入する。
      let totalSec = hh * 3600 + mm * 60 + ss + delay;
      let roundedMin = Math.round(totalSec / 60);

      roundedMin %= 24 * 60;

      const outH = Math.floor(roundedMin / 60);
      const outM = roundedMin % 60;

      return (
        `${String(outH).padStart(2, "0")}:` +
        `${String(outM).padStart(2, "0")}`
      );
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

      try {

        if (normalOperating) {
          // 通常運行時間中:
          // CloudflareのGTFS-RTを先に取得する。
          await Promise.all([
            loadDelays(),
            loadVehicles()
          ]);
        } else {
          // 最終便終了後～04:00:
          // Cloudflare Workerは呼ばない。
          latestVehicles = [];
          tripDelays = Object.create(null);
        }

        // Cloudflare fallbackを取得する。
        // Worker側でもGTFS-RT運行中車両は除外される。
        if (fallbackOperating) {
          try {
            await loadFallbackVehicles();
          } catch (fallbackError) {
            // fallbackだけ失敗しても通常の営業車表示は維持する。
            console.error("fallback取得失敗:", fallbackError);
            fallbackVehicles = [];
            retainedVehicles = [];
          }
        } else {
          fallbackVehicles = [];
          retainedVehicles = [];
        }

        const allVehicles = displayedVehicles();

        updateVehicleSearchSuggestions(
          allVehicles
        );

        await ensureVehicleIcons(allVehicles);
        map.getSource("vehicles").setData(vehicleGeoJson());
        updateVehicleNumberMarkers(allVehicles);

        // レア運用一覧だけは2分ごとに一括更新。
        // 15秒の位置更新自体は待たせない。
        refreshRareVehicles();

        // 選択中の通常便だけルート/停留所を更新
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

            renderSelectedStopNameMarkers(selectedTripId, Number(current.seq));

            const selectedProperties = selectedFeature?.properties;
            if (selectedProperties) {
              showVehicleInfoPanel(selectedProperties, Number(current.seq));
            }
          } else {
            hideVehicleInfoPanel();

            selectedTripId = null;
            clearSelectedStopNameMarkers();
            map.getSource("selected-vehicle").setData(emptyFeatureCollection());
            map.getSource("selected-route").setData(emptyFeatureCollection());
            map.getSource("selected-stops").setData(emptyFeatureCollection());
          }
        }

        document.getElementById("readableTimestamp").textContent =
          new Date().toLocaleString("ja-JP");

        if (normalOperating) {
          status.textContent =
            `LIVE  ${latestVehicles.length}台運行中` +
            (fallbackVehicles.length
              ? ` / 非営業 ${fallbackVehicles.length}台`
              : "") +
            (retainedVehicles.length
              ? ` / 前日残留 ${retainedVehicles.length}台`
              : "");
        } else {
          const parts = [];

          if (fallbackVehicles.length) {
            parts.push(`非営業車両 ${fallbackVehicles.length}台`);
          }

          if (retainedVehicles.length) {
            parts.push(`前日残留 ${retainedVehicles.length}台`);
          }

          status.textContent =
            parts.length
              ? parts.join(" / ")
              : "現在は営業運行終了後です";
        }

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
        await loadImageToMap("icon/yokokamo-v2.png");

        installLayers();
        installVehiclePlaceLayers();
      updateVehiclePlaceLabelPitchOffset();

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
