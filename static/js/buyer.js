// Buyer-specific functionality
class BuyerDashboard {
    constructor() {
        this.filters = {
            category: '',
            county: '',
            max_price: '',
            search: ''
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadCrops();
        this.loadOrders();
        this.setupFilters();
    }

    setupEventListeners() {
        // Crop actions
        document.addEventListener('click', (e) => {
            if (e.target.matches('.place-order-btn')) {
                this.showOrderModal(e.target.dataset.cropId);
            }
            if (e.target.matches('.view-crop-details')) {
                this.viewCropDetails(e.target.dataset.cropId);
            }
            if (e.target.matches('.contact-farmer')) {
                this.contactFarmer(e.target.dataset.farmerId);
            }
            if (e.target.matches('.pay-order')) {
                this.initiatePayment(e.target.dataset.orderId);
            }
        });

        // Filter changes
        document.addEventListener('change', (e) => {
            if (e.target.matches('.crop-filter')) {
                this.updateFilters();
            }
        });

        document.addEventListener('input', (e) => {
            if (e.target.matches('#search-crops')) {
                this.debounce(() => this.updateFilters(), 500)();
            }
        });
    }

    setupFilters() {
        // Populate filter dropdowns
        this.populateCounties();
        this.populateCategories();
    }

    async populateCounties() {
        try {
            const response = await fetch('/api/locations', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                const select = document.getElementById('county-filter');
                
                if (select && data.counties) {
                    select.innerHTML = '<option value="">All Counties</option>' +
                        data.counties.map(county => `<option value="${county}">${county}</option>`).join('');
                }
            }
        } catch (error) {
            console.error('Failed to load counties:', error);
        }
    }

    populateCategories() {
        const categories = [
            'Cereals', 'Legumes', 'Vegetables', 'Fruits', 
            'Root Tubers', 'Cash Crops', 'Herbs & Spices'
        ];
        
        const select = document.getElementById('category-filter');
        if (select) {
            select.innerHTML = '<option value="">All Categories</option>' +
                categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        }
    }

    updateFilters() {
        // Collect filter values
        this.filters.category = document.getElementById('category-filter')?.value || '';
        this.filters.county = document.getElementById('county-filter')?.value || '';
        this.filters.max_price = document.getElementById('price-filter')?.value || '';
        this.filters.search = document.getElementById('search-crops')?.value || '';

        // Reload crops with filters
        this.loadCrops();
    }

    async loadCrops() {
        try {
            const params = new URLSearchParams();
            Object.entries(this.filters).forEach(([key, value]) => {
                if (value) params.append(key, value);
            });

            const response = await fetch(`/api/crops?${params.toString()}`, {
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
                    <i class="fas fa-search fa-3x text-muted mb-3"></i>
                    <h4>No crops found</h4>
                    <p class="text-muted">Try adjusting your search filters</p>
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
                            <strong>Available: ${crop.quantity} ${crop.unit}</strong><br>
                            <span class="price-badge">${window.agriApp.formatCurrency(crop.price_per_unit)}/${crop.unit}</span>
                        </p>
                        <div class="d-flex align-items-center mb-2">
                            <div class="farmer-rating me-2">
                                ${this.renderStars(crop.farmer_rating)}
                            </div>
                            <small class="text-muted">${crop.farmer_name}</small>
                        </div>
                        <p class="card-text">
                            <small class="text-muted">
                                <i class="fas fa-map-marker-alt"></i> ${crop.location || crop.county}
                            </small>
                        </p>
                        ${crop.quality_grade ? `
                            <span class="badge bg-success mb-2">Grade ${crop.quality_grade}</span>
                        ` : ''}
                        ${crop.harvest_date ? `
                            <p class="card-text">
                                <small class="text-muted">Harvested: ${window.agriApp.formatDate(crop.harvest_date)}</small>
                            </p>
                        ` : ''}
                        <div class="d-grid gap-2">
                            <button class="btn btn-primary place-order-btn" data-crop-id="${crop.id}">
                                <i class="fas fa-shopping-cart"></i> Place Order
                            </button>
                            <div class="btn-group" role="group">
                                <button class="btn btn-outline-secondary view-crop-details" data-crop-id="${crop.id}">
                                    <i class="fas fa-eye"></i> Details
                                </button>
                                <button class="btn btn-outline-secondary contact-farmer" data-farmer-id="${crop.farmer_id}">
                                    <i class="fas fa-comment"></i> Contact
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderStars(rating) {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

        return '★'.repeat(fullStars) + 
               (halfStar ? '☆' : '') + 
               '☆'.repeat(emptyStars);
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
                    <p class="text-muted">Start by placing your first order</p>
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
                                <strong>Farmer:</strong> ${order.farmer_name}<br>
                                <strong>Quantity:</strong> ${order.quantity}<br>
                                <strong>Total:</strong> ${window.agriApp.formatCurrency(order.total_amount)}
                            </p>
                            <small class="text-muted">Ordered on ${window.agriApp.formatDate(order.created_at)}</small>
                            ${order.delivery_date ? `
                                <br><small class="text-muted">Delivery: ${window.agriApp.formatDate(order.delivery_date)}</small>
                            ` : ''}
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
            case 'accepted':
                return `
                    <div class="mt-2">
                        <button class="btn btn-sm btn-success pay-order" data-order-id="${order.id}">
                            <i class="fas fa-credit-card"></i> Pay Now
                        </button>
                    </div>
                `;
            case 'delivered':
                return `
                    <div class="mt-2">
                        <button class="btn btn-sm btn-info update-order-status" 
                                data-order-id="${order.id}" data-status="paid">
                            Confirm Delivery
                        </button>
                    </div>
                `;
            default:
                return '';
        }
    }

    showOrderModal(cropId) {
        // Find crop details
        fetch(`/api/crops/${cropId}`, {
            credentials: 'include'
        })
        .then(response => response.json())
        .then(crop => {
            if (crop) {
                this.displayOrderModal(crop);
            }
        })
        .catch(error => {
            console.error('Failed to load crop details:', error);
            window.agriApp.showMessage('Failed to load crop details', 'error');
        });
    }

    displayOrderModal(crop) {
        const modalHtml = `
            <div class="modal fade" id="orderModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Place Order - ${crop.name}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="place-order-form" class="ajax-form" action="/api/orders" method="POST">
                            <div class="modal-body">
                                <input type="hidden" name="crop_id" value="${crop.id}">
                                
                                <div class="mb-3">
                                    <label class="form-label">Available Quantity</label>
                                    <input type="text" class="form-control" value="${crop.quantity} ${crop.unit}" readonly>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Price per ${crop.unit}</label>
                                    <input type="text" class="form-control" value="${window.agriApp.formatCurrency(crop.price_per_unit)}" readonly>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="order-quantity" class="form-label">Quantity Required *</label>
                                    <input type="number" class="form-control" id="order-quantity" name="quantity" 
                                           min="1" max="${crop.quantity}" step="0.1" required>
                                    <div class="form-text">Maximum: ${crop.quantity} ${crop.unit}</div>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="delivery-address" class="form-label">Delivery Address *</label>
                                    <textarea class="form-control" id="delivery-address" name="delivery_address" 
                                              rows="3" required></textarea>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="delivery-date" class="form-label">Preferred Delivery Date</label>
                                    <input type="date" class="form-control" id="delivery-date" name="delivery_date"
                                           min="${new Date().toISOString().split('T')[0]}">
                                </div>
                                
                                <div class="mb-3">
                                    <label for="order-notes" class="form-label">Additional Notes</label>
                                    <textarea class="form-control" id="order-notes" name="notes" rows="2"></textarea>
                                </div>
                                
                                <div class="mb-3">
                                    <h6>Order Summary</h6>
                                    <div id="order-total" class="alert alert-info">
                                        Total: <span id="calculated-total">${window.agriApp.formatCurrency(0)}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn btn-primary">Place Order</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal
        const existingModal = document.getElementById('orderModal');
        if (existingModal) existingModal.remove();

        // Add new modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('orderModal'));
        modal.show();

        // Calculate total on quantity change
        const quantityInput = document.getElementById('order-quantity');
        const totalDisplay = document.getElementById('calculated-total');
        
        quantityInput.addEventListener('input', () => {
            const quantity = parseFloat(quantityInput.value) || 0;
            const total = quantity * crop.price_per_unit;
            totalDisplay.textContent = window.agriApp.formatCurrency(total);
        });
    }

    async initiatePayment(orderId) {
        try {
            const response = await fetch('/api/payment/initiate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    order_id: orderId,
                    payment_method: 'mpesa'
                }),
                credentials: 'include'
            });

            const result = await response.json();
            
            if (result.success) {
                window.agriApp.showMessage('Payment processed successfully!', 'success');
                this.loadOrders(); // Refresh orders
            } else {
                window.agriApp.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('Payment failed:', error);
            window.agriApp.showMessage('Payment failed. Please try again.', 'error');
        }
    }

    viewCropDetails(cropId) {
        window.location.href = `/crop/${cropId}`;
    }

    contactFarmer(farmerId) {
        window.location.href = `/conversation/${farmerId}`;
    }

    // Utility function for debouncing
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize buyer dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.userType === 'buyer') {
        window.buyerDashboard = new BuyerDashboard();
    }
});
