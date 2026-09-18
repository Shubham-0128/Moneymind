// ==========================================================================
// MoneyMind Authentication Engine
// Architectural Pattern: Provider / Adapter + Observer Pattern
// ==========================================================================

// --- Cryptographic Utilities (Web Crypto API) ---
// Native browser cryptographic primitives; no external dependencies.
const CryptoUtils = {
    // Convert ArrayBuffer to Hex String
    bufferToHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },

    // Convert Hex String to Uint8Array
    hexToBuffer(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        return bytes;
    },

    // Generate cryptographically random salt (16 bytes)
    generateSalt() {
        const salt = new Uint8Array(16);
        window.crypto.getRandomValues(salt);
        return this.bufferToHex(salt);
    },

    // Generate random 32-byte session token
    generateToken() {
        const token = new Uint8Array(32);
        window.crypto.getRandomValues(token);
        return this.bufferToHex(token);
    },

    // Derive PBKDF2 key using SHA-256 (100,000 iterations)
    async hashPassword(password, saltHex) {
        const encoder = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );

        const saltBuffer = this.hexToBuffer(saltHex);
        const derivedBits = await window.crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: saltBuffer,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            256 // 256 bits output
        );

        return this.bufferToHex(derivedBits);
    },

    // Constant-time string equality check to prevent timing attacks
    constantTimeCompare(a, b) {
        if (typeof a !== 'string' || typeof b !== 'string') return false;
        if (a.length !== b.length) return false;
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    }
};

// --- Storage Keys for Auth ---
const USERS_STORAGE_KEY = 'moneymind_users_db';
const SESSION_STORAGE_KEY = 'moneymind_active_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 Days session lifespan

// ==========================================================================
// AuthProvider: Strategy / Adapter Pattern
// Allows swapping local client-side crypto store with remote REST/JWT backend
// ==========================================================================

class WebCryptoAuthProvider {
    constructor() {
        this.initDemoUser();
    }

    // Pre-seed demo user so interviewers/testers can test in 1 click
    async initDemoUser() {
        const users = this._getUsers();
        const demoEmail = 'demo@moneymind.app';
        if (!users[demoEmail]) {
            const salt = CryptoUtils.generateSalt();
            const passwordHash = await CryptoUtils.hashPassword('Demo123!', salt);
            users[demoEmail] = {
                id: 'usr_demo_8821',
                name: 'Alex Morgan',
                email: demoEmail,
                salt,
                passwordHash,
                createdAt: new Date('2026-01-01').toISOString(),
                isDemo: true
            };
            this._saveUsers(users);
        }
    }

    _getUsers() {
        try {
            return JSON.parse(localStorage.getItem(USERS_STORAGE_KEY)) || {};
        } catch {
            return {};
        }
    }

    _saveUsers(users) {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    }

    // Sanitize user: NEVER leak salt or passwordHash to application state
    _sanitizeUser(userRecord) {
        if (!userRecord) return null;
        const { salt, passwordHash, ...safeUser } = userRecord;
        return safeUser;
    }

    // Register new user
    async register({ name, email, password }) {
        const normalizedEmail = email.trim().toLowerCase();
        if (!name || name.trim().length < 2) {
            throw new Error('Name must be at least 2 characters long.');
        }
        if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            throw new Error('Please enter a valid email address.');
        }
        if (!password || password.length < 6) {
            throw new Error('Password must be at least 6 characters long.');
        }

        const users = this._getUsers();
        if (users[normalizedEmail]) {
            throw new Error('An account with this email already exists.');
        }

        const salt = CryptoUtils.generateSalt();
        const passwordHash = await CryptoUtils.hashPassword(password, salt);
        const newUser = {
            id: 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
            name: name.trim(),
            email: normalizedEmail,
            salt,
            passwordHash,
            createdAt: new Date().toISOString()
        };

        users[normalizedEmail] = newUser;
        this._saveUsers(users);

        const session = this._createSession(newUser);
        return { user: this._sanitizeUser(newUser), session };
    }

    // Authenticate user with password
    async login({ email, password }) {
        const normalizedEmail = email.trim().toLowerCase();
        const users = this._getUsers();
        const userRecord = users[normalizedEmail];

        if (!userRecord) {
            throw new Error('Invalid email or password.');
        }

        const candidateHash = await CryptoUtils.hashPassword(password, userRecord.salt);
        const isValid = CryptoUtils.constantTimeCompare(candidateHash, userRecord.passwordHash);

        if (!isValid) {
            throw new Error('Invalid email or password.');
        }

        const session = this._createSession(userRecord);
        return { user: this._sanitizeUser(userRecord), session };
    }

    // Verify persisted session token and check TTL expiration
    async verifySession(token) {
        if (!token) return null;
        try {
            const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);
            if (!rawSession) return null;
            const session = JSON.parse(rawSession);

            if (session.token !== token) return null;
            if (Date.now() > session.expiresAt) {
                this.logout();
                return null;
            }

            const users = this._getUsers();
            const userRecord = Object.values(users).find(u => u.id === session.userId);
            if (!userRecord) return null;

            return { user: this._sanitizeUser(userRecord), session };
        } catch {
            return null;
        }
    }

    _createSession(userRecord) {
        const session = {
            token: CryptoUtils.generateToken(),
            userId: userRecord.id,
            userEmail: userRecord.email,
            createdAt: Date.now(),
            expiresAt: Date.now() + SESSION_TTL_MS
        };
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        return session;
    }

    logout() {
        localStorage.removeItem(SESSION_STORAGE_KEY);
    }
}

