import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function backendBase(): string {
  return (process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
}

/** Cabeçalhos que não devem ser reenviados ao upstream (fetch recalcula Content-Length com o body). */
const SKIP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'keep-alive',
  'te',
  'trailer',
]);

/** Cabeçalhos da resposta do Nest que quebram o cliente se o body já veio descomprimido pelo fetch. */
const STRIP_RESPONSE_HEADERS = [
  'content-encoding',
  'transfer-encoding',
  'connection',
  'content-length',
];

function pathFromCtx(params: { path?: string[] } | undefined): string[] {
  const p = params?.path;
  return Array.isArray(p) ? p : [];
}

async function proxy(req: NextRequest, pathSegments: string[]) {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  const upstreamUrl = `${backendBase()}/api/${path}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (SKIP_REQUEST_HEADERS.has(k)) return;
    headers.set(key, value);
  });

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: 'manual',
  };

  if (!['GET', 'HEAD'].includes(req.method)) {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 0) init.body = buf;
  }

  let res: Response;
  try {
    res = await fetch(upstreamUrl, init);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        message:
          'API indisponível. Na Vercel, defina BACKEND_URL com a URL pública do backend (NestJS na Render).',
        detail: process.env.NODE_ENV === 'development' ? detail : undefined,
      },
      { status: 503 }
    );
  }

  const out = new Headers(res.headers);
  for (const h of STRIP_RESPONSE_HEADERS) {
    out.delete(h);
  }

  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const bufferResponse =
    ct.includes('application/json') ||
    ct.startsWith('text/') ||
    res.status >= 400 ||
    req.method === 'HEAD';

  try {
    if (bufferResponse) {
      if (req.method === 'HEAD') {
        return new NextResponse(null, { status: res.status, statusText: res.statusText, headers: out });
      }
      const body = await res.text();
      return new NextResponse(body, { status: res.status, statusText: res.statusText, headers: out });
    }
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, { status: res.status, statusText: res.statusText, headers: out });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao ler resposta do backend';
    return NextResponse.json({ message: 'Falha no proxy da API.', detail: msg }, { status: 502 });
  }
}

type RouteCtx = { params: { path?: string[] } };

async function handle(req: NextRequest, ctx: RouteCtx) {
  try {
    return await proxy(req, pathFromCtx(ctx.params));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: 'Erro interno no proxy.', detail: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  return handle(req, ctx);
}

export async function HEAD(req: NextRequest, ctx: RouteCtx) {
  return handle(req, ctx);
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  return handle(req, ctx);
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  return handle(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  return handle(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  return handle(req, ctx);
}

export async function OPTIONS(req: NextRequest, ctx: RouteCtx) {
  return handle(req, ctx);
}
