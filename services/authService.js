const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

class AuthService {
    // Generate JWT token
    static generateToken(payload) {
        return jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        });
    }

    // Generate refresh token (longer expiry)
    static generateRefreshToken(payload) {
        return jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: '30d',
        });
    }

    // Verify JWT token
    static verifyToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            throw new Error('Invalid token');
        }
    }

    // Hash password
    static async hashPassword(password) {
        const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
        return await bcrypt.hash(password, saltRounds);
    }

    // Compare password
    static async comparePassword(password, hashedPassword) {
        return await bcrypt.compare(password, hashedPassword);
    }

    // Generate secure cookie options
    static getCookieOptions(rememberMe = false) {
        return {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000, // 30 days or 7 days
        };
    }

    // Create authentication response
    static createAuthResponse(user, role) {
        const tokenPayload = {
            id: user._id,
            email: user.email,
            role: role,
        };

        const token = this.generateToken(tokenPayload);
        const refreshToken = this.generateRefreshToken(tokenPayload);

        return {
            success: true,
            message: 'Authentication successful',
            token,
            refreshToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: role,
                permissions: user.permissions || [],
                profile: user.profile,
            },
        };
    }

    // Validate password strength
    static validatePassword(password) {
        const minLength = 6;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasNonalphas = /\W/.test(password);

        const errors = [];

        if (password.length < minLength) {
            errors.push(`Password must be at least ${minLength} characters long`);
        }

        if (!hasUpperCase) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (!hasLowerCase) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (!hasNumbers) {
            errors.push('Password must contain at least one number');
        }

        return {
            isValid: errors.length === 0,
            errors,
            strength: this.calculatePasswordStrength(password),
        };
    }

    // Calculate password strength
    static calculatePasswordStrength(password) {
        let score = 0;

        if (password.length >= 8) score += 1;
        if (password.length >= 12) score += 1;
        if (/[a-z]/.test(password)) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/[0-9]/.test(password)) score += 1;
        if (/[^A-Za-z0-9]/.test(password)) score += 1;

        if (score < 3) return 'weak';
        if (score < 5) return 'medium';
        return 'strong';
    }

    // Generate secure random password
    static generateSecurePassword(length = 12) {
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let password = '';

        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }

        return password;
    }

    // Check if user account is locked
    static isAccountLocked(user) {
        if (!user.loginAttempts || !user.lockUntil) return false;
        return user.loginAttempts >= 5 && user.lockUntil > Date.now();
    }

    // Handle failed login attempt
    static async handleFailedLogin(userModel, userId) {
        const user = await userModel.findById(userId);
        if (!user) return;

        if (!user.loginAttempts) user.loginAttempts = 0;
        user.loginAttempts += 1;

        // Lock account after 5 failed attempts for 30 minutes
        if (user.loginAttempts >= 5) {
            user.lockUntil = Date.now() + 30 * 60 * 1000; // 30 minutes
        }

        await user.save();
    }

    // Handle successful login
    static async handleSuccessfulLogin(userModel, userId) {
        const user = await userModel.findById(userId);
        if (!user) return;

        user.loginAttempts = 0;
        user.lockUntil = undefined;
        user.lastLoginAt = new Date();

        await user.save();
    }
}

module.exports = AuthService;