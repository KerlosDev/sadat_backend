const { Department } = require('../models');
const { validationResult } = require('express-validator');

class DepartmentController {
    // Get all departments
    static async getAllDepartments(req, res) {
        try {
            const { page = 1, limit = 10, search = '' } = req.query;

            const query = search
                ? {
                    $or: [
                        { name: { $regex: search, $options: 'i' } },
                        { code: { $regex: search, $options: 'i' } }
                    ]
                }
                : {};

            const departments = await Department.find(query)
                .populate('groups')
                .populate('doctors')
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .sort({ name: 1 });

            const total = await Department.countDocuments(query);

            res.json({
                success: true,
                data: departments,
                pagination: {
                    page: parseInt(page),
                    pages: Math.ceil(total / limit),
                    total
                }
            });
        } catch (error) {
            console.error('Get departments error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching departments'
            });
        }
    }

    // Get department by ID
    static async getDepartmentById(req, res) {
        try {
            const department = await Department.findById(req.params.id)
                .populate('groups')
                .populate('doctors');

            if (!department) {
                return res.status(404).json({
                    success: false,
                    message: 'Department not found'
                });
            }

            res.json({
                success: true,
                data: department
            });
        } catch (error) {
            console.error('Get department error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching department'
            });
        }
    }

    // Create new department
    static async createDepartment(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { name, code, description } = req.body;

            // Check if department already exists
            const existingDepartment = await Department.findOne({
                $or: [{ name }, { code }]
            });

            if (existingDepartment) {
                return res.status(409).json({
                    success: false,
                    message: 'Department with this name or code already exists'
                });
            }

            const department = new Department({
                name,
                code: code.toUpperCase(),
                description
            });

            await department.save();

            res.status(201).json({
                success: true,
                message: 'Department created successfully',
                data: department
            });
        } catch (error) {
            console.error('Create department error:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating department'
            });
        }
    }

    // Update department
    static async updateDepartment(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { name, code, description } = req.body;

            // Check if another department exists with the same name or code
            const existingDepartment = await Department.findOne({
                $and: [
                    { _id: { $ne: req.params.id } },
                    { $or: [{ name }, { code }] }
                ]
            });

            if (existingDepartment) {
                return res.status(409).json({
                    success: false,
                    message: 'Another department with this name or code already exists'
                });
            }

            const department = await Department.findByIdAndUpdate(
                req.params.id,
                {
                    name,
                    code: code.toUpperCase(),
                    description
                },
                { new: true, runValidators: true }
            );

            if (!department) {
                return res.status(404).json({
                    success: false,
                    message: 'Department not found'
                });
            }

            res.json({
                success: true,
                message: 'Department updated successfully',
                data: department
            });
        } catch (error) {
            console.error('Update department error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating department'
            });
        }
    }

    // Delete department
    static async deleteDepartment(req, res) {
        try {
            const department = await Department.findById(req.params.id);

            if (!department) {
                return res.status(404).json({
                    success: false,
                    message: 'Department not found'
                });
            }

            // Check if department has groups or doctors
            const { Group, Doctor } = require('../models');
            const groupCount = await Group.countDocuments({ department: req.params.id });
            const doctorCount = await Doctor.countDocuments({ department: req.params.id });

            if (groupCount > 0 || doctorCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete department that has groups or doctors assigned'
                });
            }

            await Department.findByIdAndDelete(req.params.id);

            res.json({
                success: true,
                message: 'Department deleted successfully'
            });
        } catch (error) {
            console.error('Delete department error:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting department'
            });
        }
    }

    // Get department statistics
    static async getDepartmentStats(req, res) {
        try {
            const { Group, Doctor, Student } = require('../models');
            const departmentId = req.params.id;

            const [groupCount, doctorCount, studentCount] = await Promise.all([
                Group.countDocuments({ department: departmentId }),
                Doctor.countDocuments({ department: departmentId }),
                Student.countDocuments({ department: departmentId })
            ]);

            res.json({
                success: true,
                data: {
                    groups: groupCount,
                    doctors: doctorCount,
                    students: studentCount
                }
            });
        } catch (error) {
            console.error('Get department stats error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching department statistics'
            });
        }
    }
}

module.exports = DepartmentController;