// Production REST API Auth Provider
class RestApiAuthProvider {
    constructor(apiBaseUrl = '') {
        this.apiBaseUrl = apiBaseUrl || (window.location.port === '8000' ? '' : 'http://127.0.0.1:8000');
        this.fallbackProvider = new WebCryptoAuthProvider();
    }

    async register({ name, email, password }) {
        try {
            const res = await fetch(`${this.apiBaseUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || 'Registration failed.');
            }
            return this.login({ email, password });
        } catch (err) {
            if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
                console.warn('Backend REST API unreachable. Falling back to local WebCrypto store.');
                return this.fallbackProvider.register({ name, email, password });
            }
            throw err;
        }
    }

    async login({ email, password }) {
        try {
            const res = await fetch(`${this.apiBaseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || 'Invalid email or password.');
            }

            const session = {
                token: data.token,
                userId: data.user.id,
                userEmail: data.user.email,
                createdAt: Date.now(),
                expiresAt: Date.now() + SESSION_TTL_MS
            };
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
            return { user: data.user, session };
        } catch (err) {
            if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
                console.warn('Backend REST API unreachable. Falling back to local WebCrypto store.');
                return this.fallbackProvider.login({ email, password });
            }
            throw err;
        }
    }

    async verifySession(token) {
        if (!token) return null;
        try {
            const res = await fetch(`${this.apiBaseUrl}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                return this.fallbackProvider.verifySession(token);
            }
            const user = await res.json();
            const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);
            const session = rawSession ? JSON.parse(rawSession) : { token };
            return { user, session };
        } catch (err) {
            return this.fallbackProvider.verifySession(token);
        }
    }

    logout() {
        localStorage.removeItem(SESSION_STORAGE_KEY);
    }
}

// ==========================================================================
// AuthService: Singleton & Observer Pattern
// Coordinates state, session management, and UI reactivity
// ==========================================================================

class AuthService {
    constructor(provider = new WebCryptoAuthProvider()) {
        this.provider = provider;
        this.currentUser = null;
        this.currentSession = null;
        this.subscribers = [];
        this.initialized = false;
    }

    // Subscribe to auth state transitions
    onAuthStateChanged(callback) {
        this.subscribers.push(callback);
        if (this.initialized) {
            callback(this.currentUser);
        }
        return () => {
            this.subscribers = this.subscribers.filter(sub => sub !== callback);
        };
    }

    notifySubscribers() {
        for (const callback of this.subscribers) {
            try {
                callback(this.currentUser);
            } catch (err) {
                console.error('Auth subscriber error:', err);
            }
        }
    }

    // Initialize session from storage
    async init() {
        try {
            const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);
            if (rawSession) {
                const session = JSON.parse(rawSession);
                const result = await this.provider.verifySession(session.token);
                if (result) {
                    this.currentUser = result.user;
                    this.currentSession = result.session;
                } else {
                    this.currentUser = null;
                    this.currentSession = null;
                }
            }
        } catch (e) {
            console.error('Auth initialization error:', e);
            this.currentUser = null;
            this.currentSession = null;
        } finally {
            this.initialized = true;
            this.notifySubscribers();
        }
        return this.currentUser;
    }

    async register(name, email, password) {
        const result = await this.provider.register({ name, email, password });
        this.currentUser = result.user;
        this.currentSession = result.session;
        this.notifySubscribers();
        return this.currentUser;
    }

    async login(email, password) {
        const result = await this.provider.login({ email, password });
        this.currentUser = result.user;
        this.currentSession = result.session;
        this.notifySubscribers();
        return this.currentUser;
    }

    // Instant 1-Click Demo login for interviewers
    async loginDemo() {
        return this.login('demo@moneymind.app', 'Demo123!');
    }

    logout() {
        this.provider.logout();
        this.currentUser = null;
        this.currentSession = null;
        this.notifySubscribers();
    }

    isAuthenticated() {
        return !!this.currentUser;
    }

    getUser() {
        return this.currentUser;
    }
}

// Global Export
window.CryptoUtils = CryptoUtils;
window.WebCryptoAuthProvider = WebCryptoAuthProvider;
window.RestApiAuthProvider = RestApiAuthProvider;
window.AuthService = AuthService;
window.authService = new AuthService(new RestApiAuthProvider());
