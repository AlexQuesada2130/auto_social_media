import { connection } from "next/server";
import "./globals.css";
import Candado from "./candado";

export const metadata = {
  title: "Mesa",
  description: "Panel personal: LinkedIn y dinero.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Mesa",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icono-192.png",
    apple: "/icono-192.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f3f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0810" },
  ],
};

export default async function RootLayout({ children }) {
  // La CSP lleva un nonce distinto en cada petición (ver proxy.js), y Next solo
  // puede ponerlo en sus scripts si la página se genera al pedirla.
  await connection();
  return (
    <html lang="es">
      <body><Candado>{children}</Candado></body>
    </html>
  );
}
