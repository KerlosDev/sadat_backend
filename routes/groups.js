const express = require('express');
const { body } = require('express-validator');
const GroupController = require('../controllers/groupController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const groupValidation = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Group name must be between 2 and 100 characters'),
    body('code')
        .trim()
        .isLength({ min: 2, max: 20 })
        .withMessage('Group code must be between 2 and 20 characters'),
    body('department')
        .isMongoId()
        .withMessage('Valid department ID is required'),
    body('year')
        .isInt({ min: 1, max: 6 })
        .withMessage('Year must be between 1 and 6'),
    body('semester')
        .isInt({ min: 1, max: 2 })
        .withMessage('Semester must be 1 or 2'),
    body('capacity')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Capacity must be between 1 and 100')
];

// Routes
router.get('/',
    authenticateToken,
    GroupController.getAllGroups
);
router.get('/my-groups',
    authenticateToken,
    requireRole('doctor'),
    GroupController.getMyGroups
);

router.get('/doctor/:doctorId?',
    authenticateToken,
    GroupController.getDoctorGroups
);

router.get('/:id',
    authenticateToken,
    GroupController.getGroupById
);

router.post('/',
    authenticateToken,
    requireRole('admin', 'super_admin'),
    groupValidation,
    GroupController.createGroup
);

router.put('/:id',
    authenticateToken,
    requireRole('admin', 'super_admin'),
    groupValidation,
    GroupController.updateGroup
);

router.delete('/:id',
    authenticateToken,
    requireRole('admin', 'super_admin'),
    GroupController.deleteGroup
);

router.get('/:id/stats',
    authenticateToken,
    GroupController.getGroupStats
);

module.exports = router;