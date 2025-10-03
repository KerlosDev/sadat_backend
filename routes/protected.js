const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Protected route example - Dashboard data
router.get('/dashboard', authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: 'Welcome to your dashboard',
        data: {
            user: {
                id: req.user.id,
                email: req.user.email,
                name: req.user.name
            },
            stats: {
                totalLogins: Math.floor(Math.random() * 100),
                lastActivity: new Date().toISOString(),
                accountStatus: 'active'
            },
            notifications: [
                {
                    id: 1,
                    message: 'Welcome to Sadat System!',
                    type: 'info',
                    timestamp: new Date().toISOString()
                }
            ]
        }
    });
});

// Protected route example - User data
router.get('/user-data', authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: 'User data retrieved successfully',
        data: {
            user: {
                id: req.user.id,
                email: req.user.email,
                name: req.user.name,
                permissions: ['read', 'write'],
                preferences: {
                    theme: 'light',
                    language: 'en',
                    notifications: true
                }
            }
        }
    });
});

// Protected route example - Admin only (role-based access)
router.get('/admin', authenticateToken, (req, res) => {
    // In a real application, you would check user roles from database
    // For demo purposes, we'll check if user email contains 'admin'
    if (!req.user.email.includes('admin')) {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin privileges required.'
        });
    }

    res.json({
        success: true,
        message: 'Admin data retrieved successfully',
        data: {
            users: [
                { id: 1, email: 'user1@example.com', status: 'active' },
                { id: 2, email: 'user2@example.com', status: 'inactive' }
            ],
            systemStats: {
                totalUsers: 2,
                activeUsers: 1,
                serverUptime: process.uptime()
            }
        }
    });
});

// Protected route example - Create resource
router.post('/create-resource', authenticateToken, (req, res) => {
    const { name, description } = req.body;

    if (!name) {
        return res.status(400).json({
            success: false,
            message: 'Resource name is required'
        });
    }

    const resource = {
        id: Date.now().toString(),
        name,
        description: description || '',
        createdBy: req.user.id,
        createdAt: new Date().toISOString()
    };

    res.status(201).json({
        success: true,
        message: 'Resource created successfully',
        data: { resource }
    });
});

// Protected route example - Update resource
router.put('/update-resource/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name && !description) {
        return res.status(400).json({
            success: false,
            message: 'At least one field (name or description) is required'
        });
    }

    const updatedResource = {
        id,
        name: name || 'Existing name',
        description: description || 'Existing description',
        updatedBy: req.user.id,
        updatedAt: new Date().toISOString()
    };

    res.json({
        success: true,
        message: 'Resource updated successfully',
        data: { resource: updatedResource }
    });
});

// Protected route example - Delete resource
router.delete('/delete-resource/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    res.json({
        success: true,
        message: `Resource with ID ${id} deleted successfully`,
        data: {
            deletedId: id,
            deletedBy: req.user.id,
            deletedAt: new Date().toISOString()
        }
    });
});

module.exports = router;