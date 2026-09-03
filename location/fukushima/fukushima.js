const MAX_DEPTH = 50;
const MAX_NODES = 5000;

// 詳細ツリーの履歴部分は一定時間メモリキャッシュ。
// 同じ便を何度開いても重い履歴SQLを再実行しない。
const TREE_CACHE_TTL_MS = 15 * 60 * 1000;
const TREE_CACHE_MAX = 100;
const treeBaseCache = new Map();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    const url = new URL(request.url);

    try {
      // ========================================================
      // 高速版: 次の1段だけ返す
      // ========================================================
      if (url.pathname === "/predict") {
        const tripId = clean(url.searchParams.get("trip_id"));
        const vehicleCd = clean(
          url.searchParams.get("vehicle_cd") ||
          url.searchParams.get("vehicle") ||
          url.searchParams.get("label")
        );

        const isFallback =
          clean(
            url.searchParams.get("fallback")
          ) === "1";

        if (!tripId) {
          return json(
            {
              ok: false,
              error: "trip_id is required"
            },
            400
          );
        }

        const result = await buildOneStepPrediction(
          env,
          tripId,
          vehicleCd,
          isFallback
        );

        return json(result);
      }

      // ========================================================
      // 詳細版: クリック時だけ全ツリーを返す
      // ========================================================
      if (url.pathname === "/predict-tree") {
        const tripId = clean(url.searchParams.get("trip_id"));
        const vehicleCd = clean(
          url.searchParams.get("vehicle_cd") ||
          url.searchParams.get("vehicle") ||
          url.searchParams.get("label")
        );

        const isFallback =
          clean(
            url.searchParams.get("fallback")
          ) === "1";

        if (!tripId) {
          return json(
            {
              ok: false,
              error: "trip_id is required"
            },
            400
          );
        }

        const result = await buildPredictionTree(
          env,
          tripId,
          vehicleCd,
          isFallback
        );

        return json(result);
      }

      return new Response(
        "unyo-predict",
        {
          headers: CORS_HEADERS
        }
      );

    } catch (e) {
      console.error(e);

      return json(
        {
          ok: false,
          error: String(e?.stack || e)
        },
        500
      );
    }
  }
};


// ============================================================
// 予測基準便の自動更新
//
// Pagesから渡されたtripが古くても、同一車両のtargetsに
// それより後の「終了済み実績」があれば、その最新便を基準にする。
// ============================================================

async function resolvePredictionStartTrip(
  env,
  suppliedTripId,
  vehicleCd
) {
  suppliedTripId = clean(suppliedTripId);
  vehicleCd = clean(vehicleCd);

  if (
    !env.LIVE_DB ||
    !vehicleCd ||
    !suppliedTripId
  ) {
    return {
      tripId: suppliedTripId,
      advanced: false
    };
  }

  const now = new Date(
    Date.now() + 9 * 60 * 60 * 1000
  );

  const yyyy =
    now.getUTCFullYear();

  const mm =
    String(
      now.getUTCMonth() + 1
    ).padStart(2, "0");

  const dd =
    String(
      now.getUTCDate()
    ).padStart(2, "0");

  const hh =
    String(
      now.getUTCHours()
    ).padStart(2, "0");

  const mi =
    String(
      now.getUTCMinutes()
    ).padStart(2, "0");

  const ss =
    String(
      now.getUTCSeconds()
    ).padStart(2, "0");

  const serviceDate =
    `${yyyy}-${mm}-${dd}`;

  const nowTime =
    `${hh}:${mi}:${ss}`;

  // まずPagesから渡された基準便自身の時刻を確認。
  // 現在運行中の便なら terminal_time は未来なので、
  // それより古い「終了済み便」へ絶対に巻き戻さない。
  const suppliedRow =
    await env.LIVE_DB
      .prepare(`
        SELECT
          trip_id,
          shihatsu_time,
          terminal_time,
          detected_at
        FROM targets
        WHERE service_date = ?
          AND vehicle_cd = ?
          AND trip_id = ?
        ORDER BY detected_at DESC, id DESC
        LIMIT 1
      `)
      .bind(
        serviceDate,
        vehicleCd,
        suppliedTripId
      )
      .first();

  const suppliedEnd =
    predictionTimeSortNumber(
      suppliedRow?.terminal_time
    );

  const result = await env.LIVE_DB
    .prepare(`
      SELECT
        trip_id,
        shihatsu_time,
        terminal_time,
        detected_at,
        id
      FROM targets
      WHERE service_date = ?
        AND vehicle_cd = ?
        AND trip_id IS NOT NULL
        AND trip_id <> ''
        AND terminal_time IS NOT NULL
        AND terminal_time <> ''
        AND terminal_time <= ?
      ORDER BY
        terminal_time DESC,
        shihatsu_time DESC,
        detected_at DESC,
        id DESC
      LIMIT 50
    `)
    .bind(
      serviceDate,
      vehicleCd,
      nowTime
    )
    .all();

  const rows =
    result.results || [];

  if (!rows.length) {
    return {
      tripId: suppliedTripId,
      advanced: false
    };
  }

  const seen =
    new Set();

  for (const row of rows) {
    const tripId =
      clean(row.trip_id);

    if (
      !tripId ||
      seen.has(tripId)
    ) {
      continue;
    }

    seen.add(tripId);

    if (
      tripId === suppliedTripId
    ) {
      return {
        tripId: suppliedTripId,
        advanced: false
      };
    }

    const candidateEnd =
      predictionTimeSortNumber(
        row.terminal_time
      );

    // suppliedTripIdがtargetsに存在して時刻比較できる場合、
    // 本当に後の実績便だけへ進める。
    // 古い終了便へ戻ることは禁止。
    if (
      Number.isFinite(suppliedEnd) &&
      suppliedEnd !==
        Number.MAX_SAFE_INTEGER
    ) {
      if (
        !Number.isFinite(candidateEnd) ||
        candidateEnd ===
          Number.MAX_SAFE_INTEGER ||
        candidateEnd <= suppliedEnd
      ) {
        return {
          tripId: suppliedTripId,
          advanced: false
        };
      }
    }

    return {
      tripId,
      advanced: true
    };
  }

  return {
    tripId: suppliedTripId,
    advanced: false
  };
}


