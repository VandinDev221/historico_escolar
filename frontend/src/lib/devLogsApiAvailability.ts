/**
 * UI de /dev/logs só deve chamar /api/dev/* quando o bundle é `next dev`
 * ou quando se opta explicitamente (ex.: `next start` local contra API com rotas de dev).
 * Em deploy na Vercel (build de produção) isso evita 403 repetidos no console.
 */
export const isDevLogsApiEnabled =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_DEV_API_ENABLED === 'true';
