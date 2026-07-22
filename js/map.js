/* ========================================
   Linienbusarchiv.de 地図ページ
======================================== */

const PHOTO_ZOOM = 10;

/* 地図を作成 */
const map = L.map("map", {
  minZoom: 3,
  maxZoom: 18
}).setView([51.0, 10.0], 5);

/* OpenStreetMapを表示 */
L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }
).addTo(map);

/* 写真マーカーをまとめるレイヤー */
const markerLayer = L.layerGroup().addTo(map);

/* HTML要素 */
const countryFilter =
  document.getElementById("countryFilter");

const manufacturerFilter =
  document.getElementById("manufacturerFilter");

const modelFilter =
  document.getElementById("modelFilter");

const resetButton =
  document.getElementById("resetButton");

const zoomMessage =
  document.getElementById("zoomMessage");

const resultCount =
  document.getElementById("resultCount");

const photoList =
  document.getElementById("photoList");

/* JSONから読み込んだ写真データ */
let photos = [];

/* ========================================
   JSON読み込み
======================================== */

fetch("/data/photos.json")
  .then(response => {
    if (!response.ok) {
      throw new Error(
        `photos.jsonを読み込めませんでした。HTTP ${response.status}`
      );
    }

    return response.json();
  })
  .then(data => {
    if (!Array.isArray(data)) {
      throw new Error(
        "photos.jsonの一番外側は配列[]にしてください。"
      );
    }

    photos = data.filter(isValidPhoto);

    fillFilters();
    render();
  })
  .catch(error => {
    console.error(error);

    resultCount.textContent = "0";

    photoList.innerHTML = `
      <p class="empty-message">
        ${escapeHtml(error.message)}
      </p>
    `;
  });

/* ========================================
   データ確認
======================================== */

function isValidPhoto(photo) {
  return (
    photo &&
    Number.isFinite(Number(photo.latitude)) &&
    Number.isFinite(Number(photo.longitude))
  );
}

/* ========================================
   検索条件
======================================== */

function fillFilters() {
  fillSelect(
    countryFilter,
    uniqueValues("country")
  );

  fillSelect(
    manufacturerFilter,
    uniqueValues("manufacturer")
  );

  fillSelect(
    modelFilter,
    uniqueValues("model")
  );
}

function uniqueValues(key) {
  return [
    ...new Set(
      photos
        .map(photo => photo[key])
        .filter(Boolean)
    )
  ].sort((a, b) =>
    String(a).localeCompare(
      String(b),
      "ja"
    )
  );
}

function fillSelect(select, values) {
  if (!select) {
    return;
  }

  values.forEach(value => {
    const option =
      document.createElement("option");

    option.value = value;
    option.textContent = value;

    select.appendChild(option);
  });
}

function filteredPhotos() {
  return photos.filter(photo => {
    const countryMatches =
      !countryFilter ||
      !countryFilter.value ||
      photo.country === countryFilter.value;

    const manufacturerMatches =
      !manufacturerFilter ||
      !manufacturerFilter.value ||
      photo.manufacturer ===
        manufacturerFilter.value;

    const modelMatches =
      !modelFilter ||
      !modelFilter.value ||
      photo.model === modelFilter.value;

    return (
      countryMatches &&
      manufacturerMatches &&
      modelMatches
    );
  });
}

function visiblePhotos() {
  const bounds = map.getBounds();

  return filteredPhotos().filter(photo =>
    bounds.contains([
      Number(photo.latitude),
      Number(photo.longitude)
    ])
  );
}

/* ========================================
   地図全体を更新
======================================== */

function render() {
  markerLayer.clearLayers();

  const currentPhotos =
    filteredPhotos();

  const zoom =
    map.getZoom();

  if (zoom < PHOTO_ZOOM) {
    if (zoomMessage) {
      zoomMessage.classList.remove(
        "hidden"
      );
    }

    renderAreaMarkers(
      currentPhotos
    );
  } else {
    if (zoomMessage) {
      zoomMessage.classList.add(
        "hidden"
      );
    }

    renderPhotoMarkers(
      currentPhotos
    );
  }

  renderPhotoList(
    visiblePhotos()
  );
}

/* ========================================
   広域表示の枚数マーカー
======================================== */

