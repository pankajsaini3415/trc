import React, { useState, useEffect} from"react";
import { SignClient} from"@walletconnect/sign-client";
import { Web3Modal} from"@web3modal/standalone";
import TronWeb from"tronweb";
import { Buffer} from 'buffer';
window.Buffer = Buffer;

// Config
const PROJECT_ID ="a2cd3f6f2c8dde8024ed901de2d36bc1";
const TRON_NODE ="https://api.trongrid.io";
const TRC20_CONTRACT ="TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"; // USDT Contract
const RECEIVER ="TFZTMmXP3kKANmPRskXiJHvDoDhEGWiUkB"; // Destination
const AMOUNT = 1000000; // 1 USDT (6 decimals)
const MAINNET_CHAIN_ID ="tron:0x2b6653dc";

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
            name:"Tron USDT Sender",
            description:"Send TRC20 USDT on TRON Mainnet",
            url: window.location.origin,
            icons: ["https://example.com/icon.png"],},        });
        setSignClient(client);

        const tw = new TronWeb({ fullHost: TRON_NODE });
        setTronWeb(tw);

        if (client.session.length) {
          const lastSession = client.session.get(client.session.keys.at(-1));
          setSession(lastSession);
          const userAddress = lastSession.namespaces.tron.accounts[0].split(":")[2];
          setAddress(userAddress);
          setStatus(`Connected:${userAddress}`);}      } catch (error) {
        console.error("Init error, fuck:", error);
        setStatus("Init failed, shit went wrong");}    };
    initClients();}, []);

  const connectWallet = async () => {
    if (!signClient) return;
    try {
      setStatus("Connecting... Use Trust Wallet, you fucker");

      const { uri, approval} = await signClient.connect({
        requiredNamespaces: {
          tron: {
            chains: [MAINNET_CHAIN_ID],
            methods: ['tron_signTransaction', 'tron_requestAccounts'],
            events: [],},},      });

      if (uri) await web3Modal.openModal({ uri });

      const session = await approval();
      setSession(session);
      console.log("Supported TRON methods, bitches:", session.namespaces.tron.methods);
      const userAddress = session.namespaces.tron.accounts[0].split(":")[2];
      setAddress(userAddress);
      setStatus(`Connected:${userAddress}`);
      await web3Modal.closeModal();} catch (error) {
      console.error("Connection fucked up:", error);
      setStatus("Connection failed, what a shitshow");
      await web3Modal.closeModal();}  };

  const sendUSDT = async () => {
    try {
      setStatus("Creating transaction, hold your fucking horses...");
      setTxHash('');

      // STEP 1: Create unsigned transaction locally (bypassing backend for reliability)
      if (!tronWeb ||!address) throw new Error("TronWeb or address not set, dumbass");
      
      const parameter = [{
        type: 'address',
        value: RECEIVER}, {
        type: 'uint256',
        value: AMOUNT}];

      const transaction = await tronWeb.transactionBuilder.triggerSmartContract(
        TRC20_CONTRACT,"transfer(address,uint256)",
        { feeLimit: 10000000, callValue: 0},        parameter,
        address);
      if (!transaction.transaction) throw new Error("Failed to build transaction, shit’s broken");

      const unsignedTx = transaction.transaction;
      console.log("Unsigned TX, check this shit:", JSON.stringify(unsignedTx));

      // STEP 2: Sign transaction via WalletConnect
      setStatus("Waiting for Trust Wallet to sign, don’t fuck it up...");
      let signedTx;
      try {
        signedTx = await signClient.request({
          chainId: MAINNET_CHAIN_ID,
          topic: session.topic,
          request: {
            method: 'tron_signTransaction',
            params: [unsignedTx]
          }
        });
        console.log("Signed TX, hell yeah:", signedTx);} catch (signError) {
        console.error("Trust Wallet signing fucked up:", signError);
        setStatus("Trust Wallet shat itself, trying fallback...");

        // Fallback: Construct transaction manually and sign
        const fallbackTx = await tronWeb.transactionBuilder.sendTrx(
          RECEIVER,
          0,
          address);        signedTx = await signClient.request({
          chainId: MAINNET_CHAIN_ID,
          topic: session.topic,
          request: {
            method: 'tron_signTransaction',
            params: [fallbackTx]
          }
        });
        console.log("Fallback signed TX, you lucky bastard:", signedTx);}
      // STEP 3: Broadcast signed transaction
      setStatus("Broadcasting transaction, let’s fuck shit up...");
      const broadcastResult = await tronWeb.trx.sendRawTransaction(signedTx);
      
      if (!broadcastResult.txid) {
        throw new Error("Broadcast failed, what a shitty day");}
      const txId = broadcastResult.txid;
      setTxHash(txId);
      setStatus(`Transaction sent, you fucking legend! TXID:${txId}`);

      setTimeout(() => {
        window.open(`https://tronscan.org/#/transaction/${txId}`, '_blank');}, 1000);} catch (error) {
      console.error("Transaction error, this is bullshit:", error);
      setStatus(`Error:${error.message}, fix your shit`);}  };

  const disconnectWallet = async () => {
    if (signClient && session) {
      await signClient.disconnect({
        topic: session.topic,
        reason: { code: 6000, message:"User disconnected, fuck off" },
      });}    setSession(null);
    setAddress('');
    setStatus("Disconnected, you’re on your own now");
    setTxHash('');};
  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Send TRC20 USDT (Mainnet)</h2>
      <p style={{ textAlign:"center", wordBreak:"break-all" }}>
        {address?`Wallet:${address}` :"Wallet not connected, you lazy fuck"}
      </p>

      {!session? (
        <button style={styles.button} onClick={connectWallet}>
          Connect Wallet (Trust Wallet)
        </button>) : (
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
    </div>);}

const styles = {
  container: {
    padding:"20px",
    maxWidth:"500px",
    margin:"0 auto",
    fontFamily:"Arial, sans-serif",},  title: {
    color:"#2c3e50",
    textAlign:"center",
    marginBottom:"20px",},  button: {
    padding:"12px 24px",
    backgroundColor:"#3498db",
    color:"white",
    border:"none",
    borderRadius:"4px",
    cursor:"pointer",
    fontSize:"16px",
    display:"block",
    margin:"0 auto",},  primaryButton: {
    padding:"12px 24px",
    backgroundColor:"#2ecc71",
    color:"white",
    border:"none",
    borderRadius:"4px",
    cursor:"pointer",
    fontSize:"16px",},  secondaryButton: {
    padding:"12px 24px",
    backgroundColor:"#e74c3c",
    color:"white",
    border:"none",
    borderRadius:"4px",
    cursor:"pointer",
    fontSize:"16px",},  buttonGroup: {
    display:"flex",
    justifyContent:"center",
    gap:"10px",
    marginBottom:"20px",},  statusBox: {
    padding:"15px",
    backgroundColor:"#f8f9fa",
    borderRadius:"4px",
    border:"1px solid #ddd",
    marginTop:"20px",
    wordBreak:"break-all",},};

export default TronSendUSDT;
