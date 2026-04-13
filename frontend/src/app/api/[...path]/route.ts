import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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

async function proxy(req: NextRequest, pathSegments: string[] | undefined) {
  const path = pathSegments?.length ? pathSegments.join('/') : '';
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
  } catch {
    return NextResponse.json(
      {
        message:
          'API indisponível. Na Vercel, defina a variável BACKEND_URL com a URL pública do backend (NestJS).',
      },
      { status: 503 }
    );
  }

  const out = new Headers(res.headers);
  for (const h of STRIP_RESPONSE_HEADERS) {
    out.delete(h);
  }

  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: out,
  });
}

type RouteCtx = { params: { path: string[] } };

export function GET(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, ctx.params.path);
}

export function HEAD(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, ctx.params.path);
}

export function POST(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, ctx.params.path);
}

export function PUT(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, ctx.params.path);
}

export function PATCH(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, ctx.params.path);
}

export function DELETE(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, ctx.params.path);
}

export function OPTIONS(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, ctx.params.path);
}
