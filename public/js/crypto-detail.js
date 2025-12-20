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
});

let priceChart = null;
let currentTimeframe = '24h';
let chartResizeObserver = null;

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
