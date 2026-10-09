import "./globals.css";

export const metadata = {
  title: "Mesa de Redacción",
  description: "Cola de propuestas de post para LinkedIn.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#b4472b",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
