const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { Student, Doctor, Admin } = require('../models');
const AuthService = require('../services/authService');
const QRService = require('../services/qrService');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
/* 
// Rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs for auth endpoints
    message: {
        error: 'Too many authentication attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
 */
// Validation middleware
const registerValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters'),
    body('role')
        .isIn(['student', 'doctor', 'admin'])
        .withMessage('Invalid role specified'),
];

const loginValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
];

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

// Register endpoint (Admin only for creating users)
router.post('/register',
   /*  authLimiter, */
    authenticateToken,
    requireRole('admin', 'super_admin'),
    registerValidation,
    handleValidationErrors,
    async (req, res) => {
        try {
            const { email, password, name, role, additionalData = {} } = req.body;

            // Check if user already exists in any collection
            const existingStudent = await Student.findOne({ email });
            const existingDoctor = await Doctor.findOne({ email });
            const existingAdmin = await Admin.findOne({ email });

            if (existingStudent || existingDoctor || existingAdmin) {
                return res.status(409).json({
                    success: false,
                    message: 'User already exists with this email'
                });
            }

            let newUser;

            switch (role) {
                case 'student':
                    // Generate unique student number and QR code
                    const studentNumber = `STU${Date.now()}`;
                    const qrData = QRService.generateStudentQRData(null, studentNumber);

                    newUser = new Student({
                        email,
                        password,
                        name,
                        studentNumber,
                        qrCode: qrData,
                        year: additionalData.year || 1,
                        department: additionalData.department,
                        group: additionalData.group,
                        profile: additionalData.profile || {}
                    });
                    break;

                case 'doctor':
                    newUser = new Doctor({
                        email,
                        password,
                        name,
                        department: additionalData.department,
                        assignedGroups: additionalData.assignedGroups || [],
                        profile: additionalData.profile || {}
                    });
                    break;

                case 'admin':
                    newUser = new Admin({
                        email,
                        password,
                        name,
                        role: additionalData.adminRole || 'admin',
                        permissions: additionalData.permissions || [],
                        profile: additionalData.profile || {}
                    });
                    break;

                default:
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid role specified'
                    });
            }

            await newUser.save();

            // Update QR code with actual student ID for students
            if (role === 'student') {
                const updatedQrData = QRService.generateStudentQRData(newUser._id, newUser.studentNumber);
                newUser.qrCode = updatedQrData;
                await newUser.save();
            }

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                user: {
                    id: newUser._id,
                    name: newUser.name,
                    email: newUser.email,
                    role: role,
                    ...(role === 'student' && { studentNumber: newUser.studentNumber }),
                }
            });

        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
);

// Login endpoint
router.post('/login',
    /* authLimiter, */
    loginValidation,
    handleValidationErrors,
    async (req, res) => {
        try {
            const { email, password, rememberMe = false } = req.body;

            // Find user in all collections
            let user = null;
            let userRole = null;
            let userModel = null;

            // Check Student collection
            user = await Student.findOne({ email });
            if (user) {
                userRole = 'student';
                userModel = Student;
            }

            // Check Doctor collection if not found
            if (!user) {
                user = await Doctor.findOne({ email });
                if (user) {
                    userRole = 'doctor';
                    userModel = Doctor;
                }
            }

            // Check Admin collection if still not found
            if (!user) {
                user = await Admin.findOne({ email });
                if (user) {
                    userRole = user.role; // admin or super_admin
                    userModel = Admin;
                }
            }

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }

            // Check if account is locked
            if (AuthService.isAccountLocked(user)) {
                return res.status(423).json({
                    success: false,
                    message: 'Account is temporarily locked due to multiple failed login attempts'
                });
            }

            // Check if account is active
            if (!user.isActive) {
                return res.status(401).json({
                    success: false,
                    message: 'Account is deactivated'
                });
            }

            // Compare password
            const isValidPassword = await user.comparePassword(password);

            if (!isValidPassword) {
                await AuthService.handleFailedLogin(userModel, user._id);
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }

            // Handle successful login
            await AuthService.handleSuccessfulLogin(userModel, user._id);

            // Create authentication response
            const authResponse = AuthService.createAuthResponse(user, userRole);

            // Set secure cookie
            const cookieOptions = AuthService.getCookieOptions(rememberMe);
            res.cookie('token', authResponse.token, cookieOptions);

            res.json(authResponse);

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
);

// Logout endpoint
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
    try {
        let user = null;

        switch (req.user.role) {
            case 'student':
                user = await Student.findById(req.user.id)
                    .populate('department', 'name code')
                    .populate('group', 'name code')
                    .select('-password');
                break;
            case 'doctor':
                user = await Doctor.findById(req.user.id)
                    .populate('department', 'name code')
                    .populate('assignedGroups', 'name code')
                    .select('-password');
                break;
            case 'admin':
            case 'super_admin':
                user = await Admin.findById(req.user.id).select('-password');
                break;
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: user
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Change password endpoint
router.post('/change-password',
    authenticateToken,
    [
        body('currentPassword').notEmpty().withMessage('Current password is required'),
        body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;

            let user = null;

            switch (req.user.role) {
                case 'student':
                    user = await Student.findById(req.user.id);
                    break;
                case 'doctor':
                    user = await Doctor.findById(req.user.id);
                    break;
                case 'admin':
                case 'super_admin':
                    user = await Admin.findById(req.user.id);
                    break;
            }

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Verify current password
            const isValidPassword = await user.comparePassword(currentPassword);
            if (!isValidPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Current password is incorrect'
                });
            }

            // Update password
            user.password = newPassword;
            await user.save();

            res.json({
                success: true,
                message: 'Password changed successfully'
            });

        } catch (error) {
            console.error('Change password error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
);

// Refresh token endpoint
router.post('/refresh-token', async (req, res) => {
    try {
        const refreshToken = req.body.refreshToken || req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token required'
            });
        }

        const decoded = AuthService.verifyToken(refreshToken);

        // Find user and generate new tokens
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

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token'
            });
        }

        const authResponse = AuthService.createAuthResponse(user, decoded.role);
        res.json(authResponse);

    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Invalid refresh token'
        });
    }
});

module.exports = router;