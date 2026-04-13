/**
 * Teste de carga simples contra a API (health check).
 * Uso: node scripts/load-test.mjs [baseUrl] [total] [concorrência]
 * Ex.: node scripts/load-test.mjs http://localhost:3001 200 10
 *
 * Ajuste RATE_LIMIT_LIMIT e RATE_LIMIT_TTL_MS no .env conforme o resultado
 * (ex.: se muitas requisições retornarem 429, aumente o limit ou o TTL).
 */

const baseUrl = process.argv[2] || 'http://localhost:3001';
const total = parseInt(process.argv[3] || '100', 10);
const concurrency = parseInt(process.argv[4] || '10', 10);
const path = '/api/health';

async function runOne() {
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}${path}`);
    const ms = Date.now() - start;
    return { status: res.status, ms };
  } catch (err) {
    return { status: 0, ms: Date.now() - start, error: err.message };
  }
}

async function runBatch(n) {
  const promises = Array.from({ length: n }, () => runOne());
  return Promise.all(promises);
}

async function main() {
  console.log(`Teste de carga: ${baseUrl}${path}`);
  console.log(`Total: ${total} requisições, concorrência: ${concurrency}\n`);

  const results = [];
  let done = 0;
  while (done < total) {
    const batchSize = Math.min(concurrency, total - done);
    const batch = await runBatch(batchSize);
    results.push(...batch);
    done += batchSize;
    process.stdout.write(`\r${done}/${total}`);
  }
  console.log('\n');

  const ok = results.filter((r) => r.status === 200).length;
  const rateLimited = results.filter((r) => r.status === 429).length;
  const errors = results.filter((r) => r.status !== 200 && r.status !== 429);
  const times = results.filter((r) => r.status === 200).map((r) => r.ms);
  const avgMs = times.length ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(0) : '-';
  const minMs = times.length ? Math.min(...times) : '-';
  const maxMs = times.length ? Math.max(...times) : '-';

  console.log('Resultado:');
  console.log(`  200 OK: ${ok}`);
  console.log(`  429 (rate limit): ${rateLimited}`);
  if (errors.length) console.log(`  Outros/erro: ${errors.length}`);
  console.log(`  Latência (ms) — média: ${avgMs}, min: ${minMs}, max: ${maxMs}`);

  if (rateLimited > 0) {
    console.log('\n  Dica: aumente RATE_LIMIT_LIMIT ou RATE_LIMIT_TTL_MS no .env e reinicie o backend.');
  }
}

main().catch(console.error);
