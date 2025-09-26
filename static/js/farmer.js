// Farmer-specific functionality
class FarmerDashboard {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadCrops();
        this.loadOrders();
        this.setupCropForm();
    }

    setupEventListeners() {
        // Crop management
        document.addEventListener('click', (e) => {
            if (e.target.matches('.edit-crop')) {
                this.editCrop(e.target.dataset.cropId);
            }
            if (e.target.matches('.delete-crop')) {
                this.deleteCrop(e.target.dataset.cropId);
            }
            if (e.target.matches('.update-order-status')) {
                this.updateOrderStatus(e.target.dataset.orderId, e.target.dataset.status);
            }
        });

        // Market price updates
        document.addEventListener('change', (e) => {
            if (e.target.matches('#crop-name-select')) {
                this.updateMarketPrices(e.target.value);
            }
        });
    }

    setupCropForm() {
        const form = document.getElementById('add-crop-form');
        if (!form) return;

        // Add form validation
        form.addEventListener('submit', (e) => {
            if (!this.validateCropForm(form)) {
                e.preventDefault();
                return false;
            }
        });

        // Auto-populate location from user profile
        const locationField = form.querySelector('#location');
        const countyField = form.querySelector('#county');
        
        if (locationField && !locationField.value) {
            locationField.value = document.body.dataset.userLocation || '';
        }
        if (countyField && !countyField.value) {
            countyField.value = document.body.dataset.userCounty || '';
        }
    }

    validateCropForm(form) {
        const required = ['name', 'category', 'quantity', 'unit', 'price_per_unit'];
        let isValid = true;

        required.forEach(field => {
            const input = form.querySelector(`[name="${field}"]`);
            if (!input || !input.value.trim()) {
                this.showFieldError(input, `${field} is required`);
                isValid = false;
            } else {
                this.clearFieldError(input);
            }
        });

        // Validate numeric fields
        const quantity = form.querySelector('[name="quantity"]').value;
        const price = form.querySelector('[name="price_per_unit"]').value;

        if (quantity && (isNaN(quantity) || parseFloat(quantity) <= 0)) {
            this.showFieldError(form.querySelector('[name="quantity"]'), 'Quantity must be a positive number');
            isValid = false;
        }

        if (price && (isNaN(price) || parseFloat(price) <= 0)) {
            this.showFieldError(form.querySelector('[name="price_per_unit"]'), 'Price must be a positive number');
            isValid = false;
        }

        return isValid;
    }

    showFieldError(input, message) {
        this.clearFieldError(input);
        
        const error = document.createElement('div');
        error.className = 'invalid-feedback';
        error.textContent = message;
        
        input.classList.add('is-invalid');
        input.parentElement.appendChild(error);
    }

    clearFieldError(input) {
        input.classList.remove('is-invalid');
        const error = input.parentElement.querySelector('.invalid-feedback');
        if (error) error.remove();
    }

    async loadCrops() {
        try {
            const response = await fetch('/api/crops', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.renderCropsList(data.crops || []);
            }
        } catch (error) {
            console.error('Failed to load crops:', error);
            window.agriApp.showMessage('Failed to load crops', 'error');
        }
    }

    renderCropsList(crops) {
        const container = document.getElementById('crops-list');
        if (!container) return;

        if (crops.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-seedling fa-3x text-muted mb-3"></i>
                    <h4>No crops listed yet</h4>
                    <p class="text-muted">Start by adding your first crop listing</p>
                </div>
            `;
            return;
        }

        container.innerHTML = crops.map(crop => `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card crop-card">
                    ${crop.image_filename ? `
                        <img src="/static/uploads/${crop.image_filename}" class="card-img-top crop-image" alt="${crop.name}">
                    ` : `
                        <div class="card-img-top crop-image bg-light d-flex align-items-center justify-content-center">
                            <i class="fas fa-image fa-2x text-muted"></i>
                        </div>
                    `}
                    <div class="card-body">
                        <h5 class="card-title">${crop.name}</h5>
                        <p class="card-text">
                            <small class="text-muted">${crop.category}</small><br>
                            <strong>${crop.quantity} ${crop.unit}</strong><br>
                            <span class="price-badge">${window.agriApp.formatCurrency(crop.price_per_unit)}/${crop.unit}</span>
                        </p>
                        <p class="card-text">
                            <small class="text-muted">
                                <i class="fas fa-map-marker-alt"></i> ${crop.location || crop.county}
                            </small>
                        </p>
                        <div class="d-flex justify-content-between">
                            <button class="btn btn-sm btn-outline-primary edit-crop" data-crop-id="${crop.id}">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-outline-danger delete-crop" data-crop-id="${crop.id}">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async loadOrders() {
        try {
            const response = await fetch('/api/orders', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.renderOrdersList(data.orders || []);
            }
        } catch (error) {
            console.error('Failed to load orders:', error);
            window.agriApp.showMessage('Failed to load orders', 'error');
        }
    }

    renderOrdersList(orders) {
        const container = document.getElementById('orders-list');
        if (!container) return;

        if (orders.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-shopping-cart fa-3x text-muted mb-3"></i>
                    <h4>No orders yet</h4>
                    <p class="text-muted">Orders from buyers will appear here</p>
                </div>
            `;
            return;
        }

        container.innerHTML = orders.map(order => `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-8">
                            <h5 class="mb-1">${order.crop_name}</h5>
                            <p class="mb-1">
                                <strong>Buyer:</strong> ${order.buyer_name}<br>
                                <strong>Quantity:</strong> ${order.quantity}<br>
                                <strong>Total:</strong> ${window.agriApp.formatCurrency(order.total_amount)}
                            </p>
                            <small class="text-muted">Ordered on ${window.agriApp.formatDate(order.created_at)}</small>
                        </div>
                        <div class="col-md-4 text-end">
                            <span class="badge status-badge status-${order.status}">${order.status.toUpperCase()}</span>
                            ${this.renderOrderActions(order)}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderOrderActions(order) {
        switch (order.status) {
            case 'pending':
                return `
                    <div class="mt-2">
                        <button class="btn btn-sm btn-success update-order-status me-1" 
                                data-order-id="${order.id}" data-status="accepted">
                            Accept
                        </button>
                        <button class="btn btn-sm btn-danger update-order-status" 
                                data-order-id="${order.id}" data-status="rejected">
                            Reject
                        </button>
                    </div>
                `;
            case 'accepted':
                return `
                    <div class="mt-2">
                        <button class="btn btn-sm btn-info update-order-status" 
                                data-order-id="${order.id}" data-status="delivered">
                            Mark Delivered
                        </button>
                    </div>
                `;
            default:
                return '';
        }
    }

    async updateOrderStatus(orderId, status) {
        try {
            const response = await fetch(`/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status }),
                credentials: 'include'
            });

            const result = await response.json();
            
            if (result.success) {
                window.agriApp.showMessage(result.message, 'success');
                this.loadOrders(); // Refresh orders list
            } else {
                window.agriApp.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('Failed to update order status:', error);
            window.agriApp.showMessage('Failed to update order status', 'error');
        }
    }

    async updateMarketPrices(cropName) {
        try {
            const response = await fetch(`/api/market-prices?crop_name=${encodeURIComponent(cropName)}`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.displayMarketPrices(data.prices || []);
            }
        } catch (error) {
            console.error('Failed to load market prices:', error);
        }
    }

    displayMarketPrices(prices) {
        const container = document.getElementById('market-prices');
        if (!container) return;

        if (prices.length === 0) {
            container.innerHTML = '<p class="text-muted">No market price data available</p>';
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Location</th>
                            <th>Average Price</th>
                            <th>Date</th>
                            <th>Source</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${prices.map(price => `
                            <tr>
                                <td>${price.location}</td>
                                <td>${window.agriApp.formatCurrency(price.average_price)}</td>
                                <td>${window.agriApp.formatDate(price.date)}</td>
                                <td><small class="text-muted">${price.source}</small></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    async editCrop(cropId) {
        // TODO: Implement crop editing functionality
        window.agriApp.showMessage('Crop editing coming soon!', 'info');
    }

    async deleteCrop(cropId) {
        if (!confirm('Are you sure you want to delete this crop listing?')) {
            return;
        }

        try {
            const response = await fetch(`/api/crops/${cropId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const result = await response.json();
            
            if (result.success) {
                window.agriApp.showMessage('Crop deleted successfully', 'success');
                this.loadCrops(); // Refresh crops list
            } else {
                window.agriApp.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('Failed to delete crop:', error);
            window.agriApp.showMessage('Failed to delete crop', 'error');
        }
    }
}

// Initialize farmer dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.userType === 'farmer') {
        window.farmerDashboard = new FarmerDashboard();
    }
});
