const express = require('express');
const { body } = require('express-validator');
const StudentController = require('../controllers/studentController');
const { authenticateToken, requireRole, requireResourceAccess } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const studentValidation = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Student name must be between 2 and 100 characters'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    body('password')
        .optional()
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    body('year')
        .isInt({ min: 1, max: 6 })
        .withMessage('Year must be between 1 and 6'),
    body('department')
        .isMongoId()
        .withMessage('Valid department ID is required'),
    body('group')
        .isMongoId()
        .withMessage('Valid group ID is required')
];

const updateStudentValidation = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Student name must be between 2 and 100 characters'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    body('year')
        .isInt({ min: 1, max: 6 })
        .withMessage('Year must be between 1 and 6'),
    body('department')
        .isMongoId()
        .withMessage('Valid department ID is required'),
    body('group')
        .isMongoId()
        .withMessage('Valid group ID is required')
];

// Routes
router.get('/my-qr-code',
    authenticateToken,
    requireRole('student'),
    StudentController.getMyQRCode
);

router.get('/',
    authenticateToken,
    requireRole('admin', 'super_admin', 'doctor'),
    StudentController.getAllStudents
);

router.get('/:id',
    authenticateToken,
    requireResourceAccess('student'),
    StudentController.getStudentById
);

router.get('/:id/profile',
    authenticateToken,
    requireRole('admin', 'super_admin', 'doctor'),
    StudentController.getStudentProfile
);

router.post('/',
    authenticateToken,
    requireRole('admin', 'super_admin'),
    studentValidation,
    StudentController.createStudent
);

router.put('/:id',
    authenticateToken,
    requireRole('admin', 'super_admin'),
    updateStudentValidation,
    StudentController.updateStudent
);

router.delete('/:id',
    authenticateToken,
    requireRole('admin', 'super_admin'),
    StudentController.deleteStudent
);

router.get('/:id/qr-code',
    authenticateToken,
    requireResourceAccess('student'),
    StudentController.getStudentQRCode
);

router.get('/my-qr-code',
    authenticateToken,
    requireRole('student'),
    StudentController.getMyQRCode
);

router.post('/:id/regenerate-qr',
    authenticateToken,
    requireRole('admin', 'super_admin'),
    StudentController.regenerateQRCode
);

router.get('/:id/attendance',
    authenticateToken,
    requireResourceAccess('student'),
    StudentController.getStudentAttendance
);

module.exports = router;