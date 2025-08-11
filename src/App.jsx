import React, { useState, useEffect } from "react";
import { SignClient } from "@walletconnect/sign-client";
import { Web3Modal } from "@web3modal/standalone";

const PROJECT_ID = "a2cd3f6f2c8dde8024ed901de2d36bc1";

export default function TronWCv2Final() {
  const [client,    setClient]    = useState(null);
  const [session,   setSession]   = useState(null);
  const [address,   setAddress]   = useState("");
  const [logs,      setLogs]      = useState([]);
  const [connected, setConnected] = useState(false);

  const web3Modal = new Web3Modal({
    projectId: PROJECT_ID,
    walletConnectVersion: 2,
  });

  const log = (msg) => {
    console.log(msg);
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} ${msg}`]);
  };

  // 1) Initialize singleton SignClient
  const initClient = async () => {
    if (!client) {
      const sc = await SignClient.init({
        projectId: PROJECT_ID,
        metadata: {
          name:        "Tron WCv2 Final",
          description: "Final try for tron_signTransaction",
          url:         window.location.origin,
          icons:       [],
        },
      });
      setClient(sc);
      return sc;
    }
    return client;
  };

  // 2) Connect / Pair with Trust Wallet
  const connect = async () => {
    log("▶️ Starting connection…");
    const sc = await initClient();

    // Always request Securetron’s chain + methods
    const requestedChain = "tron:0x2b6653dc";
    const requestedMethods = ["tron_signTransaction", "tron_signMessage"];

    // Try reuse
    let sess = sc
      .find({ requiredNamespaces: { tron: { chains: [requestedChain], methods: requestedMethods, events: [] } } })
      .filter((s) => s.acknowledged)
      .pop();

    if (!sess) {
      const { uri, approval } = await sc.connect({
        requiredNamespaces: {
          tron: { chains: [requestedChain], methods: requestedMethods, events: [] },
        },
      });

      if (/Android/i.test(navigator.userAgent) && uri) {
        // Intent hack for Android
        const intentURI = `intent://wc?uri=${encodeURIComponent(uri)}#Intent;package=com.trustwallet;scheme=wc;end;`;
        log("📱 Android detected, launching Intent…");
        window.location.href = intentURI;
      } else if (uri) {
        log("📷 Opening QR / deep-link modal…");
        web3Modal.openModal({ uri, chains: [requestedChain] });
      }

      sess = await approval();
      log("✅ Session approved");
      web3Modal.closeModal();
    } else {
      log("🔗 Reusing existing session");
    }

    console.log("FULL SESSION.NAMESPACES:", sess.namespaces);
    const { chains, methods } = sess.namespaces.tron;
    log(`🔍 Session chains: ${chains.join(", ")}`);
    log(`🔍 Session methods: ${methods.join(", ")}`);

    // Extract address
    const acc = sess.namespaces.tron.accounts[0].split(":")[2];
    setSession(sess);
    setAddress(acc);
    setConnected(true);
    log(`🆔 Connected addr: ${acc}`);
  };

  // 3) Sign Transaction using *object* params only
  const signTx = async () => {
    if (!session || !client) return log("⚠️ Not connected");

    const chainId = session.namespaces.tron.chains[0];
    const method  = session.namespaces.tron.methods.find((m) => m.includes("Transaction"));
    if (!method) return log("❌ tron_signTransaction not advertised");

    // Build a REAL Tron raw transaction here. This is just dummy structure.
    const rawTx = {
      to:               "TXYZ…YourDestAddress",
      feeLimit:         1000000,
      callValue:        0,
      contractAddress:  "",
      functionSelector: "",
      parameter:        "",
      extraData:        "",
    };

    // Try two object shapes: with and without `address`
    const shapes = [
      { address, transaction: rawTx },
      { transaction: rawTx },
    ];

    for (const params of shapes) {
      try {
        log(`✉️ Calling ${method} with params = ${JSON.stringify(params)}`);
        const { result } = await client.request({
          topic:   session.topic,
          chainId,
          request: {
            method,
            params,
          },
        });
        log("✅ TX Signed! Result:");
        log(JSON.stringify(result, null, 2));
        return;
      } catch (err) {
        log(`❌ shape failed: ${err.message || err}`);
      }
    }

    log("❌ All TX param shapes failed");
  };

  // 4) Sign Message using *object* params only
  const signMsg = async () => {
    if (!session || !client) return log("⚠️ Not connected");

    const chainId = session.namespaces.tron.chains[0];
    const method  = session.namespaces.tron.methods.find((m) => m.includes("Message"));
    if (!method) return log("❌ tron_signMessage not advertised");

    const message = "Hello from Trust Wallet Tron!";
    const shapes = [
      { address, message },
      { message },
    ];

    for (const params of shapes) {
      try {
        log(`✉️ Calling ${method} with params = ${JSON.stringify(params)}`);
        const sig = await client.request({
          topic:   session.topic,
          chainId,
          request: {
            method,
            params,
          },
        });
        log("✅ Message Signed! Signature:");
        log(JSON.stringify(sig, null, 2));
        return;
      } catch (err) {
        log(`❌ shape failed: ${err.message || err}`);
      }
    }

    log("❌ All Message param shapes failed");
  };

  // 5) Disconnect
  const disconnect = async () => {
    if (!session || !client) return log("⚠️ Nothing to disconnect");
    await client.disconnect({
      topic:  session.topic,
      reason: { code: 6000, message: "User disconnected" },
    });
    setSession(null);
    setAddress("");
    setConnected(false);
    log("🔌 Disconnected");
  };

  // Cleanup Web3Modal on unmount
  useEffect(() => () => web3Modal.closeModal(), []);

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>Trust Wallet + Tron: Final Test</h1>

      <button onClick={connect}    disabled={connected} style={{ marginRight: 8 }}>
        {connected ? "Connected" : "Connect Wallet"}
      </button>
      <button onClick={signTx}     disabled={!connected} style={{ marginRight: 8 }}>
        Sign Transaction
      </button>
      <button onClick={signMsg}    disabled={!connected} style={{ marginRight: 8 }}>
        Sign Message
      </button>
      <button onClick={disconnect} disabled={!connected}>
        Disconnect
      </button>

      <hr />

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
