/**
 * Crypto Detail Page JavaScript
 * Handles chart rendering, tab switching, trading forms, and real-time updates
 */

document.addEventListener('DOMContentLoaded', function() {
    initializeChart();
    setupTradingPanel();
    setupTimeframeButtons();
    setupOrderTypeButtons();
    setupTotalCalculations();
    setupMarketSentiment();
});

let priceChart = null;
let currentTimeframe = '24h';
let chartResizeObserver = null;
let sentimentModule = null;

/**
 * Initialize the price chart
 */
function initializeChart() {
    const ctx = document.getElementById('detailChart');
    if (!ctx) return;
    
    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
    const chartContainer = document.querySelector('.chart-container-detail');
    registerZoomPlugin();
    
    // Get initial chart data from window object
    const chartData = window.coinData?.chartData || [];
    
    const labels = chartData.map(point => new Date(point[0]));
    const prices = chartData.map(point => point[1]);
    
    // Determine gradient colors based on price trend
    const firstPrice = prices[0] || 0;
    const lastPrice = prices[prices.length - 1] || 0;
    const isPositive = lastPrice >= firstPrice;
    
    const gradientColor = isPositive ? 'rgba(2, 192, 118, 0.1)' : 'rgba(246, 70, 93, 0.1)';
    const lineColor = isPositive ? '#02c076' : '#f6465d';
    
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Price (USD)',
                data: prices,
                borderColor: lineColor,
                backgroundColor: gradientColor,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
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
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: isDarkTheme ? '#1e2329' : '#ffffff',
                    titleColor: isDarkTheme ? '#eaecef' : '#1a1a1a',
                    bodyColor: isDarkTheme ? '#eaecef' : '#1a1a1a',
                    borderColor: isDarkTheme ? '#2b2f36' : '#e2e8f0',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        title: function(context) {
                            const date = new Date(context[0].label);
                            return date.toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                        },
                        label: function(context) {
                            return '$' + formatPrice(context.parsed.y);
                        }
                    }
                },
                zoom: {
                    zoom: {
                        wheel: {
                            enabled: true
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x',
                        drag: {
                            enabled: false
                        }
                    },
                    pan: {
                        enabled: true,
                        mode: 'x'
                    },
                    limits: {
                        y: { min: 'original', max: 'original' }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: isDarkTheme ? '#848e9c' : '#718096',
                        maxTicksLimit: 8,
                        callback: function(value, index, values) {
                            const date = new Date(this.getLabelForValue(value));
                            if (currentTimeframe === '1h' || currentTimeframe === '24h') {
                                return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                            }
                            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        }
                    }
                },
                y: {
                    display: true,
                    position: 'right',
                    grid: {
                        color: isDarkTheme ? 'rgba(43, 47, 54, 0.3)' : 'rgba(203, 213, 224, 0.3)',
                        drawBorder: false
                    },
                    ticks: {
                        color: isDarkTheme ? '#848e9c' : '#718096',
                        callback: function(value) {
                            return '$' + formatPriceShort(value);
                        }
                    }
                }
            }
        }
    });
    
    if (chartContainer) {
        setupChartResizeObserver(chartContainer);
    }
    
    ctx.addEventListener('dblclick', () => {
        if (priceChart?.resetZoom) {
            priceChart.resetZoom();
        }
    });
    
    // Hide loading indicator
    const loadingEl = document.getElementById('chartLoading');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

function registerZoomPlugin() {
    const zoomPlugin = window.ChartZoom || window.ChartjsPluginZoom || window['chartjs-plugin-zoom'];
    if (zoomPlugin && Chart?.register) {
        try {
            Chart.register(zoomPlugin);
        } catch (err) {
            console.error('Zoom plugin registration failed', err);
        }
    }
}

function setupChartResizeObserver(container) {
    if (chartResizeObserver) {
        chartResizeObserver.disconnect();
    }
    chartResizeObserver = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.contentRect.width > 0 && priceChart) {
                priceChart.resize();
            }
        });
    });
    chartResizeObserver.observe(container);
}

/**
 * Setup trading panel (buy/sell toggle)
 */
function setupTradingPanel() {
    const tradingTabs = document.querySelectorAll('.trading-tab');
    const tradingForms = document.querySelectorAll('.trading-form');
    
    tradingTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const action = tab.getAttribute('data-action');
            
            // Remove active class from all tabs and forms
            tradingTabs.forEach(t => t.classList.remove('active'));
            tradingForms.forEach(form => form.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding form
            tab.classList.add('active');
            const targetForm = document.getElementById(`${action}-form`);
            if (targetForm) {
                targetForm.classList.add('active');
            }
        });
    });
}

