import React, { useState, useEffect } from "react";
import { SignClient } from "@walletconnect/sign-client";
import { Web3Modal } from "@web3modal/standalone";

const PROJECT_ID = "a2cd3f6f2c8dde8024ed901de2d36bc1";

export default function TronWC2Debug() {
  const [client, setClient]       = useState(null);
  const [session, setSession]     = useState(null);
  const [address, setAddress]     = useState("");
  const [logs, setLogs]           = useState([]);
  const [connected, setConnected] = useState(false);

  const web3Modal = new Web3Modal({
    projectId: PROJECT_ID,
    walletConnectVersion: 2,
  });

  const log = (msg) => {
    console.log(msg);
    setLogs((l) => [...l, `${new Date().toLocaleTimeString()} ${msg}`]);
  };

  // singleton SignClient
  const initClient = async () => {
    if (!client) {
      const sc = await SignClient.init({
        projectId: PROJECT_ID,
        metadata: {
          name:        "Tron WC2 Debug",
          description: "Inspect session methods for Tron",
          url:         window.location.origin,
          icons:       [],
        },
      });
      setClient(sc);
      return sc;
    }
    return client;
  };

  // Connect / Pair
  const connect = async () => {
    log("▶️ Starting connect…");
    const sc = await initClient();

    // force using Securetron’s hex-chain ID
    const requestedChain = "tron:0x2b6653dc";
    const req = {
      requiredNamespaces: {
        tron: { chains: [requestedChain], methods: ["tron_signTransaction","tron_signMessage"], events: [] }
      },
    };

    // try to reuse
    let sess = sc.find(req).filter((s) => s.acknowledged).pop();
    if (!sess) {
      const { uri, approval } = await sc.connect(req);

      // Android Intent hack
      if (/Android/i.test(navigator.userAgent) && uri) {
        const intentURI = `intent://wc?uri=${encodeURIComponent(uri)}#Intent;package=com.trustwallet;scheme=wc;end;`;
        log("📱 Launching Android Intent…");
        window.location.href = intentURI;
      } else if (uri) {
        log("📷 Opening QR/deep-link modal…");
        web3Modal.openModal({ uri, chains: [requestedChain] });
      }

      sess = await approval();
      web3Modal.closeModal();
      log("✅ Session approved");
    } else {
      log("🔗 Reusing existing session");
    }

    console.log("FULL SESSION.NAMESPACES:", sess.namespaces);
    const { chains, methods } = sess.namespaces.tron;
    log(`🔍 Session chains: ${chains.join(", ")}`);
    log(`🔍 Session methods: ${methods.join(", ")}`);

    // save address
    const acc = sess.namespaces.tron.accounts[0].split(":")[2];
    setSession(sess);
    setAddress(acc);
    setConnected(true);
    log(`🆔 Connected addr: ${acc}`);
  };

  // Sign a raw Tron transaction
  const signTx = async () => {
    if (!session || !client) return log("⚠️ Not connected");
    const chainId = session.namespaces.tron.chains[0];
    const available = session.namespaces.tron.methods;
    const methodTx  = available.find((m) => m.toLowerCase().includes("transaction"));
    if (!methodTx) {
      return log("❌ No tron_signTransaction on this session");
    }

    // example payload
    const rawTx = {
      to:               "TXYZ…destAddr",
      feeLimit:         1_000_000,
      callValue:        0,
      contractAddress:  "",
      functionSelector: "",
      parameter:        "",
      extraData:        ""
    };

    // try 2 shapes of params
    const shapes = [
      [{ address, transaction: rawTx }],
      [{ transaction: rawTx }],
    ];

    for (let params of shapes) {
      try {
        log(`✉️ Trying ${methodTx} with params = ${JSON.stringify(params)}`);
        const { result } = await client.request({
          topic:   session.topic,
          chainId,
          request: { method: methodTx, params },
        });
        log("✅ Success! Signed TX result:");
        log(JSON.stringify(result, null, 2));
        return;
      } catch (err) {
        log(`❌ shape failed: ${err.message || err}`);
      }
    }

    log("❌ All param shapes failed");
  };

  // Sign a message
  const signMsg = async () => {
    if (!session || !client) return log("⚠️ Not connected");
    const chainId = session.namespaces.tron.chains[0];
    const available = session.namespaces.tron.methods;
    const methodMsg = available.find((m) => m.toLowerCase().includes("message"));
    if (!methodMsg) {
      return log("❌ No tron_signMessage on this session");
    }

    const payloads = [
      [{ address, message: "Hello Chain!" }],
      [{ message: "Hello Chain!" }],
    ];

    for (let params of payloads) {
      try {
        log(`✉️ Trying ${methodMsg} with params = ${JSON.stringify(params)}`);
        const sig = await client.request({
          topic:   session.topic,
          chainId,
          request: { method: methodMsg, params },
        });
        log("✅ Success! Signature:");
        log(JSON.stringify(sig, null, 2));
        return;
      } catch (err) {
        log(`❌ shape failed: ${err.message || err}`);
      }
    }

    log("❌ All msg‐param shapes failed");
  };

  const disconnect = async () => {
    if (!session || !client) return log("⚠️ No session to disconnect");
    await client.disconnect({ topic: session.topic, reason: { code: 6000, message: "User disconnected" } });
    setSession(null);
    setAddress("");
    setConnected(false);
    log("🔌 Disconnected");
  };

  // cleanup modal on unmount
  useEffect(() => () => web3Modal.closeModal(), []);

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif", maxWidth: 600, margin: "auto" }}>
      <h2>▶️ Tron WC2 Debug</h2>
      <button onClick={connect} disabled={connected} style={{ marginRight: 8 }}>
        {connected ? "Connected" : "Connect Trust Wallet"}
      </button>
      <button onClick={signTx} disabled={!connected} style={{ marginRight: 8 }}>
        Sign Transaction
      </button>
      <button onClick={signMsg} disabled={!connected} style={{ marginRight: 8 }}>
        Sign Message
      </button>
      <button onClick={disconnect} disabled={!connected}>
        Disconnect
      </button>

      <hr />

      <pre style={{
        background: "#fafafa",
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
