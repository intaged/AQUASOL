class SolanaTrackerAPI {
    constructor() {
        this.baseUrl = CONFIG.API_BASE_URL;
        this.apiKey = CONFIG.API_KEY;
        this.ws = null;
    }

    async fetchWithAuth(endpoint) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                headers: {
                    'x-api-key': this.apiKey
                }
            });
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async getGraduatedTokens() {
        return this.fetchWithAuth('/tokens/multi/graduated');
    }

    async getTrendingTokens(timeframe = '1h') {
        return this.fetchWithAuth(`/tokens/trending/${timeframe}`);
    }

    async getTokenStats(tokenAddress) {
        return this.fetchWithAuth(`/stats/${tokenAddress}`);
    }

    initializeWebSocket() {
        this.ws = new WebSocket(CONFIG.WEBSOCKET_URL);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            // Dispatch custom event for real-time updates
            window.dispatchEvent(new CustomEvent('tokenUpdate', { detail: data }));
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            // Attempt to reconnect after 5 seconds
            setTimeout(() => this.initializeWebSocket(), 5000);
        };
    }

    async getTokenPrice(tokenAddress) {
        return this.fetchWithAuth(`/price?token=${tokenAddress}`);
    }

    async getMultipleTokenPrices(tokenAddresses) {
        return this.fetchWithAuth(`/price/multi?tokens=${tokenAddresses.join(',')}`);
    }
} 