// Theme Management
class ThemeManager {
    constructor() {
        this.currentTheme = this.getStoredTheme() || 'dark';
        this.themeToggle = document.getElementById('theme-toggle');
        this.themeIcon = this.themeToggle?.querySelector('.theme-icon');
        
        this.init();
    }

    init() {
        // Set initial theme
        this.setTheme(this.currentTheme, false);
        
        // Add event listener for theme toggle
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Listen for system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!this.getStoredTheme()) {
                    this.setTheme(e.matches ? 'dark' : 'light', true);
                }
            });
        }
    }

    getStoredTheme() {
        try {
            return localStorage.getItem('chainxchange-theme');
        } catch (e) {
            console.warn('Unable to access localStorage for theme preference');
            return null;
        }
    }

    setStoredTheme(theme) {
        try {
            localStorage.setItem('chainxchange-theme', theme);
        } catch (e) {
            console.warn('Unable to save theme preference to localStorage');
        }
    }

    setTheme(theme, store = true) {
        this.currentTheme = theme;
        document.body.setAttribute('data-theme', theme);
        
        if (store) {
            this.setStoredTheme(theme);
        }

        this.updateThemeIcon();
        this.dispatchThemeChange();
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    updateThemeIcon() {
        if (!this.themeIcon) return;

        this.themeIcon.className = this.currentTheme === 'dark' 
            ? 'theme-icon fas fa-sun' 
            : 'theme-icon fas fa-moon';
    }

    dispatchThemeChange() {
        const event = new CustomEvent('themeChanged', {
            detail: { theme: this.currentTheme }
        });
        document.dispatchEvent(event);
    }

    getCurrentTheme() {
        return this.currentTheme;
    }
}

// Initialize theme manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}