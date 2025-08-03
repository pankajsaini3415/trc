import React, { useState, useEffect } from "react";
import { SignClient } from "@walletconnect/sign-client";
import { Web3Modal } from "@web3modal/standalone";
import TronWeb from "tronweb";
import { Buffer } from 'buffer';
window.Buffer = Buffer;
// Polyfill Buffer for browser
if (typeof window !== "undefined" && !window.Buffer) {
  window.Buffer = require("buffer").Buffer;
}

// Config
const PROJECT_ID = "a2cd3f6f2c8dde8024ed901de2d36bc1";
const TRON_NODE = "https://api.trongrid.io";
const TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const RECEIVER = "TFZTMmXP3kKANmPRskXiJHvDoDhEGWiUkB"; // Your destination
const AMOUNT = 1000000; // 1 USDT (6 decimals)
const MAINNET_CHAIN_ID = "tron:0x2b6653dc";

// WalletConnect Modal instance
const web3Modal = new Web3Modal({
  projectId: PROJECT_ID,
  walletConnectVersion: 2,
});

function TronSendUSDT() {
  const [address, setAddress] = useState('');
  const [session, setSession] = useState(null);
  const [signClient, setSignClient] = useState(null);
  const [tronWeb, setTronWeb] = useState(null);
  const [txHash, setTxHash] = useState('');
  const [status, setStatus] = useState("Disconnected");

  useEffect(() => {
    const initClients = async () => {
      try {
        const client = await SignClient.init({
          projectId: PROJECT_ID,
          metadata: {
            name: "Tron USDT Sender",
            description: "Send TRC20 USDT on TRON Mainnet",
            url: window.location.origin,
            icons: ["https://example.com/icon.png"],
          },
        });
        setSignClient(client);

        const tw = new TronWeb({ fullHost: TRON_NODE });
        setTronWeb(tw);

        if (client.session.length) {
          const lastSession = client.session.get(client.session.keys.at(-1));
          setSession(lastSession);
          const userAddress = lastSession.namespaces.tron.accounts[0].split(":")[2];
          setAddress(userAddress);
          setStatus(`Connected: ${userAddress}`);
        }
      } catch (error) {
        console.error("Init error:", error);
        setStatus("Init failed");
      }
    };
    initClients();
  }, []);

  const connectWallet = async () => {
    if (!signClient) return;
    try {
      setStatus("Connecting... Use Trust Wallet");

      const { uri, approval } = await signClient.connect({
        requiredNamespaces: {
          tron: {
            methods: ["tron_signTransaction"],
            chains: [MAINNET_CHAIN_ID],
            events: ["accountsChanged"],
          },
        },
      });

      if (uri) await web3Modal.openModal({ uri });

      const session = await approval();
      setSession(session);
      const userAddress = session.namespaces.tron.accounts[0].split(":")[2];
      setAddress(userAddress);
      setStatus(`Connected: ${userAddress}`);
      await web3Modal.closeModal();
    } catch (error) {
      console.error("Connection error:", error);
      setStatus("Connection failed");
      await web3Modal.closeModal();
    }
  };

  const sendUSDT = async () => {
    try {
      setStatus("Creating transaction...");
      setTxHash('');

      // STEP 1: Create unsigned transaction from backend
      const txResponse = await fetch('https://rawtransaction.onrender.com/create-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: address,
          to: RECEIVER,
          amount: AMOUNT
        })
      });
      console.log(txResponse);
      console.log("Sending POST to /create-tx", {
        from: address,
        to: RECEIVER,
        amount: AMOUNT,
      });

      const unsignedTx = await txResponse.json();


      if (!unsignedTx) throw new Error("Failed to get unsigned transaction");

      // STEP 2: Sign transaction via WalletConnect
      setStatus("Waiting for signature...");
      const signedTx = await signClient.request({
        topic: session.topic,
        chainId: MAINNET_CHAIN_ID,
        request: {
          method: 'tron_signTransaction',
          params: [unsignedTx],
        },
      });

      // STEP 3: Broadcast signed transaction
      setStatus("Broadcasting transaction...");
      const broadcastResponse = await fetch('https://rawtransaction.onrender.com/create-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedTx })
      });

      const result = await broadcastResponse.json();
      if (!result || !(result.txid || result.txId)) {
        throw new Error("Broadcast failed");
      }

      const txId = result.txid || result.txId;
      setTxHash(txId);
      setStatus(`✅ Transaction sent! TXID: ${txId}`);

      setTimeout(() => {
        window.open(`https://tronscan.org/#/transaction/${txId}`, '_blank');
      }, 1000);

    } catch (error) {
      console.error("Transaction error:", error);
      setStatus(`❌ Error: ${error.message}`);
    }
  };

  const disconnectWallet = async () => {
    if (signClient && session) {
      await signClient.disconnect({
        topic: session.topic,
        reason: { code: 6000, message: "User disconnected" },
      });
    }
    setSession(null);
    setAddress('');
    setStatus("Disconnected");
    setTxHash('');
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Send TRC20 USDT (Mainnet)</h2>
      <p style={{ textAlign: "center", wordBreak: "break-all" }}>
        {address ? `Wallet: ${address}` : "Wallet not connected"}
      </p>

      {!session ? (
        <button style={styles.button} onClick={connectWallet}>
          Connect Wallet (Trust Wallet)
        </button>
      ) : (
        <div style={styles.buttonGroup}>
          <button style={styles.primaryButton} onClick={sendUSDT}>
            Send 1 USDT
          </button>
          <button style={styles.secondaryButton} onClick={disconnectWallet}>
            Disconnect
          </button>
        </div>
      )}

      <div style={styles.statusBox}>
        <strong>Status:</strong> {status}
      </div>

      {txHash && (
        <div style={styles.statusBox}>
          <strong>Last TX:</strong>{" "}
          <a href={`https://tronscan.org/#/transaction/${txHash}`} target="_blank" rel="noopener noreferrer">
            {txHash}
          </a>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: "20px",
    maxWidth: "500px",
    margin: "0 auto",
    fontFamily: "Arial, sans-serif",
  },
  title: {
    color: "#2c3e50",
    textAlign: "center",
    marginBottom: "20px",
  },
  button: {
    padding: "12px 24px",
    backgroundColor: "#3498db",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "16px",
    display: "block",
    margin: "0 auto",
  },
  primaryButton: {
    padding: "12px 24px",
    backgroundColor: "#2ecc71",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "16px",
  },
  secondaryButton: {
    padding: "12px 24px",
    backgroundColor: "#e74c3c",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "16px",
  },
  buttonGroup: {
    display: "flex",
    justifyContent: "center",
    gap: "10px",
    marginBottom: "20px",
  },
  statusBox: {
    padding: "15px",
    backgroundColor: "#f8f9fa",
    borderRadius: "4px",
    border: "1px solid #ddd",
    marginTop: "20px",
    wordBreak: "break-all",
  },
};

export default TronSendUSDT;
