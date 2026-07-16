import React from "react";
import ReactDOM from "react-dom/client";
import { GlobalContextProviders } from "./components/_globalContextProviders";
import IndexPage from "./pages/_index";
import layouts from "./pages/_index.pageLayout";

// Self-hosted Outfit font, then global styles (design tokens + base reset).
import "./fonts.css";
import "./global.css";

// Wrap the page in its layout stack (Floot page-layout convention).
const withLayouts = (page: React.ReactNode): React.ReactNode =>
  layouts.reduceRight<React.ReactNode>(
    (children, Layout) => <Layout>{children}</Layout>,
    page,
  );

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error('Root element "#root" not found');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <GlobalContextProviders>{withLayouts(<IndexPage />)}</GlobalContextProviders>
  </React.StrictMode>,
);
