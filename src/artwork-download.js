const decode = base64 => Uint8Array.from(atob(base64), char => char.charCodeAt(0));

export function artworkDownloadResponse(request, parts, assets) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const path = new URL(request.url).pathname;
  if (!Object.hasOwn(parts, path)) return null;
  const part = parts[path];
  if (!assets) return new Response('Artwork downloads are temporarily unavailable.', { status: 503 });
  const headers = {
    'Content-Type': 'application/zip',
    'Content-Length': String(part.size),
    'Content-Disposition': `attachment; filename="${path.slice(1)}"`,
    'Cache-Control': 'public, max-age=3600',
    'ETag': `"${part.digest}"`
  };
  if (request.headers.get('If-None-Match') === headers.ETag) {
    return new Response(null, { status: 304, headers });
  }
  if (request.method === 'HEAD') return new Response(null, { headers });
  // Read a single painting at a time. Pull-based streaming respects
  // backpressure and avoids buffering the complete part in the isolate.
  let index = 0;
  const body = new ReadableStream({
    async pull(controller) {
      if (index === part.members.length) {
        controller.enqueue(decode(part.directory));
        controller.close();
        return;
      }
      const member = part.members[index++];
      const response = await assets.fetch(new URL(member.image, request.url));
      if (!response.ok) throw new Error('Missing artwork: ' + member.image);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length !== member.size) throw new Error('Unexpected artwork size: ' + member.image);
      controller.enqueue(decode(member.header));
      controller.enqueue(bytes);
    }
  });
  return new Response(body, { headers });
}
