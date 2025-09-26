// Main application JavaScript
class AgriMarketplace {
    constructor() {
        this.isOnline = navigator.onLine;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkOnlineStatus();
        this.setupPWA();
        this.loadUserData();
    }

    setupEventListeners() {
        // Online/offline status
        window.addEventListener('online', () => this.handleOnlineStatus(true));
        window.addEventListener('offline', () => this.handleOnlineStatus(false));

        // Form submissions
        document.addEventListener('submit', (e) => this.handleFormSubmit(e));

        // Navigation
        document.addEventListener('click', (e) => this.handleNavigation(e));

        // File uploads
        document.addEventListener('change', (e) => this.handleFileUpload(e));
    }

    async handleFormSubmit(e) {
        const form = e.target;
        if (!form.classList.contains('ajax-form')) return;

        e.preventDefault();
        
        const formData = new FormData(form);
        const method = form.method || 'POST';
        const action = form.action;

        try {
            this.showLoading(form);
            
            let response;
            if (method.toLowerCase() === 'post' && form.enctype === 'multipart/form-data') {
                // File upload form
                response = await fetch(action, {
                    method: method,
                    body: formData,
                    credentials: 'include'
                });
            } else {
                // Regular form
                const data = {};
                for (let [key, value] of formData.entries()) {
                    data[key] = value;
                }
                
                response = await fetch(action, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data),
                    credentials: 'include'
                });
            }

            const result = await response.json();
            
