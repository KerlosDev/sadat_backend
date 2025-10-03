const { Group, Department, Student, Doctor } = require('../models');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

class GroupController {
    // Get all groups
    static async getAllGroups(req, res) {
        try {
            const { page = 1, limit = 10, search = '', department = '', year = '' } = req.query;

            const query = {};

            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { code: { $regex: search, $options: 'i' } }
                ];
            }

            if (department) query.department = department;
            if (year) query.year = parseInt(year);

            const groups = await Group.find(query)
                .populate('department', 'name code')
                .populate('students')
                .populate('assignedDoctors', 'name email')
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .sort({ name: 1 });

            const total = await Group.countDocuments(query);

            res.json({
                success: true,
                data: groups,
                pagination: {
                    page: parseInt(page),
                    pages: Math.ceil(total / limit),
                    total
                }
            });
        } catch (error) {
            console.error('Get groups error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching groups'
            });
        }
    }

    // Get group by ID
    static async getGroupById(req, res) {
        try {
            const group = await Group.findById(req.params.id)
                .populate('department', 'name code')
                .populate('students', 'name studentNumber email')
                .populate('assignedDoctors', 'name email profile.title');

            if (!group) {
                return res.status(404).json({
                    success: false,
                    message: 'Group not found'
                });
            }

            res.json({
                success: true,
                data: group
            });
        } catch (error) {
            console.error('Get group error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching group'
            });
        }
    }

    // Create new group
    static async createGroup(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { name, code, department, year, semester, capacity, doctor, selectedStudents } = req.body;

            // Check if group already exists
            const existingGroup = await Group.findOne({
                $or: [{ code }, { name, department, year }]
            });

            if (existingGroup) {
                return res.status(409).json({
                    success: false,
                    message: 'Group with this code or name already exists in the department'
                });
            }

            const group = new Group({
                name,
                code: code.toUpperCase(),
                department,
                year,
                semester,
                capacity
            });

            await group.save();

            // Handle doctor assignment
            if (doctor && doctor.trim() !== '') {
                await Doctor.findByIdAndUpdate(
                    doctor,
                    { $addToSet: { assignedGroups: group._id } }
                );
            }

            // Handle student assignments
            if (selectedStudents && Array.isArray(selectedStudents) && selectedStudents.length > 0) {
                await Student.updateMany(
                    { _id: { $in: selectedStudents } },
                    { group: group._id }
                );
            }

            const populatedGroup = await Group.findById(group._id)
                .populate('department', 'name code')
                .populate('assignedDoctors', 'name email')
                .populate('students', 'name studentNumber');

            res.status(201).json({
                success: true,
                message: 'Group created successfully',
                data: populatedGroup
            });
        } catch (error) {
            console.error('Create group error:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating group'
            });
        }
    }

    // Update group
    static async updateGroup(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { name, code, department, year, semester, capacity, doctor, selectedStudents } = req.body;

            // Check if another group exists with the same code or name
            const existingGroup = await Group.findOne({
                $and: [
                    { _id: { $ne: req.params.id } },
                    { $or: [{ code }, { name, department, year }] }
                ]
            });

            if (existingGroup) {
                return res.status(409).json({
                    success: false,
                    message: 'Another group with this code or name already exists'
                });
            }

            // Get current group to check previous doctor assignment
            const currentGroup = await Group.findById(req.params.id).populate('assignedDoctors');

            // Update the group
            const group = await Group.findByIdAndUpdate(
                req.params.id,
                {
                    name,
                    code: code.toUpperCase(),
                    department,
                    year,
                    semester,
                    capacity
                },
                { new: true, runValidators: true }
            ).populate('department', 'name code')
                .populate('assignedDoctors', 'name email');

            if (!group) {
                return res.status(404).json({
                    success: false,
                    message: 'Group not found'
                });
            }

            // Handle doctor assignment
            if (doctor !== undefined) {
                // Remove group from previous doctors' assignedGroups
                if (currentGroup.assignedDoctors && currentGroup.assignedDoctors.length > 0) {
                    await Doctor.updateMany(
                        { _id: { $in: currentGroup.assignedDoctors.map(d => d._id) } },
                        { $pull: { assignedGroups: req.params.id } }
                    );
                }

                // Add group to new doctor's assignedGroups (if doctor is selected)
                if (doctor && doctor.trim() !== '') {
                    await Doctor.findByIdAndUpdate(
                        doctor,
                        { $addToSet: { assignedGroups: req.params.id } }
                    );
                }
            }

            // Handle student assignments
            if (selectedStudents !== undefined && Array.isArray(selectedStudents)) {
                // Remove this group from all students first
                await Student.updateMany(
                    { group: req.params.id },
                    { $unset: { group: 1 } }
                );

                // Assign selected students to this group
                if (selectedStudents.length > 0) {
                    await Student.updateMany(
                        { _id: { $in: selectedStudents } },
                        { group: req.params.id }
                    );
                }
            }

            // Get the updated group with all populated fields
            const updatedGroup = await Group.findById(req.params.id)
                .populate('department', 'name code')
                .populate('assignedDoctors', 'name email')
                .populate('students', 'name studentNumber');

            res.json({
                success: true,
                message: 'Group updated successfully',
                data: updatedGroup
            });
        } catch (error) {
            console.error('Update group error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating group'
            });
        }
    }

    // Delete group
    static async deleteGroup(req, res) {
        try {
            const group = await Group.findById(req.params.id);

            if (!group) {
                return res.status(404).json({
                    success: false,
                    message: 'Group not found'
                });
            }

            // Check if group has students
            const studentCount = await Student.countDocuments({ group: req.params.id });
            if (studentCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete group that has students assigned'
                });
            }

            // Remove group from doctors' assigned groups
            await Doctor.updateMany(
                { assignedGroups: req.params.id },
                { $pull: { assignedGroups: req.params.id } }
            );

            await Group.findByIdAndDelete(req.params.id);

            res.json({
                success: true,
                message: 'Group deleted successfully'
            });
        } catch (error) {
            console.error('Delete group error:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting group'
            });
        }
    }

    // Get group statistics
    static async getGroupStats(req, res) {
        try {
            const { Attendance } = require('../models');
            const groupId = req.params.id;

            const [studentCount, attendanceStats] = await Promise.all([
                Student.countDocuments({ group: groupId }),
                Attendance.aggregate([
                    { $match: { group: mongoose.Types.ObjectId(groupId) } },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ])
            ]);

            const statsObj = attendanceStats.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {});

            const totalLectures = attendanceStats.reduce((sum, stat) => sum + stat.count, 0);
            const presentCount = statsObj.present || 0;
            const attendancePercentage = totalLectures > 0 ? (presentCount / totalLectures) * 100 : 0;

            res.json({
                success: true,
                data: {
                    students: studentCount,
                    totalLectures,
                    attendanceStats: statsObj,
                    averageAttendance: Math.round(attendancePercentage * 100) / 100
                }
            });
        } catch (error) {
            console.error('Get group stats error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching group statistics'
            });
        }
    }

    // Get my groups (for authenticated doctor)
    static async getMyGroups(req, res) {
        try {
            const doctorId = req.user.id;

            const doctor = await Doctor.findById(doctorId)
                .populate({
                    path: 'assignedGroups',
                    populate: [
                        {
                            path: 'department',
                            select: 'name code'
                        },
                        {
                            path: 'students',
                            select: 'name studentNumber email'
                        }
                    ]
                });

            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor not found'
                });
            }

            res.json({
                success: true,
                data: doctor.assignedGroups,
                count: doctor.assignedGroups.length
            });
        } catch (error) {
            console.error('Get my groups error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching your groups'
            });
        }
    }

    // Get groups for doctor
    static async getDoctorGroups(req, res) {
        try {
            const doctorId = req.user.role === 'doctor' ? req.user.id : req.params.doctorId;

            const doctor = await Doctor.findById(doctorId)
                .populate({
                    path: 'assignedGroups',
                    populate: {
                        path: 'department',
                        select: 'name code'
                    }
                });

            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor not found'
                });
            }

            res.json({
                success: true,
                data: doctor.assignedGroups
            });
        } catch (error) {
            console.error('Get doctor groups error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching doctor groups'
            });
        }
    }
}

module.exports = GroupController;