/**
 * Setup timeframe button functionality
 */
function setupTimeframeButtons() {
    const timeframeButtons = document.querySelectorAll('.timeframe-btn-bottom');

    timeframeButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const timeframe = button.getAttribute('data-timeframe');

            timeframeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            currentTimeframe = timeframe;
            await loadChartData(timeframe);
        });
    });
}

/**
 * Setup order type buttons
 */
function setupOrderTypeButtons() {
    const orderTypeButtons = document.querySelectorAll('.order-type-btn');

    orderTypeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const orderAction = button.getAttribute('data-order-action');
            const container = button.closest('.order-type-buttons');
            const buttons = container.querySelectorAll('.order-type-btn');

            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            toggleLimitFields(orderAction, button.getAttribute('data-order-type'));
            updateTotals(orderAction);
        });
    });

    ['buy', 'sell'].forEach(action => toggleLimitFields(action, 'market'));
}

/**
 * Setup total calculations for buy/sell forms
 */
function setupTotalCalculations() {
    ['buy', 'sell'].forEach(action => {
        const qtyInput = document.getElementById(`${action}Quantity`);
        const limitInput = document.getElementById(`${action}LimitPrice`);

        if (qtyInput) {
            qtyInput.addEventListener('input', () => updateTotals(action));
        }

        if (limitInput) {
            limitInput.addEventListener('input', () => updateTotals(action));
        }

        updateTotals(action);
    });
}

/**
 * Load chart data for different timeframes
 */
async function loadChartData(timeframe) {
    if (!priceChart) return;

    const loadingEl = document.getElementById('chartLoading');
    if (loadingEl) {
        loadingEl.style.display = 'flex';
    }

    try {
        const coinId = window.coinData?.id;
        const response = await fetch(`/crypto/chart-data/${coinId}?timeframe=${timeframe}`);
        const data = await response.json();

        if (data && data.prices) {
            const labels = data.prices.map(point => new Date(point[0]));
            const prices = data.prices.map(point => point[1]);

            const firstPrice = prices[0] || 0;
            const lastPrice = prices[prices.length - 1] || 0;
            const isPositive = lastPrice >= firstPrice;

            const gradientColor = isPositive ? 'rgba(2, 192, 118, 0.1)' : 'rgba(246, 70, 93, 0.1)';
            const lineColor = isPositive ? '#02c076' : '#f6465d';

            priceChart.data.labels = labels;
            priceChart.data.datasets[0].data = prices;
            priceChart.data.datasets[0].borderColor = lineColor;
            priceChart.data.datasets[0].backgroundColor = gradientColor;
            priceChart.data.datasets[0].pointHoverBackgroundColor = lineColor;

            if (priceChart.resetZoom) {
                priceChart.resetZoom();
            }
            priceChart.update('none');
        }
    } catch (error) {
        console.error('Error loading chart data:', error);
    } finally {
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    }
}

function toggleLimitFields(action, orderType) {
    const limitInput = document.getElementById(`${action}LimitPrice`);
    const hiddenPrice = document.getElementById(`${action}PriceHidden`);
    if (!limitInput || !hiddenPrice) return;

    if (orderType === 'limit') {
        limitInput.disabled = false;
        limitInput.placeholder = 'Set your limit price';
        if (!limitInput.value) {
            limitInput.value = (window.coinData?.currentPrice || 0).toFixed(2);
        }
        hiddenPrice.value = limitInput.value;
    } else {
        limitInput.disabled = true;
        limitInput.value = '';
        limitInput.placeholder = 'Using market price';
        hiddenPrice.value = window.coinData?.currentPrice || 0;
    }
}

function updateTotals(action) {
    const qtyInput = document.getElementById(`${action}Quantity`);
    const limitInput = document.getElementById(`${action}LimitPrice`);
    const totalElement = document.getElementById(`${action}Total`);
    const fiatHint = document.getElementById(`${action}FiatHint`);
    const hiddenPrice = document.getElementById(`${action}PriceHidden`);
    if (!qtyInput || !totalElement || !hiddenPrice) return;

    const quantity = parseFloat(qtyInput.value) || 0;
    const isLimit = limitInput && !limitInput.disabled;
    const pricePerUnit = isLimit
        ? (parseFloat(limitInput.value) || 0)
        : (window.coinData?.currentPrice || 0);

    const total = quantity * pricePerUnit;

    hiddenPrice.value = pricePerUnit || 0;

    if (totalElement) {
        totalElement.textContent = '$' + formatPrice(total);
    }

    if (fiatHint) {
        fiatHint.textContent = `$${formatPrice(total)}`;
    }

    // Check for insufficient balance on buy
    if (action === 'buy') {
        const walletBalance = parseFloat(document.querySelector('.balance-amount')?.textContent.replace('$', '').replace(',', '')) || 0;
        const buyErrorBox = document.getElementById('buy-error-message');
        if (total > walletBalance) {
            buyErrorBox.textContent = 'Insufficient balance to make this purchase.';
            buyErrorBox.style.display = 'block';
        } else {
            buyErrorBox.style.display = 'none';
        }
    }
}