// ============================================================
// ダイヤ区分
// 平日 / 土曜 / 日祝 / 学休 を絶対に混ぜない。
// ============================================================

function resolveTimetableType(
  tripId,
  currentInfo
) {
  const fromHistory = clean(
    currentInfo?.timetable_type
  );

  if (fromHistory) {
    return fromHistory;
  }

  // 履歴に表示情報がない場合の保険。
  // trip_idが「平日...」「土曜...」「日祝...」「学休...」で始まる
  // 現在の命名規則にも対応する。
  const id = clean(tripId);

  for (const type of [
    "平日",
    "土曜",
    "日祝",
    "学休"
  ]) {
    if (id.startsWith(type)) {
      return type;
    }
  }

  return "";
}


// ============================================================
// 高速版
// 現在便の「次の1段」だけ取得
// ============================================================

async function buildOneStepPrediction(
  env,
  startTripId,
  targetVehicleCd,
  isFallback = false
) {
  // 通常のGTFS-RT車両ではPagesが渡した現在trip_idを絶対にそのまま使う。
  // targetsへの収集がまだ済んでいない現在便を、過去便へ巻き戻さないため。
  // fallback車両だけは「前便trip_id」しか持たないため最新終了実績へ進めてよい。
  if (isFallback) {
    const resolvedStart =
      await resolvePredictionStartTrip(
        env,
        startTripId,
        targetVehicleCd
      );

    startTripId =
      resolvedStart.tripId;
  }
  const currentInfo = await getTripInfo(
    env,
    startTripId
  );

  const timetableType = resolveTimetableType(
    startTripId,
    currentInfo
  );

  if (!timetableType) {
    throw new Error(
      `timetable_type could not be resolved: ${startTripId}`
    );
  }

  // 現在便と同じダイヤ区分だけを使う。
  const options = await getNextOptions(
    env,
    [startTripId],
    timetableType
  );

  // 候補に出たtrip_idだけLIVE_DBへ問い合わせる
  const candidateTripIds = options
    .map(row => clean(row.next_trip_id))
    .filter(Boolean);

  const liveData = await getAssignmentsForTrips(
    env,
    candidateTripIds
  );

  const predictions = options.map(option => {
    if (option.next_trip_id === null) {
      return {
        service_end: true,
        count: Number(option.cnt),
        n: Number(option.n),
        probability: round1(option.probability)
      };
    }

    return makePredictionNode(
      option,
      100,
      liveData.assignments,
      targetVehicleCd
    );
  });

  return {
    ok: true,
    mode: "one_step",

    prediction_timetable_type:
      timetableType,

    prediction_start_trip:
      startTripId,

    target_vehicle:
      targetVehicleCd || null,

    live_service_date:
      liveData.serviceDate,

    current: {
      trip_id: startTripId,
      route_name:
        currentInfo?.route_name ?? null,
      from_stop:
        currentInfo?.from_stop ?? null,
      from_time:
        currentInfo?.from_time ?? null,
      to_stop:
        currentInfo?.to_stop ?? null,
      to_time:
        currentInfo?.to_time ?? null,
      timetable_type:
        currentInfo?.timetable_type ?? null
    },

    predictions
  };
}


// ============================================================
// 詳細版
// 全運用予測ツリーを作る
// ============================================================

async function buildPredictionTree(
  env,
  startTripId,
  targetVehicleCd,
  isFallback = false
) {
  const startedAt = Date.now();

  // 通常車は現在のGTFS-RT trip_idをそのまま起点にする。
  // fallbackだけ、保存済み実績を使って起点を更新する。
  if (isFallback) {
    const resolvedStart =
      await resolvePredictionStartTrip(
        env,
        startTripId,
        targetVehicleCd
      );

    startTripId =
      resolvedStart.tripId;
  }

  const currentInfo = await getTripInfo(
    env,
    startTripId
  );

  const timetableType = resolveTimetableType(
    startTripId,
    currentInfo
  );

  if (!timetableType) {
    throw new Error(
      `timetable_type could not be resolved: ${startTripId}`
    );
  }

  // 履歴ツリーと当日充当を並列取得。
  // 履歴側は「現在便と同じダイヤ区分」だけで構築する。
  const [baseData, liveData] = await Promise.all([
    getCachedHistoricalTreeBase(
      env,
      startTripId,
      timetableType,
      currentInfo
    ),
    getLiveAssignments(env)
  ]);

  let actualHistory = await getTodayActualHistory(
    env,
    targetVehicleCd,
    startTripId,
    liveData.serviceDate
  );

  actualHistory = await addActualHistoryProbabilities(
    env,
    actualHistory,
    timetableType
  );

  const dayTreeState = {
    nodeCount: 0,
    truncated: false
  };

  const dayTree = await buildConfirmedDayTree(
    env,
    actualHistory,
    baseData.current,
    startTripId,
    timetableType,
    liveData.assignments,
    targetVehicleCd,
    baseData,
    dayTreeState
  );

  const state = {
    nodeCount: 0,
    truncated: Boolean(baseData.truncated)
  };

  // 履歴ツリーへ当日の充当情報だけを付与する。
  // 他車充当枝はここで子孫を切るので、Pagesへ送るJSONも小さくなる。
  const tree = decorateHistoricalTree(
    baseData.tree,
    liveData.assignments,
    targetVehicleCd,
    state
  );

  return {
    ok: true,
    mode: "tree",
    engine: "single_history_query",

    prediction_timetable_type:
      timetableType,

    prediction_start_trip:
      startTripId,

    target_vehicle:
      targetVehicleCd || null,

    live_service_date:
      liveData.serviceDate,

    actual_history:
      actualHistory,

    day_tree:
      dayTree,

    current:
      baseData.current,

    tree,

    node_count:
      state.nodeCount,

    truncated:
      state.truncated,

    limits: {
      max_depth:
        MAX_DEPTH,

      max_nodes:
        MAX_NODES
    },

    timing_ms:
      Date.now() - startedAt,

    history_cache:
      baseData.cacheHit ? "hit" : "miss"
  };
}


