const express = require('express');
const { body } = require('express-validator');
const DoctorController = require('../controllers/doctorController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const doctorValidation = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Doctor name must be between 2 and 100 characters'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    body('password')
        .optional()
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    body('department')
        .isMongoId()
        .withMessage('Valid department ID is required'),
    body('assignedGroups')
        .optional()
        .isArray()
        .withMessage('Assigned groups must be an array'),
    body('assignedGroups.*')
        .isMongoId()
        .withMessage('Each assigned group must be a valid ID')
];

const updateDoctorValidation = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Doctor name must be between 2 and 100 characters'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    body('department')
        .isMongoId()
        .withMessage('Valid department ID is required'),
    body('assignedGroups')
        .optional()
        .isArray()
        .withMessage('Assigned groups must be an array'),
    body('assignedGroups.*')
        .isMongoId()
        .withMessage('Each assigned group must be a valid ID')
];

// Routes
router.get('/',
    authenticateToken,
    requireRole('admin', 'super_admin'),
    DoctorController.getAllDoctors
);

router.get('/dashboard',
    authenticateToken,
    requireRole('doctor'),
    DoctorController.getDoctorDashboard
);

router.get('/:id',
    authenticateToken,
    requireRole('admin', 'super_admin', 'doctor'),
    DoctorController.getDoctorById
);

router.post('/',
    authenticateToken,
    requireRole('admin', 'super_admin'),
    doctorValidation,
    DoctorController.createDoctor
);

router.put('/:id',
    authenticateToken,
    requireRole('admin', 'super_admin'),
    updateDoctorValidation,
    DoctorController.updateDoctor
);

router.delete('/:id',
    authenticateToken,
    requireRole('admin', 'super_admin'),
    DoctorController.deleteDoctor
);

router.post('/:id/assign-groups',
    authenticateToken,
    requireRole('admin', 'super_admin'),
    [
        body('groupIds')
            .isArray()
            .withMessage('Group IDs must be an array'),
        body('groupIds.*')
            .isMongoId()
            .withMessage('Each group ID must be valid')
    ],
    DoctorController.assignGroups
);

router.get('/:doctorId?/attendance',
    authenticateToken,
    requireRole('admin', 'super_admin', 'doctor'),
    DoctorController.getDoctorAttendance
);

module.exports = router;