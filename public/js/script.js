function updateCryptoDisplay(cryptos) {
    if (cryptoTableBody) {
        cryptoTableBody.innerHTML = '';
        cryptos.forEach(crypto => {
            const row = `<tr data-crypto-id="${crypto.id}">
                <td>${crypto.name}</td>
                <td>${crypto.symbol}</td>
                <td class="current-price">$${crypto.current_price ? formatPrice(crypto.current_price) : 'N/A'}</td>
                <td>$${formatNumber(crypto.market_cap)}</td>
                <td>$${formatNumber(crypto.total_volume)}</td>
                <td>
                    <form action="/crypto/buy" method="POST" class="buy-form">
                        <input type="hidden" name="coinId" value="${crypto.id}">
                        <input type="hidden" name="price" value="${crypto.current_price}">
                        <input type="number" 
                               name="quantity" 
                               placeholder="Quantity" 
                               required 
                               min="0.000001" 
                               step="0.000001"
                               class="quantity-input">
                        <button type="submit" class="btn-buy">Buy</button>
                    </form>
                </td>
            </tr>`;
            cryptoTableBody.innerHTML += row;
        });
    }
}

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

async function fetchAndDisplayCryptos() {
    try {
        const response = await fetch('/crypto');
        if (response.ok) {
            const freshData = await response.json();
            updateCryptoDisplay(freshData);
        } else {
            console.error('Error fetching crypto data:', response.status);
        }
    } catch (error) {
        console.error('Error fetching crypto data:', error);
    }
}