const jwt = require('jsonwebtoken');
const { Student, Doctor, Admin } = require('../models');

const authenticateToken = async (req, res, next) => {
    // Get token from Authorization header or cookies
    const authHeader = req.headers['authorization'];
    const headerToken = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    const cookieToken = req.cookies?.token;

    const token = headerToken || cookieToken;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access token required'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Verify user still exists and is active
        let user = null;
        switch (decoded.role) {
            case 'student':
                user = await Student.findById(decoded.id).select('-password');
                break;
            case 'doctor':
                user = await Doctor.findById(decoded.id).select('-password');
                break;
            case 'admin':
            case 'super_admin':
                user = await Admin.findById(decoded.id).select('-password');
                break;
            default:
                return res.status(403).json({
                    success: false,
                    message: 'Invalid user role'
                });
        }

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'User not found or inactive'
            });
        }

        req.user = {
            id: user._id,
            role: decoded.role,
            email: user.email,
            name: user.name,
            permissions: user.permissions || []
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }

        return res.status(403).json({
            success: false,
            message: 'Invalid token'
        });
    }
};

const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const headerToken = authHeader && authHeader.split(' ')[1];
    const cookieToken = req.cookies?.token;

    const token = headerToken || cookieToken;

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            let user = null;
            switch (decoded.role) {
                case 'student':
                    user = await Student.findById(decoded.id).select('-password');
                    break;
                case 'doctor':
                    user = await Doctor.findById(decoded.id).select('-password');
                    break;
                case 'admin':
                case 'super_admin':
                    user = await Admin.findById(decoded.id).select('-password');
                    break;
            }

            if (user && user.isActive) {
                req.user = {
                    id: user._id,
                    role: decoded.role,
                    email: user.email,
                    name: user.name,
                    permissions: user.permissions || []
                };
            } else {
                req.user = null;
            }
        } catch (error) {
            req.user = null;
        }
    } else {
        req.user = null;
    }

    next();
};

// Role-based authorization middleware
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions'
            });
        }

        next();
    };
};

// Permission-based authorization middleware
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Super admin has all permissions
        if (req.user.role === 'super_admin') {
            return next();
        }

        // Check if user has the required permission
        if (!req.user.permissions.includes(permission)) {
            return res.status(403).json({
                success: false,
                message: `Permission '${permission}' required`
            });
        }

        next();
    };
};

// Check if user can access specific resource
const requireResourceAccess = (resourceType) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const { id } = req.params;

        try {
            switch (resourceType) {
                case 'student':
                    // Students can only access their own data
                    if (req.user.role === 'student' && req.user.id !== id) {
                        return res.status(403).json({
                            success: false,
                            message: 'Can only access your own data'
                        });
                    }
                    break;

                case 'group':
                    // Doctors can only access their assigned groups
                    if (req.user.role === 'doctor') {
                        const doctor = await Doctor.findById(req.user.id);
                        if (!doctor.assignedGroups.includes(id)) {
                            return res.status(403).json({
                                success: false,
                                message: 'Can only access assigned groups'
                            });
                        }
                    }
                    break;

                default:
                    break;
            }

            next();
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error checking resource access'
            });
        }
    };
};

module.exports = {
    authenticateToken,
    optionalAuth,
    requireRole,
    requirePermission,
    requireResourceAccess
};