const express = require('express');
const { body } = require('express-validator');
const AttendanceController = require('../controllers/attendanceController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const recordAttendanceValidation = [
    body('studentId')
        .isMongoId()
        .withMessage('Valid student ID is required'),
    body('groupId')
        .isMongoId()
        .withMessage('Valid group ID is required'),
    body('status')
        .isIn(['present', 'absent', 'late', 'excused'])
        .withMessage('Status must be one of: present, absent, late, excused'),
    body('lectureDate')
        .isISO8601()
        .withMessage('Valid lecture date is required'),
    body('notes')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Notes must not exceed 500 characters')
];

const scanQRValidation = [
    body('qrData')
        .notEmpty()
        .withMessage('QR data is required'),
    body('groupId')
        .isMongoId()
        .withMessage('Valid group ID is required')
];

const bulkAttendanceValidation = [
    body('groupId')
        .isMongoId()
        .withMessage('Valid group ID is required'),
    body('lectureDate')
        .isISO8601()
        .withMessage('Valid lecture date is required'),
    body('attendanceList')
        .isArray()
        .withMessage('Attendance list must be an array'),
    body('attendanceList.*.studentId')
        .isMongoId()
        .withMessage('Valid student ID is required for each entry'),
    body('attendanceList.*.status')
        .isIn(['present', 'absent', 'late', 'excused'])
        .withMessage('Valid status is required for each entry')
];

// Routes

// QR Code scanning
router.post('/scan',
    authenticateToken,
    requireRole('doctor', 'admin', 'super_admin'),
    scanQRValidation,
    AttendanceController.scanQRCode
);

// Manual attendance recording
router.post('/record',
    authenticateToken,
    requireRole('doctor', 'admin', 'super_admin'),
    recordAttendanceValidation,
    AttendanceController.recordAttendance
);

// Bulk attendance recording
router.post('/bulk-record',
    authenticateToken,
    requireRole('doctor', 'admin', 'super_admin'),
    bulkAttendanceValidation,
    AttendanceController.bulkRecordAttendance
);

// Get attendance records
router.get('/',
    authenticateToken,
    AttendanceController.getAttendanceRecords
);

// Update attendance record
router.put('/:id',
    authenticateToken,
    requireRole('doctor', 'admin', 'super_admin'),
    [
        body('status')
            .optional()
            .isIn(['present', 'absent', 'late', 'excused'])
            .withMessage('Status must be one of: present, absent, late, excused'),
        body('notes')
            .optional()
            .trim()
            .isLength({ max: 500 })
            .withMessage('Notes must not exceed 500 characters')
    ],
    AttendanceController.updateAttendance
);

// Delete attendance record
router.delete('/:id',
    authenticateToken,
    requireRole('doctor', 'admin', 'super_admin'),
    AttendanceController.deleteAttendance
);

// Get attendance statistics
router.get('/stats',
    authenticateToken,
    AttendanceController.getAttendanceStats
);

module.exports = router;