// ============================================================
// 詳細ツリー高速化
//
// 旧版:
//   1ノード進むごとに getNextOptions() を呼び、
//   毎回 operation_history 全体へROW_NUMBER()を実行。
//
// 新版:
//   startTripId が出現した全車両日について、
//   その後の運用列を1回のSQLでまとめて取得し、
//   Workerメモリ内で trie（前方一致木）を構築する。
// ============================================================

async function getCachedHistoricalTreeBase(
  env,
  startTripId,
  timetableType,
  currentInfo
) {
  const now = Date.now();
  const cacheKey = `${timetableType}|${startTripId}`;
  const cached = treeBaseCache.get(cacheKey);

  if (
    cached &&
    now - cached.savedAt < TREE_CACHE_TTL_MS
  ) {
    return {
      ...cached.value,
      cacheHit: true
    };
  }

  const value = await buildHistoricalTreeBaseOneQuery(
    env,
    startTripId,
    timetableType,
    currentInfo
  );

  treeBaseCache.set(cacheKey, {
    savedAt: now,
    value
  });

  // 単純なFIFOで上限を保つ。
  while (treeBaseCache.size > TREE_CACHE_MAX) {
    const oldestKey = treeBaseCache.keys().next().value;
    treeBaseCache.delete(oldestKey);
  }

  return {
    ...value,
    cacheHit: false
  };
}


async function buildHistoricalTreeBaseOneQuery(
  env,
  startTripId,
  timetableType,
  currentInfo
) {
  // rootを含めてMAX_DEPTH便までだけ取得。
  // 1回のROW_NUMBER()で全候補系列をまとめて読む。
  const sql = `
    WITH ordered AS (
      SELECT
        yyyymmdd,
        label,
        trip_id,
        route_name,
        from_stop,
        from_time,
        to_stop,
        to_time,
        timetable_type,

        ROW_NUMBER() OVER (
          PARTITION BY
            yyyymmdd,
            label
          ORDER BY
            from_time,
            trip_id
        ) AS rn,

        COUNT(*) OVER (
          PARTITION BY
            yyyymmdd,
            label
        ) AS day_count

      FROM operation_history

      WHERE timetable_type = ?
    ),

    starts AS (
      SELECT
        yyyymmdd,
        label,
        rn AS start_rn,
        day_count

      FROM ordered

      WHERE trip_id = ?
    )

    SELECT
      s.yyyymmdd,
      s.label,
      s.start_rn,
      s.day_count,

      o.rn,
      o.trip_id,
      o.route_name,
      o.from_stop,
      o.from_time,
      o.to_stop,
      o.to_time,
      o.timetable_type

    FROM starts s

    JOIN ordered o
      ON o.yyyymmdd = s.yyyymmdd
     AND o.label = s.label
     AND o.rn >= s.start_rn
     AND o.rn < s.start_rn + ?

    ORDER BY
      s.yyyymmdd,
      s.label,
      s.start_rn,
      o.rn
  `;

  const result = await env.HISTORY_DB
    .prepare(sql)
    .bind(
      timetableType,
      startTripId,
      MAX_DEPTH
    )
    .all();

  const rows = result.results ?? [];

  if (!rows.length) {
    return {
      current: {
        trip_id: startTripId,
        route_name: currentInfo?.route_name ?? null,
        from_stop: currentInfo?.from_stop ?? null,
        from_time: currentInfo?.from_time ?? null,
        to_stop: currentInfo?.to_stop ?? null,
        to_time: currentInfo?.to_time ?? null,
        timetable_type: timetableType
      },
      tree: [],
      truncated: false
    };
  }

  const first = rows[0];

  const current = {
    trip_id:
      startTripId,
    route_name:
      first.route_name ?? null,
    from_stop:
      first.from_stop ?? null,
    from_time:
      first.from_time ?? null,
    to_stop:
      first.to_stop ?? null,
    to_time:
      first.to_time ?? null,
    timetable_type:
      timetableType
  };

  // startTripIdの各出現を1系列としてまとめる。
  const groups = new Map();

  for (const row of rows) {
    const key =
      `${row.yyyymmdd}|${row.label}|${row.start_rn}`;

    if (!groups.has(key)) {
      groups.set(key, {
        startRn: Number(row.start_rn),
        dayCount: Number(row.day_count),
        rows: []
      });
    }

    groups.get(key).rows.push(row);
  }

  const root = createTrieNode(null);
  let truncated = false;

  for (const group of groups.values()) {
    const seq = group.rows;

    // 先頭は現在便なので、予測ツリーへは2件目以降を入れる。
    root.visits++;

    let cursor = root;
    const seen = new Set([startTripId]);
    let loopStopped = false;

    for (let i = 1; i < seq.length; i++) {
      const row = seq[i];
      const tripId = clean(row.trip_id);

      if (!tripId) continue;

      let child = cursor.children.get(tripId);

      if (!child) {
        child = createTrieNode({
          trip_id: tripId,
          route_name: row.route_name,
          from_stop: row.from_stop,
          from_time: row.from_time,
          to_stop: row.to_stop,
          to_time: row.to_time,
          timetable_type: row.timetable_type
        });

        cursor.children.set(
          tripId,
          child
        );
      }

      child.visits++;
      cursor = child;

      if (seen.has(tripId)) {
        child.loopCount++;
        loopStopped = true;
        break;
      }

      seen.add(tripId);
    }

    if (loopStopped) {
      continue;
    }

    const last = seq[seq.length - 1];
    const actualDayEndRn = group.dayCount;
    const lastRn = Number(last?.rn || 0);

    if (lastRn >= actualDayEndRn) {
      // 実際にその車両日の最後まで到達。
      cursor.endCount++;
    } else {
      // MAX_DEPTHで切れた。
      cursor.truncatedCount++;
      truncated = true;
    }
  }

  const state = {
    nodeCount: 0,
    truncated
  };

  const rootSampleN =
    Number(root.visits || 0);

  const tree = trieChildrenToPredictionTree(
    root,
    100,
    1,
    state,
    rootSampleN
  );

  return {
    current,
    tree,
    truncated: state.truncated
  };
}


