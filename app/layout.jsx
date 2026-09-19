import "./globals.css";

export const metadata = {
  title: "SG Bus Timing",
  description: "Live Singapore bus arrival timings, powered by LTA DataMall.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
