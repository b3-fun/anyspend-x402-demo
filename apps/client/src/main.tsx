import React from "react";
import ReactDOM from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import { config } from "./wagmi.config";
import { SolanaWalletProvider } from "./SolanaWalletProvider";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <SolanaWalletProvider>
          <App />
        </SolanaWalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