function createTrieNode(info) {
  return {
    info,
    visits: 0,
    endCount: 0,
    loopCount: 0,
    truncatedCount: 0,
    children: new Map()
  };
}


function trieChildrenToPredictionTree(
  parent,
  parentCumulativeProbability,
  depth,
  state,
  rootSampleN
) {
  if (depth > MAX_DEPTH) {
    state.truncated = true;
    return [{
      stopped: true,
      reason: "max_depth"
    }];
  }

  const n = Number(parent.visits || 0);

  if (!n) {
    return [];
  }

  const out = [];

  const children = [...parent.children.values()]
    .sort((a, b) => {
      if (b.visits !== a.visits) {
        return b.visits - a.visits;
      }

      return clean(a.info?.trip_id)
        .localeCompare(clean(b.info?.trip_id));
    });

  for (const child of children) {
    if (state.nodeCount >= MAX_NODES) {
      state.truncated = true;
      break;
    }

    state.nodeCount++;

    const probability =
      child.visits * 100 / n;

    const cumulative =
      parentCumulativeProbability *
      probability / 100;

    const node = {
      trip_id:
        child.info?.trip_id ?? null,
      route_name:
        child.info?.route_name ?? null,
      from_stop:
        child.info?.from_stop ?? null,
      from_time:
        child.info?.from_time ?? null,
      to_stop:
        child.info?.to_stop ?? null,
      to_time:
        child.info?.to_time ?? null,
      timetable_type:
        child.info?.timetable_type ?? null,
      count:
        Number(child.visits),
      n,
      cumulative_count:
        Number(child.visits),
      cumulative_n:
        Number(rootSampleN),
      probability:
        round1(probability),
      cumulative_probability:
        round1(cumulative),
      children: []
    };

    if (child.loopCount > 0) {
      node.loop_detected = true;
    } else if (child.truncatedCount > 0) {
      node.children.push({
        stopped: true,
        reason: "max_depth"
      });
      state.truncated = true;
    } else {
      node.children = trieChildrenToPredictionTree(
        child,
        cumulative,
        depth + 1,
        state,
        rootSampleN
      );
    }

    out.push(node);
  }

  if (
    parent.endCount > 0 &&
    state.nodeCount < MAX_NODES
  ) {
    state.nodeCount++;

    const probability =
      parent.endCount * 100 / n;

    const cumulative =
      parentCumulativeProbability *
      probability / 100;

    out.push({
      service_end: true,
      count: Number(parent.endCount),
      n,
      cumulative_count:
        Number(parent.endCount),
      cumulative_n:
        Number(rootSampleN),
      probability: round1(probability),
      cumulative_probability: round1(cumulative)
    });
  }

  if (state.nodeCount >= MAX_NODES) {
    state.truncated = true;
  }

  return out;
}