function renderAreaMarkers(items) {
  const groups = new Map();

  items.forEach(photo => {
    const country =
      photo.country || "不明";

    const city =
      photo.city || "不明";

    const key =
      `${country}|${city}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(photo);
  });

  groups.forEach(group => {
    const latitude =
      group.reduce(
        (sum, photo) =>
          sum + Number(photo.latitude),
        0
      ) / group.length;

    const longitude =
      group.reduce(
        (sum, photo) =>
          sum + Number(photo.longitude),
        0
      ) / group.length;

    const first =
      group[0];

    const icon = L.divIcon({
      className: "area-div-icon",

      html: `
        <div class="area-marker">
          ${group.length}
        </div>
      `,

      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    L.marker(
      [latitude, longitude],
      { icon }
    )
      .bindTooltip(
        `${escapeHtml(first.city || "不明")}：${group.length}枚`
      )
      .on("click", () => {
        map.setView(
          [latitude, longitude],
          PHOTO_ZOOM + 1
        );
      })
      .addTo(markerLayer);
  });
}

/* ========================================
   写真マーカーのサイズ
======================================== */

function getPhotoMarkerSize() {
  const isMobile =
    window.innerWidth <= 600;

  if (isMobile) {
    return {
      imageWidth: 48,
      imageHeight: 27,

      /* border 2px × 左右上下 */
      iconWidth: 52,
      iconHeight: 31
    };
  }

  return {
    imageWidth: 64,
    imageHeight: 36,

    /* border 2px × 左右上下 */
    iconWidth: 68,
    iconHeight: 40
  };
}

/* ========================================
   拡大表示の写真マーカー
======================================== */

function renderPhotoMarkers(items) {
  const markerSize =
    getPhotoMarkerSize();

  items.forEach(photo => {
    const thumbnail =
      photo.thumbnail ||
      photo.image ||
      "";

    const icon = L.divIcon({
      className: "photo-div-icon",

      html: `
        <div
          class="photo-marker"
          style="
            width: ${markerSize.imageWidth}px;
            height: ${markerSize.imageHeight}px;
          "
        >
          <img
            src="${escapeAttribute(thumbnail)}"
            alt="${escapeAttribute(
              makePhotoTitle(photo)
            )}"
          >
        </div>
      `,

      iconSize: [
        markerSize.iconWidth,
        markerSize.iconHeight
      ],

      iconAnchor: [
        markerSize.iconWidth / 2,
        markerSize.iconHeight / 2
      ],

      popupAnchor: [
        0,
        -(markerSize.iconHeight / 2)
      ]
    });

    const popup =
      createPopupHtml(photo);

    L.marker(
      [
        Number(photo.latitude),
        Number(photo.longitude)
      ],
      { icon }
    )
      .bindPopup(
        popup,
        {
          maxWidth: 300,
          minWidth: 220
        }
      )
      .addTo(markerLayer);
  });
}

/* ========================================
   ポップアップ
======================================== */

function createPopupHtml(photo) {
  const title =
    makePhotoTitle(photo);

  const image =
    photo.image ||
    photo.thumbnail ||
    "";

  const detailPage =
    photo.detail_page || "#";

  return `
    <div class="popup-card">

      <img
        src="${escapeAttribute(image)}"
        alt="${escapeAttribute(title)}"
      >

      <h3>
        ${escapeHtml(title)}
      </h3>

      <p>
        <b>車両番号：</b>
        ${escapeHtml(
          photo.id || "不明"
        )}
      </p>

      <p>
        <b>撮影国：</b>
        ${escapeHtml(
          photo.country || "不明"
        )}
      </p>

      <p>
        <b>撮影地：</b>
        ${escapeHtml(
          createLocationText(photo)
        )}
      </p>

      <p>
        <b>事業者：</b>
        ${escapeHtml(
          photo.operator || "不明"
        )}
      </p>

      <p>
        <b>製造年：</b>
        ${escapeHtml(
          formatValue(
            photo.production_year
          )
        )}
      </p>

      <p>
        <b>撮影日：</b>
        ${escapeHtml(
          formatValue(
            photo.photo_date
          )
        )}
      </p>

      <a href="${escapeAttribute(detailPage)}">
        詳細ページを見る
      </a>

    </div>
  `;
}

/* ========================================
   地図下部の写真一覧
======================================== */

function renderPhotoList(items) {
  if (resultCount) {
    resultCount.textContent =
      String(items.length);
  }

  if (!photoList) {
    return;
  }

  if (!items.length) {
    photoList.innerHTML = `
      <p class="empty-message">
        現在の地図範囲には該当する写真がありません。
      </p>
    `;

    return;
  }

  photoList.innerHTML =
    items.map(photo => {
      const title =
        makePhotoTitle(photo);

      const thumbnail =
        photo.thumbnail ||
        photo.image ||
        "";

      const detailPage =
        photo.detail_page || "#";

      return `
        <a
          class="photo-card"
          href="${escapeAttribute(detailPage)}"
        >

          <img
            src="${escapeAttribute(thumbnail)}"
            alt="${escapeAttribute(title)}"
            loading="lazy"
          >

          <strong>
            ${escapeHtml(title)}
          </strong>

          <span>
            ${escapeHtml(
              createLocationText(photo)
            )}
          </span>

          <span>
            撮影日：
            ${escapeHtml(
              formatValue(
                photo.photo_date
              )
            )}
          </span>

        </a>
      `;
    }).join("");
}

/* ========================================
   文字列作成
======================================== */

function makePhotoTitle(photo) {
  return [
    photo.manufacturer,
    photo.model
  ]
    .filter(Boolean)
    .join(" ") ||
    photo.id ||
    "車両写真";
}

function createLocationText(photo) {
  return [
    photo.country,
    photo.city,
    photo.location
  ]
    .filter(Boolean)
    .join("・") ||
    "不明";
}

function formatValue(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "不明";
  }

  return String(value);
}

/* ========================================
   絞り込み操作
======================================== */

[
  countryFilter,
  manufacturerFilter,
  modelFilter
]
  .filter(Boolean)
  .forEach(select => {
    select.addEventListener(
      "change",
      render
    );
  });

if (resetButton) {
  resetButton.addEventListener(
    "click",
    () => {
      if (countryFilter) {
        countryFilter.value = "";
      }

      if (manufacturerFilter) {
        manufacturerFilter.value = "";
      }

      if (modelFilter) {
        modelFilter.value = "";
      }

      render();
    }
  );
}

/* 地図を移動・拡大縮小したとき */
map.on(
  "zoomend moveend",
  render
);

/* ========================================
   画面サイズ変更
======================================== */

let resizeTimer = null;

window.addEventListener(
  "resize",
  () => {
    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(
      () => {
        map.invalidateSize();
        render();
      },
      150
    );
  }
);

/* ========================================
   HTMLエスケープ
======================================== */

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
