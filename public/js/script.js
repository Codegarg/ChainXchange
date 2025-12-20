// Enhanced Crypto Trading Platform JavaScript

class CryptoPlatform {
    constructor() {
        // Check if an instance already exists
        if (CryptoPlatform.instance) {
            return CryptoPlatform.instance;
        }

        this.socket = null;
        this.cryptoTableBody = document.getElementById('crypto-table');
        this.connectionStatus = document.getElementById('connection-status');
        this.isConnected = false;
        this.priceUpdateInterval = null;
        
        this.init();
        
        // Assign the instance
        CryptoPlatform.instance = this;
    }

    init() {
        this.initializeSocket();
        this.bindEventListeners();
        this.startPriceUpdates();
        
        // Initialize tooltips and other UI components
        this.initializeUI();
    }

    initializeSocket() {
        if (typeof io !== 'undefined') {
            try {
                this.socket = io();
                
                this.socket.on('connect', () => {
                    console.log('Connected to server');
                    this.isConnected = true;
                    this.updateConnectionStatus('Connected', 'bullish');
                });

                this.socket.on('disconnect', () => {
                    console.log('Disconnected from server');
                    this.isConnected = false;
                    this.updateConnectionStatus('Disconnected', 'bearish');
                });

                this.socket.on('crypto-update', (data) => {
                    this.handleCryptoUpdate(data);
                });

                this.socket.on('price-update', (data) => {
                    this.handlePriceUpdate(data);
                });

            } catch (error) {
                console.error('Socket initialization failed:', error);
            }
        }
    }