async function buildConfirmedDayTree(
  env,
  actualHistory,
  currentInfo,
  currentTripId,
  timetableType,
  liveAssignments,
  targetVehicleCd,
  currentBaseData,
  state
) {
  const path = [
    ...(Array.isArray(actualHistory)
      ? actualHistory
      : []),
    {
      trip_id: clean(currentTripId),
      route_name: currentInfo?.route_name ?? null,
      from_stop: currentInfo?.from_stop ?? null,
      from_time: currentInfo?.from_time ?? null,
      to_stop: currentInfo?.to_stop ?? null,
      to_time: currentInfo?.to_time ?? null,
      timetable_type:
        currentInfo?.timetable_type ??
        timetableType,
      current_node: true
    }
  ].filter(
    row =>
      Boolean(clean(row?.trip_id))
  );

  const deduped = [];

  for (const row of path) {
    const tripId =
      clean(row?.trip_id);

    if (
      deduped.length &&
      clean(
        deduped[
          deduped.length - 1
        ]?.trip_id
      ) === tripId
    ) {
      deduped[
        deduped.length - 1
      ] = {
        ...deduped[
          deduped.length - 1
        ],
        ...row,
        current_node:
          Boolean(row?.current_node)
      };
      continue;
    }

    deduped.push(row);
  }

  if (!deduped.length) {
    return null;
  }

  const bases =
    await Promise.all(
      deduped.map(
        async (row, index) => {
          if (
            index ===
              deduped.length - 1 &&
            clean(row.trip_id) ===
              clean(currentTripId)
          ) {
            return currentBaseData;
          }

          const info =
            await getTripInfo(
              env,
              clean(row.trip_id)
            );

          return getCachedHistoricalTreeBase(
            env,
            clean(row.trip_id),
            timetableType,
            info
          );
        }
      )
    );

  let cumulative = 100;

  const makePathNode =
    (row, index) => {
      const isCurrent =
        index ===
        deduped.length - 1;

      return {
        trip_id:
          clean(row.trip_id),
        route_name:
          row.route_name ?? null,
        from_stop:
          row.from_stop ?? null,
        from_time:
          row.from_time ?? null,
        to_stop:
          row.to_stop ?? null,
        to_time:
          row.to_time ?? null,
        timetable_type:
          row.timetable_type ??
          timetableType,
        day_actual:
          !isCurrent,
        current_node:
          isCurrent,
        confirmed_actual:
          !isCurrent,
        actual_cumulative_probability:
          Number.isFinite(cumulative)
            ? round1(cumulative)
            : null,
        cumulative_probability:
          Number.isFinite(cumulative)
            ? round1(cumulative)
            : null,
        children: []
      };
    };

  const root =
    makePathNode(
      deduped[0],
      0
    );

  let cursor = root;

  for (
    let index = 0;
    index < deduped.length;
    index++
  ) {
    const base =
      bases[index];

    const localTree =
      Array.isArray(base?.tree)
        ? base.tree
        : [];

    const isCurrent =
      index ===
      deduped.length - 1;

    if (isCurrent) {
      const factor =
        Number.isFinite(cumulative)
          ? cumulative / 100
          : 1;

      const scaledFuture =
        localTree.map(
          node =>
            scaleHistoricalCumulative(
              node,
              factor
            )
        );

      cursor.children =
        decorateHistoricalTree(
          scaledFuture,
          liveAssignments,
          targetVehicleCd,
          state
        );

      break;
    }

    const nextTripId =
      clean(
        deduped[
          index + 1
        ]?.trip_id
      );

    const nextMatched =
      localTree.find(
        node =>
          clean(node?.trip_id) ===
          nextTripId
      );

    // 過去の各分岐点では、当日実際に他車が取った枝だけ残す。
    for (const source of localTree) {
      if (
        source?.service_end ||
        source?.stopped
      ) {
        continue;
      }

      const sourceTripId =
        clean(source?.trip_id);

      if (
        !sourceTripId ||
        sourceTripId === nextTripId
      ) {
        continue;
      }

      const assignedVehicle =
        clean(
          liveAssignments.get(
            sourceTripId
          )
        );

      if (
        !assignedVehicle ||
        assignedVehicle ===
          clean(targetVehicleCd)
      ) {
        continue;
      }

      const factor =
        Number.isFinite(cumulative)
          ? cumulative / 100
          : 1;

      const scaled =
        scaleHistoricalCumulative(
          source,
          factor
        );

      const confirmed =
        decorateHistoricalTree(
          [scaled],
          liveAssignments,
          targetVehicleCd,
          state
        );

      cursor.children.push(
        ...confirmed
      );
    }

    if (nextMatched) {
      const local =
        Number(
          nextMatched
            ?.cumulative_probability
        );

      if (
        Number.isFinite(local) &&
        Number.isFinite(cumulative)
      ) {
        cumulative =
          cumulative *
          local /
          100;
      } else {
        cumulative =
          NaN;
      }
    } else {
      cumulative =
        NaN;
    }

    const nextNode =
      makePathNode(
        deduped[
          index + 1
        ],
        index + 1
      );

    cursor.children.push(
      nextNode
    );

    cursor =
      nextNode;
  }

  return root;
}


function scaleHistoricalCumulative(
  source,
  factor
) {
  if (!source) {
    return source;
  }

  const node = {
    ...source
  };

  const cumulative =
    Number(
      source
        ?.cumulative_probability
    );

  if (
    Number.isFinite(cumulative) &&
    Number.isFinite(factor)
  ) {
    node.cumulative_probability =
      round1(
        cumulative *
        factor
      );
  }

  if (
    Array.isArray(source.children)
  ) {
    node.children =
      source.children.map(
        child =>
          scaleHistoricalCumulative(
            child,
            factor
          )
      );
  }

  return node;
}


function decorateHistoricalTree(
  nodes,
  liveAssignments,
  targetVehicleCd,
  state
) {
  const out = [];

  for (const source of nodes || []) {
    if (state.nodeCount >= MAX_NODES) {
      state.truncated = true;
      break;
    }

    state.nodeCount++;

    if (
      source?.service_end ||
      source?.stopped
    ) {
      out.push({ ...source });
      continue;
    }

    const node = {
      ...source,
      children: []
    };

    const tripId =
      clean(node.trip_id);

    const assignedVehicle =
      clean(
        liveAssignments.get(
          tripId
        )
      );

    const occupiedByOther =
      Boolean(
        targetVehicleCd &&
        assignedVehicle &&
        clean(targetVehicleCd) !==
          assignedVehicle
      );

    node.assigned_vehicle =
      assignedVehicle || null;

    node.occupied_by_other =
      occupiedByOther;

    node.confirmed_actual =
      occupiedByOther;

    node.other_vehicle_actual =
      occupiedByOther;

    node.live_text =
      occupiedByOther
        ? `${assignedVehicle}号車が充当`
        : null;

    if (occupiedByOther) {
      // 他車が実際に取った枝は「確定実績」として残す。
      // その先については、同じ車両が本当に担当したtripだけを
      // 履歴ツリー上から拾って伸ばす。未確定の予測枝は一切載せない。
      node.children =
        decorateConfirmedVehiclePath(
          source.children,
          liveAssignments,
          assignedVehicle,
          targetVehicleCd,
          state
        );

      node.children_pruned =
        false;

      node.prune_reason =
        "confirmed_actual_only";
    } else {
      // 通常の予測枝は従来どおり。
      node.children =
        decorateHistoricalTree(
          source.children,
          liveAssignments,
          targetVehicleCd,
          state
        );
    }

    out.push(node);
  }

  return out;
}


