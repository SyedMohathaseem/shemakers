/* ============================================
   SheMakers — Authentication Module
   ============================================ */

const Auth = (() => {
  const SESSION_KEY = 'shemakers_user';

  // ---------- SHA-256 Hashing ----------
  async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ---------- Signup ----------
  async function signup({ name, phone, password, role, isWomanSeller }) {
    // Validate
    if (!name || !phone || !password || !role) {
      throw new Error('All fields are required');
    }
    if (phone.length < 10) {
      throw new Error('Enter a valid phone number');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    if (role === 'seller' && !isWomanSeller) {
      throw new Error('Seller account is currently available only for women entrepreneurs');
    }

    // Check phone uniqueness
    const existing = await db.collection('users')
      .where('phone', '==', phone)
      .get();

    if (!existing.empty) {
      throw new Error('Phone number is already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user doc
    const userRef = db.collection('users').doc();
    const userData = {
      id: userRef.id,
      name: name.trim(),
      phone: phone.trim(),
      passwordHash,
      role,
      isWomanSeller: role === 'seller' ? true : false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await userRef.set(userData);

    // Save session (exclude hash)
    const session = {
      id: userRef.id,
      name: userData.name,
      phone: userData.phone,
      role: userData.role,
      isWomanSeller: userData.isWomanSeller
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));

    return session;
  }

  // ---------- Login ----------
  async function login(phone, password) {
    if (!phone || !password) {
      throw new Error('Phone and password are required');
    }

    const snapshot = await db.collection('users')
      .where('phone', '==', phone.trim())
      .get();

    if (snapshot.empty) {
      throw new Error('No account found with this phone number');
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    if (userData.role === 'seller' && !userData.isWomanSeller) {
      throw new Error('Seller access is restricted. Please contact support.');
    }

    // Compare hash
    const passwordHash = await hashPassword(password);
    if (passwordHash !== userData.passwordHash) {
      throw new Error('Incorrect password');
    }

    // Save session
    const session = {
      id: userData.id,
      name: userData.name,
      phone: userData.phone,
      role: userData.role,
      isWomanSeller: !!userData.isWomanSeller
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));

    return session;
  }

  // ---------- Logout ----------
  function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'login.html';
  }

  // ---------- Get Current User ----------
  function getCurrentUser() {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  }

  // ---------- Update Current Session User ----------
  function updateCurrentUser(patch = {}) {
    const current = getCurrentUser();
    if (!current) return null;

    const updated = { ...current, ...patch };
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    return updated;
  }

  // ---------- Auth Guard ----------
  function requireAuth(requiredRole) {
    const user = getCurrentUser();
    if (!user) {
      window.location.href = 'login.html';
      return null;
    }
    if (requiredRole && user.role !== requiredRole) {
      window.location.href = 'index.html';
      return null;
    }
    if (requiredRole === 'seller' && !user.isWomanSeller) {
      window.location.href = 'index.html';
      return null;
    }
    return user;
  }

  // ---------- Update Navbar for Auth State ----------
  function updateNavAuth() {
    const user = getCurrentUser();
    const navUser = document.getElementById('navUser');
    const navAuth = document.getElementById('navAuth');

    if (!navUser || !navAuth) return;

    if (user) {
      navAuth.style.display = 'none';
      navUser.style.display = 'flex';

      const profileLink = navUser.querySelector('.nav-profile-link');
      const avatarImage = navUser.querySelector('.nav-profile-avatar-image');
      const avatarInitial = navUser.querySelector('.nav-profile-avatar-initial');

      if (profileLink) {
        profileLink.href = user.id ? `profile.html?id=${user.id}` : 'profile.html';
        profileLink.setAttribute('aria-label', 'Open profile');
      }

      if (avatarImage) {
        if (user.profileImageUrl) {
          avatarImage.src = user.profileImageUrl;
          avatarImage.style.display = 'block';
        } else {
          avatarImage.removeAttribute('src');
          avatarImage.style.display = 'none';
        }
      }

      if (avatarInitial) {
        avatarInitial.textContent = (user.name || 'U').charAt(0).toUpperCase();
        avatarInitial.style.display = user.profileImageUrl ? 'none' : 'grid';
      }

      const dashLink = navUser.querySelector('.nav-dash-link');
      if (dashLink) {
        dashLink.style.display = (user.role === 'seller' && user.isWomanSeller) ? 'inline-flex' : 'none';
      }
    } else {
      navAuth.style.display = 'flex';
      navUser.style.display = 'none';
    }
  }

  return { signup, login, logout, getCurrentUser, updateCurrentUser, requireAuth, updateNavAuth };
})();
