const nextConfig = {
  transpilePackages: ["@mesa/shared"],
  // Las páginas reciben sus cabeceras de seguridad en proxy.js; la API no
  // pasa por ahí, así que esta se le pone aquí.
  async headers() {
    return [{ source: "/api/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }] }];
  },
};
export default nextConfig;
