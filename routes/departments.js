const express = require('express');
const { body } = require('express-validator');
const DepartmentController = require('../controllers/departmentController');
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const departmentValidation = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Department name must be between 2 and 100 characters'),
    body('code')
        .trim()
        .isLength({ min: 2, max: 10 })
        .withMessage('Department code must be between 2 and 10 characters')
        .isAlphanumeric()
        .withMessage('Department code must contain only letters and numbers'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must not exceed 500 characters')
];

// Routes
router.get('/',
    authenticateToken,
    DepartmentController.getAllDepartments
);

router.get('/:id',
    authenticateToken,
    DepartmentController.getDepartmentById
);

router.post('/',
    authenticateToken,
    requireRole('admin', 'super_admin'),
    departmentValidation,
    DepartmentController.createDepartment
);

router.put('/:id',
    authenticateToken,
    requireRole('admin', 'super_admin'),
    departmentValidation,
    DepartmentController.updateDepartment
);

router.delete('/:id',
    authenticateToken,
    requireRole('admin', 'super_admin'),
    DepartmentController.deleteDepartment
);

router.get('/:id/stats',
    authenticateToken,
    DepartmentController.getDepartmentStats
);

module.exports = router;