/**
 * Format price with appropriate decimal places
 */
function formatPrice(price) {
    if (price >= 1) {
        return price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    } else if (price >= 0.01) {
        return price.toFixed(4);
    } else {
        return price.toFixed(8);
    }
}

/**
 * Format price for chart axis (shorter version)
 */
function formatPriceShort(price) {
    if (price >= 1000) {
        return (price / 1000).toFixed(1) + 'K';
    } else if (price >= 1) {
        return price.toFixed(2);
    } else {
        return price.toFixed(4);
    }
}

/**
 * Market Sentiment (mocked order flow + buy/sell pressure)
 */
function setupMarketSentiment() {
    const container = document.getElementById('market-sentiment');
    if (!container) return;

    sentimentModule = new MarketSentiment(container, {
        basePrice: window.coinData?.currentPrice || 100,
        rowCount: 9,
        updateIntervalMs: 1400
    });
}

class MarketSentiment {
    constructor(container, options = {}) {
        this.container = container;
        this.basePrice = Math.max(options.basePrice || 100, 0.01);
        this.rowCount = options.rowCount || 8;
        this.updateIntervalMs = options.updateIntervalMs || 1500;

        this.tableBody = container.querySelector('#orderflow-body');
        this.buyFill = container.querySelector('#sentiment-buy-fill');
        this.sellFill = container.querySelector('#sentiment-sell-fill');
        this.buyPercentEl = container.querySelector('#sentiment-buy-percent');
        this.sellPercentEl = container.querySelector('#sentiment-sell-percent');
        this.pressureEl = container.querySelector('#sentiment-pressure-label');
        this.updatedEl = container.querySelector('#sentiment-updated');

        this.orderFlow = this.buildOrderFlow();
        this.rowRefs = [];

        this.renderRows();
        this.updateUI();
        this.start();

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pause();
            } else {
                this.resume();
            }
        });
    }

    start() {
        this.pause();
        this.timer = setInterval(() => this.tick(), this.updateIntervalMs);
    }

    pause() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    resume() {
        if (!this.timer) {
            this.start();
        }
    }

    tick() {
        this.orderFlow = this.orderFlow.map((entry) => this.nudgeEntry(entry));

        // Occasionally inject a fresh row to keep values lively
        if (Math.random() > 0.6) {
            const replaceIndex = Math.floor(Math.random() * this.orderFlow.length);
            this.orderFlow[replaceIndex] = this.createEntry();
        }

        this.updateUI();
    }

    buildOrderFlow() {
        return Array.from({ length: this.rowCount }, () => this.createEntry());
    }

    createEntry() {
        const drift = (Math.random() - 0.5) * 0.01;
        return {
            price: this.roundPrice(this.basePrice * (1 + drift)),
            buyQty: this.randomQty(),
            sellQty: this.randomQty()
        };
    }

    nudgeEntry(entry) {
        const priceDrift = 1 + (Math.random() - 0.5) * 0.004;
        entry.price = this.roundPrice(entry.price * priceDrift);

        entry.buyQty = this.nudgeQty(entry.buyQty);
        entry.sellQty = this.nudgeQty(entry.sellQty);

        if (Math.random() > 0.7) {
            entry.buyQty += Math.random() * 1.2;
        }
        if (Math.random() > 0.7) {
            entry.sellQty += Math.random() * 1.2;
        }

        return entry;
    }

    randomQty() {
        return Math.max(0.01, +(Math.random() * 3 + 0.15).toFixed(3));
    }

    nudgeQty(qty) {
        return Math.max(0.01, +(qty * (0.85 + Math.random() * 0.35)).toFixed(3));
    }

    roundPrice(value) {
        if (value >= 1) return +value.toFixed(2);
        if (value >= 0.1) return +value.toFixed(4);
        return +value.toFixed(6);
    }

    renderRows() {
        if (!this.tableBody) return;

        this.tableBody.innerHTML = '';
        this.rowRefs = [];

        this.orderFlow.forEach((entry) => {
            const row = document.createElement('tr');

            const priceCell = document.createElement('td');
            const buyCell = document.createElement('td');
            const sellCell = document.createElement('td');

            priceCell.classList.add('orderflow-price-buy');
            buyCell.classList.add('orderflow-qty-buy');
            sellCell.classList.add('orderflow-qty-sell');

            row.appendChild(priceCell);
            row.appendChild(buyCell);
            row.appendChild(sellCell);

            this.tableBody.appendChild(row);
            this.rowRefs.push({ row, priceCell, buyCell, sellCell });
        });
    }

    updateUI() {
        this.updatePercents();
        this.updateRows();
        this.markUpdated();
    }

    updatePercents() {
        const totals = this.orderFlow.reduce(
            (acc, entry) => {
                acc.buy += entry.buyQty;
                acc.sell += entry.sellQty;
                return acc;
            },
            { buy: 0, sell: 0 }
        );

        const combined = totals.buy + totals.sell;
        const buyPercent = combined ? (totals.buy / combined) * 100 : 50;
        const sellPercent = 100 - buyPercent;

        if (this.buyFill) {
            this.buyFill.style.width = `${buyPercent.toFixed(1)}%`;
        }
        if (this.sellFill) {
            this.sellFill.style.width = `${sellPercent.toFixed(1)}%`;
        }
        if (this.buyPercentEl) {
            this.buyPercentEl.textContent = `${buyPercent.toFixed(1)}%`;
        }
        if (this.sellPercentEl) {
            this.sellPercentEl.textContent = `${sellPercent.toFixed(1)}%`;
        }

        if (this.pressureEl) {
            const pressureClass = buyPercent > sellPercent + 2 ? 'buy' : sellPercent > buyPercent + 2 ? 'sell' : 'balanced';
            this.pressureEl.textContent = pressureClass === 'buy' ? 'Buying' : pressureClass === 'sell' ? 'Selling' : 'Balanced';
            this.pressureEl.className = pressureClass;
        }
    }

    updateRows() {
        if (!this.rowRefs.length) return;

        const maxVolume = Math.max(...this.orderFlow.map((entry) => entry.buyQty + entry.sellQty), 1);

        this.orderFlow.forEach((entry, idx) => {
            const ref = this.rowRefs[idx];
            if (!ref) return;

            const dominant = entry.buyQty >= entry.sellQty ? 'buy' : 'sell';
            const intensity = Math.min(1, (entry.buyQty + entry.sellQty) / maxVolume);
            const baseColor = dominant === 'buy' ? '2, 192, 118' : '246, 70, 93';
            const tint = 0.06 + intensity * 0.12;

            ref.priceCell.textContent = `$${formatPrice(entry.price)}`;
            ref.buyCell.textContent = this.formatQty(entry.buyQty);
            ref.sellCell.textContent = this.formatQty(entry.sellQty);

            ref.priceCell.className = dominant === 'buy' ? 'orderflow-price-buy' : 'orderflow-price-sell';

            ref.row.style.backgroundColor = `rgba(${baseColor}, ${tint})`;
            ref.row.setAttribute('data-dominant', dominant);
        });
    }

    formatQty(qty) {
        if (qty >= 1) return qty.toFixed(2);
        return qty.toFixed(3);
    }

    markUpdated() {
        if (!this.updatedEl) return;
        const now = new Date();
        this.updatedEl.textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }
}

/**
 * Update theme when theme toggle is clicked
 */
document.addEventListener('themeChanged', function() {
    if (priceChart) {
        const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
        
        // Update chart colors
        priceChart.options.plugins.tooltip.backgroundColor = isDarkTheme ? '#1e2329' : '#ffffff';
        priceChart.options.plugins.tooltip.titleColor = isDarkTheme ? '#eaecef' : '#1a1a1a';
        priceChart.options.plugins.tooltip.bodyColor = isDarkTheme ? '#eaecef' : '#1a1a1a';
        priceChart.options.plugins.tooltip.borderColor = isDarkTheme ? '#2b2f36' : '#e2e8f0';
        
        priceChart.options.scales.x.ticks.color = isDarkTheme ? '#848e9c' : '#718096';
        priceChart.options.scales.y.ticks.color = isDarkTheme ? '#848e9c' : '#718096';
        priceChart.options.scales.y.grid.color = isDarkTheme ? 'rgba(43, 47, 54, 0.3)' : 'rgba(203, 213, 224, 0.3)';
        
        priceChart.update();
    }
});
