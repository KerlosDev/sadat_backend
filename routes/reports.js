const express = require('express');
const ReportsController = require('../controllers/reportsController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Student attendance report
router.get('/student-attendance',
    authenticateToken,
    requireRole('admin', 'super_admin', 'doctor', 'student'),
    ReportsController.getStudentAttendanceReport
);

// Group attendance report
router.get('/group-attendance',
    authenticateToken,
    requireRole('admin', 'super_admin', 'doctor'),
    ReportsController.getGroupAttendanceReport
);

// Doctor attendance report
router.get('/doctor-attendance',
    authenticateToken,
    requireRole('admin', 'super_admin', 'doctor'),
    ReportsController.getDoctorAttendanceReport
);

// Department attendance report
router.get('/department-attendance',
    authenticateToken,
    requireRole('admin', 'super_admin'),
    ReportsController.getDepartmentAttendanceReport
);

// System overview
router.get('/overview',
    authenticateToken,
    requireRole('admin', 'super_admin'),
    ReportsController.getSystemOverview
);

module.exports = router;