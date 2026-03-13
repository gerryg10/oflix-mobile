<?php
/**
 * DONGHUA_API.PHP v4
 * - Multi-season: coba s1,s2,s3... per slug sampai gagal
 * - DEBUG: &debug=1
 */

error_reporting(0); ini_set('display_errors', 0); set_time_limit(0);
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$action = $_GET['action'] ?? '';
$page   = (int)($_GET['page']   ?? 1);
$q      = $_GET['q']      ?? '';
$slug   = $_GET['slug']   ?? '';
$epSlug = $_GET['epSlug'] ?? '';
$debug  = isset($_GET['debug']);

$BASE     = "https://www.sankavollerei.com/anime/donghua";
$cacheDir = 'cache_json/';
if (!is_dir($cacheDir)) mkdir($cacheDir, 0777, true);

function doFetch($url) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_ENCODING       => '',
        CURLOPT_HTTPHEADER     => [
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept: application/json, */*',
            'Referer: https://www.sankavollerei.com/',
        ],
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    return [$res, $code, $err];
}

function cachedFetch($key, $ttl, $fn) {
    global $cacheDir, $debug;
    $file = $cacheDir . 'donghua_' . md5($key) . '.json';
    if (!$debug && file_exists($file) && (time() - filemtime($file) < $ttl)) {
        $d = json_decode(file_get_contents($file), true);
        if ($d && !empty($d['success'])) {
            // Jangan pakai cache kalau items ada tapi kosong
            if (isset($d['items']) && empty($d['items'])) {
                @unlink($file);
            } else {
                return $d; // Cache valid
            }
        } else {
            @unlink($file); // Cache error/kosong
        }
    }
    $data = $fn();
    // Simpan cache kalau sukses (items boleh tidak ada untuk detail/episode)
    if ($data && !empty($data['success'])) {
        // Jangan cache kalau items kosong
        if (!isset($data['items']) || !empty($data['items'])) {
            file_put_contents($file, json_encode($data));
        }
    }
    return $data;
}

function normaliseItem($item) {
    if (!is_array($item)) return null;
    $title = $item['title'] ?? $item['name'] ?? '';
    if (empty($title)) return null;
    $poster = $item['poster'] ?? $item['thumbnail'] ?? $item['image'] ?? $item['cover'] ?? '';
    $href   = $item['href']   ?? $item['slug']      ?? $item['url']   ?? '';
    $sl = preg_replace('#^.*?/donghua/detail/#', '', $href);
    $sl = preg_replace('#^/+#', '', $sl);
    if (empty($sl) && isset($item['anichinUrl'])) {
        $sl = preg_replace('#^.*?/seri/#', '', rtrim($item['anichinUrl'], '/'));
    }
    if (empty($sl)) $sl = $href;
    return ['title' => $title, 'poster' => $poster, 'slug' => $sl, 'status' => $item['status'] ?? '', 'sub' => $item['sub'] ?? ''];
}

function extractList($json) {
    if (!is_array($json)) return [];
    foreach (['data','results','items','list','donghua','animes','latest','anime','posts'] as $k) {
        if (isset($json[$k]) && is_array($json[$k]) && isset($json[$k][0])) return $json[$k];
    }
    if (isset($json[0]) && is_array($json[0])) return $json;
    foreach ($json as $v) {
        if (is_array($v) && isset($v[0]) && is_array($v[0]) && isset($v[0]['title'])) return $v;
    }
    return [];
}

// ── Parse satu detail JSON, return array season info ─────────────────────────
// JSON bisa punya 1 season atau 2 season sekaligus
function parseDetailJson($res, $slugUsed) {
    $json = @json_decode($res, true);
    if (!$json) return null;
    $root = $json['data'] ?? $json;

    // Ambil episodes
    $epRaw = $root['episodes_list'] ?? $root['episodes'] ?? $root['episode_list'] ?? [];
    if (empty($epRaw)) return null;

    $episodes = [];
    foreach ((array)$epRaw as $ep) {
        $epSl = $ep['slug'] ?? '';
        if (empty($epSl)) {
            $href = $ep['href'] ?? '';
            $epSl = preg_replace('#^.*?/donghua/episode/#', '', $href);
            $epSl = preg_replace('#^/+#', '', $epSl);
        }
        $episodes[] = [
            'title' => $ep['episode'] ?? $ep['title'] ?? $ep['name'] ?? '',
            'slug'  => $epSl,
            'href'  => $ep['href'] ?? '',
        ];
    }
    $episodes = array_reverse($episodes);

    // Deteksi apakah JSON ini punya info season eksplisit
    $seasonLabel = $root['season'] ?? $root['season_number'] ?? null;
    $title       = $root['title'] ?? $root['name'] ?? '';
    $poster      = $root['poster'] ?? $root['thumbnail'] ?? $root['image'] ?? '';
    $synopsis    = $root['synopsis'] ?? $root['description'] ?? $root['sinopsis'] ?? '';

    return [
        'slug'     => $slugUsed,
        'title'    => $title,
        'poster'   => $poster,
        'synopsis' => $synopsis,
        'season'   => $seasonLabel,
        'episodes' => $episodes,
    ];
}

// ════════════════════════════════════════════════════
// LATEST
// ════════════════════════════════════════════════════
if ($action === 'latest') {
    $url  = "$BASE/latest/$page";
    $data = cachedFetch("latest_$page", 1800, function() use ($url, $debug) {
        [$res, $code, $err] = doFetch($url);
        if ($debug) {
            $json = @json_decode($res, true);
            return ['success'=>false,'_debug'=>true,'url'=>$url,'http_code'=>$code,
                    'json_keys'=>$json?array_keys($json):'bad json','raw_preview'=>mb_substr($res,0,3000)];
        }
        if (!$res || $code !== 200) return ['success'=>false,'error'=>"HTTP $code | $err",'url'=>$url];
        $json = @json_decode($res, true);
        if (!$json) return ['success'=>false,'error'=>'Bad JSON: '.json_last_error_msg(),'raw'=>substr($res,0,300)];
        $list  = extractList($json);
        $items = array_values(array_filter(array_map('normaliseItem', $list)));
        if (empty($items)) return ['success'=>false,'error'=>'Items empty. Add &debug=1','json_keys'=>array_keys($json),'raw'=>mb_substr($res,0,500)];
        return ['success'=>true,'items'=>$items,'source'=>'donghua'];
    });
    echo json_encode($data, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE);
    exit;
}

// ════════════════════════════════════════════════════
// DETAIL — multi-season logic
// Contoh: swallowed-star → season 1
//         swallowed-star-season-2 → season 2+3
//         swallowed-star-season-4 → season 4
// Kita coba slug asli dulu, lalu slug-season-2, slug-season-3, dst sampai 404/kosong
// ════════════════════════════════════════════════════
if ($action === 'detail' && $slug) {
    $data = cachedFetch("detail4_$slug", 3600, function() use ($slug, $debug, $BASE) {

        // --- Kumpulkan semua season dari slug utama (dari kartu/latest) ---
        // slug dari latest biasanya sudah langsung ke season tertentu
        // misal "swallowed-star-season-4"
        // Kita perlu tahu "base slug" untuk cari semua season
        
        // Coba fetch slug yang diberikan dulu
        [$res, $code, $err] = doFetch("$BASE/detail/$slug");

        if ($debug) {
            $json = @json_decode($res, true);
            return ['success'=>false,'_debug'=>true,'url'=>"$BASE/detail/$slug",
                    'http_code'=>$code,'json_keys'=>$json?array_keys($json):null,'raw_preview'=>mb_substr($res,0,3000)];
        }

        if (!$res || $code !== 200) return ['success'=>false,'error'=>"HTTP $code",'slug'=>$slug];
        $json = @json_decode($res, true);
        if (!$json) return ['success'=>false,'error'=>'Bad JSON'];

        $root = $json['data'] ?? $json;
        $mainTitle   = $root['title']    ?? $root['name']      ?? '';
        $mainPoster  = $root['poster']   ?? $root['thumbnail'] ?? $root['image'] ?? '';
        $mainSynopsis = $root['synopsis'] ?? $root['description'] ?? $root['sinopsis'] ?? '';
        $episodesCount = $root['episodes_count'] ?? '';

        // Parse season pertama dari slug ini
        $firstSeason = parseDetailJson($res, $slug);

        // Tentukan base slug (hapus -season-N di akhir)
        $baseSlug = preg_replace('/-season-\d+$/', '', $slug);

        // Kumpulkan semua season
        $allSeasons = [];

        // Kalau slug ini sudah punya episodes, masukkan sebagai season
        if ($firstSeason && !empty($firstSeason['episodes'])) {
            // Tentukan nomor season dari slug atau dari data
            $sNum = 1;
            if (preg_match('/-season-(\d+)$/', $slug, $m)) $sNum = (int)$m[1];
            $firstSeason['season_num'] = $sNum;
            $allSeasons[] = $firstSeason;
        }

        // Kalau slug tidak ada -season-N, ini season 1 → cari season 2, 3, 4...
        // Kalau slug ada -season-N, kita perlu juga cari yang lain
        // Strategi: cari dari season 1 sampai dapat 404 berturut-turut 2x

        // Kumpulkan nomor season yang sudah kita punya
        $gotNums = array_column($allSeasons, 'season_num');

        // Coba slug-season-2 hingga slug-season-10 (stop kalau 2x gagal berturut)
        $failStreak = 0;
        for ($sn = 2; $sn <= 15; $sn++) {
            if (in_array($sn, $gotNums)) continue;
            $trySlug = "$baseSlug-season-$sn";
            if ($trySlug === $slug) continue; // sudah di-fetch
            [$r2, $c2] = doFetch("$BASE/detail/$trySlug");
            if (!$r2 || $c2 !== 200) {
                $failStreak++;
                if ($failStreak >= 2) break;
                continue;
            }
            $parsed = parseDetailJson($r2, $trySlug);
            if (!$parsed || empty($parsed['episodes'])) {
                $failStreak++;
                if ($failStreak >= 2) break;
                continue;
            }
            $failStreak = 0;
            $parsed['season_num'] = $sn;
            $allSeasons[] = $parsed;
        }

        // Juga cek slug-season-1 jika slug tidak punya -season-N
        if (!preg_match('/-season-\d+$/', $slug)) {
            // slug ini adalah season 1, tapi pastikan season_num = 1
            if (!empty($allSeasons) && $allSeasons[0]['season_num'] != 1) {
                $allSeasons[0]['season_num'] = 1;
            }
        } else {
            // Ada kemungkinan season 1 pakai slug tanpa -season-1
            if (!in_array(1, array_column($allSeasons, 'season_num'))) {
                [$r1, $c1] = doFetch("$BASE/detail/$baseSlug");
                if ($r1 && $c1 === 200) {
                    $p1 = parseDetailJson($r1, $baseSlug);
                    if ($p1 && !empty($p1['episodes'])) {
                        $p1['season_num'] = 1;
                        array_unshift($allSeasons, $p1);
                    }
                }
            }
        }

        // Sort by season_num
        usort($allSeasons, fn($a,$b) => ($a['season_num']??0) - ($b['season_num']??0));

        if (empty($allSeasons)) {
            return ['success'=>false,'error'=>'No episodes found in any season','slug'=>$slug];
        }

        // Format seasons untuk frontend (mirip format FoodCash)
        $seasons = array_map(function($s) {
            return [
                'season'   => $s['season_num'],
                'slug'     => $s['slug'],
                'episodes' => $s['episodes'],
            ];
        }, $allSeasons);

        return [
            'success'  => true,
            'source'   => 'donghua',
            'slug'     => $slug,
            'title'    => $mainTitle,
            'poster'   => $mainPoster,
            'synopsis' => $mainSynopsis,
            'seasons'  => $seasons,
            // Semua episode flat (season 1) untuk backward compat
            'episodes' => $allSeasons[0]['episodes'] ?? [],
        ];
    });
    echo json_encode($data, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE);
    exit;
}

// ════════════════════════════════════════════════════
// EPISODE — ambil URL stream, proxy kalau bisa
// ════════════════════════════════════════════════════
if ($action === 'episode' && $epSlug) {
    $cl   = preg_replace('#^/+|^donghua/episode/#', '', $epSlug);
    $url  = "$BASE/episode/$cl";
    $data = cachedFetch("ep_$cl", 1800, function() use ($url, $debug) {
        [$res, $code, $err] = doFetch($url);
        if ($debug) {
            $json = @json_decode($res, true);
            return ['success'=>false,'_debug'=>true,'url'=>$url,'http_code'=>$code,
                    'json_keys'=>$json?array_keys($json):null,'raw_preview'=>mb_substr($res,0,3000)];
        }
        if (!$res || $code !== 200) return ['success'=>false,'error'=>"HTTP $code"];
        $json = @json_decode($res, true);
        if (!$json) return ['success'=>false,'error'=>'Bad JSON'];

        $root = $json['data'] ?? $json;
        $streamUrl = ''; $streamName = ''; $allStreams = [];

        if (isset($root['streaming'])) {
            foreach ($root['streaming'] as $k => $s) {
                if (!empty($s['url'])) $allStreams[] = ['name'=>$s['name']??$k,'url'=>$s['url']];
            }
            // Prioritas: non-Dailymotion, non-ok.ru dulu (lebih bisa diproxy)
            foreach ($allStreams as $s) {
                $u = $s['url'];
                if (stripos($u,'dailymotion')===false && stripos($u,'ok.ru')===false) {
                    $streamUrl = $u; $streamName = $s['name']; break;
                }
            }
            // Fallback: ok.ru
            if (empty($streamUrl)) {
                foreach ($allStreams as $s) {
                    if (stripos($s['url'],'ok.ru')!==false) { $streamUrl=$s['url']; $streamName=$s['name']; break; }
                }
            }
            // Fallback: Dailymotion
            if (empty($streamUrl) && !empty($allStreams)) {
                $streamUrl = $allStreams[0]['url']; $streamName = $allStreams[0]['name'];
            }
        }

        // Tentukan tipe embed
        $embedType = 'direct';
        if (stripos($streamUrl,'dailymotion')!==false) $embedType = 'iframe';
        elseif (stripos($streamUrl,'ok.ru')!==false) $embedType = 'okru';

        return [
            'success'    => true,
            'source'     => 'donghua',
            'url'        => $streamUrl,
            'embedType'  => $embedType,
            'name'       => $streamName,
            'allStreams' => $allStreams,
            'title'      => $root['title'] ?? '',
        ];
    });
    echo json_encode($data, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE);
    exit;
}

// ════════════════════════════════════════════════════
// SEARCH
// ════════════════════════════════════════════════════
if ($action === 'search' && $q) {
    $url  = "$BASE/search/".urlencode($q)."/$page";
    $data = cachedFetch("search_{$q}_{$page}", 600, function() use ($url) {
        [$res, $code] = doFetch($url);
        if (!$res || $code !== 200) return ['success'=>false,'items'=>[]];
        $json = @json_decode($res, true);
        if (!$json) return ['success'=>false,'items'=>[]];
        $list  = extractList($json);
        $items = array_values(array_filter(array_map('normaliseItem', $list)));
        return ['success'=>true,'items'=>$items,'source'=>'donghua'];
    });
    echo json_encode($data, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(['success'=>false,'error'=>'Unknown action','action'=>$action,'tip'=>'Add &debug=1'], JSON_PRETTY_PRINT);