    bindEventListeners() {
        // Bind form submissions
        document.addEventListener('submit', (e) => {
            if (e.target.classList.contains('action-form')) {
                this.handleTradeSubmission(e);
            }
        });

        // Bind input validations
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('quantity-input')) {
                this.validateQuantityInput(e.target);
            }
        });

        // Bind theme change events
        document.addEventListener('themeChanged', (e) => {
            this.handleThemeChange(e.detail.theme);
        });

        // Bind window events
        window.addEventListener('focus', () => {
            this.refreshData();
        });
    }

    initializeUI() {
        // Add loading animations
        this.addLoadingAnimations();
        
        // Format numbers and prices
        this.formatAllNumbers();
        
        // Initialize tooltips
        this.initializeTooltips();
    }

    updateConnectionStatus(status, type) {
        if (this.connectionStatus) {
            this.connectionStatus.className = `market-status ${type}`;
            this.connectionStatus.innerHTML = `
                <div class="status-dot"></div>
                ${status}
            `;
        }
    }

    formatPrice(price) {
        if (price == null || price === undefined || isNaN(price)) {
            return 'N/A';
        }
        
        const num = parseFloat(price);
        
        if (num < 0.01) {
            return num.toPrecision(3);
        } else if (num < 1) {
            return num.toFixed(4);
        } else if (num < 10) {
            return num.toFixed(3);
        } else {
            return new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(num);
        }
    }

    formatNumber(num) {
        if (!num || isNaN(num)) return '0';
        
        const absNum = Math.abs(num);
        
        if (absNum >= 1e12) {
            return (num / 1e12).toFixed(2) + 'T';
        } else if (absNum >= 1e9) {
            return (num / 1e9).toFixed(2) + 'B';
        } else if (absNum >= 1e6) {
            return (num / 1e6).toFixed(2) + 'M';
        } else if (absNum >= 1e3) {
            return (num / 1e3).toFixed(2) + 'K';
        }
        return num.toFixed(2);
    }

    updateCryptoDisplay(cryptos) {
        if (!this.cryptoTableBody) return;

        this.cryptoTableBody.innerHTML = '';
        
        cryptos.forEach((crypto, index) => {
            const row = this.createCryptoRow(crypto, index);
            this.cryptoTableBody.appendChild(row);
        });

        this.addLoadingAnimations();
    }

    createCryptoRow(crypto, index) {
        const row = document.createElement('tr');
        row.setAttribute('data-crypto-id', crypto.id);
        row.className = 'fade-in';
        row.style.animationDelay = `${index * 0.05}s`;

        const change24h = crypto.price_change_percentage_24h || 0;
        const isPositiveChange = change24h >= 0;

        row.innerHTML = `
            <td class="rank-cell">${index + 1}</td>
            <td>
                <div class="crypto-name">
                    <img src="${crypto.image || this.getDefaultCryptoIcon(crypto.symbol)}" 
                         alt="${crypto.name}" 
                         class="crypto-icon" 
                         onerror="this.src='${this.getDefaultCryptoIcon(crypto.symbol)}'">
                    <div>
                        <div class="crypto-name-text">${crypto.name}</div>
                        <div class="crypto-symbol">${crypto.symbol?.toUpperCase()}</div>
                    </div>
                </div>
            </td>
            <td class="price-cell">$${this.formatPrice(crypto.current_price)}</td>
            <td class="change-cell ${isPositiveChange ? 'change-positive' : 'change-negative'}">
                ${isPositiveChange ? '+' : ''}${this.formatPrice(change24h)}%
            </td>
            <td>$${this.formatNumber(crypto.market_cap)}</td>
            <td>$${this.formatNumber(crypto.total_volume)}</td>
            <td>
                ${this.createActionCell(crypto)}
            </td>
        `;

        return row;
    }

    createActionCell(crypto) {
        const isLoggedIn = document.querySelector('.nav-link[href="/portfolio"]') !== null;
        
        if (isLoggedIn) {
            return `
                <form action="/crypto/buy" method="POST" class="action-form">
                    <input type="hidden" name="coinId" value="${crypto.id}">
                    <input type="hidden" name="price" value="${crypto.current_price}">
                    <input type="number" 
                           name="quantity" 
                           placeholder="0.00" 
                           required 
                           min="0.000001" 
                           step="0.000001"
                           class="form-control quantity-input">
                    <button type="submit" class="btn btn-success btn-sm">
                        <i class="fas fa-shopping-cart"></i>&nbsp;Buy
                    </button>
                </form>
            `;
        } else {
            return `
                <a href="/auth/login" class="btn btn-primary btn-sm">
                    <i class="fas fa-sign-in-alt"></i>&nbsp;Login to Trade
                </a>
            `;
        }
    }

    getDefaultCryptoIcon(symbol) {
        const encodedSVG = btoa(`<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#f0b90b"/><text x="16" y="20" text-anchor="middle" fill="white" font-size="10" font-weight="bold">${symbol?.slice(0, 3) || 'N/A'}</text></svg>`);
        return `data:image/svg+xml;base64,${encodedSVG}`;
    }

    async fetchAndDisplayCryptos() {
        try {
            const response = await fetch('/crypto', {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            if (response.ok) {
                const freshData = await response.json();
                this.updateCryptoDisplay(freshData);
            }
        } catch (error) {
            console.error('Error fetching crypto data:', error);
        }
    }

    startPriceUpdates() {
        // Update prices every 30 seconds
        this.priceUpdateInterval = setInterval(() => {
            this.fetchAndDisplayCryptos();
        }, 30000);
    }

    addLoadingAnimations() {
        const rows = this.cryptoTableBody?.querySelectorAll('tr');
        if (rows) {
            rows.forEach((row, index) => {
                row.style.animationDelay = `${index * 0.05}s`;
                row.classList.add('fade-in');
            });
        }
    }

    formatAllNumbers() {
        document.querySelectorAll('.stat-value').forEach(element => {
            const value = element.textContent;
            if (value && !isNaN(value.replace(/[^0-9.-]+/g, ''))) {
                const num = parseFloat(value.replace(/[^0-9.-]+/g, ''));
                element.textContent = this.formatNumber(num);
            }
        });
    }

    initializeTooltips() {
        // Add tooltips to interactive elements
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        tooltipElements.forEach(element => {
            element.addEventListener('mouseenter', this.showTooltip);
            element.addEventListener('mouseleave', this.hideTooltip);
        });
    }

    showTooltip(e) {}
    hideTooltip(e) {}

    // Method to refresh data
    refreshData() {
        console.log('Refreshing data...');
        if (this.cryptoTableBody) {
            this.fetchAndDisplayCryptos();
        }
    }

    // Method to handle theme changes
    handleThemeChange(theme) {
        console.log('Theme changed to:', theme);
        // Update any theme-specific UI elements here
        if (this.socket && this.isConnected) {
            this.socket.emit('theme-change', { theme });
        }
    }
}

// Backward compatibility functions
function formatPrice(price) {
    if (price >= 1) return price.toFixed(2);
    return price.toFixed(8);
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
    }
    return num;
}

function updateCryptoDisplay(cryptos) {
    if (window.cryptoPlatform) {
        window.cryptoPlatform.updateCryptoDisplay(cryptos);
    }
}

async function fetchAndDisplayCryptos() {
    if (window.cryptoPlatform) {
        return window.cryptoPlatform.fetchAndDisplayCryptos();
    }
}

// Initialize the platform when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.cryptoPlatform = new CryptoPlatform();
});

const cryptoTableBody = document.getElementById('crypto-table');