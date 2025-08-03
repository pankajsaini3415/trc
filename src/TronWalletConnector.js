// TronWalletConnector.js
import { SignClient } from "@walletconnect/sign-client";
import { Web3Modal } from "@web3modal/standalone";

const TRON_MAINNET = "tron:0x2b6653dc";
const METHODS = ["tron_signTransaction", "tron_signMessage"];

export class TronWalletConnector {
    constructor({ projectId, modalConfig = {} }) {
        this.projectId = projectId;
        this.network = TRON_MAINNET;
        this.modalConfig = modalConfig;
        this.web3Modal = new Web3Modal({
            ...modalConfig,
            projectId,
            chains: [this.network, ...(modalConfig.chains || [])],
        });
    }

    async initClient() {
        if (!this.client) {
            this.client = await SignClient.init({
                projectId: this.projectId,
                metadata: {
                    name: "Tron DApp",
                    description: "TRON WalletConnect Integration",
                    url: window.location.origin,
                    icons: ["https://example.com/icon.png"],
                },
            });
        }
        return this.client;
    }

    getRequiredNamespaces(pairingTopic = undefined) {
        return {
            requiredNamespaces: {
                tron: {
                    chains: [this.network],
                    methods: METHODS,
                    events: [],
                },
            },
            pairingTopic,
        };
    }

    async connect() {
        const client = await this.initClient();
        const sessions = client.find(this.getRequiredNamespaces()).filter(s => s.acknowledged);

        if (sessions.length) {
            this.session = sessions[sessions.length - 1];
        } else {
            const { uri, approval } = await client.connect(this.getRequiredNamespaces());
            if (uri) {
                this.web3Modal.openModal({ uri, chains: [this.network] });
                this.web3Modal.subscribeModal(state => {
                    if (!state.open) throw new Error("Modal closed");
                });
            }
            this.session = await approval();
            await this.web3Modal.closeModal();
        }

        const accounts = Object.values(this.session.namespaces).flatMap(ns => ns.accounts);
        this.address = accounts[0].split(":")[2];
        return { address: this.address };
    }

    async disconnect() {
        if (this.client && this.session) {
            await this.client.disconnect({
                topic: this.session.topic,
                reason: { code: 6000, message: "User disconnected" },
            });
            this.session = null;
            this.address = null;
        }
    }

    async signTransaction(tx) {
        if (!this.client || !this.session) throw new Error("Not connected");

        const response = await this.client.request({
            topic: this.session.topic,
            chainId: this.network,
            request: {
                method: "tron_signTransaction",
                params: [tx], // Must be an object with TRON transaction fields
            },
        });

        return response; // Signed transaction object
    }

    async signMessage(message) {
        if (!this.client || !this.session) throw new Error("Not connected");

        const response = await this.client.request({
            topic: this.session.topic,
            chainId: this.network,
            request: {
                method: "tron_signMessage",
                params: [message], // Plain string message
            },
        });

        return response; // Signed message
    }
}