            if (result.success) {
                this.showMessage(result.message || 'Success!', 'success');
                if (result.redirect) {
                    window.location.href = result.redirect;
                } else {
                    form.reset();
                    // If the form is in a modal, close it
                    const modalEl = form.closest('.modal');
                    if (modalEl) {
                        const modal = bootstrap.Modal.getInstance(modalEl);
                        if (modal) modal.hide();
                    }
                    this.refreshCurrentData();
                }
            } else {
                this.showMessage(result.message || 'An error occurred', 'error');
            }
        } catch (error) {
            console.error('Form submission error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            this.hideLoading(form);
        }
    }

    handleNavigation(e) {
        // Handle dynamic navigation
        if (e.target.classList.contains('load-content')) {
            e.preventDefault();
            const url = e.target.href || e.target.dataset.url;
            this.loadContent(url);
        }
    }

    async handleFileUpload(e) {
        if (e.target.type !== 'file') return;

        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            this.showMessage('Please select a valid image file', 'error');
            e.target.value = '';
            return;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            this.showMessage('File size must be less than 5MB', 'error');
            e.target.value = '';
            return;
        }

        // Show preview
        this.showImagePreview(file, e.target);
    }

    showImagePreview(file, input) {
        const reader = new FileReader();
        reader.onload = (e) => {
            let preview = input.parentElement.querySelector('.image-preview');
            if (!preview) {
                preview = document.createElement('div');
                preview.className = 'image-preview mt-2';
                input.parentElement.appendChild(preview);
            }
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview" class="img-thumbnail" style="max-width: 200px;">`;
        };
        reader.readAsDataURL(file);
    }

    async loadContent(url) {
        try {
            this.showPageLoading();
            const response = await fetch(url, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const content = await response.text();
                // Update main content area
                const mainContent = document.querySelector('#main-content');
                if (mainContent) {
                    mainContent.innerHTML = content;
                }
            }
        } catch (error) {
            console.error('Content loading error:', error);
            this.showMessage('Failed to load content', 'error');
        } finally {
            this.hidePageLoading();
        }
    }

    checkOnlineStatus() {
        this.handleOnlineStatus(navigator.onLine);
    }

    handleOnlineStatus(isOnline) {
        this.isOnline = isOnline;
        
        let indicator = document.querySelector('.offline-indicator');
        if (!isOnline && !indicator) {
            indicator = document.createElement('div');
            indicator.className = 'offline-indicator';
            indicator.textContent = 'You are offline. Some features may not work.';
            document.body.insertBefore(indicator, document.body.firstChild);
        } else if (isOnline && indicator) {
            indicator.remove();
        }
    }

    setupPWA() {
        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/static/js/sw.js')
                .then(registration => {
                    console.log('SW registered: ', registration);
                })
                .catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                });
        }

        // Handle install prompt
        let deferredPrompt;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            this.showInstallPrompt();
        });

        // Handle app install
        document.addEventListener('click', (e) => {
            if (e.target.id === 'install-app') {
                e.preventDefault();
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    deferredPrompt.userChoice.then((choiceResult) => {
                        if (choiceResult.outcome === 'accepted') {
                            console.log('User accepted the A2HS prompt');
                            this.hideInstallPrompt();
                        }
                        deferredPrompt = null;
                    });
                }
            }
        });
    }

    showInstallPrompt() {
        const existingPrompt = document.querySelector('.install-prompt');
        if (existingPrompt) return;

        const prompt = document.createElement('div');
        prompt.className = 'install-prompt';
        prompt.innerHTML = `
            <div>Install AgriMarket as an app?</div>
            <div class="mt-2">
                <button id="install-app" class="btn btn-sm btn-light me-2">Install</button>
                <button class="btn btn-sm btn-outline-light" onclick="this.parentElement.parentElement.remove()">Later</button>
            </div>
        `;
        document.body.appendChild(prompt);
    }

    hideInstallPrompt() {
        const prompt = document.querySelector('.install-prompt');
        if (prompt) prompt.remove();
    }

    loadUserData() {
        // Load user-specific data if logged in
        const userType = document.body.dataset.userType;
        if (userType) {
            this.userType = userType;
            this.loadDashboardData();
        }
    }

    async loadDashboardData() {
        // Load dashboard data based on user type
        if (this.userType === 'farmer') {
            this.loadFarmerData();
        } else if (this.userType === 'buyer') {
            this.loadBuyerData();
        }
    }

    async loadFarmerData() {
        // Load farmer-specific data
        try {
            const [cropsResponse, ordersResponse] = await Promise.all([
                fetch('/api/crops', { credentials: 'include' }),
                fetch('/api/orders', { credentials: 'include' })
            ]);

            if (cropsResponse.ok && ordersResponse.ok) {
                const crops = await cropsResponse.json();
                const orders = await ordersResponse.json();
                
                this.updateDashboardStats('farmer', crops, orders);
            }
        } catch (error) {
            console.error('Failed to load farmer data:', error);
        }
    }

    async loadBuyerData() {
        // Load buyer-specific data
        try {
            const [cropsResponse, ordersResponse] = await Promise.all([
                fetch('/api/crops', { credentials: 'include' }),
                fetch('/api/orders', { credentials: 'include' })
            ]);

            if (cropsResponse.ok && ordersResponse.ok) {
                const crops = await cropsResponse.json();
                const orders = await ordersResponse.json();
                
                this.updateDashboardStats('buyer', crops, orders);
            }
        } catch (error) {
            console.error('Failed to load buyer data:', error);
        }
    }

    updateDashboardStats(userType, cropsData, ordersData) {
        // Update dashboard statistics
        const statsContainer = document.querySelector('.dashboard-stats');
        if (!statsContainer) return;

        if (userType === 'farmer') {
            const totalCrops = cropsData.crops ? cropsData.crops.length : 0;
            const totalOrders = ordersData.orders ? ordersData.orders.length : 0;
            const pendingOrders = ordersData.orders ? ordersData.orders.filter(o => o.status === 'pending').length : 0;

            statsContainer.innerHTML = `
                <div class="row">
                    <div class="col-md-4">
                        <div class="dashboard-stat text-center">
                            <h3>${totalCrops}</h3>
                            <p>Active Crops</p>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="dashboard-stat text-center">
                            <h3>${totalOrders}</h3>
                            <p>Total Orders</p>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="dashboard-stat text-center">
                            <h3>${pendingOrders}</h3>
                            <p>Pending Orders</p>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    refreshCurrentData() {
        // Refresh current page data
        if (window.location.pathname.includes('dashboard')) {
            this.loadDashboardData();
        }
    }

    showLoading(element) {
        const button = element.querySelector('button[type="submit"]');
        if (button) {
            button.disabled = true;
            button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Loading...';
        }
    }

    hideLoading(element) {
        const button = element.querySelector('button[type="submit"]');
        if (button) {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || 'Submit';
        }
    }

    showPageLoading() {
        const loader = document.createElement('div');
        loader.id = 'page-loader';
        loader.innerHTML = '<div class="spinner"></div>';
        loader.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255,255,255,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        `;
        document.body.appendChild(loader);
    }

    hidePageLoading() {
        const loader = document.getElementById('page-loader');
        if (loader) loader.remove();
    }

    showMessage(message, type = 'info') {
        // Remove existing messages
        const existing = document.querySelectorAll('.alert-message');
        existing.forEach(el => el.remove());

        const alertClass = type === 'error' ? 'alert-danger' : 
                          type === 'success' ? 'alert-success' : 'alert-info';

        const alert = document.createElement('div');
        alert.className = `alert ${alertClass} alert-dismissible fade show alert-message`;
        alert.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1050; min-width: 300px;';
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(alert);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alert.parentElement) {
                alert.remove();
            }
        }, 5000);
    }

    // Utility methods
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES'
        }).format(amount);
    }

    formatDate(dateString) {
        return new Intl.DateTimeFormat('en-KE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(new Date(dateString));
    }

    formatDateTime(dateString) {
        return new Intl.DateTimeFormat('en-KE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(dateString));
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.agriApp = new AgriMarketplace();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgriMarketplace;
}
