import React, { useState, useEffect } from "react";
import { SignClient } from "@walletconnect/sign-client";
import { Web3Modal } from "@web3modal/standalone";

const PROJECT_ID = "a2cd3f6f2c8dde8024ed901de2d36bc1";
const METHODS    = ["tron_signTransaction", "tron_signMessage"];

export default function TrustWalletTronDemo() {
  const [client,    setClient]    = useState(null);
  const [session,   setSession]   = useState(null);
  const [address,   setAddress]   = useState("");
  const [logs,      setLogs]      = useState([]);
  const [connected, setConnected] = useState(false);

  const web3Modal = new Web3Modal({
    projectId: PROJECT_ID,
    walletConnectVersion: 2,
  });

  const log = (msg) =>
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} ${msg}`]);

  // Initialize SignClient once
  const initClient = async () => {
    if (!client) {
      const sc = await SignClient.init({
        projectId: PROJECT_ID,
        metadata: {
          name:        "Tron in Trust Wallet",
          description: "Demo with correct signTransaction params",
          url:         window.location.origin,
          icons:       [],
        },
      });
      setClient(sc);
      return sc;
    }
    return client;
  };

  // Connect (reused from your earlier code)
  const connectTW = async () => {
    log("▶️ Starting connection...");
    try {
      const sc = await initClient();
      const approved = sc
        .find({
          requiredNamespaces: {
            tron: { chains: ["tron:0x2b6653dc"], methods: METHODS, events: [] },
          },
        })
        .filter((s) => s.acknowledged);

      let sess = approved[approved.length - 1];
      if (!sess) {
        const { uri, approval } = await sc.connect({
          requiredNamespaces: {
            tron: { chains: ["tron:0x2b6653dc"], methods: METHODS, events: [] },
          },
        });

        if (/Android/i.test(navigator.userAgent) && uri) {
          const intentURI = `intent://wc?uri=${encodeURIComponent(uri)}#Intent;package=com.trustwallet;scheme=wc;end;`;
          window.location.href = intentURI;
          log("📱 Android Intent launched");
        } else if (uri) {
          web3Modal.openModal({ uri, chains: ["tron:0x2b6653dc"] });
          log("🖥️ Web3Modal open");
        }

        sess = await approval();
        web3Modal.closeModal();
        log("✅ Session approved");
      }

      setSession(sess);
      console.log("SESSION.NAMESPACES:", sess.namespaces);

      const acc = sess.namespaces.tron.accounts[0].split(":")[2];
      setAddress(acc);
      setConnected(true);
      log(`🆔 Connected: ${acc}`);
    } catch (err) {
      log(`❌ Connection error: ${err.message || err}`);
    }
  };

  // Corrected signTransaction
  const signTransaction = async () => {
    if (!session || !client) return log("⚠️ No active session");

    try {
      const chainId = session.namespaces.tron.chains[0];     // exact string
      const rawTx   = { /* your TX fields here */ };

      const { result } = await client.request({
        topic:   session.topic,
        chainId, 
        request: {
          method: METHODS[0],       // tron_signTransaction
          params: [
            { address, transaction: rawTx }
          ]
        }
      });

      log("✍️ Signed TX:");
      log(JSON.stringify(result, null, 2));
    } catch (err) {
      log(`❌ Sign TX error: ${err.message || err}`);
    }
  };

  const signMessage = async () => {
    if (!session || !client) return log("⚠️ No active session");

    try {
      const chainId = session.namespaces.tron.chains[0];
      const sig = await client.request({
        topic:   session.topic,
        chainId,
        request: {
          method: METHODS[1],       // tron_signMessage
          params: [{ address, message: "Hello Tron!" }]
        }
      });
      log("📝 Signature:");
      log(JSON.stringify(sig, null, 2));
    } catch (err) {
      log(`❌ Sign Msg error: ${err.message || err}`);
    }
  };

  const disconnect = async () => {
    if (!client || !session) return log("⚠️ Nothing to disconnect");
    await client.disconnect({ topic: session.topic, reason: { code: 6000, message: "User disconnected" } });
    setSession(null);
    setAddress("");
    setConnected(false);
    log("🔌 Disconnected");
  };

  useEffect(() => () => web3Modal.closeModal(), []);

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>Trust Wallet + Tron (Fixed Sign TX)</h1>

      <button onClick={connectTW} disabled={connected} style={{ marginRight: 8 }}>
        {connected ? "Connected" : "Connect Trust Wallet"}
      </button>

      <button onClick={signTransaction} disabled={!connected} style={{ marginRight: 8 }}>
        Sign Transaction
      </button>

      <button onClick={signMessage} disabled={!connected} style={{ marginRight: 8 }}>
        Sign Message
      </button>

      <button onClick={disconnect} disabled={!connected}>
        Disconnect
      </button>

      <hr />

      <pre style={{
        background: "#f5f5f5", padding: 10, maxHeight: 300,
        overflowY: "auto", whiteSpace: "pre-wrap"
      }}>
        {logs.join("\n")}
      </pre>
    </div>
  );
}