function decorateConfirmedVehiclePath(
  nodes,
  liveAssignments,
  confirmedVehicleCd,
  targetVehicleCd,
  state
) {
  const out = [];

  for (const source of nodes || []) {
    if (state.nodeCount >= MAX_NODES) {
      state.truncated = true;
      break;
    }

    // 「運行終了」は当日のtargetsだけでは確定できないため、
    // 他車実績枝の先には載せない。
    if (
      source?.service_end ||
      source?.stopped
    ) {
      continue;
    }

    const tripId =
      clean(
        source?.trip_id
      );

    if (!tripId) {
      continue;
    }

    const assignedVehicle =
      clean(
        liveAssignments.get(
          tripId
        )
      );

    // この枝を担当した同じ車両の実績だけを連続実績として残す。
    // 別車・未取得・未確定の候補は予測として表示しない。
    if (
      !assignedVehicle ||
      assignedVehicle !==
        clean(confirmedVehicleCd)
    ) {
      continue;
    }

    state.nodeCount++;

    const node = {
      ...source,
      assigned_vehicle:
        assignedVehicle,
      occupied_by_other:
        Boolean(
          targetVehicleCd &&
          clean(targetVehicleCd) !==
            assignedVehicle
        ),
      confirmed_actual:
        true,
      other_vehicle_actual:
        true,
      live_text:
        `${assignedVehicle}号車が充当`,
      children_pruned:
        false,
      prune_reason:
        "confirmed_actual_only",
      children: []
    };

    node.children =
      decorateConfirmedVehiclePath(
        source.children,
        liveAssignments,
        confirmedVehicleCd,
        targetVehicleCd,
        state
      );

    out.push(node);
  }

  return out;
}


// ============================================================
// 予測ノード共通生成
// ============================================================

function makePredictionNode(
  option,
  parentCumulativeProbability,
  liveAssignments,
  targetVehicleCd
) {
  const probability =
    Number(option.probability) || 0;

  const cumulative =
    parentCumulativeProbability *
    (
      probability /
      100
    );

  const tripId =
    clean(option.next_trip_id);

  const assignedVehicle =
    clean(
      liveAssignments.get(tripId)
    );

  const occupiedByOther =
    Boolean(
      targetVehicleCd &&
      assignedVehicle &&
      clean(targetVehicleCd) !==
        assignedVehicle
    );

  return {
    trip_id:
      option.next_trip_id,

    route_name:
      option.route_name,

    from_stop:
      option.from_stop,

    from_time:
      option.from_time,

    to_stop:
      option.to_stop,

    to_time:
      option.to_time,

    timetable_type:
      option.timetable_type,

    count:
      Number(option.cnt),

    n:
      Number(option.n),

    probability:
      round1(probability),

    cumulative_probability:
      round1(cumulative),

    // 再帰計算専用
    cumulative_probability_raw:
      cumulative,

    assigned_vehicle:
      assignedVehicle || null,

    occupied_by_other:
      occupiedByOther,

    live_text:
      occupiedByOther
        ? `${assignedVehicle}号車が充当`
        : null
  };
}


// ============================================================
// 高速版用
// 候補trip_idだけ実充当を取得
// ============================================================

async function getAssignmentsForTrips(
  env,
  tripIds
) {
  const assignments =
    new Map();

  if (
    !env.LIVE_DB ||
    !Array.isArray(tripIds) ||
    tripIds.length === 0
  ) {
    return {
      serviceDate: null,
      assignments
    };
  }

  const dateRow =
    await env.LIVE_DB
      .prepare(`
        SELECT MAX(service_date) AS service_date
        FROM targets
        WHERE service_date IS NOT NULL
          AND service_date <> ''
      `)
      .first();

  const serviceDate =
    clean(
      dateRow?.service_date
    );

  if (!serviceDate) {
    return {
      serviceDate: null,
      assignments
    };
  }

  const uniqueTripIds =
    [...new Set(
      tripIds
        .map(clean)
        .filter(Boolean)
    )];

  if (!uniqueTripIds.length) {
    return {
      serviceDate,
      assignments
    };
  }

  const placeholders =
    uniqueTripIds
      .map(() => "?")
      .join(",");

  const result =
    await env.LIVE_DB
      .prepare(`
        SELECT
          trip_id,
          vehicle_cd,
          detected_at,
          id
        FROM targets
        WHERE service_date = ?
          AND trip_id IN (${placeholders})
          AND vehicle_cd IS NOT NULL
          AND vehicle_cd <> ''
        ORDER BY
          detected_at ASC,
          id ASC
      `)
      .bind(
        serviceDate,
        ...uniqueTripIds
      )
      .all();

  for (
    const row of
    result.results || []
  ) {
    const tripId =
      clean(row.trip_id);

    const vehicleCd =
      clean(row.vehicle_cd);

    if (
      !tripId ||
      !vehicleCd
    ) {
      continue;
    }

    assignments.set(
      tripId,
      vehicleCd
    );
  }

  return {
    serviceDate,
    assignments
  };
}


// ============================================================
// 実績経路の累積確率
//
// 今日の最初の取得実績を起点(100%)として、
// 同じダイヤ区分の過去運用で実際の経路がどこまで続いたかを計算。
// 累積5%未満まで実際に進んだ場合だけ rare_pattern=true。
// ============================================================

