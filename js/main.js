// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    const api = new SolanaTrackerAPI();
    let graduatedTokens = [];
    let trendingManager = new TrendingTokensManager();

    // Initialize WebSocket connection
    api.initializeWebSocket();

    // Initialize the page
    async function initialize() {
        await Promise.all([
            loadGraduatedTokens(),
            trendingManager.updateTrendingTokens()
        ]);
        
        // Initialize timeframe controls
        initializeTimeframeControls();
    }

    function initializeTimeframeControls() {
        const timeframePills = document.querySelectorAll('.timeframe-pill');
        timeframePills.forEach(pill => {
            pill.addEventListener('click', async (e) => {
                // Remove active class from all pills
                timeframePills.forEach(p => p.classList.remove('active'));
                
                // Add active class to clicked pill
                pill.classList.add('active');
                
                // Get the timeframe from the data attribute
                const timeframe = pill.dataset.time;
                
                // Update the trending tokens with smooth transition
                const container = document.getElementById('trending-tokens');
                if (container) {
                    // Add transition class for smooth fade
                    container.style.opacity = '0';
                    container.style.transform = 'translateY(10px)';
                    
                    // Update the timeframe and fetch new data
                    trendingManager.currentTimeFrame = timeframe;
                    await trendingManager.updateTrendingTokens();
                    
                    // Restore container visibility with animation
                    setTimeout(() => {
                        container.style.opacity = '1';
                        container.style.transform = 'translateY(0)';
                    }, 300);
                }
            });
        });
    }

    async function loadGraduatedTokens() {
        try {
            graduatedTokens = await api.getGraduatedTokens();
            renderTokenGrid('graduated-tokens', graduatedTokens);
        } catch (error) {
            console.error('Error loading graduated tokens:', error);
        }
    }

    async function loadTrendingTokens(timeframe = '1h') {
        try {
            trendingTokens = await api.getTrendingTokens(timeframe);
            renderTokenGrid('trending-tokens', trendingTokens);
        } catch (error) {
            console.error('Error loading trending tokens:', error);
        }
    }

    async function renderTokenGrid(containerId, tokens) {
        const container = document.getElementById(containerId);
        // Limit to 12 tokens
        const limitedTokens = tokens.slice(0, 12);
        
        // Fetch prices for all tokens at once
        const tokenAddresses = limitedTokens.map(token => token.token.mint);
        let prices;
        try {
            prices = await api.getMultipleTokenPrices(tokenAddresses);
        } catch (error) {
            console.error('Error fetching prices:', error);
            prices = {};
        }
        
        // Clear existing content with fade out
        container.style.opacity = '0';
        
        setTimeout(() => {
            container.innerHTML = limitedTokens.map((token, index) => 
                createTokenCard(token, index, prices[token.token.mint])
            ).join('');
            
            // Fade in new content
            container.style.opacity = '1';
            
            // Add staggered animation to cards
            const cards = container.querySelectorAll('.token-card');
            cards.forEach((card, index) => {
                card.style.animationDelay = `${index * 0.1}s`;
            });
        }, 300);
    }

    function createTokenCard(token, index, priceData) {
        const priceChange = token.events['24h'].priceChangePercentage;
        const priceChangeClass = priceChange >= 0 ? 'positive' : 'negative';
        const performanceWidth = Math.min(Math.abs(priceChange), 100);
        
        // Calculate market cap and volume with proper formatting
        const marketCap = priceData ? priceData.marketCap : token.pools[0]?.marketCap?.usd || 0;
        const volume = priceData ? priceData.liquidity : token.pools[0]?.liquidity?.usd || 0;
        
        return `
            <div class="token-card" data-token-address="${token.token.mint}" style="animation-delay: ${index * 0.1}s">
                <div class="token-header">
                    <div class="token-main-info">
                        <img class="token-icon" src="${token.token.image}" alt="${token.token.name}">
                        <div class="token-info">
                            <h3>${token.token.name}</h3>
                            <span class="token-symbol">${token.token.symbol}</span>
                        </div>
                    </div>
                    <div class="token-change ${priceChangeClass}">
                        <span class="change-value">${formatNumber(priceChange)}%</span>
                        <span class="change-label">24h</span>
                    </div>
                </div>
                
                <div class="token-metrics">
                    <div class="metric">
                        <div class="metric-label">Market Cap</div>
                        <div class="metric-value">$${formatCompactNumber(marketCap)}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Volume (24h)</div>
                        <div class="metric-value">$${formatCompactNumber(volume)}</div>
                    </div>
                </div>

                <div class="token-performance">
                    <div class="performance-bar-wrapper">
                        <div class="performance-bar ${priceChangeClass}" style="width: ${performanceWidth}%">
                            <div class="performance-glow"></div>
                        </div>
                    </div>
                    <div class="token-stats">
                        <div class="stat-item">
                            <span class="stat-dot ${token.buys > token.sells ? 'positive' : 'negative'}"></span>
                            <span class="stat-label">Buys</span>
                            <span class="stat-value">${token.buys || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-dot ${token.sells > token.buys ? 'positive' : 'negative'}"></span>
                            <span class="stat-label">Sells</span>
                            <span class="stat-value">${token.sells || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function formatNumber(number) {
        return new Intl.NumberFormat('en-US', {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        }).format(number);
    }

    function formatCompactNumber(number) {
        if (number >= 1e9) {
            return (number / 1e9).toFixed(2) + 'B';
        }
        if (number >= 1e6) {
            return (number / 1e6).toFixed(2) + 'M';
        }
        if (number >= 1e3) {
            return (number / 1e3).toFixed(2) + 'K';
        }
        return number.toFixed(2);
    }

    // Handle real-time updates
    window.addEventListener('tokenUpdate', (event) => {
        const updatedToken = event.detail;
        updateTokenDisplay(updatedToken);
    });

    function updateTokenDisplay(updatedToken) {
        // Update the token card if it exists in either grid
        const tokenCards = document.querySelectorAll('.token-card');
        tokenCards.forEach(card => {
            if (card.dataset.tokenAddress === updatedToken.token.mint) {
                // Update the relevant metrics
                updateTokenMetrics(card, updatedToken);
            }
        });
    }

    // Add real-time price updates
    async function updateTokenMetrics(card, updatedToken) {
        try {
            const tokenAddress = card.dataset.tokenAddress;
            const priceData = await api.getTokenPrice(tokenAddress);
            
            // Update price
            const priceElement = card.querySelector('.metric-value');
            if (priceElement) {
                priceElement.textContent = `$${formatNumber(priceData.price)}`;
            }
            
            // Update other metrics...
            const metrics = card.querySelectorAll('.metric-value');
            metrics[2].textContent = `$${formatCompactNumber(priceData.marketCap)}`;
            metrics[3].textContent = `$${formatCompactNumber(priceData.liquidity)}`;
            
            // Update performance bar
            const priceChange = updatedToken.events['24h'].priceChangePercentage;
            const performanceBar = card.querySelector('.performance-bar');
            if (performanceBar) {
                performanceBar.style.width = `${Math.min(Math.abs(priceChange), 100)}%`;
                performanceBar.className = `performance-bar ${priceChange >= 0 ? 'positive' : 'negative'}`;
            }
        } catch (error) {
            console.error('Error updating token metrics:', error);
        }
    }

    // Initialize the page
    initialize();
});

class TrendingTokensManager {
    constructor() {
        this.currentTimeFrame = '5m';
        this.maxTokensToShow = 6;
        this.api = new SolanaTrackerAPI();
    }

    async updateTrendingTokens() {
        try {
            const container = document.getElementById('trending-tokens');
            if (!container) return;

            // Show loading state
            container.style.opacity = '0.5';
            
            const tokens = await this.fetchTrendingTokens(this.currentTimeFrame);
            const topGainer = tokens[0]; // First token is always the top gainer since we sort by performance
            const limitedTokens = tokens.slice(0, this.maxTokensToShow);

            // Update display with animation
            container.style.opacity = '0';
            container.style.transform = 'translateY(10px)';
            
            setTimeout(() => {
                container.innerHTML = '';
                limitedTokens.forEach((token, index) => {
                    const isTopGainer = token === topGainer;
                    const card = this.createTokenCard(token, isTopGainer, index);
                    container.appendChild(card);
                });
                
                // Restore container visibility with animation
                container.style.opacity = '1';
                container.style.transform = 'translateY(0)';
                
                // Add staggered animation to cards
                const cards = container.querySelectorAll('.token-card');
                cards.forEach((card, index) => {
                    card.style.animationDelay = `${index * 0.1}s`;
                });
            }, 300);

        } catch (error) {
            console.error('Error updating trending tokens:', error);
            const container = document.getElementById('trending-tokens');
            if (container) {
                container.innerHTML = `
                    <div class="error-state">
                        <p>Unable to load trending tokens. Please try again later.</p>
                    </div>
                `;
            }
        }
    }

    createTokenCard(token, isTopGainer, index) {
        const card = document.createElement('div');
        card.className = `token-card ${isTopGainer ? 'top-gainer' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;
        card.dataset.tokenAddress = token.token.mint;
        
        const performanceValue = token.performance || 0;
        const performanceClass = this.getPerformanceClass(performanceValue);
        
        // Add decorative elements
        this.addUnderwaterDecorations(card);
        
        card.innerHTML = `
            <div class="token-header ${isTopGainer ? 'top-performer' : ''}">
                <div class="token-main-info">
                    <img src="${token.token.image}" alt="${token.token.name}" class="token-icon">
                    <div class="token-info">
                        <div class="token-name-wrapper">
                            <h3>${token.token.name}</h3>
                            ${isTopGainer ? '<span class="premium-indicator">★</span>' : ''}
                        </div>
                        <span class="token-symbol">${token.token.symbol}</span>
                    </div>
                </div>
                <div class="performance-indicator ${performanceClass}">
                    <span class="change-value">${performanceValue >= 0 ? '+' : ''}${performanceValue.toFixed(2)}%</span>
                    <span class="change-label">${this.currentTimeFrame}</span>
                </div>
            </div>
            <div class="token-metrics">
                <div class="metric">
                    <div class="metric-label">Volume (${this.currentTimeFrame})</div>
                    <div class="metric-value">${this.formatCurrency(token.volume)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Market Cap</div>
                    <div class="metric-value">${this.formatCurrency(token.marketCap)}</div>
                </div>
            </div>
            <div class="token-performance">
                <div class="performance-bar-wrapper">
                    <div class="performance-bar ${performanceClass} ${isTopGainer ? 'premium-glow' : ''}"
                         style="width: ${Math.min(Math.abs(performanceValue), 100)}%">
                        <div class="performance-glow"></div>
                    </div>
                </div>
            </div>
        `;

        return card;
    }

    getPerformanceClass(value) {
        if (value >= 10) return 'super-positive';
        if (value > 0) return 'positive';
        return 'negative';
    }

    addUnderwaterDecorations(card) {
        // Add seaweed
        for (let i = 0; i < 3; i++) {
            const seaweed = document.createElement('div');
            seaweed.className = 'seaweed';
            seaweed.style.left = `${10 + (i * 40)}%`;
            card.appendChild(seaweed);
        }

        // Add coral
        for (let i = 0; i < 2; i++) {
            const coral = document.createElement('div');
            coral.className = 'coral';
            coral.style.left = `${25 + (i * 50)}%`;
            card.appendChild(coral);
        }
    }

    formatCurrency(value) {
        if (!value || value === 0) return '$0.00';
        
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            notation: 'compact',
            maximumFractionDigits: 1
        }).format(value);
    }

    formatNumber(number) {
        if (!number || isNaN(number)) return '0.00';
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6,
            notation: number >= 1000000 ? 'compact' : 'standard'
        }).format(number);
    }

    async fetchTrendingTokens(timeFrame) {
        try {
            const tokens = await this.api.getTrendingTokens(timeFrame);
            
            // Fetch prices for all tokens at once for better performance
            const tokenAddresses = tokens.map(token => token.token.mint);
            let prices = {};
            try {
                prices = await this.api.getMultipleTokenPrices(tokenAddresses);
            } catch (error) {
                console.error('Error fetching prices:', error);
            }
            
            // Enrich tokens with price and volume data
            const enrichedTokens = tokens.map(token => {
                const priceData = prices[token.token.mint] || {};
                return {
                    ...token,
                    price: priceData.price || 0,
                    marketCap: priceData.marketCap || token.pools[0]?.marketCap?.usd || 0,
                    volume: priceData.liquidity || token.pools[0]?.liquidity?.usd || 0,
                    performance: token.events[timeFrame]?.priceChangePercentage || 0
                };
            });

            // Sort by performance
            return enrichedTokens.sort((a, b) => b.performance - a.performance);
        } catch (error) {
            console.error('Error fetching trending tokens:', error);
            return [];
        }
    }
} 