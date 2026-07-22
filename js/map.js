const PHOTO_ZOOM = 10;

const map = L.map("map", {
  minZoom: 3,
  maxZoom: 18
}).setView([51.0, 10.0], 5);

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }
).addTo(map);

const markerLayer = L.layerGroup().addTo(map);

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

let photos = [];

fetch("/data/photos.json")
  .then(response => {
    if (!response.ok) {
      throw new Error(
        "photos.jsonを読み込めませんでした。"
      );
    }

    return response.json();
  })
  .then(data => {
    photos = data;

    fillFilters();
    render();
  })
  .catch(error => {
    photoList.innerHTML =
      `<p class="empty-message">${escapeHtml(error.message)}</p>`;
  });

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
    a.localeCompare(b, "ja")
  );
}

function fillSelect(select, values) {
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
    return (
      (
        !countryFilter.value ||
        photo.country === countryFilter.value
      ) &&
      (
        !manufacturerFilter.value ||
        photo.manufacturer ===
          manufacturerFilter.value
      ) &&
      (
        !modelFilter.value ||
        photo.model === modelFilter.value
      )
    );
  });
}

function visiblePhotos() {
  const bounds = map.getBounds();

  return filteredPhotos().filter(photo =>
    bounds.contains([
      photo.latitude,
      photo.longitude
    ])
  );
}

function render() {
  markerLayer.clearLayers();

  const current = filteredPhotos();
  const zoom = map.getZoom();

  if (zoom < PHOTO_ZOOM) {
    zoomMessage.classList.remove("hidden");
    renderAreaMarkers(current);
  } else {
    zoomMessage.classList.add("hidden");
    renderPhotoMarkers(current);
  }

  renderPhotoList(
    visiblePhotos()
  );
}

function renderAreaMarkers(items) {
  const groups = new Map();

  items.forEach(photo => {
    const key =
      `${photo.country}|${photo.city}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(photo);
  });

  groups.forEach(group => {
    const latitude =
      group.reduce(
        (sum, photo) =>
          sum + photo.latitude,
        0
      ) / group.length;

    const longitude =
      group.reduce(
        (sum, photo) =>
          sum + photo.longitude,
        0
      ) / group.length;

    const first = group[0];

    const icon = L.divIcon({
      className: "",
      html:
        `<div class="area-marker">${group.length}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    L.marker(
      [latitude, longitude],
      { icon }
    )
      .bindTooltip(
        `${first.city}：${group.length}枚`
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

function renderPhotoMarkers(items) {
  items.forEach(photo => {
    const icon = L.divIcon({
  className: "photo-div-icon",

  html: `
    <div class="photo-marker">
      <img
        src="${escapeAttribute(photo.thumbnail)}"
        alt=""
      >
    </div>
  `,

  iconSize: [68, 40],
  iconAnchor: [34, 20]
});

    const popup = `
      <div class="popup-card">

        <img
          src="${escapeAttribute(photo.image)}"
          alt="${escapeAttribute(photo.model)}"
        >

        <h3>
          ${escapeHtml(photo.manufacturer)}
          ${escapeHtml(photo.model)}
        </h3>

        <p>
          <b>撮影国：</b>
          ${escapeHtml(photo.country)}
        </p>

        <p>
          <b>撮影地：</b>
          ${escapeHtml(photo.city)}
          ${escapeHtml(photo.location || "")}
        </p>

        <p>
          <b>製造年：</b>
          ${escapeHtml(
            String(
              photo.production_year ||
              "不明"
            )
          )}
        </p>

        <p>
          <b>撮影日：</b>
          ${escapeHtml(
            String(
              photo.photo_date ||
              "不明"
            )
          )}
        </p>

        <a href="${escapeAttribute(photo.detail_page)}">
          詳細ページを見る
        </a>

      </div>
    `;

    L.marker(
      [
        photo.latitude,
        photo.longitude
      ],
      { icon }
    )
      .bindPopup(
        popup,
        {
          maxWidth: 280
        }
      )
      .addTo(markerLayer);
  });
}

function renderPhotoList(items) {
  resultCount.textContent =
    String(items.length);

  if (!items.length) {
    photoList.innerHTML =
      '<p class="empty-message">現在の地図範囲には該当する写真がありません。</p>';

    return;
  }

  photoList.innerHTML =
    items.map(photo => `
      <a
        class="photo-card"
        href="${escapeAttribute(photo.detail_page)}"
      >

        <img
          src="${escapeAttribute(photo.thumbnail)}"
          alt="${escapeAttribute(photo.model)}"
          loading="lazy"
        >

        <strong>
          ${escapeHtml(photo.manufacturer)}
          ${escapeHtml(photo.model)}
        </strong>

        <span>
          ${escapeHtml(photo.country)}
          ・
          ${escapeHtml(photo.city)}
        </span>

        <span>
          撮影日：
          ${escapeHtml(
            String(
              photo.photo_date ||
              "不明"
            )
          )}
        </span>

      </a>
    `).join("");
}

[
  countryFilter,
  manufacturerFilter,
  modelFilter
].forEach(select => {
  select.addEventListener(
    "change",
    render
  );
});

resetButton.addEventListener(
  "click",
  () => {
    countryFilter.value = "";
    manufacturerFilter.value = "";
    modelFilter.value = "";

    render();
  }
);

map.on(
  "zoomend moveend",
  render
);

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
