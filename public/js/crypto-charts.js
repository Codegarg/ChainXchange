/**
 * Crypto Charts JavaScript
 * Handles cryptocurrency price charts using Chart.js
 */

class CryptoCharts {
    constructor() {
        this.chart = null;
        this.currentCoinId = null;
        this.currentCoinName = null;
        this.currentCoinSymbol = null;
        this.currentPeriod = '7';
        
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeElements();
            });
        } else {
            this.initializeElements();
        }
    }

    initializeElements() {
        this.modal = document.getElementById('chartModal');
        this.chartTitle = document.getElementById('chartTitle');
        this.chartCanvas = document.getElementById('priceChart');
        this.chartLoading = document.getElementById('chartLoading');
        this.closeBtn = document.querySelector('.close');
        
        // Debug: Check if elements exist
        if (!this.modal) {
            console.error('Chart modal element not found!');
            return;
        }
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Chart button clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('chart-btn')) {
                const coinId = e.target.getAttribute('data-coin-id');
                const coinName = e.target.getAttribute('data-coin-name');
                const coinSymbol = e.target.getAttribute('data-coin-symbol');
                this.openChart(coinId, coinName, coinSymbol);
            }
        });

        // Period button clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('chart-period-btn')) {
                const days = e.target.getAttribute('data-days');
                this.updateChartPeriod(days);
                
                // Update active button
                document.querySelectorAll('.chart-period-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                e.target.classList.add('active');
            }
        });

        // Close modal
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => {
                this.closeChart();
            });
        }

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeChart();
            }
        });

        // ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal && this.modal.style.display === 'block') {
                this.closeChart();
            }
        });
    }

    async openChart(coinId, coinName, coinSymbol) {        
        if (!this.modal) {
            console.error('Modal element not found!');
            return;
        }
        
        this.currentCoinId = coinId;
        this.currentCoinName = coinName;
        this.currentCoinSymbol = coinSymbol;
        
        if (this.chartTitle) {
            this.chartTitle.textContent = `${coinName} (${coinSymbol.toUpperCase()}) Price Chart`;
        }
        
        this.modal.style.display = 'block';
        this.modal.classList.add('show');
        
        // Reset to 7-day view
        this.currentPeriod = '7';
        document.querySelectorAll('.chart-period-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const sevenDayBtn = document.querySelector('[data-days="7"]');
        if (sevenDayBtn) {
            sevenDayBtn.classList.add('active');
        }
        
        await this.loadChartData();
    }

    closeChart() {
        if (this.modal) {
            this.modal.style.display = 'none';
            this.modal.classList.remove('show');
        }
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        
        // Clean up error messages
        const errorDiv = document.getElementById('chartError');
        if (errorDiv) {
            errorDiv.remove();
        }
    }

    async updateChartPeriod(days) {
        this.currentPeriod = days;
        await this.loadChartData();
    }

    async loadChartData() {
        try {
            this.showLoading(true);
            
            // Set a timeout for the fetch request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
            
            const response = await fetch(`/crypto/chart-data/${this.currentCoinId}?days=${this.currentPeriod}`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Validate data structure
            if (!data || !data.prices || !Array.isArray(data.prices) || data.prices.length === 0) {
                throw new Error('Invalid chart data format');
            }
            
            this.renderChart(data);
            
        } catch (error) {
            console.error('Error loading chart data:', error);
            
            if (error.name === 'AbortError') {
                this.showError(`Chart loading timed out for ${this.currentCoinName}. Please try again or check your connection.`);
            } else {
                this.showError(`Failed to load chart data for ${this.currentCoinName}. Showing fallback data.`);
                
                // Generate simple fallback chart data
                this.renderFallbackChart();
            }
        } finally {
            this.showLoading(false);
        }
    }

    renderChart(data) {
        // Destroy existing chart
        if (this.chart) {
            this.chart.destroy();
        }

        // Prepare data
        const prices = data.prices || [];
        const labels = prices.map(price => {
            const date = new Date(price[0]);
            if (this.currentPeriod === '1') {
                return date.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            } else if (this.currentPeriod <= '30') {
                return date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    hour: this.currentPeriod === '7' ? '2-digit' : undefined
                });
            } else {
                return date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: '2-digit'
                });
            }
        });
        
        const priceData = prices.map(price => price[1]);
        
        // Calculate color based on price trend
        const firstPrice = priceData[0];
        const lastPrice = priceData[priceData.length - 1];
        const isPositive = lastPrice >= firstPrice;
        const lineColor = isPositive ? '#02c076' : '#f6465d';
        const gradientColor = isPositive ? 'rgba(2, 192, 118, 0.1)' : 'rgba(246, 70, 93, 0.1)';

        // Create gradient
        const ctx = this.chartCanvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, gradientColor);
        gradient.addColorStop(1, 'transparent');

        // Chart configuration
        const config = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `${this.currentCoinSymbol.toUpperCase()} Price (USD)`,
                    data: priceData,
                    borderColor: lineColor,
                    backgroundColor: gradient,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: lineColor,
                    pointHoverBorderColor: '#ffffff',
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxTicksLimit: 10,
                            color: '#848e9c'
                        }
                    },
                    y: {
                        display: true,
                        grid: {
                            color: 'rgba(132, 142, 156, 0.1)'
                        },
                        ticks: {
                            color: '#848e9c',
                            callback: function(value) {
                                return '$' + value.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 8
                                });
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: lineColor,
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            title: function(context) {
                                return labels[context[0].dataIndex];
                            },
                            label: function(context) {
                                const price = context.parsed.y;
                                return `Price: $${price.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 8
                                })}`;
                            }
                        }
                    }
                }
            }
        };

        this.chart = new Chart(ctx, config);
    }

    renderFallbackChart() {
        // Generate simple fallback data
        const dataPoints = this.currentPeriod === '1' ? 24 : this.currentPeriod === '7' ? 7 : this.currentPeriod === '30' ? 30 : 365;
        const interval = this.currentPeriod === '1' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
        const basePrice = this.getBasePriceForSymbol(this.currentCoinSymbol);
        
        const mockData = {
            prices: Array.from({ length: dataPoints }, (_, i) => {
                const timestamp = Date.now() - (dataPoints - 1 - i) * interval;
                const price = basePrice * (1 + (Math.random() - 0.5) * 0.1); // ±5% variation
                return [timestamp, price];
            })
        };
        
        this.renderChart(mockData);
    }

    getBasePriceForSymbol(symbol) {
        const basePrices = {
            'BTC': 65000,
            'ETH': 3500,
            'BNB': 600,
            'XRP': 0.6,
            'ADA': 0.5,
            'SOL': 150,
            'DOGE': 0.1,
            'MATIC': 1.2,
            'AVAX': 35,
            'LINK': 12,
            'LTC': 85
        };
        
        return basePrices[symbol?.toUpperCase()] || 100;
    }

    showLoading(show) {
        if (show) {
            this.chartLoading.style.display = 'flex';
            this.chartCanvas.style.opacity = '0.3';
        } else {
            this.chartLoading.style.display = 'none';
            this.chartCanvas.style.opacity = '1';
        }
    }

    showError(message) {
        // Create or update error display
        let errorDiv = document.getElementById('chartError');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'chartError';
            errorDiv.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(246, 70, 93, 0.1);
                color: #f6465d;
                padding: 1.5rem;
                border-radius: 12px;
                border: 1px solid rgba(246, 70, 93, 0.3);
                text-align: center;
                z-index: 11;
                max-width: 80%;
                font-size: 0.9rem;
                line-height: 1.5;
            `;
            this.chartCanvas.parentElement.appendChild(errorDiv);
        }
        
        errorDiv.innerHTML = `
            <div style="margin-bottom: 0.5rem;">⚠️</div>
            <div>${message}</div>
            <div style="margin-top: 0.5rem; font-size: 0.8rem; opacity: 0.8;">
                Try refreshing or selecting a different time period
            </div>
        `;
        errorDiv.style.display = 'block';
        
        // Hide after 8 seconds
        setTimeout(() => {
            if (errorDiv) {
                errorDiv.style.display = 'none';
            }
        }, 8000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CryptoCharts();
});