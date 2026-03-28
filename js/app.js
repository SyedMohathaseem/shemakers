/* ============================================
   SheMakers — App Utilities
   ============================================ */

const App = (() => {

  // ---------- Toast Notifications ----------
  function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ---------- Loading Spinner ----------
  function showSpinner(container) {
    container.innerHTML = `
      <div class="spinner-overlay">
        <div class="spinner"></div>
        <p class="spinner-text">Loading...</p>
      </div>
    `;
  }

  // ---------- Empty State ----------
  function showEmpty(container, message = 'Nothing here yet', sub = '') {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="10" y="18" width="60" height="50" rx="6"/>
          <path d="M10 30h60"/>
          <circle cx="40" cy="48" r="8"/>
          <path d="M36 48l3 3 5-6"/>
        </svg>
        <h3>${message}</h3>
        <p>${sub}</p>
      </div>
    `;
  }

  // ---------- Lazy Load Images ----------
  function initLazyLoad() {
    const images = document.querySelectorAll('img[data-src], video[data-src]');
    if (!images.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          el.src = el.dataset.src;
          el.removeAttribute('data-src');
          observer.unobserve(el);
        }
      });
    }, { rootMargin: '200px' });

    images.forEach(img => observer.observe(img));
  }

  // ---------- Animate In ----------
  function initAnimations() {
    const items = document.querySelectorAll('.animate-in');
    if (!items.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    items.forEach(item => observer.observe(item));
  }

  // ---------- Mobile Nav Toggle ----------
  function initMobileNav() {
    const toggle = document.getElementById('navToggle');
    const links = document.getElementById('navLinks');
    if (!toggle || !links) return;

    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
    });

    // Close on link click
    links.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => links.classList.remove('open'));
    });
  }

  // ---------- Mobile Bottom Navigation ----------
  function initMobileBottomNav() {
    const path = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (path === 'login.html' || path === 'signup.html') return;

    const user = (typeof Auth !== 'undefined' && Auth.getCurrentUser) ? Auth.getCurrentUser() : null;
    const profileHref = user ? `profile.html?id=${user.id}` : 'profile.html';
    const isSeller = !!(user && user.role === 'seller');

    const items = [
      {
        key: 'home',
        href: 'index.html',
        label: 'Home',
        icon: '<path d="M3 11.5L12 4l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-8.5z" />',
        active: path === 'index.html'
      },
      {
        key: 'feed',
        href: 'feed.html',
        label: 'Feed',
        icon: '<path d="M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zm0 5h14M9 4v16" />',
        active: path === 'feed.html'
      },
      {
        key: 'sell',
        href: isSeller ? 'dashboard.html' : 'signup.html',
        label: 'Sell',
        icon: '<path d="M12 5v14M5 12h14" />',
        active: path === 'dashboard.html' && isSeller
      },
      {
        key: 'dashboard',
        href: isSeller ? 'dashboard.html' : 'signup.html',
        label: 'Dashboard',
        icon: '<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" />',
        active: path === 'dashboard.html' && isSeller
      },
      {
        key: 'profile',
        href: profileHref,
        label: 'Profile',
        icon: '<circle cx="12" cy="8" r="3.25" /><path d="M5 20c.9-3.5 3.5-5 7-5s6.1 1.5 7 5" />',
        active: path === 'profile.html'
      }
    ];

    let nav = document.getElementById('mobileBottomNav');
    if (!nav) {
      nav = document.createElement('nav');
      nav.id = 'mobileBottomNav';
      nav.className = 'mobile-bottom-nav';
      document.body.appendChild(nav);
    }

    nav.innerHTML = items.map(item => `
      <a href="${item.href}" class="mobile-bottom-link ${item.active ? 'active' : ''} ${item.key === 'sell' ? 'is-emphasis' : ''}" data-key="${item.key}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          ${item.icon}
        </svg>
        <span>${item.label}</span>
      </a>
    `).join('');

    document.body.classList.add('has-mobile-bottom-nav');
  }

  // ---------- Format Price ----------
  function formatPrice(price) {
    return '₹' + Number(price).toLocaleString('en-IN');
  }

  // ---------- Time Ago ----------
  function timeAgo(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    const intervals = [
      { label: 'y', seconds: 31536000 },
      { label: 'mo', seconds: 2592000 },
      { label: 'd', seconds: 86400 },
      { label: 'h', seconds: 3600 },
      { label: 'm', seconds: 60 },
    ];
    for (const i of intervals) {
      const count = Math.floor(seconds / i.seconds);
      if (count >= 1) return `${count}${i.label} ago`;
    }
    return 'Just now';
  }

  // ---------- Init Common ----------
  function init() {
    initMobileNav();
    initMobileBottomNav();
    initAnimations();
    Auth.updateNavAuth();
  }

  return {
    showToast, showSpinner, showEmpty,
    initLazyLoad, initAnimations, initMobileNav, initMobileBottomNav,
    formatPrice, timeAgo, init
  };
})();

// Auto-init on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
