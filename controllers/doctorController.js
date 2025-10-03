const { Doctor, Department, Group, Attendance } = require('../models');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

class DoctorController {
    // Get all doctors
    static async getAllDoctors(req, res) {
        try {
            const { page = 1, limit = 10, search = '', department = '' } = req.query;

            const query = {};

            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ];
            }

            if (department) query.department = department;

            const doctors = await Doctor.find(query)
                .populate('department', 'name code')
                .populate('assignedGroups', 'name code year')
                .select('-password')
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .sort({ name: 1 });

            const total = await Doctor.countDocuments(query);

            res.json({
                success: true,
                data: doctors,
                pagination: {
                    page: parseInt(page),
                    pages: Math.ceil(total / limit),
                    total
                }
            });
        } catch (error) {
            console.error('Get doctors error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching doctors'
            });
        }
    }

    // Get doctor by ID
    static async getDoctorById(req, res) {
        try {
            const doctor = await Doctor.findById(req.params.id)
                .populate('department', 'name code')
                .populate('assignedGroups', 'name code year')
                .select('-password');

            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor not found'
                });
            }

            res.json({
                success: true,
                data: doctor
            });
        } catch (error) {
            console.error('Get doctor error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching doctor'
            });
        }
    }

    // Create new doctor
    static async createDoctor(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { name, email, password, department, assignedGroups = [], profile = {} } = req.body;

            // Check if doctor already exists
            const existingDoctor = await Doctor.findOne({ email });
            if (existingDoctor) {
                return res.status(409).json({
                    success: false,
                    message: 'Doctor with this email already exists'
                });
            }

            const doctor = new Doctor({
                name,
                email,
                password,
                department,
                assignedGroups,
                profile
            });

            await doctor.save();

            const populatedDoctor = await Doctor.findById(doctor._id)
                .populate('department', 'name code')
                .populate('assignedGroups', 'name code')
                .select('-password');

            res.status(201).json({
                success: true,
                message: 'Doctor created successfully',
                data: populatedDoctor
            });
        } catch (error) {
            console.error('Create doctor error:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating doctor'
            });
        }
    }

    // Update doctor
    static async updateDoctor(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { name, email, department, assignedGroups, profile, isActive } = req.body;

            // Check if another doctor exists with the same email
            const existingDoctor = await Doctor.findOne({
                $and: [
                    { _id: { $ne: req.params.id } },
                    { email }
                ]
            });

            if (existingDoctor) {
                return res.status(409).json({
                    success: false,
                    message: 'Another doctor with this email already exists'
                });
            }

            const updateData = {
                name,
                email,
                department,
                assignedGroups,
                profile,
                ...(isActive !== undefined && { isActive })
            };

            const doctor = await Doctor.findByIdAndUpdate(
                req.params.id,
                updateData,
                { new: true, runValidators: true }
            )
                .populate('department', 'name code')
                .populate('assignedGroups', 'name code')
                .select('-password');

            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor not found'
                });
            }

            res.json({
                success: true,
                message: 'Doctor updated successfully',
                data: doctor
            });
        } catch (error) {
            console.error('Update doctor error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating doctor'
            });
        }
    }

    // Delete doctor
    static async deleteDoctor(req, res) {
        try {
            const doctor = await Doctor.findById(req.params.id);

            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor not found'
                });
            }

            // Check if doctor has attendance records
            const attendanceCount = await Attendance.countDocuments({ doctor: req.params.id });
            if (attendanceCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete doctor who has attendance records'
                });
            }

            await Doctor.findByIdAndDelete(req.params.id);

            res.json({
                success: true,
                message: 'Doctor deleted successfully'
            });
        } catch (error) {
            console.error('Delete doctor error:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting doctor'
            });
        }
    }

    // Assign groups to doctor
    static async assignGroups(req, res) {
        try {
            const { groupIds } = req.body;
            const doctorId = req.params.id;

            if (!Array.isArray(groupIds)) {
                return res.status(400).json({
                    success: false,
                    message: 'Group IDs must be an array'
                });
            }

            // Verify all groups exist
            const groupCount = await Group.countDocuments({ _id: { $in: groupIds } });
            if (groupCount !== groupIds.length) {
                return res.status(400).json({
                    success: false,
                    message: 'One or more groups not found'
                });
            }

            const doctor = await Doctor.findByIdAndUpdate(
                doctorId,
                { assignedGroups: groupIds },
                { new: true, runValidators: true }
            )
                .populate('department', 'name code')
                .populate('assignedGroups', 'name code year')
                .select('-password');

            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor not found'
                });
            }

            res.json({
                success: true,
                message: 'Groups assigned successfully',
                data: doctor
            });
        } catch (error) {
            console.error('Assign groups error:', error);
            res.status(500).json({
                success: false,
                message: 'Error assigning groups'
            });
        }
    }

    // Get doctor dashboard data
    static async getDoctorDashboard(req, res) {
        try {
            const doctorId = req.user.id;

            const doctor = await Doctor.findById(doctorId)
                .populate('assignedGroups', 'name code year');

            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor not found'
                });
            }

            const groupIds = doctor.assignedGroups.map(group => group._id);

            // Get statistics
            const [
                totalStudents,
                todayAttendance,
                weeklyStats,
                groupStats
            ] = await Promise.all([
                // Total students in assigned groups
                require('../models').Student.countDocuments({ group: { $in: groupIds } }),

                // Today's attendance
                Attendance.countDocuments({
                    doctor: doctorId,
                    lectureDate: {
                        $gte: new Date().setHours(0, 0, 0, 0),
                        $lt: new Date().setHours(23, 59, 59, 999)
                    }
                }),

                // Weekly attendance stats
                Attendance.aggregate([
                    {
                        $match: {
                            doctor: mongoose.Types.ObjectId(doctorId),
                            lectureDate: {
                                $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                            }
                        }
                    },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ]),

                // Group-wise attendance stats
                Attendance.aggregate([
                    {
                        $match: {
                            doctor: mongoose.Types.ObjectId(doctorId),
                            group: { $in: groupIds.map(id => mongoose.Types.ObjectId(id)) }
                        }
                    },
                    {
                        $group: {
                            _id: {
                                group: '$group',
                                status: '$status'
                            },
                            count: { $sum: 1 }
                        }
                    },
                    {
                        $lookup: {
                            from: 'groups',
                            localField: '_id.group',
                            foreignField: '_id',
                            as: 'groupInfo'
                        }
                    }
                ])
            ]);

            res.json({
                success: true,
                data: {
                    doctor: {
                        name: doctor.name,
                        email: doctor.email,
                        profile: doctor.profile,
                        assignedGroups: doctor.assignedGroups
                    },
                    statistics: {
                        totalStudents,
                        todayAttendance,
                        weeklyStats,
                        groupStats
                    }
                }
            });
        } catch (error) {
            console.error('Get doctor dashboard error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching dashboard data'
            });
        }
    }

    // Get doctor attendance records
    static async getDoctorAttendance(req, res) {
        try {
            const { page = 1, limit = 20, startDate, endDate, groupId, status } = req.query;
            const doctorId = req.user.role === 'doctor' ? req.user.id : req.params.doctorId;

            const query = { doctor: doctorId };

            if (groupId) query.group = groupId;
            if (status) query.status = status;

            if (startDate || endDate) {
                query.lectureDate = {};
                if (startDate) query.lectureDate.$gte = new Date(startDate);
                if (endDate) query.lectureDate.$lte = new Date(endDate);
            }

            const attendance = await Attendance.find(query)
                .populate('student', 'name studentNumber')
                .populate('group', 'name code')
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .sort({ lectureDate: -1 });

            const total = await Attendance.countDocuments(query);

            res.json({
                success: true,
                data: attendance,
                pagination: {
                    page: parseInt(page),
                    pages: Math.ceil(total / limit),
                    total
                }
            });
        } catch (error) {
            console.error('Get doctor attendance error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching attendance records'
            });
        }
    }
}

module.exports = DoctorController;