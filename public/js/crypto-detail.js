/**
 * Crypto Detail Page JavaScript
 * Handles chart rendering, tab switching, trading forms, and real-time updates
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize chart
    initializeChart();
    
    // Setup trading panel
    setupTradingPanel();
    
    // Setup timeframe buttons
    setupTimeframeButtons();
    
    // Setup order type buttons
    setupOrderTypeButtons();
    
    // Calculate totals
    setupTotalCalculations();
});

let priceChart = null;
let currentTimeframe = '1';

/**
 * Initialize the price chart
 */
function initializeChart() {
    const ctx = document.getElementById('detailChart');
    if (!ctx) return;
    
    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
    
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
                            if (currentTimeframe === '1') {
                                return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                            } else {
                                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            }
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
    
    // Hide loading indicator
    const loadingEl = document.getElementById('chartLoading');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
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
            const days = button.getAttribute('data-days');
            
            // Remove active class from all buttons
            timeframeButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Update current timeframe
            currentTimeframe = days === 'max' ? '365' : days;
            
            // Load new chart data
            await loadChartData(days);
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
            const container = button.closest('.order-type-buttons');
            const buttons = container.querySelectorAll('.order-type-btn');
            
            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });
}

/**
 * Setup total calculations for buy/sell forms
 */
function setupTotalCalculations() {
    const buyQuantityInput = document.getElementById('buyQuantity');
    const sellQuantityInput = document.getElementById('sellQuantity');
    const currentPrice = window.coinData?.currentPrice || 0;
    
    if (buyQuantityInput) {
        buyQuantityInput.addEventListener('input', (e) => {
            const quantity = parseFloat(e.target.value) || 0;
            const total = quantity * currentPrice;
            const totalElement = document.getElementById('buyTotal');
            if (totalElement) {
                totalElement.textContent = '$' + formatPrice(total);
            }
        });
    }
    
    if (sellQuantityInput) {
        sellQuantityInput.addEventListener('input', (e) => {
            const quantity = parseFloat(e.target.value) || 0;
            const total = quantity * currentPrice;
            const totalElement = document.getElementById('sellTotal');
            if (totalElement) {
                totalElement.textContent = '$' + formatPrice(total);
            }
        });
    }
}

/**
 * Load chart data for different timeframes
 */
async function loadChartData(days) {
    if (!priceChart) return;
    
    const loadingEl = document.getElementById('chartLoading');
    if (loadingEl) {
        loadingEl.style.display = 'flex';
    }
    
    try {
        const coinId = window.coinData?.id;
        const daysParam = days === 'max' ? 'max' : days;
        
        const response = await fetch(`/crypto/chart-data/${coinId}?days=${daysParam}`);
        const data = await response.json();
        
        if (data && data.prices) {
            const labels = data.prices.map(point => new Date(point[0]));
            const prices = data.prices.map(point => point[1]);
            
            // Determine if price is up or down
            const firstPrice = prices[0] || 0;
            const lastPrice = prices[prices.length - 1] || 0;
            const isPositive = lastPrice >= firstPrice;
            
            const gradientColor = isPositive ? 'rgba(2, 192, 118, 0.1)' : 'rgba(246, 70, 93, 0.1)';
            const lineColor = isPositive ? '#02c076' : '#f6465d';
            
            // Update chart data
            priceChart.data.labels = labels;
            priceChart.data.datasets[0].data = prices;
            priceChart.data.datasets[0].borderColor = lineColor;
            priceChart.data.datasets[0].backgroundColor = gradientColor;
            priceChart.data.datasets[0].pointHoverBackgroundColor = lineColor;
            
            priceChart.update('none'); // Update without animation for smoother transition
        }
    } catch (error) {
        console.error('Error loading chart data:', error);
    } finally {
        if (loadingEl) {
            loadingEl.style.display = 'none';
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
