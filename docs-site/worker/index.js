const withRequestOrigin = async (request, response) => {
  if (request.method === "HEAD" || !response.headers.get("content-type")?.includes("text/html")) {
    return response;
  }

  const origin = new URL(request.url).origin;
  const body = (await response.text()).replaceAll("__ARCHNOTES_ORIGIN__", origin);
  return new Response(body, response);
};

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");

    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) {
      return withRequestOrigin(request, response);
    }

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    const fallback = await env.ASSETS.fetch(new Request(indexUrl, request));
    return withRequestOrigin(request, fallback);
  },
};
