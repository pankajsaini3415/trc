import React, { useState, useEffect } from "react";
import { SignClient } from "@walletconnect/sign-client";
import { Web3Modal } from "@web3modal/standalone";

// Your WalletConnect projectId (replace with yours)
const PROJECT_ID = "a2cd3f6f2c8dde8024ed901de2d36bc1";

// Securetron‐style chain and methods
const CHAIN_ID = "tron:0x2b6653dc"; // Tron Mainnet
const METHODS = ["tron_signTransaction", "tron_signMessage"];

export default function TrustWalletTronDemo() {
  const [client, setClient]       = useState(null);
  const [session, setSession]     = useState(null);
  const [address, setAddress]     = useState("");
  const [logs, setLogs]           = useState([]);
  const [connected, setConnected] = useState(false);

  // Web3Modal instance
  const web3Modal = new Web3Modal({
    projectId: PROJECT_ID,
    walletConnectVersion: 2,
  });

  // Simple logger
  const log = (msg) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} ${msg}`]);
  };

  // Initialize SignClient singleton
  const initClient = async () => {
    if (!client) {
      const sc = await SignClient.init({
        projectId: PROJECT_ID,
        metadata: {
          name:        "Tron in Trust Wallet",
          description: "Demo using Securetron method",
          url:         window.location.origin,
          icons:       [],
        },
      });
      setClient(sc);
      return sc;
    }
    return client;
  };

  // Connect / Pair with Trust Wallet
  const connectTW = async () => {
    log("▶️ Starting connection...");
    try {
      const sc = await initClient();

      // reuse existing approved session if possible
      const approved = sc.find({
        requiredNamespaces: {
          tron: { chains: [CHAIN_ID], methods: METHODS, events: [] },
        },
      }).filter((s) => s.acknowledged);

      let sess;
      if (approved.length) {
        sess = approved[approved.length - 1];
        log("🔗 Reusing existing session");
      } else {
        // initiate new pairing
        const { uri, approval } = await sc.connect({
          requiredNamespaces: {
            tron: { chains: [CHAIN_ID], methods: METHODS, events: [] },
          },
        });

        if (uri) {
          // Android: fire an Intent so Chrome opens Trust Wallet
          if (/Android/i.test(navigator.userAgent)) {
            const androidURI = `
              intent://wc?uri=${encodeURIComponent(uri)}
              #Intent;package=com.trustwallet;scheme=wc;end;
            `
              .trim()
              .replace(/\s+/g, "");

            log("📱 Android detected, launching Intent...");
            window.location.href = androidURI;
          } else {
            // iOS / Desktop: use modal QR or deep link
            web3Modal.openModal({ uri, chains: [CHAIN_ID] });
            log("🖥️ Opening Web3Modal QR / deep link");
          }
        }

        sess = await approval();
        log("✅ Wallet approved connection");
        web3Modal.closeModal();
      }

      setSession(sess);
      // Tron accounts look like "tron:0x2b6653dc:<hexAddress>"
      const acc = sess.namespaces.tron.accounts[0].split(":")[2];
      setAddress(acc);
      setConnected(true);
      log(`🆔 Connected address: ${acc}`);
    } catch (err) {
      log(`❌ Connection error: ${err.message || err}`);
    }
  };

  // Sign a raw Tron transaction
  const signTransaction = async () => {
    if (!session) return log("⚠️ No active session");
    try {
      // Example raw transaction object – replace with real values
      const rawTx = {
        to:               "TXYZ...destinationAddress",
        feeLimit:         1_000000,
        callValue:        0,
        contractAddress:  "",
        functionSelector: "",
        parameter:        "",
        extraData:        "",
      };

      const { result } = await client.request({
        topic:   session.topic,
        chainId: CHAIN_ID,
        request: {
          method: METHODS[0], // "tron_signTransaction"
          params: {
            address,
            transaction: rawTx,
          },
        },
      });

      log("✍️ Transaction signed result:");
      log(JSON.stringify(result, null, 2));
    } catch (err) {
      log(`❌ Sign TX error: ${err.message || err}`);
    }
  };

  // Sign an arbitrary message
  const signMessage = async () => {
    if (!session) return log("⚠️ No active session");
    try {
      const message = "Hello from Trust Wallet + Tron!";
      const signature = await client.request({
        topic:   session.topic,
        chainId: CHAIN_ID,
        request: {
          method: METHODS[1], // "tron_signMessage"
          params: {
            address,
            message,
          },
        },
      });

      log("📝 Message signature:");
      log(signature);
    } catch (err) {
      log(`❌ Sign Msg error: ${err.message || err}`);
    }
  };

  // Disconnect / kill session
  const disconnect = async () => {
    if (!client || !session) return log("⚠️ Nothing to disconnect");
    try {
      await client.disconnect({
        topic:   session.topic,
        reason:  { code: 6000, message: "User disconnected" },
      });
      setSession(null);
      setAddress("");
      setConnected(false);
      log("🔌 Disconnected");
    } catch (err) {
      log(`❌ Disconnect error: ${err.message || err}`);
    }
  };

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      if (web3Modal) web3Modal.closeModal();
    };
  }, []);

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto", fontFamily: "Arial, sans-serif" }}>
      <h1>Trust Wallet + Tron Demo</h1>

      <button onClick={connectTW} disabled={connected} style={{ marginRight: 10 }}>
        {connected ? "Connected" : "Connect Trust Wallet"}
      </button>

      <button onClick={signTransaction} disabled={!connected} style={{ marginRight: 10 }}>
        Sign Transaction
      </button>

      <button onClick={signMessage} disabled={!connected} style={{ marginRight: 10 }}>
        Sign Message
      </button>

      <button onClick={disconnect} disabled={!connected}>
        Disconnect
      </button>

      <hr style={{ margin: "1rem 0" }} />

      <pre style={{
        background: "#f5f5f5",
        padding: 10,
        maxHeight: 300,
        overflowY: "auto",
        whiteSpace: "pre-wrap"
      }}>
        {logs.join("\n")}
      </pre>
    </div>
  );
}