async function addActualHistoryProbabilities(
  env,
  actualHistory,
  timetableType
) {
  if (
    !Array.isArray(actualHistory) ||
    !actualHistory.length
  ) {
    return actualHistory || [];
  }

  const firstTripId =
    clean(
      actualHistory[0]?.trip_id
    );

  if (!firstTripId) {
    return actualHistory;
  }

  const firstInfo =
    await getTripInfo(
      env,
      firstTripId
    );

  const base =
    await getCachedHistoricalTreeBase(
      env,
      firstTripId,
      timetableType,
      firstInfo
    );

  const annotated =
    actualHistory.map(
      row => ({
        ...row,
        actual_cumulative_probability:
          null,
        actual_cumulative_count:
          null,
        actual_cumulative_n:
          null,
        rare_pattern:
          false
      })
    );

  // 起点は100%
  annotated[0]
    .actual_cumulative_probability =
      100;

  // 2便目以降は、起点からの予測ツリーを
  // 実際のtrip_id列に沿ってたどる。
  let level =
    Array.isArray(base?.tree)
      ? base.tree
      : [];

  for (
    let i = 1;
    i < annotated.length;
    i++
  ) {
    const tripId =
      clean(
        annotated[i]?.trip_id
      );

    const matched =
      level.find(
        node =>
          clean(node?.trip_id) ===
          tripId
      );

    if (!matched) {
      break;
    }

    const cumulative =
      Number(
        matched
          ?.cumulative_probability
      );

    const count =
      Number(
        matched
          ?.cumulative_count ??
        matched?.count
      );

    const n =
      Number(
        matched
          ?.cumulative_n
      );

    if (
      Number.isFinite(
        cumulative
      )
    ) {
      annotated[i]
        .actual_cumulative_probability =
          round1(cumulative);

      annotated[i]
        .rare_pattern =
          cumulative < 5;
    }

    if (
      Number.isFinite(count)
    ) {
      annotated[i]
        .actual_cumulative_count =
          count;
    }

    if (
      Number.isFinite(n)
    ) {
      annotated[i]
        .actual_cumulative_n =
          n;
    }

    level =
      Array.isArray(
        matched?.children
      )
        ? matched.children
        : [];
  }

  // 起点のnは、2便目があればその累積母数から取得。
  // 1便しか無い場合はn不明のままでよい。
  if (
    annotated.length > 1 &&
    Number.isFinite(
      Number(
        annotated[1]
          ?.actual_cumulative_n
      )
    )
  ) {
    const rootN =
      Number(
        annotated[1]
          .actual_cumulative_n
      );

    annotated[0]
      .actual_cumulative_count =
        rootN;

    annotated[0]
      .actual_cumulative_n =
        rootN;
  }

  return annotated;
}


// ============================================================
// 今日すでに終了した実運用
// ============================================================

async function getTodayActualHistory(
  env,
  vehicleCd,
  currentTripId,
  serviceDate
) {
  vehicleCd = clean(vehicleCd);
  currentTripId = clean(currentTripId);
  serviceDate = clean(serviceDate);

  if (
    !env.LIVE_DB ||
    !vehicleCd ||
    !currentTripId ||
    !serviceDate
  ) {
    return [];
  }

  const result = await env.LIVE_DB
    .prepare(`
      SELECT
        id,
        trip_id,
        vehicle_cd,
        route,
        route_name,
        destination,
        shihatsu_name,
        shihatsu_time,
        to_name,
        terminal_time,
        day,
        detected_at,
        status
      FROM targets
      WHERE service_date = ?
        AND vehicle_cd = ?
        AND trip_id IS NOT NULL
        AND trip_id <> ''
      ORDER BY
        CASE
          WHEN shihatsu_time IS NULL
            OR shihatsu_time = ''
          THEN 1
          ELSE 0
        END,
        shihatsu_time ASC,
        terminal_time ASC,
        detected_at ASC,
        id ASC
    `)
    .bind(
      serviceDate,
      vehicleCd
    )
    .all();

  const byTrip = new Map();

  for (const row of result.results || []) {
    const tripId = clean(row.trip_id);
    if (!tripId) continue;

    const prev = byTrip.get(tripId);

    if (
      !prev ||
      clean(row.detected_at) >= clean(prev.detected_at)
    ) {
      byTrip.set(tripId, row);
    }
  }

  const rows = [...byTrip.values()];

  rows.sort((a, b) => {
    const ta = predictionTimeSortNumber(a.shihatsu_time);
    const tb = predictionTimeSortNumber(b.shihatsu_time);

    if (ta !== tb) {
      return ta - tb;
    }

    const ea = predictionTimeSortNumber(a.terminal_time);
    const eb = predictionTimeSortNumber(b.terminal_time);

    if (ea !== eb) {
      return ea - eb;
    }

    return clean(a.detected_at)
      .localeCompare(clean(b.detected_at));
  });

  const currentIndex = rows.findIndex(
    row => clean(row.trip_id) === currentTripId
  );

  if (currentIndex < 0) {
    return [];
  }

  return rows
    .slice(0, currentIndex)
    .map((row, index) => ({
      actual: true,
      index: index + 1,
      trip_id: clean(row.trip_id),
      route_name:
        clean(row.route_name) || clean(row.route),
      from_stop: clean(row.shihatsu_name),
      from_time: clean(row.shihatsu_time),
      to_stop:
        clean(row.to_name) || clean(row.destination),
      to_time: clean(row.terminal_time),
      timetable_type: clean(row.day),
      status: clean(row.status)
    }));
}


