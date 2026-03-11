<?php
/**
 * KOMIK_API.PHP - Komiku Proxy + Cache
 * Pola sama dengan cache_api.php (FoodCash)
 *
 * Usage:
 *   komik_api.php?action=populer&page=1
 *   komik_api.php?action=search&q=naruto
 *   komik_api.php?action=detail&detailManga=boruto-two-blue-vortex
 *   komik_api.php?action=baca&bacaManga=boruto-two-blue-vortex-chapter-01
 */

error_reporting(0);
ini_set('display_errors', 0);

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ── Ganti ini dengan URL ngrok / IP lokal Python kamu ─────────────────────────
define('PYTHON_API', 'https://unstrained-commandingly-arya.ngrok-free.dev/api');

// TTL cache per action (detik)
$TTL = [
    'populer' => 3600,    // 1 jam
    'search'  => 1800,    // 30 menit
    'detail'  => 7200,    // 2 jam
    'baca'    => 86400,   // 1 hari
];

// Ambil semua parameter
$params = $_GET;

if (empty($params) || empty($params['action'])) {
    die(json_encode(['status' => 'error', 'message' => 'Parameter action wajib diisi']));
}

$action = $params['action'];
$ttl    = $TTL[$action] ?? 3600;

// ── Cache folder ──────────────────────────────────────────────────────────────
$cacheDir = '/tmp/cache_komik/';
if (!is_dir($cacheDir)) mkdir($cacheDir, 0777, true);

// Cache key dari semua param
$cacheKey  = md5(json_encode($params));
$cacheFile = $cacheDir . $cacheKey . '.json';

// ── Serve dari cache jika masih fresh ─────────────────────────────────────────
if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < $ttl)) {
    echo file_get_contents($cacheFile);
    exit;
}

// ── Fetch dari Python API ─────────────────────────────────────────────────────
$url = PYTHON_API . '?' . http_build_query($params);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'User-Agent: Mozilla/5.0',
    'Accept: application/json',
    'ngrok-skip-browser-warning: true',  // bypass halaman warning ngrok
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

// ── Jika gagal fetch ──────────────────────────────────────────────────────────
if (!$response || $curlErr) {
    // Kalau ada cache lama, pakai itu (stale)
    if (file_exists($cacheFile)) {
        echo file_get_contents($cacheFile);
        exit;
    }
    die(json_encode([
        'status'  => 'error',
        'message' => 'Gagal connect ke Python API: ' . $curlErr,
        'tip'     => 'Pastikan python api.py berjalan & ngrok aktif',
    ]));
}

// ── Cek response bukan HTML (ngrok expired → balik <!DOCTYPE) ─────────────────
if ($httpCode !== 200 || ltrim($response)[0] === '<') {
    // Serve stale cache kalau ada
    if (file_exists($cacheFile)) {
        echo file_get_contents($cacheFile);
        exit;
    }
    die(json_encode([
        'status'  => 'error',
        'message' => 'Python API tidak aktif atau ngrok expired (HTTP ' . $httpCode . ')',
        'tip'     => 'Jalankan ulang: python api.py lalu ngrok http 5000, update PYTHON_API di komik_api.php',
    ]));
}

// ── Simpan ke cache & return ──────────────────────────────────────────────────
file_put_contents($cacheFile, $response);
echo $response;
?>
