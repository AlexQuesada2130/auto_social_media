import "./globals.css";

export const metadata = {
  title: "Mesa de Redacción",
  description: "Cola de propuestas de post para LinkedIn.",
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

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