function predictionTimeSortNumber(value) {
  const s = clean(value);
  const m = s.match(
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!m) {
    return Number.MAX_SAFE_INTEGER;
  }

  return (
    Number(m[1]) * 3600 +
    Number(m[2]) * 60 +
    Number(m[3] || 0)
  );
}


// ============================================================
// 詳細ツリー用
// 当日の全実充当を1回だけ取得
// ============================================================

async function getLiveAssignments(env) {
  const assignments =
    new Map();

  if (!env.LIVE_DB) {
    return {
      serviceDate: null,
      assignments
    };
  }

  const dateRow =
    await env.LIVE_DB
      .prepare(`
        SELECT MAX(service_date) AS service_date
        FROM targets
        WHERE service_date IS NOT NULL
          AND service_date <> ''
      `)
      .first();

  const serviceDate =
    clean(
      dateRow?.service_date
    );

  if (!serviceDate) {
    return {
      serviceDate: null,
      assignments
    };
  }

  const result =
    await env.LIVE_DB
      .prepare(`
        SELECT
          trip_id,
          vehicle_cd,
          detected_at,
          id
        FROM targets
        WHERE service_date = ?
          AND trip_id IS NOT NULL
          AND trip_id <> ''
          AND vehicle_cd IS NOT NULL
          AND vehicle_cd <> ''
        ORDER BY
          detected_at ASC,
          id ASC
      `)
      .bind(serviceDate)
      .all();

  for (
    const row of
    result.results || []
  ) {
    const tripId =
      clean(row.trip_id);

    const vehicleCd =
      clean(row.vehicle_cd);

    if (
      !tripId ||
      !vehicleCd
    ) {
      continue;
    }

    assignments.set(
      tripId,
      vehicleCd
    );
  }

  return {
    serviceDate,
    assignments
  };
}


// ============================================================
// 「ここまでの運用経路」と完全一致した実績だけから
// 次便候補を集計
// ============================================================

async function getNextOptions(
  env,
  path,
  timetableType
) {
  const aliases =
    path.map(
      (_, i) => `o${i}`
    );

  let joins = "";

  for (
    let i = 1;
    i < path.length;
    i++
  ) {
    joins += `
      JOIN ordered ${aliases[i]}
        ON ${aliases[i]}.yyyymmdd
             = ${aliases[0]}.yyyymmdd
       AND ${aliases[i]}.label
             = ${aliases[0]}.label
       AND ${aliases[i]}.rn
             = ${aliases[0]}.rn + ${i}
    `;
  }

  const whereParts = [];

  for (
    let i = 0;
    i < path.length;
    i++
  ) {
    whereParts.push(
      `${aliases[i]}.trip_id = ?`
    );
  }

  const nextOffset =
    path.length;

  const sql = `
    WITH ordered AS (
      SELECT
        yyyymmdd,
        label,
        trip_id,
        route_name,
        from_stop,
        from_time,
        to_stop,
        to_time,
        timetable_type,

        ROW_NUMBER() OVER (
          PARTITION BY
            yyyymmdd,
            label
          ORDER BY
            from_time,
            trip_id
        ) AS rn

      FROM operation_history

      WHERE timetable_type = ?
    ),

    matched AS (
      SELECT
        ${aliases[0]}.yyyymmdd
          AS yyyymmdd,

        ${aliases[0]}.label
          AS label,

        ${aliases[0]}.rn
          AS start_rn

      FROM ordered ${aliases[0]}

      ${joins}

      WHERE
        ${whereParts.join(
          "\n        AND "
        )}
    ),

    counts AS (
      SELECT
        next_trip.trip_id
          AS next_trip_id,

        MAX(
          next_trip.route_name
        )
          AS route_name,

        MAX(
          next_trip.from_stop
        )
          AS from_stop,

        MAX(
          next_trip.from_time
        )
          AS from_time,

        MAX(
          next_trip.to_stop
        )
          AS to_stop,

        MAX(
          next_trip.to_time
        )
          AS to_time,

        MAX(
          next_trip.timetable_type
        )
          AS timetable_type,

        COUNT(*) AS cnt

      FROM matched m

      LEFT JOIN ordered next_trip
        ON next_trip.yyyymmdd
             = m.yyyymmdd
       AND next_trip.label
             = m.label
       AND next_trip.rn
             = m.start_rn + ${nextOffset}

      GROUP BY
        next_trip.trip_id
    )

    SELECT
      next_trip_id,
      route_name,
      from_stop,
      from_time,
      to_stop,
      to_time,
      timetable_type,
      cnt,

      SUM(cnt) OVER ()
        AS n,

      ROUND(
        cnt * 100.0
        /
        SUM(cnt) OVER (),
        3
      )
        AS probability

    FROM counts

    ORDER BY
      cnt DESC,
      next_trip_id
  `;

  const result =
    await env.HISTORY_DB
      .prepare(sql)
      .bind(
        timetableType,
        ...path
      )
      .all();

  return result.results ?? [];
}


// ============================================================
// trip_idの表示情報取得
// ============================================================

async function getTripInfo(
  env,
  tripId
) {
  return await env.HISTORY_DB
    .prepare(`
      SELECT
        route_name,
        from_stop,
        from_time,
        to_stop,
        to_time,
        timetable_type

      FROM operation_history

      WHERE trip_id = ?

      ORDER BY
        yyyymmdd DESC

      LIMIT 1
    `)
    .bind(tripId)
    .first();
}


// ============================================================
// 共通
// ============================================================

function clean(value) {
  return String(
    value ?? ""
  ).trim();
}


function round1(value) {
  return Math.round(
    Number(value) * 10
  ) / 10;
}


function json(
  data,
  status = 200
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type":
          "application/json; charset=utf-8"
      }
    }
  );
}
