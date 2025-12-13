/**
 * Komari WebSocket 测试脚本 v3
 * 测试 /api/nodes 端点
 */

import WebSocket from 'ws';

const KOMARI_URL = process.argv[2] || 'https://km.bcbc.pp.ua';

const ENDPOINTS = [
    '/api/nodes',
    '/api/clients',
];

let currentEndpointIndex = 0;

function testWebSocket(endpoint) {
    let wsUrl = KOMARI_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const protocol = KOMARI_URL.startsWith('https') ? 'wss' : 'ws';
    const fullUrl = `${protocol}://${wsUrl}${endpoint}`;

    console.log(`\n📡 尝试 WebSocket 连接: ${fullUrl}`);

    const ws = new WebSocket(fullUrl, {
        headers: { 'User-Agent': 'KomariMonitor/1.0' }
    });

    let connected = false;

    ws.on('open', () => {
        connected = true;
        console.log('✅ WebSocket 连接成功！');
        console.log('📤 发送 "get" 命令...');
        ws.send('get');
    });

    ws.on('message', (data) => {
        console.log('\n📦 收到数据:');
        try {
            const json = JSON.parse(data.toString());
            let servers = Array.isArray(json) ? json : (json.data || json.nodes || []);

            if (servers.length > 0) {
                console.log(`✅ 检测到 ${servers.length} 台服务器\n`);
                const now = Date.now();
                servers.slice(0, 5).forEach((s, i) => {
                    const name = s.name || 'Unknown';
                    const updatedAt = s.updated_at;
                    let status = '未知';
                    if (updatedAt) {
                        const diff = Math.floor((now - new Date(updatedAt).getTime()) / 60000);
                        status = diff < 5 ? `🟢 在线 (${diff}分钟)` : `🔴 离线 (${diff}分钟)`;
                    }
                    console.log(`  ${i + 1}. ${s.region || ''}${name} - ${status}`);
                });
                if (servers.length > 5) console.log(`  ... 还有 ${servers.length - 5} 台`);

                console.log('\n✅ WebSocket 实时推送可用！');
            }
        } catch (e) {
            console.log(data.toString().substring(0, 300));
        }

        setTimeout(() => { ws.close(); process.exit(0); }, 1000);
    });

    ws.on('error', (error) => {
        console.log(`❌ 错误: ${error.message}`);
    });

    ws.on('close', (code) => {
        if (!connected && ++currentEndpointIndex < ENDPOINTS.length) {
            testWebSocket(ENDPOINTS[currentEndpointIndex]);
        } else if (!connected) {
            console.log('\n❌ WebSocket 不可用，将使用 HTTP 轮询优化方案');
            process.exit(1);
        }
    });

    setTimeout(() => { if (!connected) ws.terminate(); }, 5000);
}

console.log('🔌 Komari WebSocket 测试 v3');
console.log('='.repeat(50));
testWebSocket(ENDPOINTS[0]);
